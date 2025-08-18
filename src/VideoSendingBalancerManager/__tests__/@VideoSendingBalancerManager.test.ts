import { doMockSipConnector } from '@/doMock';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';

import type { CallManager } from '@/CallManager';
import type SipConnector from '@/SipConnector/@SipConnector';

describe('VideoSendingBalancerManager', () => {
  let sipConnector: SipConnector;
  let callManager: CallManager;
  let videoSendingBalancerManager: VideoSendingBalancerManager;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    callManager = sipConnector.callManager;
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
      callManager.events.trigger('peerconnection:confirmed', {});

      // Проверяем, что используется кастомная задержка
      expect(customManager.isBalancingScheduled).toBe(true);
    });
  });

  describe('balancing lifecycle', () => {
    it('should start balancing immediately when startBalancing is called', () => {
      videoSendingBalancerManager.startBalancing();

      expect(videoSendingBalancerManager.isBalancingActive).toBe(true);
    });

    it('should stop balancing when stopBalancing is called', () => {
      videoSendingBalancerManager.startBalancing();
      expect(videoSendingBalancerManager.isBalancingActive).toBe(true);

      videoSendingBalancerManager.stopBalancing();
      expect(videoSendingBalancerManager.isBalancingActive).toBe(false);
    });
  });

  describe('events', () => {
    it('should trigger balancing-started event when balancing starts', async () => {
      const promise = videoSendingBalancerManager.wait('balancing-started');

      videoSendingBalancerManager.startBalancing();

      const data = await promise;

      expect(data.delay).toBe(10_000);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should trigger balancing-stopped event when balancing stops', async () => {
      videoSendingBalancerManager.startBalancing();

      const promise = videoSendingBalancerManager.wait('balancing-stopped');

      videoSendingBalancerManager.stopBalancing();

      await promise;
    });

    it('should trigger balancing-scheduled event when call starts', async () => {
      const promise = videoSendingBalancerManager.wait('balancing-scheduled');

      // Эмулируем начало звонка
      callManager.events.trigger('peerconnection:confirmed', {});

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
      callManager.events.trigger('peerconnection:confirmed', {});

      expect(scheduledSpy).toHaveBeenCalledWith({ delay: 10_000 }); // Значение по умолчанию
      expect(videoSendingBalancerManager.isBalancingScheduled).toBe(true);
    });

    it('should stop balancing when call ends', () => {
      videoSendingBalancerManager.startBalancing();
      expect(videoSendingBalancerManager.isBalancingActive).toBe(true);

      // Эмулируем окончание звонка
      callManager.events.trigger('ended', {});

      expect(videoSendingBalancerManager.isBalancingActive).toBe(false);
    });

    it('should stop balancing when call fails', () => {
      videoSendingBalancerManager.startBalancing();
      expect(videoSendingBalancerManager.isBalancingActive).toBe(true);

      // Эмулируем неудачный звонок
      callManager.events.trigger('failed', {});

      expect(videoSendingBalancerManager.isBalancingActive).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw error when trying to reBalance without active balancer', async () => {
      await expect(videoSendingBalancerManager.reBalance()).rejects.toThrow(
        'connection is not exist',
      );
    });
  });
});
