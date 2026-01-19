import { createManagers } from '@/__fixtures__/createManagers';
import { EContentedStreamCodec } from '@/ApiManager';
import ContentedStreamManager from '../@ContentedStreamManager';

import type { ApiManager } from '@/ApiManager';

describe('ContentedStreamManager', () => {
  let apiManager: ApiManager;
  let manager: ContentedStreamManager;

  beforeEach(() => {
    apiManager = createManagers().apiManager;
    manager = new ContentedStreamManager();
  });

  afterEach(() => {
    manager.stateMachine.stop();
  });

  describe('Создание менеджера', () => {
    it('должен создавать экземпляр с events и stateMachine', () => {
      expect(manager.events).toBeDefined();
      expect(manager.stateMachine).toBeDefined();
      expect(manager.stateMachine).toBeInstanceOf(Object); // ContentedStreamStateMachine
    });
  });

  describe('Геттеры-прокси к StateMachine', () => {
    it('isAvailable должен проксировать к stateMachine.isAvailable', () => {
      expect(manager.isAvailable).toBe(false);

      // Имитируем событие available
      manager.stateMachine.send({
        type: 'CONTENTED_STREAM.AVAILABLE',
        codec: EContentedStreamCodec.H264,
      });

      expect(manager.isAvailable).toBe(true);
    });

    it('codec должен проксировать к stateMachine.codec', () => {
      expect(manager.codec).toBeUndefined();

      // Имитируем событие available
      manager.stateMachine.send({
        type: 'CONTENTED_STREAM.AVAILABLE',
        codec: EContentedStreamCodec.H264,
      });

      expect(manager.codec).toBe('H264');
    });

    it('getStateInfo должен проксировать к stateMachine.getStateInfo', () => {
      expect(manager.getStateInfo()).toEqual({ isAvailable: false, codec: undefined });

      // Имитируем событие available
      manager.stateMachine.send({
        type: 'CONTENTED_STREAM.AVAILABLE',
        codec: EContentedStreamCodec.H264,
      });

      expect(manager.getStateInfo()).toEqual({
        isAvailable: true,
        codec: EContentedStreamCodec.H264,
      });
    });
  });

  describe('Метод reset', () => {
    it('должен вызывать reset на stateMachine', () => {
      // Сначала сделаем available
      manager.stateMachine.send({
        type: 'CONTENTED_STREAM.AVAILABLE',
        codec: EContentedStreamCodec.H264,
      });
      expect(manager.isAvailable).toBe(true);

      manager.reset();

      expect(manager.isAvailable).toBe(false);
      expect(manager.codec).toBeUndefined();
    });
  });

  describe('Методы подписки на события', () => {
    it('on должен проксировать к events.on', () => {
      const handler = jest.fn();
      const spy = jest.spyOn(manager.events, 'on');

      const unsubscribe = manager.on('available', handler);

      expect(typeof unsubscribe).toBe('function');
      expect(spy).toHaveBeenCalledWith('available', handler);

      spy.mockRestore();
    });

    it('once должен проксировать к events.once', () => {
      const handler = jest.fn();
      const spy = jest.spyOn(manager.events, 'once');

      const unsubscribe = manager.once('available', handler);

      expect(typeof unsubscribe).toBe('function');
      expect(spy).toHaveBeenCalledWith('available', handler);

      spy.mockRestore();
    });

    it('off должен проксировать к events.off', () => {
      const handler = jest.fn();
      const spy = jest.spyOn(manager.events, 'off');

      manager.off('available', handler);

      expect(spy).toHaveBeenCalledWith('available', handler);

      spy.mockRestore();
    });
  });

  describe('Интеграция с ApiManager событиями', () => {
    it('должен триггерить событие available при contented-stream:available от ApiManager', () => {
      const handler = jest.fn();

      manager.on('available', handler);
      manager.subscribeToApiEvents(apiManager);

      apiManager.events.trigger('contented-stream:available', {
        codec: EContentedStreamCodec.H264,
      });

      expect(handler).toHaveBeenCalledWith({ codec: EContentedStreamCodec.H264 });
    });

    it('должен триггерить событие not-available при contented-stream:not-available от ApiManager', () => {
      const handler = jest.fn();

      manager.on('not-available', handler);
      manager.subscribeToApiEvents(apiManager);

      // Сначала переводим в AVAILABLE
      apiManager.events.trigger('contented-stream:available', {
        codec: EContentedStreamCodec.H264,
      });

      // Теперь триггерим not-available
      apiManager.events.trigger('contented-stream:not-available', {});

      expect(handler).toHaveBeenCalledWith({});
    });

    it('должен корректно передавать codec из ApiManager события', () => {
      manager.subscribeToApiEvents(apiManager);

      apiManager.events.trigger('contented-stream:available', {
        codec: EContentedStreamCodec.H264,
      });
      expect(manager.codec).toBe('H264');

      apiManager.events.trigger('contented-stream:available', { codec: EContentedStreamCodec.VP8 });
      expect(manager.codec).toBe('VP8');
    });

    it('должен корректно обрабатывать available без codec', () => {
      manager.subscribeToApiEvents(apiManager);

      apiManager.events.trigger('contented-stream:available', {});
      expect(manager.isAvailable).toBe(true);
      expect(manager.codec).toBeUndefined();
    });
  });

  describe('Полный жизненный цикл через ApiManager', () => {
    it('должен корректно проходить полный цикл событий', () => {
      const availableEvents: { codec?: EContentedStreamCodec }[] = [];
      const notAvailableEvents: Record<string, never>[] = [];

      manager.on('available', (data) => {
        return availableEvents.push(data);
      });
      manager.on('not-available', (data) => {
        return notAvailableEvents.push(data);
      });

      manager.subscribeToApiEvents(apiManager);

      // Первый available
      apiManager.events.trigger('contented-stream:available', {
        codec: EContentedStreamCodec.H264,
      });
      expect(manager.isAvailable).toBe(true);
      expect(manager.codec).toBe('H264');
      expect(availableEvents).toEqual([{ codec: EContentedStreamCodec.H264 }]);

      // Второй available с новым codec
      apiManager.events.trigger('contented-stream:available', { codec: EContentedStreamCodec.VP8 });
      expect(manager.isAvailable).toBe(true);
      expect(manager.codec).toBe('VP8');
      expect(availableEvents).toEqual([
        { codec: EContentedStreamCodec.H264 },
        { codec: EContentedStreamCodec.VP8 },
      ]);

      // Not available
      apiManager.events.trigger('contented-stream:not-available', {});
      expect(manager.isAvailable).toBe(false);
      expect(manager.codec).toBeUndefined();
      expect(notAvailableEvents).toEqual([{}]);
    });
  });
});
