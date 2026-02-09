import { createApiManagerEvents } from '@/ApiManager';
import { CallStateMachine, EState } from '../CallStateMachine';
import { createEvents } from '../events';

import type { EndEvent } from '@krivega/jssip';
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
        title: 'CALL.FAILED из CONNECTING в FAILED',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
        },
        event: { type: 'CALL.FAILED', error: new Error('fail') as unknown as EndEvent },
        expected: EState.FAILED,
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
        title: 'CALL.CONNECTING из FAILED возвращает в CONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.FAILED', error: new Error('fail') as unknown as EndEvent });
        },
        event: { type: 'CALL.CONNECTING', number: '200', answer: true },
        expected: EState.CONNECTING,
      },
      {
        title: 'CALL.RESET из FAILED оставляет FAILED',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
          machine.send({ type: 'CALL.FAILED', error: new Error('fail') as unknown as EndEvent });
        },
        event: { type: 'CALL.RESET' },
        expected: EState.FAILED,
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
          { event: 'failed', expected: EState.FAILED },
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
      machine.send({ type: 'CALL.ENTER_ROOM', ...room1Payload });
      machine.send({ type: 'CALL.TOKEN_ISSUED', token: token1Context.token });
      expect(machine.isInRoom).toBe(true);
    });

    it('isFailed должен возвращать true только для FAILED', () => {
      expect(machine.isFailed).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.FAILED', error: new Error('fail') as unknown as EndEvent });
      expect(machine.isFailed).toBe(true);
    });

    it('isPending должен возвращать true только для CONNECTING', () => {
      expect(machine.isPending).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isPending).toBe(true);
    });

    it('isActive должен возвращать true только для IN_ROOM', () => {
      expect(machine.isActive).toBe(false);
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      expect(machine.isActive).toBe(false);
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

    it('возвращает undefined в FAILED', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.FAILED', error: new Error('fail') as unknown as EndEvent });

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

  describe('Обработка ошибок', () => {
    it('error должен быть undefined в начальном состоянии', () => {
      expect(machine.error).toBeUndefined();
    });

    it('error должен сохранять Error при CALL.FAILED', () => {
      const testError = new Error('Connection failed');

      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.FAILED', error: testError as unknown as EndEvent });

      expect(machine.state).toBe(EState.FAILED);
      expect(machine.error).toBe(testError);
      expect(machine.error?.message).toBe('Connection failed');
    });

    it('error должен конвертировать non-Error в Error', () => {
      machine.send({ type: 'CALL.CONNECTING', ...connectPayload });
      machine.send({ type: 'CALL.FAILED', error: 'String error' as unknown as EndEvent });

      expect(machine.error).toBeInstanceOf(Error);
      expect(machine.error?.message).toBe('"String error"');
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

    it('должен сохранять ошибку из события failed', () => {
      events.trigger('start-call', connectPayload);

      const error = new Error('Call failed') as unknown as EndEvent;

      events.trigger('failed', error as never);

      expect(machine.state).toBe(EState.FAILED);
      expect(machine.error).toBe(error);
      expect(machine.context).toEqual({ error });
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
                setError?: AssignAction;
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
        event: { type: 'CALL.ENTER_ROOM', room: 'r', participantName: 'p' },
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
        event: { type: 'CALL.ENTER_ROOM', room: 'r', participantName: 'p' },
      });

      expect(result).toBe(context);
    });

    it('setError: возвращает context при event.type !== CALL.FAILED', () => {
      const context = {};
      const result = getSnapshot().machine.implementations.actions.setError?.assignment({
        context,
        event: { type: 'CALL.RESET' },
      });

      expect(result).toBe(context);
    });
  });
});
