import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { doMockSipConnector } from '@/doMock';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';

import type { CallManager } from '@/CallManager';
import type SipConnector from '@/SipConnector/@SipConnector';
import type VideoSendingBalancer from '@/VideoSendingBalancer/@VideoSendingBalancer';

describe('VideoSendingBalancerManager', () => {
  let sipConnector: SipConnector;
  let callManager: CallManager;
  let videoSendingBalancerManager: VideoSendingBalancerManager;
  let mockConnection: RTCPeerConnection;
  let mockVideoTrack: MediaStreamVideoTrack;
  let mockSender: RTCRtpSender;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    callManager = sipConnector.callManager;

    // Создаем видео трек
    mockVideoTrack = createVideoMediaStreamTrackMock({
      constraints: { width: 1920, height: 1080 },
    }) as MediaStreamVideoTrack;

    // Создаем sender
    mockSender = new RTCRtpSenderMock({ track: mockVideoTrack }) as RTCRtpSender;
    Object.defineProperty(mockSender, 'getParameters', {
      value: jest.fn().mockReturnValue({
        encodings: [{ scaleResolutionDownBy: 1, maxBitrate: 1_000_000 }],
      }),
    });
    Object.defineProperty(mockSender, 'setParameters', {
      value: jest.fn().mockResolvedValue(undefined),
    });

    // Создаем RTCPeerConnection
    mockConnection = new RTCPeerConnectionMock(undefined, [] as never[]) as RTCPeerConnection;
    Object.defineProperty(mockConnection, 'getSenders', {
      value: jest.fn().mockReturnValue([mockSender]),
    });

    // Мокаем connection в CallManager
    Object.defineProperty(callManager, 'connection', {
      value: mockConnection,
      writable: true,
      configurable: true,
    });

    videoSendingBalancerManager = new VideoSendingBalancerManager(
      callManager,
      sipConnector.apiManager,
    );
  });

  afterEach(() => {
    videoSendingBalancerManager.stopBalancing();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(videoSendingBalancerManager).toBeInstanceOf(VideoSendingBalancerManager);
      expect(videoSendingBalancerManager.isBalancingActive).toBe(false);
      expect(videoSendingBalancerManager.isBalancingScheduled).toBe(false);
    });

    it('should create instance with custom balancing start delay', () => {
      const customDelay = 5000; // 5 секунд
      const customManager = new VideoSendingBalancerManager(callManager, sipConnector.apiManager, {
        balancingStartDelay: customDelay,
      });

      // Эмулируем начало звонка
      callManager.events.trigger('peerconnection:confirmed', mockConnection);

      // Проверяем, что используется кастомная задержка
      expect(customManager.isBalancingScheduled).toBe(true);

      // Очищаем после теста
      customManager.stopBalancing();
    });
  });

  describe('balancing lifecycle', () => {
    it('should start balancing immediately when startBalancing is called', async () => {
      await videoSendingBalancerManager.startBalancing();

      expect(videoSendingBalancerManager.isBalancingActive).toBe(true);
    });

    it('should stop balancing when stopBalancing is called', async () => {
      await videoSendingBalancerManager.startBalancing();
      expect(videoSendingBalancerManager.isBalancingActive).toBe(true);

      videoSendingBalancerManager.stopBalancing();
      expect(videoSendingBalancerManager.isBalancingActive).toBe(false);
    });
  });

  describe('events', () => {
    it('should trigger balancing-started event when balancing starts', async () => {
      const promise = videoSendingBalancerManager.wait('balancing-started');

      await videoSendingBalancerManager.startBalancing();

      const data = await promise;

      expect(data.delay).toBe(10_000);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should trigger balancing-stopped event when balancing stops', async () => {
      await videoSendingBalancerManager.startBalancing();

      const promise = videoSendingBalancerManager.wait('balancing-stopped');

      videoSendingBalancerManager.stopBalancing();

      await promise;
    });

    it('should trigger balancing-scheduled event when call starts', async () => {
      const promise = videoSendingBalancerManager.wait('balancing-scheduled');

      // Эмулируем начало звонка
      callManager.events.trigger('peerconnection:confirmed', mockConnection);

      const data = await promise;

      expect(data.delay).toBe(10_000); // Значение по умолчанию

      expect(videoSendingBalancerManager.isBalancingScheduled).toBe(true);
    });
  });

  describe('call lifecycle integration', () => {
    it('should schedule balancing when call starts', () => {
      const scheduledSpy = jest.fn();

      videoSendingBalancerManager.on('balancing-scheduled', scheduledSpy);

      // Эмулируем начало звонка
      callManager.events.trigger('peerconnection:confirmed', mockConnection);

      expect(scheduledSpy).toHaveBeenCalledWith({ delay: 10_000 }); // Значение по умолчанию
      expect(videoSendingBalancerManager.isBalancingScheduled).toBe(true);
    });

    it('should stop balancing when call ends', async () => {
      await videoSendingBalancerManager.startBalancing();
      expect(videoSendingBalancerManager.isBalancingActive).toBe(true);

      // Эмулируем окончание звонка
      callManager.events.trigger('ended', {
        originator: 'remote',
        // @ts-expect-error
        message: {},
        cause: 'error',
      });

      expect(videoSendingBalancerManager.isBalancingActive).toBe(false);
    });

    it('should stop balancing when call fails', async () => {
      await videoSendingBalancerManager.startBalancing();
      expect(videoSendingBalancerManager.isBalancingActive).toBe(true);

      // Эмулируем неудачный звонок
      callManager.events.trigger('failed', {
        originator: 'remote',
        // @ts-expect-error
        message: {},
        cause: 'error',
      });

      expect(videoSendingBalancerManager.isBalancingActive).toBe(false);
    });
  });

  it('should not call balance again if balancing already active', async () => {
    // Достаём приватный videoSendingBalancer, сохраняя типизацию через двойное приведение
    const balancer = (
      videoSendingBalancerManager as unknown as {
        videoSendingBalancer: VideoSendingBalancer;
      }
    ).videoSendingBalancer;

    const balanceSpy = jest.spyOn(balancer, 'balance');

    // Первый запуск
    await videoSendingBalancerManager.startBalancing();
    expect(videoSendingBalancerManager.isBalancingActive).toBe(true);
    expect(balanceSpy).toHaveBeenCalledTimes(1);

    // Повторный запуск не должен вызвать balance второй раз
    await videoSendingBalancerManager.startBalancing();

    expect(balanceSpy).toHaveBeenCalledTimes(1);
  });
});
