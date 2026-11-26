import delayPromise from '@/__fixtures__/delayPromise';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM } from '@/ApiManager';
import { doMockSipConnector } from '@/doMock';
import resolveDebug from '@/logger';
import {
  createVideoTrack,
  NO_MAX_RESOLUTION_BALANCER_OPTIONS,
  rejectGetStats,
} from '@/VideoSendingBalancer/__fixtures__';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';
import { setConnection } from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';

jest.mock('@/logger');

const { mcuDebugLogger } = resolveDebug as jest.Mock & { mcuDebugLogger: jest.Mock };

describe('VideoSendingBalancerManager scheduleBalancingStart error handling', () => {
  let callManager: CallManager;
  let mockConnection: RTCPeerConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const sipConnector = doMockSipConnector();

    mockConnection = new RTCPeerConnectionMock(undefined, [] as never[]) as RTCPeerConnection;
    callManager = sipConnector.callManager;

    // Убираем connection, чтобы balance упал с ошибкой
    Object.defineProperty(callManager, 'connection', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    // Создаем менеджер с нулевой задержкой старта

    // eslint-disable-next-line no-new
    new VideoSendingBalancerManager(callManager, sipConnector.apiManager, {
      ...NO_MAX_RESOLUTION_BALANCER_OPTIONS,
      balancingStartDelay: 0,
    });

    // Эмулируем начало звонка, что запланирует балансировку
    callManager.events.trigger('peerconnection:confirmed', mockConnection);

    // Прокручиваем таймеры, чтобы исполнился setTimeout
    jest.runAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('logs error when startBalancing rejects', () => {
    expect(mcuDebugLogger).toHaveBeenCalledWith('startBalancing: error', expect.any(Error));
  });
});

describe('VideoSendingBalancerManager error handling', () => {
  let callManager: CallManager;
  let apiManager: ApiManager;
  let videoSendingBalancerManager: VideoSendingBalancerManager;

  beforeEach(() => {
    const sipConnector = doMockSipConnector();

    callManager = sipConnector.callManager;
    apiManager = sipConnector.apiManager;

    // Убираем connection из CallManager
    Object.defineProperty(callManager, 'connection', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    videoSendingBalancerManager = new VideoSendingBalancerManager(
      callManager,
      sipConnector.apiManager,
      NO_MAX_RESOLUTION_BALANCER_OPTIONS,
    );
  });

  it('throws error when trying to balance without connection', async () => {
    await expect(videoSendingBalancerManager.balance()).rejects.toThrow('connection is not exist');
  });

  it('throws error when trying to start balancing without connection', async () => {
    await expect(videoSendingBalancerManager.startBalancing()).rejects.toThrow(
      'connection is not exist',
    );
  });

  it('does not try to start on main-cam-control while balancing is scheduled', async () => {
    mcuDebugLogger.mockClear();
    callManager.events.trigger('peerconnection:confirmed', {} as RTCPeerConnection);
    apiManager.events.trigger('main-cam-control', { mainCam: EContentMainCAM.PAUSE_MAIN_CAM });
    await delayPromise(0);

    expect(videoSendingBalancerManager.isBalancingScheduled).toBe(true);
    expect(videoSendingBalancerManager.isBalancingActive).toBe(false);
    expect(mcuDebugLogger).not.toHaveBeenCalled();

    videoSendingBalancerManager.stopBalancing();
  });

  it('stays active and triggers balancing-started when the initial balance fails', async () => {
    const handler = jest.fn();
    const connection = new RTCPeerConnectionMock(undefined, []);
    const sender = new RTCRtpSenderMock({ track: createVideoTrack(1280, 720) });

    rejectGetStats(sender);
    connection.senders = [sender];
    setConnection(callManager, connection as RTCPeerConnection);
    videoSendingBalancerManager.on('balancing-started', handler);

    await expect(videoSendingBalancerManager.startBalancing()).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(videoSendingBalancerManager.isBalancingActive).toBe(true);

    videoSendingBalancerManager.stopBalancing();
  });

  // фиксирует текущее поведение: решение по нему ещё не принято
  it('logs startBalancing: error when the initial balance fails (current behavior)', async () => {
    const statsError = new Error('getStats failed');
    const connection = new RTCPeerConnectionMock(undefined, []);
    const sender = new RTCRtpSenderMock({ track: createVideoTrack(1280, 720) });

    rejectGetStats(sender, statsError);
    connection.senders = [sender];
    setConnection(callManager, connection as RTCPeerConnection);
    mcuDebugLogger.mockClear();

    await videoSendingBalancerManager.startBalancing();

    expect(mcuDebugLogger).toHaveBeenCalledWith('startBalancing: error', statsError);

    videoSendingBalancerManager.stopBalancing();
  });

  it('logs error when balance on main-cam-control rejects during active balancing', async () => {
    setConnection(callManager, new RTCPeerConnectionMock(undefined, []) as RTCPeerConnection);
    await expect(videoSendingBalancerManager.startBalancing()).resolves.toBeUndefined();
    setConnection(callManager, undefined);

    apiManager.events.trigger('main-cam-control', { mainCam: EContentMainCAM.PAUSE_MAIN_CAM });
    await delayPromise(0);

    expect(videoSendingBalancerManager.isBalancingActive).toBe(true);
    expect(mcuDebugLogger).toHaveBeenCalledWith(
      'balance on main-cam-control: error',
      expect.any(Error),
    );
  });
});
