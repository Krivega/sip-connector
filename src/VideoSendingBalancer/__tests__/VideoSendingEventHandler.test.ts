/// <reference types="jest" />
import { VideoSendingEventHandler } from '../VideoSendingEventHandler';

import type { ApiManager } from '@/ApiManager';
import type { IMainCamHeaders, TBalancingContext } from '../types';

const BALANCING_CONTEXT: TBalancingContext = {};

describe('VideoSendingEventHandler', () => {
  let eventHandler: VideoSendingEventHandler;
  let apiManager: jest.Mocked<ApiManager>;

  const getWrappedHandler = (callIndex = 0) => {
    return apiManager.on.mock.calls[callIndex]?.[1];
  };

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

      eventHandler.subscribe(handler, BALANCING_CONTEXT);

      const wrappedHandler = getWrappedHandler();

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler);
    });

    it('должен передавать контекст в обработчик', () => {
      const handler = jest.fn();
      const context: TBalancingContext = {
        getMaxResolution: () => {
          return { width: 1280, height: 720 };
        },
      };

      eventHandler.subscribe(handler, context);

      const wrappedHandler = getWrappedHandler();
      const headers: IMainCamHeaders = { resolutionMainCam: '1280x720' };

      wrappedHandler(headers);

      expect(handler).toHaveBeenCalledWith(headers, context);
    });

    it('должен сохранить текущий обработчик', () => {
      const handler = jest.fn();

      eventHandler.subscribe(handler, BALANCING_CONTEXT);

      const wrappedHandler = getWrappedHandler();

      eventHandler.unsubscribe();

      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', wrappedHandler);
    });

    it('должен заменить предыдущий обработчик при повторной подписке', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventHandler.subscribe(handler1, BALANCING_CONTEXT);
      eventHandler.subscribe(handler2, BALANCING_CONTEXT);

      const wrappedHandler1 = getWrappedHandler(0);
      const wrappedHandler2 = getWrappedHandler(1);

      expect(apiManager.on).toHaveBeenCalledTimes(2);
      expect(wrappedHandler1).not.toBe(wrappedHandler2);
      expect(apiManager.on).toHaveBeenNthCalledWith(1, 'main-cam-control', wrappedHandler1);
      expect(apiManager.on).toHaveBeenNthCalledWith(2, 'main-cam-control', wrappedHandler2);
    });
  });

  describe('unsubscribe', () => {
    it('должен отписаться от событий если есть текущий обработчик', () => {
      const handler = jest.fn();

      eventHandler.subscribe(handler, BALANCING_CONTEXT);

      const wrappedHandler = getWrappedHandler();

      eventHandler.unsubscribe();

      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', wrappedHandler);
    });

    it('должен очистить текущий обработчик после отписки', () => {
      const handler = jest.fn();

      eventHandler.subscribe(handler, BALANCING_CONTEXT);
      eventHandler.unsubscribe();

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

      eventHandler.subscribe(handler1, BALANCING_CONTEXT);
      eventHandler.subscribe(handler2, BALANCING_CONTEXT);

      const wrappedHandler2 = getWrappedHandler(1);

      eventHandler.unsubscribe();

      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', wrappedHandler2);
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно обрабатывать полный цикл подписки и отписки', () => {
      const handler = jest.fn();

      eventHandler.subscribe(handler, BALANCING_CONTEXT);

      const wrappedHandler = getWrappedHandler();

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler);

      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', wrappedHandler);

      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledTimes(1);
    });

    it('должен корректно обрабатывать смену обработчиков', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventHandler.subscribe(handler1, BALANCING_CONTEXT);

      const wrappedHandler1 = getWrappedHandler();

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler1);

      eventHandler.subscribe(handler2, BALANCING_CONTEXT);

      const wrappedHandler2 = getWrappedHandler(1);

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler2);

      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', wrappedHandler2);
    });

    it('должен корректно обрабатывать множественные подписки и отписки', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventHandler.subscribe(handler1, BALANCING_CONTEXT);

      const wrappedHandler1 = getWrappedHandler();

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler1);

      eventHandler.subscribe(handler2, BALANCING_CONTEXT);

      const wrappedHandler2 = getWrappedHandler(1);

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler2);

      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', wrappedHandler2);

      eventHandler.subscribe(handler3, BALANCING_CONTEXT);

      const wrappedHandler3 = getWrappedHandler(2);

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler3);

      eventHandler.unsubscribe();
      expect(apiManager.off).toHaveBeenCalledWith('main-cam-control', wrappedHandler3);
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать undefined handler', () => {
      const handler = undefined as unknown as (
        headers: IMainCamHeaders,
        context: TBalancingContext,
      ) => void;

      eventHandler.subscribe(handler, BALANCING_CONTEXT);

      const wrappedHandler = getWrappedHandler();

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler);
    });

    it('должен корректно обрабатывать null handler', () => {
      // eslint-disable-next-line unicorn/no-null
      const handler = null as unknown as (
        headers: IMainCamHeaders,
        context: TBalancingContext,
      ) => void;

      eventHandler.subscribe(handler, BALANCING_CONTEXT);

      const wrappedHandler = getWrappedHandler();

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler);
    });

    it('должен корректно обрабатывать пустую функцию handler', () => {
      const handler = () => {};

      eventHandler.subscribe(handler, BALANCING_CONTEXT);

      const wrappedHandler = getWrappedHandler();

      expect(apiManager.on).toHaveBeenCalledWith('main-cam-control', wrappedHandler);
    });
  });
});
