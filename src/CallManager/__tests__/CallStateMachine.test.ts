import { createApiManagerEvents } from '@/ApiManager';
import { PURGATORY_CONFERENCE_NUMBER } from '@/tools/hasPurgatory';
import { buildStateContext, CallStateMachine, EState } from '../CallStateMachine';
import { createEvents } from '../events';

import type { TApiManagerEvents } from '@/ApiManager';
import type { TEventName, TEvents } from '../events';

describe('CallStateMachine', () => {
  let apiManagerEvents: TApiManagerEvents;
  let events: TEvents;
  let machine: CallStateMachine;

  const connectPayload = { number: '100', answer: false };
  const token1Payload = { jwt: 'jwt1', conference: 'room-1', participant: 'p-1' };
  const token1Context = {
    token: token1Payload.jwt,
    conferenceForToken: token1Payload.conference,
    participantName: token1Payload.participant,
  };
  const token2Payload = { jwt: 'jwt2', conference: 'room-2', participant: 'p-2' };
  const token2Context = {
    token: token2Payload.jwt,
    conferenceForToken: token2Payload.conference,
    participantName: token2Payload.participant,
  };
  const room1Payload = { room: 'room-1', participantName: 'User' };
  const room2Payload = { room: 'room-2', participantName: 'User2' };
  const purgatoryPayload = { room: PURGATORY_CONFERENCE_NUMBER, participantName: 'User' };
  const p2pRoomPayload = { room: 'p2pCallerToCallee', participantName: 'User' };
  const directP2pRoomPayload = {
    room: 'p2pCallerToCallee',
    participantName: 'User',
    isDirectPeerToPeer: true,
  };

  beforeEach(() => {
    apiManagerEvents = createApiManagerEvents();
    events = createEvents();
    machine = new CallStateMachine(events);
    machine.subscribeToApiEvents(apiManagerEvents);
  });

  afterEach(() => {
    machine.stop();
  });

  const getRawContext = () => {
    return machine.context.raw as Record<string, unknown>;
  };

  const getStateContext = () => {
    return machine.context.state as Record<string, unknown>;
  };

  describe('Табличные переходы по доменным событиям', () => {
    const transitions: {
      title: string;
      arrange?: () => void;
      event: { type: string } & Record<string, unknown>;
      expected: EState;
    }[] = [
      {
        title: 'CALL.CONNECTING из IDLE в CONNECTING',
        event: { type: 'CALL.CONNECTING', ...connectPayload },
        expected: EState.CONNECTING,
      },
      {
        title:
          'CALL.ENTER_ROOM в CONNECTING переводит в ROOM_PENDING_AUTH для обычной комнаты без token',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.ENTER_ROOM', ...room1Payload },
        expected: EState.ROOM_PENDING_AUTH,
      },
      {
        title: 'CALL.TOKEN_ISSUED в CONNECTING оставляет CONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.TOKEN_ISSUED', ...token1Context },
        expected: EState.CONNECTING,
      },
      {
        title: 'CALL.ENTER_ROOM (purgatory) в CONNECTING переводит в PURGATORY',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.ENTER_ROOM', ...purgatoryPayload },
        expected: EState.PURGATORY,
      },
      {
        title: 'CALL.ENTER_ROOM (p2p) в CONNECTING переводит в P2P_ROOM',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.ENTER_ROOM', ...p2pRoomPayload },
        expected: EState.P2P_ROOM,
      },
      {
        title: 'CALL.ENTER_ROOM (p2p) в CONNECTING переводит в DIRECT_P2P_ROOM',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload },
        expected: EState.DIRECT_P2P_ROOM,
      },
      {
        title:
          'CALL.ENTER_ROOM с token в CONNECTING переводит в IN_ROOM (ожидание авторизации по token не требуется)',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.ENTER_ROOM', ...room1Payload, token: 'jwt-with-enter-room' },
        expected: EState.IN_ROOM,
      },
      {
        title: 'CALL.RESET из CONNECTING в IDLE',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.RESET' },
        expected: EState.IDLE,
      },
      {
        title: 'CALL.RESET из ROOM_PENDING_AUTH в IDLE',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        },
        event: { type: 'CALL.RESET' },
        expected: EState.IDLE,
      },
      {
        title: 'CALL.RESET из PURGATORY в IDLE',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
        },
        event: { type: 'CALL.RESET' },
        expected: EState.IDLE,
      },
      {
        title: 'CALL.RESET из P2P_ROOM в IDLE',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
        },
        event: { type: 'CALL.RESET' },
        expected: EState.IDLE,
      },
      {
        title: 'CALL.RESET из DIRECT_P2P_ROOM в IDLE',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
        },
        event: { type: 'CALL.RESET' },
        expected: EState.IDLE,
      },
      {
        title: 'CALL.START_DISCONNECT из CONNECTING в DISCONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.START_DISCONNECT' },
        expected: EState.DISCONNECTING,
      },
      {
        title: 'CALL.START_DISCONNECT из IN_ROOM в DISCONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
          machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
        },
        event: { type: 'CALL.START_DISCONNECT' },
        expected: EState.DISCONNECTING,
      },
      {
        title: 'CALL.START_DISCONNECT из ROOM_PENDING_AUTH в DISCONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        },
        event: { type: 'CALL.START_DISCONNECT' },
        expected: EState.DISCONNECTING,
      },
      {
        title: 'CALL.START_DISCONNECT из PURGATORY в DISCONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
        },
        event: { type: 'CALL.START_DISCONNECT' },
        expected: EState.DISCONNECTING,
      },
      {
        title: 'CALL.START_DISCONNECT из P2P_ROOM в DISCONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
        },
        event: { type: 'CALL.START_DISCONNECT' },
        expected: EState.DISCONNECTING,
      },
      {
        title: 'CALL.START_DISCONNECT из DIRECT_P2P_ROOM в DISCONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
        },
        event: { type: 'CALL.START_DISCONNECT' },
        expected: EState.DISCONNECTING,
      },
      {
        title: 'CALL.RESET из DISCONNECTING в IDLE',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
          machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
          machine.send({ type: 'CALL.START_DISCONNECT' });
        },
        event: { type: 'CALL.RESET' },
        expected: EState.IDLE,
      },
    ];

    it.each(transitions)('$title', ({ arrange, event, expected }) => {
      arrange?.();

      machine.send(event as never);

      expect(machine.state).toBe(expected);
    });
  });

  describe('Контракт адаптера событий менеджеров', () => {
    const scenarios: {
      title: string;
      steps: {
        event: TEventName;
        payload?: unknown;
        expected: EState;
      }[];
    }[] = [
      {
        title: 'звонок (start-call → ended)',
        steps: [
          { event: 'start-call', payload: connectPayload, expected: EState.CONNECTING },
          { event: 'ended', expected: EState.IDLE },
        ],
      },
      {
        title: 'ошибка звонка (start-call → failed)',
        steps: [
          { event: 'start-call', payload: connectPayload, expected: EState.CONNECTING },
          { event: 'failed', expected: EState.IDLE },
        ],
      },
    ];

    it.each(scenarios)('$title', ({ steps }) => {
      for (const step of steps) {
        events.trigger(step.event as never, step.payload as never);
        expect(machine.state).toBe(step.expected);
      }
    });
  });

  describe('Геттеры состояний', () => {
    it('isIdle должен возвращать true только для IDLE', () => {
      expect(machine.isIdle).toBe(true);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isIdle).toBe(false);
    });

    it('isConnecting должен возвращать true только для CONNECTING', () => {
      expect(machine.isConnecting).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isConnecting).toBe(true);
    });

    it('isInRoom должен возвращать true только для IN_ROOM', () => {
      expect(machine.isInRoom).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isInRoom).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      expect(machine.isInRoom).toBe(false);
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.isInRoom).toBe(true);
    });

    it('isRoomPendingAuth должен возвращать true только для ROOM_PENDING_AUTH', () => {
      expect(machine.isRoomPendingAuth).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isRoomPendingAuth).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      expect(machine.isRoomPendingAuth).toBe(true);
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.isRoomPendingAuth).toBe(false);
    });

    it('isInPurgatory должен возвращать true только для PURGATORY', () => {
      expect(machine.isInPurgatory).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isInPurgatory).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.isInPurgatory).toBe(true);
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.isInPurgatory).toBe(true);
    });

    it('isP2PRoom должен возвращать true только для P2P_ROOM', () => {
      expect(machine.isP2PRoom).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isP2PRoom).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
      expect(machine.isP2PRoom).toBe(true);
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.isP2PRoom).toBe(true);
    });

    it('isDirectP2PRoom должен возвращать true только для DIRECT_P2P_ROOM', () => {
      expect(machine.isDirectP2PRoom).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isDirectP2PRoom).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
      expect(machine.isDirectP2PRoom).toBe(true);
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.isDirectP2PRoom).toBe(true);
    });

    it('isDisconnecting должен возвращать true только для DISCONNECTING', () => {
      expect(machine.isDisconnecting).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.isDisconnecting).toBe(false);
      machine.send({ type: 'CALL.START_DISCONNECT' });
      expect(machine.isDisconnecting).toBe(true);
      machine.send({ type: 'CALL.RESET' });
      expect(machine.isDisconnecting).toBe(false);
    });
    it('isActive должен возвращать true для ROOM_PENDING_AUTH, IN_ROOM, PURGATORY, P2P_ROOM и DIRECT_P2P_ROOM', () => {
      expect(machine.isActive).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isActive).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      expect(machine.isActive).toBe(true);
      machine.send({ type: 'CALL.RESET' });
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.isActive).toBe(true);
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.isActive).toBe(true);
      machine.send({ type: 'CALL.RESET' });
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
      expect(machine.isActive).toBe(true);
      machine.send({ type: 'CALL.RESET' });
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
      expect(machine.isActive).toBe(true);
    });
  });

  describe('typed context accessors', () => {
    it('idleContext только в IDLE', () => {
      expect(machine.idleContext).toEqual({});
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.idleContext).toBeUndefined();
    });

    it('connectingContext только в CONNECTING', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.connectingContext).toEqual(connectPayload);
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      expect(machine.connectingContext).toBeUndefined();
    });

    it('roomPendingAuthContext только в ROOM_PENDING_AUTH при валидном предикате', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      expect(machine.roomPendingAuthContext).toEqual({ ...connectPayload, ...room1Payload });
    });

    it('purgatoryContext только в PURGATORY (в т.ч. после TOKEN_ISSUED — переход в IN_ROOM только через enter-room с bearer)', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.purgatoryContext).toEqual({ ...connectPayload, ...purgatoryPayload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.PURGATORY);
      expect(machine.purgatoryContext).toEqual({
        ...connectPayload,
        room: purgatoryPayload.room,
        participantName: token1Context.participantName,
      });
    });

    it('p2pRoomContext только в P2P_ROOM', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
      expect(machine.p2pRoomContext).toEqual({ ...connectPayload, ...p2pRoomPayload });
    });

    it('directP2pRoomContext только в DIRECT_P2P_ROOM', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
      expect(machine.directP2pRoomContext).toEqual({ ...connectPayload, ...directP2pRoomPayload });
    });

    it('inRoomContext и typed-контексты других состояний взаимоисключающи в IN_ROOM', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext).toBeDefined();
      expect(machine.connectingContext).toBeUndefined();
      expect(machine.roomPendingAuthContext).toBeUndefined();
      expect(machine.purgatoryContext).toBeUndefined();
      expect(machine.p2pRoomContext).toBeUndefined();
      expect(machine.directP2pRoomContext).toBeUndefined();
    });

    it('disconnectingContext только в DISCONNECTING (после перехода контекст сброшен reset)', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.START_DISCONNECT' });
      expect(machine.state).toBe(EState.DISCONNECTING);
      expect(machine.disconnectingContext).toBeDefined();
      expect(machine.idleContext).toBeUndefined();
      machine.send({ type: 'CALL.RESET' });
      expect(machine.disconnectingContext).toBeUndefined();
      expect(machine.idleContext).toEqual({});
    });
  });

  describe('getSnapshot: нормализованный контекст (согласован с typed-геттерами)', () => {
    it('в PURGATORY после TOKEN_ISSUED сырой context содержит JWT, публичный snapshot — без полей token/conferenceForToken', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.PURGATORY);
      expect(getRawContext()).toMatchObject({
        token: token1Context.token,
        conferenceForToken: token1Context.conferenceForToken,
      });

      const snap = machine.getSnapshot();

      expect(snap.value).toBe(EState.PURGATORY);
      expect('token' in snap.context.state).toBe(false);
      expect('conferenceForToken' in snap.context.state).toBe(false);
      expect(snap.context.raw).toEqual(machine.context.raw);
      expect(snap.context.state).toEqual(machine.purgatoryContext);
    });

    it('в P2P_ROOM при TOKEN_ISSUED для другой конференции сырой context с JWT; snapshot без JWT и как p2pRoomContext', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.P2P_ROOM);
      expect(getRawContext()).toMatchObject({ token: token1Context.token });

      const snap = machine.getSnapshot();

      expect(snap.value).toBe(EState.P2P_ROOM);
      expect('token' in snap.context.state).toBe(false);
      expect(snap.context.raw).toEqual(machine.context.raw);
      expect(snap.context.state).toEqual(machine.p2pRoomContext);
    });

    it('в ROOM_PENDING_AUTH при JWT для другой конференции сырой context хранит token; snapshot без JWT', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token2Context });
      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      expect(getRawContext()).toMatchObject({ token: token2Context.token });

      const snap = machine.getSnapshot();

      expect(snap.value).toBe(EState.ROOM_PENDING_AUTH);
      expect('token' in snap.context.state).toBe(false);
      expect(snap.context.raw).toEqual(machine.context.raw);
      expect(snap.context.state).toEqual(machine.roomPendingAuthContext);
    });

    it('в IN_ROOM snapshot.context совпадает с inRoomContext и содержит валидный token', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.IN_ROOM);

      const snap = machine.getSnapshot();

      expect(snap.context.state).toEqual(machine.inRoomContext);
      expect((snap.context.state as { token: string }).token).toBe(token1Context.token);
    });

    it('subscribe передаёт в listener тот же нормализованный context, что и getSnapshot()', () => {
      let lastContext: unknown;
      const subscription = machine.subscribe((snapshot) => {
        lastContext = snapshot.context;
      });

      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(lastContext).toEqual(machine.getSnapshot().context);
      expect('token' in (lastContext as { state: object }).state).toBe(false);
      subscription.unsubscribe();
    });
  });

  /**
   * Интеграционные проверки: геттеры дают undefined, когда **состояние** уже не то
   * (например `connectingContext` вне CONNECTING). Обычные переходы это покрывают.
   */
  describe('typed context accessors: undefined при «чужом» состоянии', () => {
    describe('connectingContext', () => {
      it('возвращает undefined в IDLE', () => {
        expect(machine.connectingContext).toBeUndefined();
      });

      it('возвращает undefined после выхода из CONNECTING (ROOM_PENDING_AUTH, PURGATORY, IN_ROOM, DISCONNECTING)', () => {
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        expect(machine.connectingContext).toBeDefined();

        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
        expect(machine.connectingContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
        expect(machine.state).toBe(EState.PURGATORY);
        expect(machine.connectingContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
        expect(machine.state).toBe(EState.IN_ROOM);
        expect(machine.connectingContext).toBeUndefined();

        machine.send({ type: 'CALL.START_DISCONNECT' });
        expect(machine.state).toBe(EState.DISCONNECTING);
        expect(machine.connectingContext).toBeUndefined();
      });
    });

    describe('roomPendingAuthContext', () => {
      it('возвращает undefined в IDLE и CONNECTING', () => {
        expect(machine.roomPendingAuthContext).toBeUndefined();
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        expect(machine.roomPendingAuthContext).toBeUndefined();
      });

      it('возвращает undefined в PURGATORY, P2P_ROOM, DIRECT_P2P_ROOM, IN_ROOM', () => {
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
        expect(machine.state).toBe(EState.PURGATORY);
        expect(machine.roomPendingAuthContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
        expect(machine.state).toBe(EState.P2P_ROOM);
        expect(machine.roomPendingAuthContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
        expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
        expect(machine.roomPendingAuthContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
        expect(machine.state).toBe(EState.IN_ROOM);
        expect(machine.roomPendingAuthContext).toBeUndefined();
      });
    });

    describe('purgatoryContext', () => {
      it('возвращает undefined вне PURGATORY (IDLE, CONNECTING, ROOM_PENDING_AUTH, P2P_ROOM, IN_ROOM)', () => {
        expect(machine.purgatoryContext).toBeUndefined();

        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        expect(machine.purgatoryContext).toBeUndefined();

        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
        expect(machine.purgatoryContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
        expect(machine.state).toBe(EState.P2P_ROOM);
        expect(machine.purgatoryContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
        expect(machine.state).toBe(EState.IN_ROOM);
        expect(machine.purgatoryContext).toBeUndefined();
      });
    });

    describe('p2pRoomContext', () => {
      it('возвращает undefined вне P2P_ROOM (PURGATORY, ROOM_PENDING_AUTH, DIRECT_P2P_ROOM, IN_ROOM)', () => {
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
        expect(machine.state).toBe(EState.PURGATORY);
        expect(machine.p2pRoomContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
        expect(machine.p2pRoomContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
        expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
        expect(machine.p2pRoomContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
        expect(machine.state).toBe(EState.IN_ROOM);
        expect(machine.p2pRoomContext).toBeUndefined();
      });
    });

    describe('directP2pRoomContext', () => {
      it('возвращает undefined вне DIRECT_P2P_ROOM (PURGATORY, P2P_ROOM, ROOM_PENDING_AUTH, IN_ROOM)', () => {
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
        expect(machine.directP2pRoomContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
        expect(machine.state).toBe(EState.P2P_ROOM);
        expect(machine.directP2pRoomContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
        expect(machine.directP2pRoomContext).toBeUndefined();

        machine.send({ type: 'CALL.RESET' });
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
        expect(machine.state).toBe(EState.IN_ROOM);
        expect(machine.directP2pRoomContext).toBeUndefined();
      });
    });

    describe('inRoomContext', () => {
      it('возвращает undefined при ROOM_PENDING_AUTH с несовпадающим conference в токене (state не IN_ROOM)', () => {
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        machine.send({
          type: 'CALL.TOKEN_ISSUED',
          token: 'jwt-m',
          conferenceForToken: 'other',
          participantName: 'User',
        });
        expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
        expect(machine.inRoomContext).toBeUndefined();
      });

      it('возвращает undefined в PURGATORY после TOKEN_ISSUED (ожидание enter-room с bearer для IN_ROOM)', () => {
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
        machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
        expect(machine.state).toBe(EState.PURGATORY);
        expect(machine.inRoomContext).toBeUndefined();
      });

      it('возвращает undefined в ROOM_PENDING_AUTH после смены room из IN_ROOM без выравнивания токена', () => {
        machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
        machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
        expect(machine.state).toBe(EState.IN_ROOM);
        expect(machine.inRoomContext).toBeDefined();

        machine.send({ type: 'CALL.ENTER_ROOM', ...room2Payload });
        expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
        expect(machine.inRoomContext).toBeUndefined();
      });
    });
  });

  /**
   * Второй предикат в геттерах (`!hasConnectingContext`, …) — защита от рассинхрона
   * снимка (редко в проде). Достигается подменой `state`/`context` через spy.
   */
  describe('typed context accessors: защитные ветки при рассинхроне snapshot', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('connectingContext: undefined если state=CONNECTING, но context без number/answer', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      jest.spyOn(machine, 'state', 'get').mockReturnValue(EState.CONNECTING);
      jest.spyOn(machine, 'context', 'get').mockReturnValue({} as never);

      expect(machine.connectingContext).toBeUndefined();
    });

    it('roomPendingAuthContext: undefined если state=ROOM_PENDING_AUTH, но предикат «ожидание auth» ложен', () => {
      jest.spyOn(machine, 'state', 'get').mockReturnValue(EState.ROOM_PENDING_AUTH);
      jest.spyOn(machine, 'context', 'get').mockReturnValue({
        ...connectPayload,
        ...room1Payload,
        ...token1Context,
      } as never);

      expect(machine.roomPendingAuthContext).toBeUndefined();
    });

    it('purgatoryContext: undefined если state=PURGATORY, но room не purgatory', () => {
      jest.spyOn(machine, 'state', 'get').mockReturnValue(EState.PURGATORY);
      jest.spyOn(machine, 'context', 'get').mockReturnValue({
        ...connectPayload,
        room: room1Payload.room,
        participantName: 'User',
      } as never);

      expect(machine.purgatoryContext).toBeUndefined();
    });

    it('p2pRoomContext: undefined если state=P2P_ROOM, но room не p2p-шаблон', () => {
      jest.spyOn(machine, 'state', 'get').mockReturnValue(EState.P2P_ROOM);
      jest.spyOn(machine, 'context', 'get').mockReturnValue({
        ...connectPayload,
        room: room1Payload.room,
        participantName: 'User',
      } as never);

      expect(machine.p2pRoomContext).toBeUndefined();
    });

    it('directP2pRoomContext: undefined если state=DIRECT_P2P_ROOM, но нет isDirectPeerToPeer', () => {
      jest.spyOn(machine, 'state', 'get').mockReturnValue(EState.DIRECT_P2P_ROOM);
      jest.spyOn(machine, 'context', 'get').mockReturnValue({
        ...connectPayload,
        ...p2pRoomPayload,
      } as never);

      expect(machine.directP2pRoomContext).toBeUndefined();
    });

    it('inRoomContext: undefined если state=IN_ROOM, но conferenceForToken не совпадает с room', () => {
      jest.spyOn(machine, 'state', 'get').mockReturnValue(EState.IN_ROOM);
      jest.spyOn(machine, 'context', 'get').mockReturnValue({
        ...connectPayload,
        ...room1Payload,
        token: 'jwt',
        conferenceForToken: 'other-conference',
        participantName: 'User',
      } as never);

      expect(machine.inRoomContext).toBeUndefined();
    });
  });

  describe('inRoomContext', () => {
    it('возвращает undefined в IDLE', () => {
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает undefined в CONNECTING без room и token', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });

      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает undefined в ROOM_PENDING_AUTH без token', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });

      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает undefined в PURGATORY', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });

      expect(machine.state).toBe(EState.PURGATORY);
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает undefined в P2P_ROOM', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });

      expect(machine.state).toBe(EState.P2P_ROOM);
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает undefined в DIRECT_P2P_ROOM', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });

      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает undefined в IDLE после failed', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      events.trigger('failed', undefined as never);

      expect(machine.state).toBe(EState.IDLE);
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает undefined в DISCONNECTING (не IN_ROOM)', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext).toBeDefined();

      machine.send({ type: 'CALL.START_DISCONNECT' });

      expect(machine.state).toBe(EState.DISCONNECTING);
      // inRoomContext возвращает undefined, так как состояние не IN_ROOM
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает контекст типа TInRoomContext в IN_ROOM со всеми полями', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(machine.state).toBe(EState.IN_ROOM);

      const context = machine.inRoomContext;

      expect(context).toBeDefined();
      expect(context).toMatchObject({
        ...connectPayload,
        room: room1Payload.room,
        ...token1Context,
      });
      expect(context?.number).toBe(connectPayload.number);
      expect(context?.answer).toBe(connectPayload.answer);
      expect(context?.room).toBe(room1Payload.room);
      expect(context?.participantName).toBe(token1Context.participantName);
      expect(context?.token).toBe(token1Context.token);
      expect(context?.conferenceForToken).toBe(token1Context.conferenceForToken);
      expect(context).not.toHaveProperty('participant');
    });

    it('при смене room без нового token контекст остаётся с несогласованным conferenceForToken; inRoomContext недоступен до выравнивания', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(machine.inRoomContext?.room).toBe(room1Payload.room);

      machine.send({ type: 'CALL.ENTER_ROOM', ...room2Payload });

      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      expect(machine.inRoomContext).toBeUndefined();
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...room2Payload,
        token: token1Context.token,
        conferenceForToken: token1Context.conferenceForToken,
      });
      expect(getStateContext()).toEqual({ ...connectPayload, ...room2Payload });
    });

    it('возвращает обновлённый контекст при смене token в IN_ROOM', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(machine.inRoomContext?.token).toBe(token1Context.token);

      machine.send({
        type: 'CALL.TOKEN_ISSUED',
        ...token2Context,
        conferenceForToken: room1Payload.room,
      });

      expect(machine.inRoomContext).toBeDefined();
      expect(machine.inRoomContext?.token).toBe(token2Context.token);
    });

    it('возвращает undefined после перехода из IN_ROOM в IDLE по RESET', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(machine.inRoomContext).toBeDefined();

      machine.send({ type: 'CALL.RESET' });

      expect(machine.state).toBe(EState.IDLE);
      expect(machine.inRoomContext).toBeUndefined();
    });
  });

  describe('isCallInitiator', () => {
    it('возвращает true при answer: false (инициатор)', () => {
      machine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });

      expect(machine.isCallInitiator).toBe(true);
    });

    it('возвращает false при answer: true (принимающая сторона)', () => {
      machine.send({ type: 'CALL.CONNECTING', number: '100', answer: true });

      expect(machine.isCallInitiator).toBe(false);
    });
  });

  describe('isCallAnswerer', () => {
    it('возвращает false когда в контексте нет поля answer', () => {
      expect(machine.isCallAnswerer).toBe(false);
    });

    it('возвращает true при answer: true', () => {
      machine.send({ type: 'CALL.CONNECTING', number: '100', answer: true });

      expect(machine.isCallAnswerer).toBe(true);
    });

    it('возвращает false при answer: false', () => {
      machine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });

      expect(machine.isCallAnswerer).toBe(false);
    });
  });

  describe('Валидация переходов', () => {
    it('должен игнорировать недопустимые переходы с предупреждением', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });

      expect(machine.state).toBe(EState.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid transition: CALL.ENTER_ROOM from call:idle'),
      );

      consoleSpy.mockRestore();
    });

    it('должен игнорировать повторные CALL.CONNECTING в CONNECTING', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.state).toBe(EState.CONNECTING);

      machine.send({ type: 'CALL.CONNECTING', number: '200', answer: true });

      expect(machine.state).toBe(EState.CONNECTING);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('должен игнорировать CALL.TOKEN_ISSUED в IDLE', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(machine.state).toBe(EState.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid transition: CALL.TOKEN_ISSUED from call:idle'),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Интеграция с событиями CallManager', () => {
    it('должен корректно реагировать на события через events', () => {
      events.trigger('start-call', connectPayload);

      expect(machine.state).toBe(EState.CONNECTING);
      expect(getRawContext()).toEqual(connectPayload);
      expect(getStateContext()).toEqual(connectPayload);

      events.trigger('ended', {} as never);

      expect(machine.state).toBe(EState.IDLE);
      expect(getRawContext()).toEqual({});
      expect(getStateContext()).toEqual({});
    });

    it('должен переходить в IDLE при событии failed', () => {
      events.trigger('start-call', connectPayload);

      events.trigger('failed', undefined as never);

      expect(machine.state).toBe(EState.IDLE);
      expect(getRawContext()).toEqual({});
      expect(getStateContext()).toEqual({});
    });

    it('должен переходить в DISCONNECTING при событии end-call из IN_ROOM', () => {
      events.trigger('start-call', connectPayload);
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.IN_ROOM);

      events.trigger('end-call');

      expect(machine.state).toBe(EState.DISCONNECTING);
    });

    it('должен переходить в DISCONNECTING при событии end-call из CONNECTING', () => {
      events.trigger('start-call', connectPayload);
      expect(machine.state).toBe(EState.CONNECTING);

      events.trigger('end-call');

      expect(machine.state).toBe(EState.DISCONNECTING);
    });

    it('должен переходить в DISCONNECTING при событии end-call из PURGATORY', () => {
      events.trigger('start-call', connectPayload);
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.state).toBe(EState.PURGATORY);

      events.trigger('end-call');

      expect(machine.state).toBe(EState.DISCONNECTING);
    });

    it('должен переходить в IDLE из DISCONNECTING при событии ended', () => {
      events.trigger('start-call', connectPayload);
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      events.trigger('end-call');
      expect(machine.state).toBe(EState.DISCONNECTING);

      events.trigger('ended', {} as never);

      expect(machine.state).toBe(EState.IDLE);
      expect(getRawContext()).toEqual({});
      expect(getStateContext()).toEqual({});
    });

    it('должен переходить в IDLE из DISCONNECTING при событии failed', () => {
      events.trigger('start-call', connectPayload);
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      events.trigger('end-call');
      expect(machine.state).toBe(EState.DISCONNECTING);

      events.trigger('failed', undefined as never);

      expect(machine.state).toBe(EState.IDLE);
      expect(getRawContext()).toEqual({});
      expect(getStateContext()).toEqual({});
    });
  });

  describe('Интеграция с событиями ApiManager', () => {
    it('должен обновлять данные из "enter-room"', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', room1Payload);

      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      expect(getRawContext()).toEqual({ ...connectPayload, ...room1Payload });
      expect(getStateContext()).toEqual({ ...connectPayload, ...room1Payload });

      apiManagerEvents.trigger('enter-room', room2Payload);

      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      expect(getRawContext()).toEqual({ ...connectPayload, ...room2Payload });
      expect(getStateContext()).toEqual({ ...connectPayload, ...room2Payload });
    });

    it('должен обновлять данные из "conference:participant-token-issued"', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.CONNECTING);
      expect(getRawContext()).toEqual({ ...connectPayload, ...token1Context });
      expect(getStateContext()).toEqual(connectPayload);

      apiManagerEvents.trigger('conference:participant-token-issued', token2Payload);

      expect(machine.state).toBe(EState.CONNECTING);
      expect(getRawContext()).toEqual({ ...connectPayload, ...token2Context });
      expect(getStateContext()).toEqual(connectPayload);
    });

    it('должен переходить в IN_ROOM по наличию всех данных', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', room1Payload);
      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(getRawContext()).toEqual({ ...connectPayload, ...room1Payload, ...token1Context });
      expect(getStateContext()).toEqual({ ...connectPayload, ...room1Payload, ...token1Context });
    });

    it('должен оставаться в ROOM_PENDING_AUTH, если conference из токена не совпадает с room', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', room1Payload);
      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);

      apiManagerEvents.trigger('conference:participant-token-issued', {
        jwt: 'jwt-mismatch',
        conference: 'other-conference',
        participant: 'User',
      });

      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...room1Payload,
        token: 'jwt-mismatch',
        conferenceForToken: 'other-conference',
      });
      expect(getStateContext()).toEqual({ ...connectPayload, ...room1Payload });
    });

    it('должен переходить из ROOM_PENDING_AUTH в IN_ROOM, если сначала conference токена ≠ room, затем пришёл токен с conference === room', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', room1Payload);
      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);

      apiManagerEvents.trigger('conference:participant-token-issued', {
        jwt: 'jwt-mismatch',
        conference: 'other-conference',
        participant: 'User',
      });

      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);

      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(getRawContext()).toEqual({ ...connectPayload, ...room1Payload, ...token1Context });
      expect(getStateContext()).toEqual({ ...connectPayload, ...room1Payload, ...token1Context });
    });

    it('должен обновлять данные в IN_ROOM', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', room1Payload);
      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(getRawContext()).toEqual({ ...connectPayload, ...room1Payload, ...token1Context });
      expect(getStateContext()).toEqual({ ...connectPayload, ...room1Payload, ...token1Context });

      apiManagerEvents.trigger('conference:participant-token-issued', {
        ...token2Payload,
        conference: room1Payload.room,
      });

      const token2AlignedWithRoom1Context = {
        ...token2Context,
        conferenceForToken: room1Payload.room,
      };

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(getRawContext()).toEqual({
        ...connectPayload,
        ...room1Payload,
        ...token2AlignedWithRoom1Context,
      });
      expect(getStateContext()).toEqual({
        ...connectPayload,
        ...room1Payload,
        ...token2AlignedWithRoom1Context,
      });

      apiManagerEvents.trigger('enter-room', room2Payload);

      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...room2Payload,
        token: token2Context.token,
        conferenceForToken: room1Payload.room,
      });
      expect(getStateContext()).toEqual({ ...connectPayload, ...room2Payload });
    });

    it('должен переходить в IN_ROOM по enter-room с bearerToken', () => {
      const bearerToken = 'jwt-from-enter-room';

      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', { ...room1Payload, bearerToken });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...room1Payload,
        token: bearerToken,
        conferenceForToken: room1Payload.room,
      });
      expect(getStateContext()).toEqual({
        ...connectPayload,
        ...room1Payload,
        token: bearerToken,
        conferenceForToken: room1Payload.room,
      });
      expect(machine.inRoomContext?.token).toBe(bearerToken);
      expect(machine.inRoomContext?.conferenceForToken).toBe(room1Payload.room);
    });

    it('должен переходить в PURGATORY по enter-room с room purgatory без token', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', purgatoryPayload);

      expect(machine.state).toBe(EState.PURGATORY);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...purgatoryPayload,
      });
      expect(getStateContext()).toEqual({ ...connectPayload, ...purgatoryPayload });
    });

    it('conference:participant-token-issued из PURGATORY не переводит в IN_ROOM (только enter-room с bearer)', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', purgatoryPayload);
      expect(machine.state).toBe(EState.PURGATORY);

      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.PURGATORY);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...purgatoryPayload,
        ...token1Context,
      });
      expect(getStateContext()).toEqual(machine.purgatoryContext as Record<string, unknown>);
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('должен переходить из PURGATORY в IN_ROOM при enter-room с bearerToken', () => {
      const bearerToken = 'jwt-after-purgatory';

      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', purgatoryPayload);
      expect(machine.state).toBe(EState.PURGATORY);

      apiManagerEvents.trigger('enter-room', { ...room1Payload, bearerToken });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe(bearerToken);
    });

    it('должен переходить в P2P_ROOM по enter-room с p2p комнатой без token', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', p2pRoomPayload);

      expect(machine.state).toBe(EState.P2P_ROOM);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...p2pRoomPayload,
      });
      expect(getStateContext()).toEqual({ ...connectPayload, ...p2pRoomPayload });
    });

    it('должен переходить в DIRECT_P2P_ROOM по enter-room с p2p комнатой без token', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', directP2pRoomPayload);

      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...directP2pRoomPayload,
      });
      expect(getStateContext()).toEqual({ ...connectPayload, ...directP2pRoomPayload });
    });

    it('должен переходить в DIRECT_P2P_ROOM по enter-room с флагом isDirectPeerToPeer даже без p2p имени комнаты', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', {
        ...room1Payload,
        isDirectPeerToPeer: true,
      });

      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...room1Payload,
        isDirectPeerToPeer: true,
      });
      expect(getStateContext()).toEqual({
        ...connectPayload,
        ...room1Payload,
        isDirectPeerToPeer: true,
      });
    });

    it('conference:participant-token-issued из P2P_ROOM не переводит в IN_ROOM (только enter-room с bearer)', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', p2pRoomPayload);
      expect(machine.state).toBe(EState.P2P_ROOM);

      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.P2P_ROOM);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...p2pRoomPayload,
        ...token1Context,
      });
      expect(getStateContext()).toEqual(machine.p2pRoomContext as Record<string, unknown>);
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('должен переходить из P2P_ROOM в IN_ROOM при enter-room с bearerToken', () => {
      const bearerToken = 'jwt-after-p2p';

      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', p2pRoomPayload);
      expect(machine.state).toBe(EState.P2P_ROOM);

      apiManagerEvents.trigger('enter-room', { ...room1Payload, bearerToken });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe(bearerToken);
    });
  });

  describe('Переходы PURGATORY ↔ IN_ROOM', () => {
    it('PURGATORY: CALL.TOKEN_ISSUED не переводит в IN_ROOM; токен копится в context', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.state).toBe(EState.PURGATORY);

      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(machine.state).toBe(EState.PURGATORY);
      expect(machine.inRoomContext).toBeUndefined();
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...purgatoryPayload,
        ...token1Context,
      });
      expect(getStateContext()).toEqual(machine.purgatoryContext as Record<string, unknown>);
    });

    it('PURGATORY -> IN_ROOM: по CALL.ENTER_ROOM с bearerToken', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.state).toBe(EState.PURGATORY);

      machine.send({
        type: 'CALL.ENTER_ROOM',
        ...room1Payload,
        token: 'jwt-enter-room',
      });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe('jwt-enter-room');
      expect(machine.inRoomContext?.room).toBe(room1Payload.room);
    });

    it('IN_ROOM -> PURGATORY: по CALL.ENTER_ROOM с room purgatory без token', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.IN_ROOM);

      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });

      expect(machine.state).toBe(EState.PURGATORY);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...purgatoryPayload,
      });
      expect(getStateContext()).toEqual({ ...connectPayload, ...purgatoryPayload });
      expect(machine.inRoomContext).toBeUndefined();
    });
  });

  describe('Переходы ROOM_PENDING_AUTH ↔ IN_ROOM', () => {
    it('ENTER_ROOM без token оставляет ROOM_PENDING_AUTH и не задаёт conference в контексте', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });

      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      expect(getRawContext()).toMatchObject({ ...connectPayload, ...room1Payload });
      expect(getStateContext()).toEqual({ ...connectPayload, ...room1Payload });
      expect(getRawContext().conferenceForToken).toBeUndefined();
      expect(getRawContext().token).toBeUndefined();
    });

    it('ROOM_PENDING_AUTH -> IN_ROOM: по CALL.TOKEN_ISSUED', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);

      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe(token1Context.token);
      expect(machine.inRoomContext?.room).toBe(room1Payload.room);
    });

    it('повторный CALL.ENTER_ROOM без token для обычной комнаты: уходит в ROOM_PENDING_AUTH, token в контексте сохраняется, inRoomContext до выравнивания недоступен', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.IN_ROOM);

      machine.send({ type: 'CALL.ENTER_ROOM', ...room2Payload });

      expect(machine.state).toBe(EState.ROOM_PENDING_AUTH);
      expect(machine.inRoomContext).toBeUndefined();
      expect(getRawContext().token).toBe(token1Context.token);
      expect(getRawContext().room).toBe(room2Payload.room);
      expect(getStateContext()).toEqual({ ...connectPayload, ...room2Payload });

      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token2Context });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe(token2Context.token);
      expect(machine.inRoomContext?.room).toBe(room2Payload.room);
    });
  });

  describe('Переходы P2P_ROOM ↔ IN_ROOM', () => {
    it('P2P_ROOM: CALL.TOKEN_ISSUED не переводит в IN_ROOM; токен копится в context', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
      expect(machine.state).toBe(EState.P2P_ROOM);

      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(machine.state).toBe(EState.P2P_ROOM);
      expect(machine.inRoomContext).toBeUndefined();
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...p2pRoomPayload,
        ...token1Context,
      });
      expect(getStateContext()).toEqual(machine.p2pRoomContext as Record<string, unknown>);
    });

    it('P2P_ROOM -> IN_ROOM: по CALL.ENTER_ROOM с bearerToken', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
      expect(machine.state).toBe(EState.P2P_ROOM);

      machine.send({
        type: 'CALL.ENTER_ROOM',
        ...room1Payload,
        token: 'jwt-enter-room',
      });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe('jwt-enter-room');
      expect(machine.inRoomContext?.room).toBe(room1Payload.room);
    });

    it('IN_ROOM -> P2P_ROOM: по CALL.ENTER_ROOM с p2p комнатой без token', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.IN_ROOM);

      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });

      expect(machine.state).toBe(EState.P2P_ROOM);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...p2pRoomPayload,
      });
      expect(getStateContext()).toEqual({ ...connectPayload, ...p2pRoomPayload });
      expect(machine.inRoomContext).toBeUndefined();
    });
  });

  describe('Переходы DIRECT_P2P_ROOM ↔ IN_ROOM', () => {
    it('DIRECT_P2P_ROOM: CALL.TOKEN_ISSUED не переводит в IN_ROOM', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);

      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });

      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
      expect(machine.directP2pRoomContext).toEqual({
        ...connectPayload,
        ...directP2pRoomPayload,
        participantName: token1Context.participantName,
      });
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('DIRECT_P2P_ROOM -> IN_ROOM: по CALL.ENTER_ROOM с bearerToken', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);

      machine.send({
        type: 'CALL.ENTER_ROOM',
        ...room1Payload,
        token: 'jwt-enter-room',
      });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe('jwt-enter-room');
      expect(machine.inRoomContext?.room).toBe(room1Payload.room);
    });

    it('IN_ROOM -> DIRECT_P2P_ROOM: по CALL.ENTER_ROOM с p2p комнатой без token', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', ...token1Context });
      expect(machine.state).toBe(EState.IN_ROOM);

      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });

      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
      expect(getRawContext()).toMatchObject({
        ...connectPayload,
        ...directP2pRoomPayload,
      });
      expect(getStateContext()).toEqual({ ...connectPayload, ...directP2pRoomPayload });
      expect(machine.inRoomContext).toBeUndefined();
    });
  });

  describe('assign actions (defensive branch: event.type mismatch)', () => {
    type AssignAction = { assignment: (args: { event: unknown; context: unknown }) => unknown };
    type ActorWithSnapshot = {
      actor: {
        getSnapshot: () => {
          machine: {
            implementations: {
              actions: {
                setConnecting?: AssignAction;
                setRoomInfo?: AssignAction;
                setTokenInfo?: AssignAction;
              };
            };
          };
        };
      };
    };

    const getSnapshot = () => {
      return (machine as unknown as ActorWithSnapshot).actor.getSnapshot();
    };

    it('setConnecting: возвращает context при event.type !== CALL.CONNECTING', () => {
      const context = { raw: {}, state: {} };
      const result = getSnapshot().machine.implementations.actions.setConnecting?.assignment({
        context,
        event: { type: 'CALL.ENTER_ROOM', room: 'room', participantName: 'participantName' },
      });

      expect(result).toBe(context);
    });

    it('setRoomInfo: возвращает context при event.type !== CALL.ENTER_ROOM', () => {
      const context = { raw: {}, state: {} };
      const result = getSnapshot().machine.implementations.actions.setRoomInfo?.assignment({
        context,
        event: { type: 'CALL.CONNECTING', number: '1', answer: false },
      });

      expect(result).toBe(context);
    });

    it('setRoomInfo: при CALL.ENTER_ROOM с token задаёт conference равным room', () => {
      const context = { raw: { ...connectPayload }, state: { ...connectPayload } };
      const room = 'room-as-conference';
      const token = 'jwt-inline';

      const result = getSnapshot().machine.implementations.actions.setRoomInfo?.assignment({
        context,
        event: {
          type: 'CALL.ENTER_ROOM',
          room,
          participantName: 'Alice',
          token,
        },
      });

      expect(result).toEqual({
        raw: {
          ...connectPayload,
          room,
          participantName: 'Alice',
          token,
          conferenceForToken: room,
        },
      });
    });

    it('setRoomInfo: при CALL.ENTER_ROOM без token для обычной комнаты не задаёт token и conference', () => {
      const context = { raw: { ...connectPayload }, state: { ...connectPayload } };

      const result = getSnapshot().machine.implementations.actions.setRoomInfo?.assignment({
        context,
        event: { type: 'CALL.ENTER_ROOM', ...room1Payload },
      });

      expect(result).toEqual({
        raw: {
          ...connectPayload,
          room: room1Payload.room,
          participantName: room1Payload.participantName,
        },
      });
    });

    it('setTokenInfo: возвращает context при event.type !== CALL.TOKEN_ISSUED', () => {
      const context = { raw: {}, state: {} };
      const result = getSnapshot().machine.implementations.actions.setTokenInfo?.assignment({
        context,
        event: { type: 'CALL.ENTER_ROOM', room: 'room', participantName: 'participantName' },
      });

      expect(result).toBe(context);
    });
  });

  describe('buildStateContext', () => {
    it('default: возвращает пустой объект для неизвестного state', () => {
      // @ts-expect-error: unknown state
      const result = buildStateContext('unknown', {
        ...connectPayload,
        ...token1Context,
      });

      expect(result).toEqual({});
    });
  });
});
