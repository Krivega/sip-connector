/// <reference types="jest" />
import { VideoSendingEventHandler } from '../VideoSendingEventHandler';

import type { ApiManager } from '@/ApiManager';
import type { IMainCamHeaders } from '../types';

describe('VideoSendingEventHandler', () => {
  let eventHandler: VideoSendingEventHandler;
  let apiManager: jest.Mocked<ApiManager>;

  beforeEach(() => {
    apiManager = {
      on: jest.fn(),
      off: jest.fn(),
    } as unknown as jest.Mocked<ApiManager>;

    eventHandler = new VideoSendingEventHandler(apiManager);
  });

  describe('constructor', () => {
    it('должен создать экземпляр с SipConnector', () => {
      expect(eventHandler).toBeInstanceOf(VideoSendingEventHandler);
    });
  });

  describe('subscribe', () => {
    it('должен подписаться на события main-cam-control', () => {
      const handler = jest.fn();

      eventHandler.subscribe(handler);

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler);
    });

    it('должен сохранить текущий обработчик', () => {
      const handler = jest.fn();

      eventHandler.subscribe(handler);

      // Проверяем, что обработчик сохранился для последующей отписки
      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler);
    });

    it('должен заменить предыдущий обработчик при повторной подписке', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventHandler.subscribe(handler1);
      eventHandler.subscribe(handler2);

      expect(apiManager.on).toHaveBeenCalledTimes(2);
      expect(apiManager.on).toHaveBeenNthCalledWith(1, 'main-cam-control', handler1);
      expect(apiManager.on).toHaveBeenNthCalledWith(2, 'main-cam-control', handler2);
    });
  });

  describe('unsubscribe', () => {
    it('должен отписаться от событий если есть текущий обработчик', () => {
      const handler = jest.fn();

      eventHandler.subscribe(handler);
      eventHandler.unsubscribe();

      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', handler);
    });

    it('должен очистить текущий обработчик после отписки', () => {
      const handler = jest.fn();

      eventHandler.subscribe(handler);
      eventHandler.unsubscribe();

      // Повторная отписка не должна вызывать off
      eventHandler.unsubscribe();

      expect(apiManager.off).toHaveBeenCalledTimes(1);
    });

    it('должен ничего не делать если нет текущего обработчика', () => {
      eventHandler.unsubscribe();

      expect(apiManager.off).not.toHaveBeenCalled();
    });

    it('должен отписаться от правильного обработчика', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventHandler.subscribe(handler1);
      eventHandler.subscribe(handler2);
      eventHandler.unsubscribe();

      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', handler2);
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно обрабатывать полный цикл подписки и отписки', () => {
      const handler = jest.fn();

      // Подписка
      eventHandler.subscribe(handler);
      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler);

      // Отписка
      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', handler);

      // Повторная отписка не должна вызывать off
      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledTimes(1);
    });

    it('должен корректно обрабатывать смену обработчиков', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      // Первая подписка
      eventHandler.subscribe(handler1);
      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler1);

      // Смена обработчика
      eventHandler.subscribe(handler2);
      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler2);

      // Отписка от второго обработчика
      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', handler2);
    });

    it('должен корректно обрабатывать множественные подписки и отписки', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      // Подписка 1
      eventHandler.subscribe(handler1);
      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler1);

      // Подписка 2
      eventHandler.subscribe(handler2);
      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler2);

      // Отписка
      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', handler2);

      // Подписка 3
      eventHandler.subscribe(handler3);
      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler3);

      // Финальная отписка
      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', handler3);
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать undefined handler', () => {
      const handler = undefined as unknown as (headers: IMainCamHeaders) => void;

      eventHandler.subscribe(handler);

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler);
    });

    it('должен корректно обрабатывать null handler', () => {
      // eslint-disable-next-line unicorn/no-null
      const handler = null as unknown as (headers: IMainCamHeaders) => void;

      eventHandler.subscribe(handler);

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler);
    });

    it('должен корректно обрабатывать пустую функцию handler', () => {
      const handler = () => {};

      eventHandler.subscribe(handler);

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', handler);
    });
  });
});
