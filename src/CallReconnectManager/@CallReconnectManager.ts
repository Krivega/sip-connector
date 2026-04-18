import { EventEmitterProxy } from 'events-constructor';

import resolveDebug from '@/logger';
import { CallReconnectRuntime } from './CallReconnectRuntime';
import { createCallReconnectStateMachine, ECallReconnectStatus } from './CallReconnectStateMachine';
import { createMachineDeps } from './createMachineDeps';
import { createEvents } from './events';

import type { EndEvent } from '@krivega/jssip';
import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ICallReconnectStateMachine } from './CallReconnectStateMachine';
import type { TEventMap } from './events';
import type { ICallReconnectOptions, TCallRedialParameters, TCancelledReason } from './types';

const debug = resolveDebug('CallReconnectManager');

/**
 * Менеджер автоматического перезвона при сетевых обрывах звонка.
 *
 * Фасад управляет XState-машиной и подписками на `CallManager`/`ConnectionManager`.
 * Контракт:
 * - `arm()` — активирует наблюдение за сетевыми обрывами и запоминает параметры звонка.
 * - `disarm()` — отменяет текущую попытку (in-flight `startCall` + задержку) и уводит в `idle`.
 * - `forceReconnect()` — немедленный повтор даже после `limit-reached`.
 * - События фасада дублируются в `SipConnector` с префиксом `call-reconnect:*`.
 */
class CallReconnectManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: ICallReconnectStateMachine;

  private readonly runtime: CallReconnectRuntime;

  private readonly callManager: CallManager;

  private readonly connectionManager: ConnectionManager;

  private readonly unsubscribes: (() => void)[] = [];

  public constructor(
    {
      callManager,
      connectionManager,
    }: {
      callManager: CallManager;
      connectionManager: ConnectionManager;
    },
    options?: ICallReconnectOptions,
  ) {
    super(createEvents());

    this.callManager = callManager;
    this.connectionManager = connectionManager;

    this.runtime = new CallReconnectRuntime({
      callManager,
      connectionManager,
      options,
      emitters: {
        emitStatusChange: (payload) => {
          this.events.trigger('status-changed', payload);
        },
      },
    });

    this.stateMachine = createCallReconnectStateMachine(
      createMachineDeps({ runtime: this.runtime, events: this.events }),
    );

    this.subscribeToManagers();
  }

  public get isReconnecting(): boolean {
    return this.stateMachine.state !== ECallReconnectStatus.IDLE;
  }

  public get state(): ECallReconnectStatus {
    return this.stateMachine.state;
  }

  /**
   * Армирует менеджер: сохраняет параметры редиала и начинает слушать `call:failed` с сетевой причиной.
   *
   * Роль spectator не редиалим автоматически (это не наш сценарий), поэтому early-exit
   * с событием `cancelled('spectator-role')`.
   */
  public arm(parameters: TCallRedialParameters): void {
    debug('arm');

    if (this.callManager.hasSpectator()) {
      this.events.trigger('cancelled', { reason: 'spectator-role' });

      return;
    }

    this.stateMachine.send({ type: 'RECONNECT.ARM', parameters });
  }

  public disarm(reason: TCancelledReason = 'disarm'): void {
    debug('disarm', reason);

    this.stateMachine.send({ type: 'RECONNECT.DISARM', reason });
  }

  public forceReconnect(): void {
    debug('forceReconnect');

    this.stateMachine.send({ type: 'RECONNECT.FORCE' });
  }

  public cancelCurrentAttempt(): void {
    this.runtime.cancelAll();
  }

  public stop(): void {
    this.unsubscribes.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.unsubscribes.length = 0;
    this.runtime.cancelAll();
    this.stateMachine.stop();
  }

  private subscribeToManagers(): void {
    /**
     * Классификация JsSIP-событий `failed` / `ended`:
     *
     * - `failed` стреляет, если звонок НЕ успел установиться. Сетевые причины
     *   (`REQUEST_TIMEOUT`, `CONNECTION_ERROR`, `ADDRESS_INCOMPLETE`, system `INTERNAL_ERROR`) —
     *   кандидат на редиал. Остальные (`BUSY`, `REJECTED`, `USER_DENIED_MEDIA_ACCESS`, …) — бизнес/user,
     *   редиалить бессмысленно — разоружаем менеджер.
     * - `ended` стреляет, если УЖЕ установленный звонок завершился. Сетевые причины
     *   (`RTP_TIMEOUT`, `CONNECTION_ERROR` в середине звонка) — это как раз сценарий редиала.
     *   Нормальные (`BYE`, `CANCELED`, локальный hangUp) — штатное окончание, разоружаем.
     *
     * Решение о сетевой природе принимает `isNetworkFailurePolicy` (кастомизируется через
     * `options.isNetworkFailure`), поэтому маршрутизация живёт в единой точке.
     */
    const routeTerminationEvent = (event: EndEvent): void => {
      if (this.runtime.isNetworkFailure(event)) {
        this.stateMachine.send({ type: 'CALL.FAILED', event });

        return;
      }

      this.stateMachine.send({ type: 'CALL.ENDED', event });
    };

    const onFailed = (event: EndEvent) => {
      routeTerminationEvent(event);
    };

    const onEnded = (event: EndEvent) => {
      routeTerminationEvent(event);
    };

    // Явный локальный hangUp через `CallManager.endCall()` — payload не несёт,
    // безусловно разоружаем.
    const onEndCall = () => {
      this.stateMachine.send({ type: 'CALL.ENDED' });
    };

    const onConnConnected = () => {
      this.stateMachine.send({ type: 'CONN.CONNECTED' });
    };

    const onConnDisconnected = () => {
      this.stateMachine.send({ type: 'CONN.DISCONNECTED' });
    };

    this.callManager.on('failed', onFailed);
    this.callManager.on('end-call', onEndCall);
    this.callManager.on('ended', onEnded);
    this.connectionManager.on('connected', onConnConnected);
    this.connectionManager.on('registered', onConnConnected);
    this.connectionManager.on('disconnected', onConnDisconnected);

    this.unsubscribes.push(
      () => {
        this.callManager.off('failed', onFailed);
      },
      () => {
        this.callManager.off('end-call', onEndCall);
      },
      () => {
        this.callManager.off('ended', onEnded);
      },
      () => {
        this.connectionManager.off('connected', onConnConnected);
      },
      () => {
        this.connectionManager.off('registered', onConnConnected);
      },
      () => {
        this.connectionManager.off('disconnected', onConnDisconnected);
      },
    );
  }
}

export default CallReconnectManager;
