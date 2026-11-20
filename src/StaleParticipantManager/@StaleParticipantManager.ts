import { DelayRequester } from '@krivega/timeout-requester';

import resolveDebug from '@/logger';
import { createCanceledError } from '@/utils/errors';

import type { CallManager } from '@/CallManager';
import type { TCallEndEvent } from '@/DisconnectCause';

const debug = resolveDebug('StaleParticipantManager');

export const REQUEST_TIMEOUT_MS = 10_000;

const CONFIRM_INTERVAL_MS = 1000;

const CONFIRM_LIMIT_MS = 15_000;

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
  isCanceled: boolean;
  isLimitReached: boolean;
};

const interruptCycle = ({ abortController, delayRequester }: TCycle): void => {
  abortController.abort();
  delayRequester.cancelRequest();
};

/** `true` — сервер подтвердил отключение ответом 401: участника уже нет. */
const requestDisconnect = async (
  { sipServerUrl, token }: TSlot,
  abortController: AbortController,
): Promise<boolean> => {
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${sipServerUrl}/${ENDPOINT}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'same-origin',
      signal: abortController.signal,
    });

    if (response.status === 401) {
      return true;
    }

    if (!response.ok) {
      throw new Error(`Stale participant disconnect failed with status ${response.status}`);
    }

    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};

// 2xx подтверждает только приём команды: повторяем запрос, пока сервер не ответит 401.
const confirmDisconnect = async (slot: TSlot, cycle: TCycle): Promise<void> => {
  if (await requestDisconnect(slot, cycle.abortController)) {
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

  private readonly unsubscribes: (() => void)[];

  private readonly cycles = new Set<TCycle>();

  private slot?: TSlot;

  public constructor({
    callManager,
    getServerUrl,
  }: {
    callManager: CallManager;
    getServerUrl: () => string | undefined;
  }) {
    this.getSipServerUrl = getServerUrl;
    this.unsubscribes = [
      callManager.stateMachine.onInRoomCredentialsChange(this.handleInRoomCredentials),
      callManager.on('ended', this.handleCallTermination),
      callManager.on('failed', this.handleCallTermination),
      callManager.on('end-call', this.handleEndCall),
    ];
  }

  public async disconnectStale(): Promise<void> {
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
      isCanceled: false,
      isLimitReached: false,
    };
    const limitTimeoutId = setTimeout(() => {
      cycle.isLimitReached = true;
      interruptCycle(cycle);
    }, CONFIRM_LIMIT_MS);

    this.cycles.add(cycle);

    try {
      await confirmDisconnect(slot, cycle);
    } catch (error) {
      if (cycle.isCanceled) {
        throw createCanceledError('StaleParticipantManager');
      }

      if (!cycle.isLimitReached) {
        throw error;
      }

      debug('disconnectStale: disconnect is not confirmed');
    } finally {
      clearTimeout(limitTimeoutId);
      this.cycles.delete(cycle);

      if (!cycle.isCanceled && this.slot === slot) {
        this.slot = undefined;
      }
    }
  }

  public cancel(): void {
    for (const cycle of this.cycles) {
      debug('cancel');

      cycle.isCanceled = true;
      interruptCycle(cycle);
    }
  }

  public stop(): void {
    this.cancel();
    this.unsubscribes.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.unsubscribes.length = 0;
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
