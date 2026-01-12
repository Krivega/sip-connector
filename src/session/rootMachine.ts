import { forwardTo, setup } from 'xstate';

import { callMachine } from './callMachine';
import { connectionMachine } from './connectionMachine';
import { incomingMachine } from './incomingMachine';
import { screenShareMachine } from './screenShareMachine';

import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import type { TSessionEvent } from './types';

/**
 * Идентификаторы дочерних акторов (машин состояний).
 * Используются для:
 * - запуска машин через invoke (id и src)
 * - пересылки событий через forwardTo()
 *
 * Важно: значения должны совпадать с ключами в actors и именами регионов состояний.
 */
const ACTORS_CONFIG = {
  connection: { id: 'connection', src: 'connection' },
  call: { id: 'call', src: 'call' },
  incoming: { id: 'incoming', src: 'incoming' },
  screenShare: { id: 'screenShare', src: 'screenShare' },
} as const;

/**
 * Корневая машина состояний сессии.
 *
 * Использует параллельную архитектуру (parallel), где все дочерние машины
 * работают одновременно и независимо друг от друга:
 * - connection: управление подключением к SIP-серверу
 * - call: управление исходящими звонками
 * - incoming: управление входящими звонками
 * - screenShare: управление демонстрацией экрана
 *
 * Все события, поступающие в эту машину, пересылаются (broadcast) во все
 * дочерние машины. Каждая дочерняя машина сама решает, обрабатывать ли
 * конкретное событие или игнорировать его.
 */
export const sessionMachine = setup({
  types: {
    context: {} as Record<string, never>,
    events: {} as TSessionEvent,
  },
  /**
   * Регистрация дочерних машин состояний.
   * Эти машины будут запущены параллельно при создании sessionMachine.
   */
  actors: {
    [ACTORS_CONFIG.connection.src]: connectionMachine,
    [ACTORS_CONFIG.call.src]: callMachine,
    [ACTORS_CONFIG.incoming.src]: incomingMachine,
    [ACTORS_CONFIG.screenShare.src]: screenShareMachine,
  },
  /**
   * Действия для пересылки событий дочерним машинам.
   *
   * forwardTo() - встроенная функция XState, которая создает действие,
   * пересылающее текущее событие дочернему актору по указанному ID.
   *
   * Паттерн broadcast: каждое событие пересылается во все дочерние машины,
   * что позволяет им независимо реагировать на события, которые их касаются.
   */
  actions: {
    forwardToConnection: forwardTo(ACTORS_CONFIG.connection.id),
    forwardToCall: forwardTo(ACTORS_CONFIG.call.id),
    forwardToIncoming: forwardTo(ACTORS_CONFIG.incoming.id),
    forwardToScreenShare: forwardTo(ACTORS_CONFIG.screenShare.id),
  },
}).createMachine({
  id: 'session',
  /**
   * Параллельная машина: все дочерние состояния активны одновременно.
   * Это позволяет независимо управлять разными аспектами сессии.
   */
  type: 'parallel',
  context: {},
  /**
   * Параллельные регионы состояний.
   * Каждый регион содержит одну дочернюю машину, запущенную через invoke.
   */
  states: {
    connection: {
      /**
       * invoke - механизм XState для запуска дочерних акторов (машин состояний).
       *
       * При входе в это состояние:
       * 1. Создается и запускается экземпляр машины из actors.connection
       * 2. Машина работает до тех пор, пока состояние активно
       * 3. При выходе из состояния машина автоматически останавливается
       *
       * Параметры:
       * - id: ACTORS_CONFIG.connection.id - уникальный идентификатор актора, используется в forwardTo()
       *   для пересылки событий именно этому экземпляру машины
       * - src: ACTORS_CONFIG.connection.src - ссылка на машину, зарегистрированную в actors выше
       *
       * Связь с forwardTo: ID должен совпадать с параметром в forwardTo(ACTORS_CONFIG.connection),
       * чтобы события корректно пересылались в эту машину.
       */
      invoke: ACTORS_CONFIG.connection,
    },
    call: {
      invoke: ACTORS_CONFIG.call,
    },
    incoming: {
      invoke: ACTORS_CONFIG.incoming,
    },
    screenShare: {
      invoke: ACTORS_CONFIG.screenShare,
    },
  },
  /**
   * Обработчик всех событий (wildcard '*').
   *
   * Любое событие, поступившее в эту машину, будет переслано во все
   * дочерние машины одновременно. Это реализует паттерн broadcast:
   *
   * - Событие 'CALL.CONNECTING' пересылается всем, но обработает его только callMachine
   * - Событие 'CONNECTION.CONNECTED' обработает только connectionMachine
   * - Остальные машины просто проигнорируют нерелевантные события
   *
   * Преимущества:
   * - Декомпозиция: каждая машина отвечает только за свою область
   * - Слабая связанность: дочерние машины не знают друг о друге
   * - Централизованная маршрутизация: родитель управляет распределением событий
   */
  on: {
    '*': {
      actions: [
        'forwardToConnection',
        'forwardToCall',
        'forwardToIncoming',
        'forwardToScreenShare',
      ],
    },
  },
});

export type TSessionSnapshot = SnapshotFrom<typeof sessionMachine>;
export type TSessionActor = ActorRefFrom<typeof sessionMachine>;
