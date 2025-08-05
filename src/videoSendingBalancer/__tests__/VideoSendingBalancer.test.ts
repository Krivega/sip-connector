/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable no-await-in-loop */

/// <reference types="jest" />
import { EEventsMainCAM } from '@/ApiManager';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { doMockSipConnector } from '@/doMock';
import { createVideoMediaStreamTrackMock } from 'webrtc-mock';
import VideoSendingBalancer, { resolveVideoSendingBalancer } from '../VideoSendingBalancer';
import type { IBalancerOptions, IMainCamHeaders } from '../types';

// Мокаем только логгер, как запрошено
jest.mock('../../logger', () => {
  return {
    debug: jest.fn(),
    __esModule: true,
    default: jest.fn(),
  };
});

describe('VideoSendingBalancer', () => {
  let balancer: VideoSendingBalancer;
  let sipConnector: ReturnType<typeof doMockSipConnector>;
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

    balancer = new VideoSendingBalancer(sipConnector);
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

      const balancerWithOptions = new VideoSendingBalancer(sipConnector, options);

      expect(balancerWithOptions).toBeInstanceOf(VideoSendingBalancer);
    });
  });

  describe('subscribe', () => {
    it('должен подписаться на события управления главной камерой', () => {
      const spyOn = jest.spyOn(sipConnector, 'on');

      balancer.subscribe();

      expect(spyOn).toHaveBeenCalledWith('api:main-cam-control', expect.any(Function));
    });

    it('должен обрабатывать событие main-cam-control при подписке', async () => {
      const spyOn = jest.spyOn(sipConnector, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'api:main-cam-control') {
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
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    });
  });

  describe('unsubscribe', () => {
    it('должен отписаться от событий', () => {
      const spyOff = jest.spyOn(sipConnector, 'off');

      balancer.subscribe();
      balancer.unsubscribe();

      expect(spyOff).toHaveBeenCalledWith('api:main-cam-control', expect.any(Function));
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

  describe('reBalance', () => {
    it('должен выполнить балансировку при наличии соединения', async () => {
      const result = await balancer.reBalance();

      expect(result).toBeDefined();
      expect(mockConnection.getSenders).toHaveBeenCalled();
    });

    it('должен выбросить ошибку если нет соединения', async () => {
      // Убираем соединение
      Object.defineProperty(sipConnector, 'connection', {
        value: undefined,
        writable: true,
      });

      await expect(balancer.reBalance()).rejects.toThrow('connection is not exist');
    });

    it('должен работать с заголовками сервера', async () => {
      // Устанавливаем заголовки

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1920x1080',
      };

      const result = await balancer.reBalance();

      expect(result).toBeDefined();
      expect(mockConnection.getSenders).toHaveBeenCalled();
    });
  });

  describe('handleMainCamControl (через события)', () => {
    it('должен обновить заголовки сервера при получении события', async () => {
      const spyOn = jest.spyOn(sipConnector, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'api:main-cam-control') {
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
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect((balancer as unknown as { serverHeaders: IMainCamHeaders }).serverHeaders).toEqual(
        testHeaders,
      );
    });

    it('должен вызвать балансировку при получении разных типов событий главной камеры', async () => {
      const spyOn = jest.spyOn(sipConnector, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'api:main-cam-control') {
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
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });

        expect((balancer as unknown as { serverHeaders: IMainCamHeaders }).serverHeaders).toEqual(
          headers,
        );
      }
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно работать полный цикл подписки, события и отписки', async () => {
      const spyOn = jest.spyOn(sipConnector, 'on');
      const spyOff = jest.spyOn(sipConnector, 'off');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'api:main-cam-control') {
          eventHandler = handler as (data: IMainCamHeaders) => void;
        }

        return () => {
          return undefined;
        };
      });

      // Подписка
      balancer.subscribe();
      expect(spyOn).toHaveBeenCalledWith('api:main-cam-control', expect.any(Function));

      // Событие
      const testHeaders: IMainCamHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: '1920x1080',
      };

      expect(eventHandler).toBeDefined();

      eventHandler?.(testHeaders);
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      expect((balancer as unknown as { serverHeaders: IMainCamHeaders }).serverHeaders).toEqual(
        testHeaders,
      );

      // Ребалансировка
      const result = await balancer.reBalance();

      expect(result).toBeDefined();

      // Отписка
      balancer.unsubscribe();
      expect(spyOff).toHaveBeenCalledWith('api:main-cam-control', expect.any(Function));
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

      const balancerWithOptions = new VideoSendingBalancer(sipConnector, options);

      try {
        const result = await balancerWithOptions.reBalance();

        expect(result).toBeDefined();
      } finally {
        balancerWithOptions.unsubscribe();
      }
    });

    it('должен обрабатывать события без заголовков разрешения', async () => {
      const spyOn = jest.spyOn(sipConnector, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'api:main-cam-control') {
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
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect((balancer as unknown as { serverHeaders: IMainCamHeaders }).serverHeaders).toEqual(
        headersWithoutResolution,
      );
    });
  });

  describe('обработка ошибок', () => {
    it('должен обрабатывать ошибки балансировки без падения', async () => {
      // Делаем getSenders возвращающим ошибку
      const errorConnection = {
        getSenders: jest.fn().mockImplementation(() => {
          throw new Error('Test error');
        }),
      } as unknown as RTCPeerConnection;

      Object.defineProperty(sipConnector, 'connection', {
        value: errorConnection,
        writable: true,
      });

      await expect(balancer.reBalance()).rejects.toThrow('Test error');
    });

    it('должен обрабатывать ошибки в обработчике событий', async () => {
      const spyOn = jest.spyOn(sipConnector, 'on');
      let eventHandler: ((data: IMainCamHeaders) => void) | undefined;

      spyOn.mockImplementation((eventName, handler) => {
        if (eventName === 'api:main-cam-control') {
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

      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    });
  });
});

describe('resolveVideoSendingBalancer', () => {
  let sipConnector: ReturnType<typeof doMockSipConnector>;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
  });

  it('должен создать экземпляр VideoSendingBalancer', () => {
    const balancer = resolveVideoSendingBalancer(sipConnector);

    expect(balancer).toBeInstanceOf(VideoSendingBalancer);

    balancer.unsubscribe();
  });

  it('должен создать экземпляр с опциями', () => {
    const options: IBalancerOptions = {
      ignoreForCodec: 'VP9',
      onSetParameters: jest.fn(),
    };

    const balancer = resolveVideoSendingBalancer(sipConnector, options);

    expect(balancer).toBeInstanceOf(VideoSendingBalancer);

    balancer.unsubscribe();
  });

  it('должен создать экземпляр без опций', () => {
    const balancer = resolveVideoSendingBalancer(sipConnector, {});

    expect(balancer).toBeInstanceOf(VideoSendingBalancer);

    balancer.unsubscribe();
  });
});
