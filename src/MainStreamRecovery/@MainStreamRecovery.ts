import { CancelableRequest } from '@krivega/cancelable-promise';
import lodash from 'lodash';

import logger from '@/logger';

import type { CallManager } from '@/CallManager';

const DEFAULT_THROTTLE_RECOVERY_TIMEOUT_MS = 3000;

/**
 * Алгоритм восстановления "main stream":
 * 1) Внешний код вызывает `recover()`.
 * 2) Срабатывает throttling, чтобы не выполнять renegotiate слишком часто.
 * 3) `requestRenegotiate()` инициирует renegotiate через `CancelableRequest`.
 * 4) Если renegotiate уже выполняется (есть in-flight request), повторный вызов игнорируется.
 * 5) Успех/ошибка логируются (но recovery не меняет внешний state напрямую).
 * 6) Если сессия завершилась (`CallManager` -> событие `ended`), подписка отменяет throttling и отменяет in-flight renegotiate.
 */
class MainStreamRecovery {
  private readonly renegotiateRequester: CancelableRequest<void, boolean>;

  private readonly renegotiateThrottled: (() => void) & { cancel: () => void };

  private readonly callManager: CallManager;

  public constructor(
    callManager: CallManager,
    throttleRecoveryTimeout: number = DEFAULT_THROTTLE_RECOVERY_TIMEOUT_MS,
  ) {
    // `renegotiateRequester` инкапсулирует возможность отмены in-flight renegotiate.
    this.callManager = callManager;
    this.renegotiateRequester = new CancelableRequest(callManager.renegotiate.bind(callManager));

    // `renegotiateThrottled` ограничивает частоту вызовов `requestRenegotiate()`.
    this.renegotiateThrottled = lodash.throttle(
      this.requestRenegotiate.bind(this),
      throttleRecoveryTimeout,
    );

    // Подписываемся на завершение звонка, чтобы остановить попытки recovery.
    this.subscribe();
  }

  // Запускает recovery: фактически вызывает throttled-версию requestRenegotiate.
  public recover(): void {
    logger('trying to recover main stream');

    this.renegotiateThrottled();
  }

  // Выполняет renegotiate main media stream (если только он еще не выполняется).
  private readonly requestRenegotiate = () => {
    logger('trying to renegotiate');

    if (this.renegotiateRequester.requested) {
      logger('previous renegotiate is not finished yet');

      return;
    }

    // Инициируем renegotiate. Результат не меняет UI, только логирование.
    this.renegotiateRequester
      .request()
      .then(() => {
        logger('renegotiate has successful');
      })
      .catch((error: unknown) => {
        logger('failed to renegotiate main media stream', error);
      });
  };

  // На завершение вызова: отменяем throttling и (если есть) in-flight renegotiate.
  private subscribe() {
    this.callManager.on('ended', () => {
      this.cancel();
    });
  }

  // Останавливает дальнейшие попытки recovery.
  private cancel() {
    logger('cancel recover main stream');

    this.renegotiateThrottled.cancel();
    this.renegotiateRequester.cancelRequest();
  }
}

export default MainStreamRecovery;
