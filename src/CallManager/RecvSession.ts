import { repeatedCallsAsync } from 'repeated-calls';

import { resolveRecvQuality } from './quality';

import type { TEffectiveQuality, TRecvQuality } from './quality';

type TConferenceNumber = string;

/** Максимальное количество попыток отправки offer при ошибках сети/сервера */
const SEND_OFFER_CALL_LIMIT = 10;
/** Задержка между повторными попытками отправки offer (мс) */
const SEND_OFFER_DELAY_BETWEEN_CALLS = 500;
/** Таймаут ожидания готовности peer connection (signalingState stable + connectionState ready) (мс) */
const PEER_CONNECTION_READY_TIMEOUT = 5000;

type TSendOfferParams = {
  quality: TEffectiveQuality;
  audioChannel: string;
};

type TConfigInput = {
  audioChannel: string;
  quality?: TRecvQuality;
  pcConfig?: RTCConfiguration;
};

type TConfig = TConfigInput & {
  quality: TRecvQuality;
  effectiveQuality: TEffectiveQuality;
};

type TCallParams = {
  conferenceNumber: TConferenceNumber;
  token: string;
};

type TLastCallParams = TCallParams;

export type TTools = {
  sendOffer: (
    params: TSendOfferParams & { conferenceNumber: TConferenceNumber; token: string },
    offer: RTCSessionDescriptionInit,
  ) => Promise<RTCSessionDescription>;
};

/**
 * Управляет входящей сессией WebRTC для приёма медиа-потоков.
 * Обеспечивает безопасное пересогласование (renegotiation) с защитой от race conditions.
 */
class RecvSession {
  /**
   * Текущая операция отправки offer с повторными попытками при ошибках.
   * Может быть отменена при новом renegotiate для предотвращения конфликтов.
   */
  private cancelableSendOfferWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<RTCSessionDescription, Error, false>>
    | undefined;

  /**
   * Промис текущего выполняющегося renegotiate.
   * Используется для сериализации: новый renegotiate ждёт завершения предыдущего,
   * чтобы избежать конфликтов состояний RTCPeerConnection.
   */
  private currentRenegotiation: Promise<boolean> | undefined;

  private readonly config: TConfig;

  private readonly tools: TTools;

  private readonly connection: RTCPeerConnection;

  private lastCallParams?: TLastCallParams;

  public constructor(config: TConfigInput, tools: TTools) {
    const quality = config.quality ?? 'auto';

    this.config = {
      ...config,
      quality,
      effectiveQuality: resolveRecvQuality(quality),
    };
    this.tools = tools;
    this.connection = new RTCPeerConnection(config.pcConfig);
    this.addTransceivers();
  }

  public get settings(): TConfig {
    return this.config;
  }

  public get peerConnection(): RTCPeerConnection {
    return this.connection;
  }

  public getQuality(): TRecvQuality {
    return this.config.quality;
  }

  public getEffectiveQuality(): TEffectiveQuality {
    return this.config.effectiveQuality;
  }

  /**
   * Устанавливает качество приёма медиа-потоков.
   * Пересогласовывает соединение только если изменилось effectiveQuality
   * (например, 'auto' -> 'high' не требует renegotiate, если effectiveQuality уже 'high').
   *
   * @param quality - запрошенное качество ('low' | 'medium' | 'high' | 'auto')
   * @returns true если качество изменилось, false если осталось прежним
   */
  public async setQuality(quality: TRecvQuality): Promise<boolean> {
    if (!this.lastCallParams) {
      return false;
    }

    const previousEffective = this.config.effectiveQuality;
    const previousQuality = this.config.quality;
    const effectiveQuality = resolveRecvQuality(quality);

    // Если качество не изменилось, ничего не делаем
    if (quality === previousQuality && effectiveQuality === previousEffective) {
      return false;
    }

    this.config.quality = quality;
    this.config.effectiveQuality = effectiveQuality;

    // Пересогласовываем только если изменилось effectiveQuality
    // (например, 'auto' -> 'high' не требует renegotiate, если effectiveQuality уже 'high')
    if (effectiveQuality !== previousEffective) {
      await this.renegotiate(this.lastCallParams);
    }

    return true;
  }

  public async applyQuality(quality: TRecvQuality): Promise<{
    applied: boolean;
    effectiveQuality: TEffectiveQuality;
  }> {
    const applied = await this.setQuality(quality);
    const effectiveQuality = this.getEffectiveQuality();

    return { applied, effectiveQuality };
  }

  public close(): void {
    this.cancelSendOfferWithRepeatedCalls();
    this.connection.close();
  }

  /**
   * Инициирует входящий вызов: пересогласовывает соединение и ждёт получения треков.
   * Выполняет renegotiate и waitForTracks параллельно для оптимизации времени ожидания.
   *
   * @param conferenceNumber - номер конференции
   * @param token - токен авторизации
   */
  public async call({ conferenceNumber, token }: TCallParams): Promise<boolean> {
    // Начинаем ожидание треков параллельно с renegotiate
    const tracksPromise = this.waitForTracks();

    const result = await this.renegotiate({ conferenceNumber, token });

    // Ждём получения всех необходимых треков (audio + video)
    await tracksPromise;

    return result;
  }

  /**
   * Пересогласовывает соединение с новыми параметрами качества.
   *
   * Алгоритм защиты от race conditions:
   * 1. Отменяет текущий sendOffer (если есть) - предотвращает конфликт offer'ов
   * 2. Ждёт завершения предыдущего renegotiate (если есть) - сериализация операций
   * 3. Выполняет новый renegotiate через performRenegotiate
   * 4. Очищает currentRenegotiation только если это всё ещё текущая операция
   *    (защита от случая, когда новый renegotiate начался до завершения текущего)
   *
   * @param conferenceNumber - номер конференции
   * @param token - токен авторизации
   * @returns true если пересогласование успешно
   */
  public async renegotiate({ conferenceNumber, token }: TCallParams): Promise<boolean> {
    this.lastCallParams = { conferenceNumber, token };

    // Отменяем текущий sendOffer, чтобы избежать конфликта с новым offer
    this.cancelSendOfferWithRepeatedCalls();

    const previous = this.currentRenegotiation;

    // Сериализация: ждём завершения предыдущего renegotiate перед началом нового
    // catch(() => {}) игнорирует ошибки предыдущего - они не должны блокировать новый renegotiate
    if (previous) {
      await previous.catch(() => {});
    }

    const current = this.performRenegotiate({ conferenceNumber, token });

    this.currentRenegotiation = current;

    try {
      return await current;
    } finally {
      // Очищаем currentRenegotiation только если это всё ещё текущая операция
      // Это защищает от случая, когда новый renegotiate начался до завершения текущего
      if (this.currentRenegotiation === current) {
        this.currentRenegotiation = undefined;
      }
    }
  }

  /**
   * Выполняет фактическое пересогласование соединения.
   *
   * Алгоритм:
   * 1. Rollback: если состояние 'have-local-offer' (после отмены предыдущего renegotiate),
   *    откатываем его в 'stable' для корректного старта нового negotiation
   * 2. Ждём stable state: гарантируем, что предыдущий setRemoteDescription завершён
   * 3. Создаём и устанавливаем новый offer
   * 4. Отправляем offer на сервер с повторными попытками при ошибках
   * 5. Устанавливаем полученный answer
   * 6. Ждём stable state: гарантируем, что setRemoteDescription полностью применён
   *    перед возвратом (важно для предотвращения зависания потоков)
   *
   * @param conferenceNumber - номер конференции
   * @param token - токен авторизации
   * @returns true при успешном пересогласовании
   */
  private async performRenegotiate({ conferenceNumber, token }: TCallParams): Promise<boolean> {
    // Если после отмены предыдущего renegotiate состояние застряло в 'have-local-offer',
    // откатываем его в 'stable' для корректного старта нового negotiation
    if (this.hasHaveLocalOfferSignalingState()) {
      await this.connection.setLocalDescription({ type: 'rollback' });
    }

    // Ждём готовности peer connection перед началом нового negotiation
    // Это гарантирует, что предыдущий setRemoteDescription полностью завершён
    await this.waitForPeerConnectionReady();

    const offer = await this.createOffer();

    const targetFunction = async (): Promise<RTCSessionDescription> => {
      return this.tools.sendOffer(
        {
          conferenceNumber,
          token,
          quality: this.config.effectiveQuality,
          audioChannel: this.config.audioChannel,
        },
        offer,
      );
    };

    const isComplete = (response: RTCSessionDescription | Error): boolean => {
      return !(response instanceof Error);
    };

    this.cancelableSendOfferWithRepeatedCalls = repeatedCallsAsync<
      RTCSessionDescription,
      Error,
      false
    >({
      targetFunction,
      isComplete,
      callLimit: SEND_OFFER_CALL_LIMIT,
      delay: SEND_OFFER_DELAY_BETWEEN_CALLS,
      isRejectAsValid: true,
      isCheckBeforeCall: false,
    });

    const result = await this.cancelableSendOfferWithRepeatedCalls
      .then((response) => {
        return response as RTCSessionDescription;
      })
      .finally(() => {
        this.cancelableSendOfferWithRepeatedCalls = undefined;
      });

    // Устанавливаем полученный answer от сервера
    await this.setRemoteDescription(result);

    // КРИТИЧНО: ждём готовности peer connection перед возвратом
    // Это гарантирует, что setRemoteDescription полностью применён и RTCPeerConnection
    // готов к приёму медиа-потоков. Без этого ожидания возможны зависания потоков
    // при быстрых последовательных вызовах setQuality -> renegotiate -> setRemoteDescription
    await this.waitForPeerConnectionReady();

    return true;
  }

  /**
   * Создаёт и устанавливает локальный offer для пересогласования.
   * После вызова signalingState переходит в 'have-local-offer'.
   *
   * @returns созданный offer для отправки на сервер
   */
  private async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.connection.createOffer();

    // Устанавливаем локальное описание - это переводит signalingState в 'have-local-offer'
    await this.connection.setLocalDescription(offer);

    return offer;
  }

  private async setRemoteDescription(description: RTCSessionDescription): Promise<void> {
    return this.connection.setRemoteDescription(description);
  }

  private hasStableSignalingState() {
    return this.connection.signalingState === 'stable';
  }

  /**
   * connectionState 'connected' — ICE соединение установлено (после setRemoteDescription).
   * connectionState 'new' — допустимо до первого negotiation (при начале performRenegotiate).
   */
  private hasReadyConnectionState() {
    const state = this.connection.connectionState;

    return state === 'connected' || state === 'new';
  }

  /** connectionState 'failed' или 'closed' — финальные ошибки, восстановление невозможно */
  private hasTerminalConnectionState() {
    const state = this.connection.connectionState;

    return state === 'failed' || state === 'closed';
  }

  private isStableAndReady() {
    return this.hasStableSignalingState() && this.hasReadyConnectionState();
  }

  private hasHaveLocalOfferSignalingState() {
    return this.connection.signalingState === 'have-local-offer';
  }

  /**
   * Ожидает перехода RTCPeerConnection в состояние 'stable' (signalingState) и готовности connectionState.
   *
   * connectionState 'connected' — ICE соединение установлено (после setRemoteDescription).
   * connectionState 'new' — допустимо до первого negotiation (при начале performRenegotiate).
   * connectionState 'failed' | 'closed' — немедленный reject, восстановление невозможно.
   * connectionState 'connecting' | 'disconnected' — ожидаем перехода в connected или таймаут.
   *
   * Используется для синхронизации операций пересогласования:
   * - В начале performRenegotiate: гарантирует завершение предыдущего setRemoteDescription
   * - В конце performRenegotiate: гарантирует применение setRemoteDescription и установку ICE-соединения
   *
   * Алгоритм:
   * 1. Если уже stable и ready — возвращаемся немедленно
   * 2. Если connectionState 'failed' или 'closed' — reject немедленно
   * 3. Подписываемся на signalingstatechange и connectionstatechange
   * 4. При достижении обоих условий — resolve
   * 5. При transition в failed/closed — reject
   * 6. При таймауте — reject
   *
   * @throws Error если состояния не достигнуты или connection перешёл в failed/closed
   */
  private async waitForPeerConnectionReady(): Promise<void> {
    if (this.isStableAndReady()) {
      return;
    }

    const getErrorByState = () => {
      const state = this.connection.connectionState;

      return new Error(`Peer connection in terminal state: ${state}. Recovery is not possible.`);
    };

    const check = (): 'loading' | 'success' | 'error' => {
      if (this.hasTerminalConnectionState()) {
        return 'error';
      }

      if (this.isStableAndReady()) {
        return 'success';
      }

      return 'loading';
    };

    if (check() === 'error') {
      throw getErrorByState();
    }

    return new Promise<void>((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout>;
      let isSettled = false;
      const resolveOnce = (): void => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        clearTimeout(timeout);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.connection.removeEventListener('signalingstatechange', checkAndResolve);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.connection.removeEventListener('connectionstatechange', checkAndResolve);
        resolve();
      };

      const rejectOnce = (error: Error): void => {
        /* istanbul ignore if: defensive guard, second caller after settle */
        if (isSettled) {
          return;
        }

        isSettled = true;
        clearTimeout(timeout);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.connection.removeEventListener('signalingstatechange', checkAndResolve);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.connection.removeEventListener('connectionstatechange', checkAndResolve);
        reject(error);
      };

      function checkAndResolve(): void {
        const result = check();

        if (result === 'error') {
          rejectOnce(getErrorByState());

          return;
        }

        if (result === 'success') {
          resolveOnce();
        }
      }

      timeout = setTimeout(() => {
        rejectOnce(
          new Error('Timed out waiting for stable signaling state and ready connection state'),
        );
      }, PEER_CONNECTION_READY_TIMEOUT);

      this.connection.addEventListener('signalingstatechange', checkAndResolve);
      this.connection.addEventListener('connectionstatechange', checkAndResolve);

      checkAndResolve();
    });
  }

  private async waitForTracks(): Promise<void> {
    return new Promise<void>((resolve) => {
      const receivedTracks = new Set<'audio' | 'video'>();
      const handler = (event: RTCTrackEvent): void => {
        const { track } = event;

        receivedTracks.add(track.kind as 'audio');

        if (receivedTracks.has('audio') && receivedTracks.has('video')) {
          this.connection.removeEventListener('track', handler);
          resolve();
        }
      };

      this.connection.addEventListener('track', handler);
    });
  }

  /**
   * Добавляет трансиверы для приёма медиа-потоков.
   * Структура: 1 аудио (основной) + 4 видео (1 основной + 3 для контента/презентации).
   */
  private addTransceivers(): void {
    this.addRecvOnlyTransceiver('audio'); // main
    this.addRecvOnlyTransceiver('video'); // main
    this.addRecvOnlyTransceiver('video'); // contented
    this.addRecvOnlyTransceiver('video'); // contented
    this.addRecvOnlyTransceiver('video'); // contented
  }

  private addRecvOnlyTransceiver(kind: 'audio' | 'video'): RTCRtpTransceiver {
    const init: RTCRtpTransceiverInit = {
      direction: 'recvonly',
    };

    return this.connection.addTransceiver(kind, init);
  }

  /**
   * Отменяет текущую операцию отправки offer с повторными попытками.
   * Используется при новом renegotiate для предотвращения конфликтов.
   */
  private cancelSendOfferWithRepeatedCalls(): void {
    this.cancelableSendOfferWithRepeatedCalls?.cancel();
  }
}

export default RecvSession;
