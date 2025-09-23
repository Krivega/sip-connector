/* eslint-disable no-await-in-loop */

/// <reference types="jest" />
import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import delayPromise from '@/__fixtures__/delayPromise';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EEventsMainCAM } from '@/ApiManager';
import { doMockSipConnector } from '@/doMock';
import logger from '@/logger';
import VideoSendingBalancer, { resolveVideoSendingBalancer } from '../@VideoSendingBalancer';
import { createMockTrack } from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { IBalancerOptions, IMainCamHeaders } from '../types';

jest.mock('../../logger', () => {
  return jest.fn();
});

describe('VideoSendingBalancer', () => {
  let balancer: VideoSendingBalancer;
  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let apiManager: ApiManager;
  let mockConnection: RTCPeerConnection;
  let mockVideoTrack: MediaStreamVideoTrack;
  let mockSender: RTCRtpSender;

  beforeEach(() => {
    // Создаем реальный SipConnector с замоканным JsSIP
    sipConnector = doMockSipConnector();

    // Создаем видео трек
    mockVideoTrack = createVideoMediaStreamTrackMock({
      constraints: { width: 1920, height: 1080 },
    }) as MediaStreamVideoTrack;

    // Создаем sender
    mockSender = new RTCRtpSenderMock({ track: mockVideoTrack });
    Object.defineProperty(mockSender, 'getParameters', {
      value: jest.fn().mockReturnValue({
        encodings: [{ scaleResolutionDownBy: 1, maxBitrate: 1_000_000 }],
      }),
    });
    Object.defineProperty(mockSender, 'setParameters', {
      value: jest.fn().mockResolvedValue(undefined),
    });

    // Создаем RTCPeerConnection
    mockConnection = {
      getSenders: jest.fn().mockReturnValue([mockSender]),
    } as unknown as RTCPeerConnection;

    // Устанавливаем соединение в sipConnector
    Object.defineProperty(sipConnector, 'connection', {
      value: mockConnection,
      writable: true,
    });

    // Добавляем методы для имитации событий (реальный SipConnector уже их имеет)
    apiManager = sipConnector.apiManager;
    balancer = new VideoSendingBalancer(apiManager, () => {
      return sipConnector.connection;
    });
  });

  afterEach(() => {
    balancer.unsubscribe();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('должен создать экземпляр VideoSendingBalancer', () => {
      expect(balancer).toBeInstanceOf(VideoSendingBalancer);
    });

    it('должен создать экземпляр с опциями', () => {
      const options: IBalancerOptions = {
        ignoreForCodec: 'VP8',
        onSetParameters: jest.fn(),
      };

      const balancerWithOptions = new VideoSendingBalancer(
        apiManager,
        () => {
          return sipConnector.connection;
        },
        options,
      );

      expect(balancerWithOptions).toBeInstanceOf(VideoSendingBalancer);
    });
  });

  describe('subscribe', () => {
    it('должен подписаться на события управления главной камерой', () => {
      const spyOn = jest.spyOn(apiManager, 'on');

      balancer.subscribe();

      expect(spyOn).toHaveBeenCalledWith('main-cam-control', expect.any(Function));
    });

    it('должен обрабатывать событие main-cam-control при подписке', async () => {
      const spyOn = jest.spyOn(apiManager, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'main-cam-control') {
          eventHandler = handler as (data: IMainCamHeaders) => void;
        }

        // Возвращаем функцию отписки
        return () => {
          return undefined;
        };
      });

      balancer.subscribe();

      expect(eventHandler).toBeDefined();

      // Имитируем событие
      const testHeaders: IMainCamHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1920x1080',
      };

      expect(eventHandler).toBeDefined();

      // Ждем обработки события без ошибок
      expect(() => {
        eventHandler?.(testHeaders);
      }).not.toThrow();

      // Даем время на обработку асинхронного вызова
      await delayPromise(10);
    });
  });

  describe('unsubscribe', () => {
    it('должен отписаться от событий', () => {
      const spyOff = jest.spyOn(apiManager, 'off');

      balancer.subscribe();
      balancer.unsubscribe();

      expect(spyOff).toHaveBeenCalledWith('main-cam-control', expect.any(Function));
    });

    it('должен сбросить состояние при отписке', () => {
      balancer.subscribe();

      // Устанавливаем заголовки через приватное свойство

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1920x1080',
      };

      balancer.unsubscribe();

      // Проверяем, что заголовки сброшены
      // @ts-expect-error
      expect(balancer.serverHeaders).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('должен сбросить состояние балансировщика', () => {
      // Устанавливаем заголовки

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1920x1080',
      };

      balancer.reset();
      // @ts-expect-error
      expect(balancer.serverHeaders).toBeUndefined();
    });
  });

  describe('balance', () => {
    it('должен выполнить балансировку при наличии соединения', async () => {
      const result = await balancer.balance();

      expect(result).toBeDefined();
      expect(mockConnection.getSenders).toHaveBeenCalled();
    });

    it('должен выбросить ошибку если нет соединения', async () => {
      // Убираем соединение
      Object.defineProperty(sipConnector, 'connection', {
        value: undefined,
        writable: true,
      });

      await expect(balancer.balance()).rejects.toThrow('connection is not exist');
    });

    it('должен работать с заголовками сервера', async () => {
      // Устанавливаем заголовки

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1920x1080',
      };

      const result = await balancer.balance();

      expect(result).toBeDefined();
      expect(mockConnection.getSenders).toHaveBeenCalled();
    });
  });

  describe('handleMainCamControl (через события)', () => {
    it('должен обновить заголовки сервера при получении события', async () => {
      const spyOn = jest.spyOn(apiManager, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'main-cam-control') {
          eventHandler = handler as (data: IMainCamHeaders) => void;
        }

        return () => {
          return undefined;
        };
      });

      balancer.subscribe();

      const testHeaders: IMainCamHeaders = {
        mainCam: EEventsMainCAM.PAUSE_MAIN_CAM,
        resolutionMainCam: '1280x720',
      };

      expect(eventHandler).toBeDefined();

      eventHandler?.(testHeaders);
      // Даем время на обработку
      await delayPromise(10);

      expect((balancer as unknown as { serverHeaders: IMainCamHeaders }).serverHeaders).toEqual(
        testHeaders,
      );
    });

    it('должен вызвать балансировку при получении разных типов событий главной камеры', async () => {
      const spyOn = jest.spyOn(apiManager, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'main-cam-control') {
          eventHandler = handler as (data: IMainCamHeaders) => void;
        }

        return () => {
          return undefined;
        };
      });

      balancer.subscribe();

      // Тестируем разные типы событий
      const events = [
        {
          mainCam: EEventsMainCAM.PAUSE_MAIN_CAM,
          resolutionMainCam: '640x480',
        },
        {
          mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
          resolutionMainCam: '1920x1080',
        },
        {
          mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
          resolutionMainCam: '3840x2160',
        },
        {
          mainCam: EEventsMainCAM.ADMIN_STOP_MAIN_CAM,
        },
        {
          mainCam: EEventsMainCAM.ADMIN_START_MAIN_CAM,
          resolutionMainCam: '1920x1080',
        },
      ];

      expect(eventHandler).toBeDefined();

      for (const headers of events) {
        eventHandler?.(headers);
        // Даем время на обработку каждого события
        await delayPromise(10);

        expect((balancer as unknown as { serverHeaders: IMainCamHeaders }).serverHeaders).toEqual(
          headers,
        );
      }
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно работать полный цикл подписки, события и отписки', async () => {
      const spyOn = jest.spyOn(apiManager, 'on');
      const spyOff = jest.spyOn(apiManager, 'off');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'main-cam-control') {
          eventHandler = handler as (data: IMainCamHeaders) => void;
        }

        return () => {
          return undefined;
        };
      });

      // Подписка
      balancer.subscribe();
      expect(spyOn).toHaveBeenCalledWith('main-cam-control', expect.any(Function));

      // Событие
      const testHeaders: IMainCamHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1920x1080',
      };

      expect(eventHandler).toBeDefined();

      eventHandler?.(testHeaders);
      await delayPromise(10);
      expect((balancer as unknown as { serverHeaders: IMainCamHeaders }).serverHeaders).toEqual(
        testHeaders,
      );

      // Ребалансировка
      const result = await balancer.balance();

      expect(result).toBeDefined();

      // Отписка
      balancer.unsubscribe();
      expect(spyOff).toHaveBeenCalledWith('main-cam-control', expect.any(Function));
      expect(
        (balancer as unknown as { serverHeaders?: IMainCamHeaders }).serverHeaders,
      ).toBeUndefined();
    });

    it('должен корректно работать с разными опциями балансировщика', async () => {
      const onSetParameters = jest.fn().mockResolvedValue({ success: true });
      const options: IBalancerOptions = {
        ignoreForCodec: 'VP8',
        onSetParameters,
      };

      const balancerWithOptions = new VideoSendingBalancer(
        apiManager,
        () => {
          return sipConnector.connection;
        },
        options,
      );

      try {
        const result = await balancerWithOptions.balance();

        expect(result).toBeDefined();
      } finally {
        balancerWithOptions.unsubscribe();
      }
    });

    it('должен обрабатывать события без заголовков разрешения', async () => {
      const spyOn = jest.spyOn(apiManager, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'main-cam-control') {
          eventHandler = handler as (data: IMainCamHeaders) => void;
        }

        return () => {
          return undefined;
        };
      });

      balancer.subscribe();

      // Событие без resolutionMainCam
      const headersWithoutResolution: IMainCamHeaders = {
        mainCam: EEventsMainCAM.PAUSE_MAIN_CAM,
      };

      expect(eventHandler).toBeDefined();

      eventHandler?.(headersWithoutResolution);
      await delayPromise(10);

      expect((balancer as unknown as { serverHeaders: IMainCamHeaders }).serverHeaders).toEqual(
        headersWithoutResolution,
      );
    });
  });

  describe('TrackMonitor колбэк при изменении трека', () => {
    it('должен создать VideoSendingBalancer с pollIntervalMs', () => {
      const testBalancer = new VideoSendingBalancer(
        apiManager,
        () => {
          return sipConnector.connection;
        },
        {
          pollIntervalMs: 500,
        },
      );

      expect(testBalancer).toBeInstanceOf(VideoSendingBalancer);
      testBalancer.unsubscribe();
    });

    it('должен вызывать balance без ошибок', async () => {
      const result = await balancer.balance();

      expect(result).toHaveProperty('isChanged');
      expect(result).toHaveProperty('parameters');
      expect(typeof result.isChanged).toBe('boolean');
    });

    it('должен обрабатывать ошибки при отсутствии connection', async () => {
      const testBalancer = new VideoSendingBalancer(
        apiManager,
        () => {
          return undefined;
        },
        {
          pollIntervalMs: 100,
        },
      );

      try {
        await expect(testBalancer.balance()).rejects.toThrow('connection is not exist');
      } finally {
        testBalancer.unsubscribe();
      }
    });
  });

  describe('обработка ошибок', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('должен обрабатывать ошибки балансировки без падения', async () => {
      const { track, setWidth } = createMockTrack(640); // no resize event support

      const sender = new RTCRtpSenderMock({ track });
      const connection = new RTCPeerConnectionMock(undefined, [track]);

      Object.defineProperty(connection, 'getSenders', {
        value: () => {
          return [sender];
        },
      });

      const testBalancer = new VideoSendingBalancer(
        apiManager,
        () => {
          return connection;
        },
        {
          pollIntervalMs: 100,
        },
      );

      try {
        // Вызываем balance
        await testBalancer.balance();

        // Мокаем balance метод для проверки вызова
        const balanceSpy = jest.spyOn(testBalancer, 'balance');

        setWidth(320);

        // Ждем выполнения асинхронного кода
        await delayPromise(100);

        // Проверяем, что balance был вызван повторно
        expect(balanceSpy).toHaveBeenCalled();
      } finally {
        testBalancer.unsubscribe();
      }
    });

    it('должен логировать ошибки в колбэке TrackMonitor при неудачном вызове balance()', async () => {
      const { track, setWidth } = createMockTrack(640); // no resize event support

      const sender = new RTCRtpSenderMock({ track });
      const connection = new RTCPeerConnectionMock(undefined, [track]);

      Object.defineProperty(connection, 'getSenders', {
        value: () => {
          return [sender];
        },
      });

      // Мокаем TrackMonitor
      const mockTrackMonitorSubscribe = jest.fn();
      const MockTrackMonitor = jest.fn().mockImplementation(() => {
        return {
          subscribe: mockTrackMonitorSubscribe,
          unsubscribe: jest.fn(),
        };
      });

      jest.doMock('../TrackMonitor', () => {
        return {
          TrackMonitor: MockTrackMonitor,
        };
      });

      const testBalancer = new VideoSendingBalancer(
        apiManager,
        () => {
          return connection;
        }, // Возвращаем undefined для создания ошибки
        { pollIntervalMs: 100 },
      );

      try {
        await testBalancer.balance();

        // Ломаем connection для создания ошибки
        // @ts-expect-error
        testBalancer.getConnection = () => {
          return undefined;
        };

        setWidth(320);

        // Ждем выполнения асинхронного кода
        await delayPromise(100);

        // Проверяем, что debug был вызван с ошибкой
        expect(logger).toHaveBeenCalledWith('balance on track change: error', expect.any(Error));
      } finally {
        testBalancer.unsubscribe();
        jest.clearAllMocks();
        jest.dontMock('../TrackMonitor');
      }
    });

    it('должен обрабатывать ошибки в обработчике событий', async () => {
      const spyOn = jest.spyOn(apiManager, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'main-cam-control') {
          eventHandler = handler as (data: IMainCamHeaders) => void;
        }

        return () => {
          return undefined;
        };
      });

      // Делаем соединение недоступным для создания ошибки
      Object.defineProperty(sipConnector, 'connection', {
        value: undefined,
        writable: true,
      });

      balancer.subscribe();

      const testHeaders: IMainCamHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1920x1080',
      };

      // Событие должно обработаться без падения, но с логированием ошибки
      expect(eventHandler).toBeDefined();

      expect(() => {
        eventHandler?.(testHeaders);
      }).not.toThrow();

      await delayPromise(10);
    });
  });
});

describe('resolveVideoSendingBalancer', () => {
  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let apiManager: ApiManager;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    apiManager = sipConnector.apiManager;
  });

  it('должен создать экземпляр VideoSendingBalancer', () => {
    const balancer = resolveVideoSendingBalancer(apiManager, () => {
      return sipConnector.connection;
    });

    expect(balancer).toBeInstanceOf(VideoSendingBalancer);

    balancer.unsubscribe();
  });

  it('должен создать экземпляр с опциями', () => {
    const options: IBalancerOptions = {
      ignoreForCodec: 'VP9',
      onSetParameters: jest.fn(),
    };

    const balancer = resolveVideoSendingBalancer(
      apiManager,
      () => {
        return sipConnector.connection;
      },
      options,
    );

    expect(balancer).toBeInstanceOf(VideoSendingBalancer);

    balancer.unsubscribe();
  });

  it('должен создать экземпляр без опций', () => {
    const balancer = resolveVideoSendingBalancer(
      apiManager,
      () => {
        return sipConnector.connection;
      },
      {},
    );

    expect(balancer).toBeInstanceOf(VideoSendingBalancer);

    balancer.unsubscribe();
  });
});
