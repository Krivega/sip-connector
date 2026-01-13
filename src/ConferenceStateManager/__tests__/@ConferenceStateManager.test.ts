import ConferenceStateManager from '../@ConferenceStateManager';

import type { TChannels } from '@/ApiManager/types';

describe('ConferenceStateManager', () => {
  let manager: ConferenceStateManager;

  beforeEach(() => {
    manager = new ConferenceStateManager();
  });

  describe('getState', () => {
    it('должен возвращать пустое состояние по умолчанию', () => {
      const state = manager.getState();

      expect(state).toEqual({});
    });

    it('должен возвращать readonly копию состояния', () => {
      manager.updateState({ number: '123' });

      const state1 = manager.getState();
      const state2 = manager.getState();

      expect(state1).toEqual({ number: '123' });
      expect(state1).not.toBe(state2);
    });
  });

  describe('updateState', () => {
    it('должен обновлять состояние', () => {
      manager.updateState({ number: '123', answer: false });

      expect(manager.getState()).toEqual({ number: '123', answer: false });
    });

    it('должен частично обновлять состояние', () => {
      manager.updateState({ number: '123', answer: false });
      manager.updateState({ answer: true });

      expect(manager.getState()).toEqual({ number: '123', answer: true });
    });

    it('должен обновлять данные конференции', () => {
      manager.updateState({
        room: 'room123',
        participantName: 'John Doe',
        token: 'jwt-token',
        conference: 'conf123',
        participant: 'user456',
      });

      const state = manager.getState();

      expect(state.room).toBe('room123');
      expect(state.participantName).toBe('John Doe');
      expect(state.token).toBe('jwt-token');
      expect(state.conference).toBe('conf123');
      expect(state.participant).toBe('user456');
    });

    it('должен обновлять channels', () => {
      const channels: TChannels = {
        inputChannels: 'input1,input2',
        outputChannels: 'output1,output2',
      };

      manager.updateState({ channels });

      expect(manager.getState().channels).toEqual(channels);
    });

    it('должен триггерить событие state-changed', () => {
      const handler = jest.fn();

      manager.on('state-changed', handler);
      manager.updateState({ number: '123' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        previous: {},
        current: { number: '123' },
        updates: { number: '123' },
      });
    });

    it('должен передавать предыдущее состояние в событии', () => {
      const handler = jest.fn();

      manager.updateState({ number: '123' });
      manager.on('state-changed', handler);
      manager.updateState({ answer: true });

      expect(handler).toHaveBeenCalledWith({
        previous: { number: '123' },
        current: { number: '123', answer: true },
        updates: { answer: true },
      });
    });
  });

  describe('reset', () => {
    it('должен очищать состояние', () => {
      manager.updateState({ number: '123', answer: true, room: 'room1' });
      manager.reset();

      expect(manager.getState()).toEqual({});
    });

    it('должен триггерить событие state-reset', () => {
      const handler = jest.fn();

      manager.on('state-reset', handler);
      manager.reset();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({});
    });
  });

  describe('геттеры', () => {
    it('getToken должен возвращать токен', () => {
      manager.updateState({ token: 'jwt-token' });

      expect(manager.getToken()).toBe('jwt-token');
    });

    it('getRoom должен возвращать room', () => {
      manager.updateState({ room: 'room123' });

      expect(manager.getRoom()).toBe('room123');
    });

    it('getParticipantName должен возвращать participantName', () => {
      manager.updateState({ participantName: 'John Doe' });

      expect(manager.getParticipantName()).toBe('John Doe');
    });

    it('getChannels должен возвращать channels', () => {
      const channels: TChannels = {
        inputChannels: 'input1',
        outputChannels: 'output1',
      };

      manager.updateState({ channels });

      expect(manager.getChannels()).toEqual(channels);
    });

    it('getConference должен возвращать conference', () => {
      manager.updateState({ conference: 'conf123' });

      expect(manager.getConference()).toBe('conf123');
    });

    it('getParticipant должен возвращать participant', () => {
      manager.updateState({ participant: 'user456' });

      expect(manager.getParticipant()).toBe('user456');
    });

    it('getNumber должен возвращать number', () => {
      manager.updateState({ number: '123' });

      expect(manager.getNumber()).toBe('123');
    });

    it('getAnswer должен возвращать answer', () => {
      manager.updateState({ answer: true });

      expect(manager.getAnswer()).toBe(true);
    });

    it('геттеры должны возвращать undefined для несуществующих значений', () => {
      expect(manager.getToken()).toBeUndefined();
      expect(manager.getRoom()).toBeUndefined();
      expect(manager.getParticipantName()).toBeUndefined();
      expect(manager.getChannels()).toBeUndefined();
      expect(manager.getConference()).toBeUndefined();
      expect(manager.getParticipant()).toBeUndefined();
      expect(manager.getNumber()).toBeUndefined();
      expect(manager.getAnswer()).toBeUndefined();
    });
  });

  describe('события', () => {
    it('on должен подписываться на события', () => {
      const handler = jest.fn();

      manager.on('state-changed', handler);
      manager.updateState({ number: '123' });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('once должен подписываться на событие один раз', () => {
      const handler = jest.fn();

      manager.once('state-changed', handler);
      manager.updateState({ number: '123' });
      manager.updateState({ number: '456' });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('off должен отписываться от событий', () => {
      const handler = jest.fn();

      manager.on('state-changed', handler);
      manager.off('state-changed', handler);
      manager.updateState({ number: '123' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('интеграция с данными звонка', () => {
    it('должен хранить данные звонка и конференции одновременно', () => {
      manager.updateState({
        number: '123',
        answer: false,
        room: 'room1',
        participantName: 'John',
        token: 'jwt-token',
      });

      const state = manager.getState();

      expect(state.number).toBe('123');
      expect(state.answer).toBe(false);
      expect(state.room).toBe('room1');
      expect(state.participantName).toBe('John');
      expect(state.token).toBe('jwt-token');
    });
  });
});
