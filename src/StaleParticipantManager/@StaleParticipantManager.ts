import { DelayRequester } from '@krivega/timeout-requester';

import resolveDebug from '@/logger';

import type { CallManager } from '@/CallManager';
import type { TCallEndEvent } from '@/DisconnectCause';

const debug = resolveDebug('StaleParticipantManager');

const CONFIRM_INTERVAL_MS = 1000;

const CONFIRM_LIMIT_MS = 20_000;

const STALE_TTL_MS = 60_000;

const ENDPOINT = 'api/v2/participants/self/disconnect';

const normalizeServerUrl = (serverUrl: string): string => {
  return serverUrl.replace(/\/$/, '');
};

type TSlot = {
  token: string;
  sipServerUrl: string;
  // Время завершения звонка: подключение могло остаться на сервере.
  staleAt?: number;
};

type TCycle = {
  abortController: AbortController;
  delayRequester: DelayRequester;
  isLimitReached: boolean;
};

const interruptCycle = ({ abortController, delayRequester }: TCycle): void => {
  abortController.abort();
  delayRequester.cancelRequest();
};

/** `true` — сервер подтвердил отключение ответом 401: участника уже нет. */
const requestDisconnect = async (
  { sipServerUrl, token }: TSlot,
  signal: AbortSignal,
): Promise<boolean> => {
  const response = await fetch(`https://${sipServerUrl}/${ENDPOINT}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'same-origin',
    signal,
  });

  if (response.status === 401) {
    return true;
  }

  if (!response.ok) {
    throw new Error(`Stale participant disconnect failed with status ${response.status}`);
  }

  return false;
};

// 2xx подтверждает только приём команды: повторяем запрос, пока сервер не ответит 401.
const confirmDisconnect = async (slot: TSlot, cycle: TCycle): Promise<void> => {
  if (await requestDisconnect(slot, cycle.abortController.signal)) {
    return undefined;
  }

  // Прерывание между ответом и паузой иначе оставило бы таймер паузы.
  cycle.abortController.signal.throwIfAborted();
  await cycle.delayRequester.request();

  return confirmDisconnect(slot, cycle);
};

/** Запоминает подключение комнаты и перед исходящим звонком отключает его, если сервер мог его не снять. */
class StaleParticipantManager {
  private readonly getSipServerUrl: () => string | undefined;

  private slot?: TSlot;

  public constructor({
    callManager,
    getServerUrl,
  }: {
    callManager: CallManager;
    getServerUrl: () => string | undefined;
  }) {
    this.getSipServerUrl = getServerUrl;
    callManager.stateMachine.onInRoomCredentialsChange(this.handleInRoomCredentials);
    callManager.on('ended', this.handleCallTermination);
    callManager.on('failed', this.handleCallTermination);
    callManager.on('end-call', this.handleEndCall);
  }

  public async disconnectStale(signal: AbortSignal): Promise<void> {
    const { slot } = this;

    if (slot?.staleAt === undefined) {
      return;
    }

    // Дольше сервер устаревшего участника не держит.
    if (Date.now() - slot.staleAt > STALE_TTL_MS) {
      this.slot = undefined;

      return;
    }

    const serverUrl = this.getServerUrl();

    // Без конфигурации сервер соединения неизвестен: устаревший участник ждёт следующего звонка.
    if (serverUrl === undefined) {
      return;
    }

    // Устаревшего участника другого сервера тот сервер уберёт сам по своему таймауту.
    if (serverUrl !== slot.sipServerUrl) {
      this.slot = undefined;

      return;
    }

    debug('disconnectStale');

    const cycle: TCycle = {
      abortController: new AbortController(),
      delayRequester: new DelayRequester(CONFIRM_INTERVAL_MS),
      isLimitReached: false,
    };
    const handleAbort = (): void => {
      interruptCycle(cycle);
    };
    const limitTimeoutId = setTimeout(() => {
      cycle.isLimitReached = true;
      interruptCycle(cycle);
    }, CONFIRM_LIMIT_MS);

    signal.addEventListener('abort', handleAbort);

    try {
      await confirmDisconnect(slot, cycle);
    } catch (error) {
      signal.throwIfAborted();

      if (!cycle.isLimitReached) {
        throw error;
      }

      debug('disconnectStale: disconnect is not confirmed');
    } finally {
      clearTimeout(limitTimeoutId);
      signal.removeEventListener('abort', handleAbort);

      if (!signal.aborted && this.slot === slot) {
        this.slot = undefined;
      }
    }
  }

  private getServerUrl(): string | undefined {
    const sipServerUrl = this.getSipServerUrl();

    return sipServerUrl === undefined ? undefined : normalizeServerUrl(sipServerUrl);
  }

  private readonly handleInRoomCredentials = ({ token }: { token: string }): void => {
    const sipServerUrl = this.getServerUrl();

    this.slot = sipServerUrl === undefined ? undefined : { token, sipServerUrl };
  };

  private readonly handleCallTermination = ({ originator }: TCallEndEvent): void => {
    if (this.slot === undefined || this.slot.staleAt !== undefined) {
      return;
    }

    // Завершил сервер — он и снял подключение; иначе оно могло остаться на сервере.
    this.slot = originator === 'remote' ? undefined : { ...this.slot, staleAt: Date.now() };
  };

  private readonly handleEndCall = (): void => {
    if (this.slot !== undefined && this.slot.staleAt === undefined) {
      this.slot = { ...this.slot, staleAt: Date.now() };
    }
  };
}

export default StaleParticipantManager;
