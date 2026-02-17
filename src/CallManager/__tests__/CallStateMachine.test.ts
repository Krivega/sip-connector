import { createApiManagerEvents } from '@/ApiManager';
import { PURGATORY_CONFERENCE_NUMBER } from '@/tools/hasPurgatory';
import { CallStateMachine, EState } from '../CallStateMachine';
import { createEvents } from '../events';

import type { TApiManagerEvents } from '@/ApiManager';
import type { TEventName, TEvents } from '../events';

describe('CallStateMachine', () => {
  let apiManagerEvents: TApiManagerEvents;
  let events: TEvents;
  let machine: CallStateMachine;

  const connectPayload = { number: '100', answer: false };
  const token1Payload = { jwt: 'jwt1', conference: 'conf-1', participant: 'p-1' };
  const token1Context = {
    token: token1Payload.jwt,
  };
  const token2Payload = { jwt: 'jwt2', conference: 'conf-2', participant: 'p-2' };
  const token2Context = {
    token: token2Payload.jwt,
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
        title: 'CALL.ENTER_ROOM в CONNECTING оставляет CONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.ENTER_ROOM', ...room1Payload },
        expected: EState.CONNECTING,
      },
      {
        title: 'CALL.TOKEN_ISSUED в CONNECTING оставляет CONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.TOKEN_ISSUED', ...token1Payload },
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
        title: 'CALL.RESET из CONNECTING в IDLE',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
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
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.isInRoom).toBe(false);
      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });
      expect(machine.isInRoom).toBe(true);
    });

    it('isInPurgatory должен возвращать true только для PURGATORY', () => {
      expect(machine.isInPurgatory).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isInPurgatory).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.isInPurgatory).toBe(true);
      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });
      expect(machine.isInPurgatory).toBe(false);
    });

    it('isP2PRoom должен возвращать true только для P2P_ROOM', () => {
      expect(machine.isP2PRoom).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isP2PRoom).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
      expect(machine.isP2PRoom).toBe(true);
      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });
      expect(machine.isP2PRoom).toBe(false);
    });

    it('isDirectP2PRoom должен возвращать true только для DIRECT_P2P_ROOM', () => {
      expect(machine.isDirectP2PRoom).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isDirectP2PRoom).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
      expect(machine.isDirectP2PRoom).toBe(true);
      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });
      expect(machine.isDirectP2PRoom).toBe(false);
    });

    it('isPending должен возвращать true только для CONNECTING', () => {
      expect(machine.isPending).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isPending).toBe(true);
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.isPending).toBe(false);
    });

    it('isActive должен возвращать true для IN_ROOM, PURGATORY, P2P_ROOM и DIRECT_P2P_ROOM', () => {
      expect(machine.isActive).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isActive).toBe(false);
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.isActive).toBe(true);
      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });
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

  describe('inRoomContext', () => {
    it('возвращает undefined в IDLE', () => {
      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает undefined в CONNECTING без room и token', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });

      expect(machine.inRoomContext).toBeUndefined();
    });

    it('возвращает undefined в CONNECTING с room без token', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });

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

    it('возвращает контекст типа TInRoomContext в IN_ROOM со всеми полями', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: token1Context.token,
      });

      expect(machine.state).toBe(EState.IN_ROOM);

      const context = machine.inRoomContext;

      expect(context).toBeDefined();
      expect(context).toMatchObject({
        ...connectPayload,
        ...room1Payload,
        ...token1Context,
      });
      expect(context?.number).toBe(connectPayload.number);
      expect(context?.answer).toBe(connectPayload.answer);
      expect(context?.room).toBe(room1Payload.room);
      expect(context?.participantName).toBe(room1Payload.participantName);
      expect(context?.token).toBe(token1Context.token);
    });

    it('возвращает обновлённый контекст при смене room в IN_ROOM', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: token1Context.token,
      });

      expect(machine.inRoomContext?.room).toBe(room1Payload.room);

      machine.send({ type: 'CALL.ENTER_ROOM', ...room2Payload });

      expect(machine.inRoomContext).toBeDefined();
      expect(machine.inRoomContext?.room).toBe(room2Payload.room);
      expect(machine.inRoomContext?.participantName).toBe(room2Payload.participantName);
    });

    it('возвращает обновлённый контекст при смене token в IN_ROOM', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: token1Context.token,
      });

      expect(machine.inRoomContext?.token).toBe(token1Context.token);

      machine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: token2Context.token,
      });

      expect(machine.inRoomContext).toBeDefined();
      expect(machine.inRoomContext?.token).toBe(token2Context.token);
    });

    it('возвращает undefined после перехода из IN_ROOM в IDLE по RESET', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: token1Context.token,
      });

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
      expect(machine.context).toEqual(connectPayload);

      events.trigger('ended', {} as never);

      expect(machine.state).toBe(EState.IDLE);
      expect(machine.context).toEqual({});
    });

    it('должен переходить в IDLE при событии failed', () => {
      events.trigger('start-call', connectPayload);

      events.trigger('failed', undefined as never);

      expect(machine.state).toBe(EState.IDLE);
      expect(machine.context).toEqual({});
    });
  });

  describe('Интеграция с событиями ApiManager', () => {
    it('должен обновлять данные из "enter-room"', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', room1Payload);

      expect(machine.state).toBe(EState.CONNECTING);
      expect(machine.context).toEqual({ ...connectPayload, ...room1Payload });

      apiManagerEvents.trigger('enter-room', room2Payload);

      expect(machine.state).toBe(EState.CONNECTING);
      expect(machine.context).toEqual({ ...connectPayload, ...room2Payload });
    });

    it('должен обновлять данные из "conference:participant-token-issued"', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.CONNECTING);
      expect(machine.context).toEqual({ ...connectPayload, ...token1Context });

      apiManagerEvents.trigger('conference:participant-token-issued', token2Payload);

      expect(machine.state).toBe(EState.CONNECTING);
      expect(machine.context).toEqual({ ...connectPayload, ...token2Context });
    });

    it('должен переходить в IN_ROOM по наличию всех данных', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', room1Payload);
      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.context).toEqual({ ...connectPayload, ...room1Payload, ...token1Context });
    });

    it('должен обновлять данные в IN_ROOM', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', room1Payload);
      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.context).toEqual({ ...connectPayload, ...room1Payload, ...token1Context });

      apiManagerEvents.trigger('conference:participant-token-issued', token2Payload);

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.context).toEqual({ ...connectPayload, ...room1Payload, ...token2Context });

      apiManagerEvents.trigger('enter-room', room2Payload);

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.context).toEqual({ ...connectPayload, ...room2Payload, ...token2Context });
    });

    it('должен переходить в IN_ROOM по enter-room с bearerToken', () => {
      const bearerToken = 'jwt-from-enter-room';

      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', { ...room1Payload, bearerToken });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.context).toEqual({
        ...connectPayload,
        ...room1Payload,
        token: bearerToken,
      });
      expect(machine.inRoomContext?.token).toBe(bearerToken);
    });

    it('должен переходить в PURGATORY по enter-room с room purgatory без token', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', purgatoryPayload);

      expect(machine.state).toBe(EState.PURGATORY);
      expect(machine.context).toMatchObject({
        ...connectPayload,
        ...purgatoryPayload,
      });
    });

    it('должен переходить из PURGATORY в IN_ROOM при получении token', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', purgatoryPayload);
      expect(machine.state).toBe(EState.PURGATORY);

      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe(token1Context.token);
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
      expect(machine.context).toMatchObject({
        ...connectPayload,
        ...p2pRoomPayload,
      });
    });

    it('должен переходить в DIRECT_P2P_ROOM по enter-room с p2p комнатой без token', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', directP2pRoomPayload);

      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
      expect(machine.context).toMatchObject({
        ...connectPayload,
        ...directP2pRoomPayload,
      });
    });

    it('должен переходить в DIRECT_P2P_ROOM по enter-room с флагом isDirectPeerToPeer даже без p2p имени комнаты', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', {
        ...room1Payload,
        isDirectPeerToPeer: true,
      });

      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
      expect(machine.context).toMatchObject({
        ...connectPayload,
        ...room1Payload,
        isDirectPeerToPeer: true,
      });
    });

    it('должен переходить из P2P_ROOM в IN_ROOM при получении token', () => {
      events.trigger('start-call', connectPayload);
      apiManagerEvents.trigger('enter-room', p2pRoomPayload);
      expect(machine.state).toBe(EState.P2P_ROOM);

      apiManagerEvents.trigger('conference:participant-token-issued', token1Payload);

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe(token1Context.token);
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
    it('PURGATORY -> IN_ROOM: по CALL.TOKEN_ISSUED', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });
      expect(machine.state).toBe(EState.PURGATORY);

      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe(token1Context.token);
      expect(machine.inRoomContext?.room).toBe(PURGATORY_CONFERENCE_NUMBER);
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
      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });
      expect(machine.state).toBe(EState.IN_ROOM);

      machine.send({ type: 'CALL.ENTER_ROOM', ...purgatoryPayload });

      expect(machine.state).toBe(EState.PURGATORY);
      expect(machine.context).toMatchObject({
        ...connectPayload,
        ...purgatoryPayload,
      });
      expect(machine.inRoomContext).toBeUndefined();
    });
  });

  describe('Переходы P2P_ROOM ↔ IN_ROOM', () => {
    it('P2P_ROOM -> IN_ROOM: по CALL.TOKEN_ISSUED', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });
      expect(machine.state).toBe(EState.P2P_ROOM);

      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe(token1Context.token);
      expect(machine.inRoomContext?.room).toBe(p2pRoomPayload.room);
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
      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });
      expect(machine.state).toBe(EState.IN_ROOM);

      machine.send({ type: 'CALL.ENTER_ROOM', ...p2pRoomPayload });

      expect(machine.state).toBe(EState.P2P_ROOM);
      expect(machine.context).toMatchObject({
        ...connectPayload,
        ...p2pRoomPayload,
      });
      expect(machine.inRoomContext).toBeUndefined();
    });
  });

  describe('Переходы DIRECT_P2P_ROOM ↔ IN_ROOM', () => {
    it('DIRECT_P2P_ROOM -> IN_ROOM: по CALL.TOKEN_ISSUED', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });
      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);

      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });

      expect(machine.state).toBe(EState.IN_ROOM);
      expect(machine.inRoomContext?.token).toBe(token1Context.token);
      expect(machine.inRoomContext?.room).toBe(directP2pRoomPayload.room);
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
      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });
      expect(machine.state).toBe(EState.IN_ROOM);

      machine.send({ type: 'CALL.ENTER_ROOM', ...directP2pRoomPayload });

      expect(machine.state).toBe(EState.DIRECT_P2P_ROOM);
      expect(machine.context).toMatchObject({
        ...connectPayload,
        ...directP2pRoomPayload,
      });
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
      const context = {};
      const result = getSnapshot().machine.implementations.actions.setConnecting?.assignment({
        context,
        event: { type: 'CALL.ENTER_ROOM', room: 'room', participantName: 'participantName' },
      });

      expect(result).toBe(context);
    });

    it('setRoomInfo: возвращает context при event.type !== CALL.ENTER_ROOM', () => {
      const context = {};
      const result = getSnapshot().machine.implementations.actions.setRoomInfo?.assignment({
        context,
        event: { type: 'CALL.CONNECTING', number: '1', answer: false },
      });

      expect(result).toBe(context);
    });

    it('setTokenInfo: возвращает context при event.type !== CALL.TOKEN_ISSUED', () => {
      const context = {};
      const result = getSnapshot().machine.implementations.actions.setTokenInfo?.assignment({
        context,
        event: { type: 'CALL.ENTER_ROOM', room: 'room', participantName: 'participantName' },
      });

      expect(result).toBe(context);
    });
  });
});
