import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { doMockSipConnector } from '@/doMock';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';

import type { CallManager } from '@/CallManager';
import type SipConnector from '@/SipConnector/@SipConnector';

describe('VideoSendingBalancerManager events API', () => {
  let sipConnector: SipConnector;
  let callManager: CallManager;
  let videoSendingBalancerManager: VideoSendingBalancerManager;

  beforeEach(() => {
    // Создаем мок SipConnector, внутри которого есть CallManager и ApiManager
    sipConnector = doMockSipConnector();
    callManager = sipConnector.callManager;

    // Создаем базовую инфраструктуру peer connection, чтобы не падали проверки VideoSendingBalancer
    const mockVideoTrack = createVideoMediaStreamTrackMock({
      constraints: { width: 640, height: 480 },
    }) as MediaStreamVideoTrack;

    const mockSender = new RTCRtpSenderMock({ track: mockVideoTrack }) as unknown as RTCRtpSender;

    Object.defineProperty(mockSender, 'getParameters', {
      value: jest.fn().mockReturnValue({ encodings: [] }),
    });
    Object.defineProperty(mockSender, 'setParameters', {
      value: jest.fn().mockResolvedValue(undefined),
    });

    const mockConnection = new RTCPeerConnectionMock(
      undefined,
      [] as never[],
    ) as unknown as RTCPeerConnection;

    Object.defineProperty(mockConnection, 'getSenders', {
      value: jest.fn().mockReturnValue([mockSender]),
    });

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
    jest.clearAllMocks();
  });

  it('on should subscribe and trigger handler for every occurrence', () => {
    const handler = jest.fn();

    videoSendingBalancerManager.on('balancing-scheduled', handler);

    const firstPayload = { delay: 1 } as const;

    videoSendingBalancerManager.events.trigger('balancing-scheduled', firstPayload);

    const secondPayload = { delay: 2 } as const;

    videoSendingBalancerManager.events.trigger('balancing-scheduled', secondPayload);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, firstPayload);
    expect(handler).toHaveBeenNthCalledWith(2, secondPayload);
  });

  it('off should unsubscribe handler', () => {
    const handler = jest.fn();

    videoSendingBalancerManager.on('balancing-stopped', handler);
    videoSendingBalancerManager.off('balancing-stopped', handler);

    videoSendingBalancerManager.events.trigger('balancing-stopped', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('once should handle event exactly once', () => {
    const handler = jest.fn();

    videoSendingBalancerManager.once('balancing-started', handler);

    const payload = { delay: 5 } as const;

    videoSendingBalancerManager.events.trigger('balancing-started', payload);
    videoSendingBalancerManager.events.trigger('balancing-started', { delay: 10 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('onceRace should handle only the first occurred event', () => {
    const handler = jest.fn();

    videoSendingBalancerManager.onceRace(['balancing-started', 'balancing-stopped'], handler);

    const payload = { delay: 42 } as const;

    videoSendingBalancerManager.events.trigger('balancing-started', payload);

    // Триггерим другое событие, которое не должно вызвать handler второй раз
    videoSendingBalancerManager.events.trigger('balancing-stopped', {});

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload, 'balancing-started');
  });

  it('wait should resolve once the event is triggered', async () => {
    const waitPromise = videoSendingBalancerManager.wait('balancing-started');

    const payload = { delay: 123 } as const;

    videoSendingBalancerManager.events.trigger('balancing-started', payload);

    await expect(waitPromise).resolves.toEqual(payload);
  });
});
