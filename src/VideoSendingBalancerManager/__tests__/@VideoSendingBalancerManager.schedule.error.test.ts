import delayPromise from '@/__fixtures__/delayPromise';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { EContentMainCAM } from '@/ApiManager';
import { doMockSipConnector } from '@/doMock';
import resolveDebug from '@/logger';
import { NO_MAX_RESOLUTION_BALANCER_OPTIONS } from '@/VideoSendingBalancer/__fixtures__';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';

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

  it('logs error when start on main-cam-control rejects', async () => {
    callManager.events.trigger('peerconnection:confirmed', {} as RTCPeerConnection);
    apiManager.events.trigger('main-cam-control', { mainCam: EContentMainCAM.PAUSE_MAIN_CAM });
    await delayPromise(0);

    expect(videoSendingBalancerManager.isBalancingScheduled).toBe(false);
    expect(mcuDebugLogger).toHaveBeenCalledWith('startBalancing: error', expect.any(Error));
  });

  it('stays active and triggers balancing-started before the failed initial balance', async () => {
    const handler = jest.fn();

    videoSendingBalancerManager.on('balancing-started', handler);

    await expect(videoSendingBalancerManager.startBalancing()).rejects.toThrow(
      'connection is not exist',
    );
    expect(handler).toHaveBeenCalledTimes(1);
    expect(videoSendingBalancerManager.isBalancingActive).toBe(true);
  });

  it('logs error when balance on main-cam-control rejects during active balancing', async () => {
    await expect(videoSendingBalancerManager.startBalancing()).rejects.toThrow(
      'connection is not exist',
    );

    apiManager.events.trigger('main-cam-control', { mainCam: EContentMainCAM.PAUSE_MAIN_CAM });
    await delayPromise(0);

    expect(videoSendingBalancerManager.isBalancingActive).toBe(true);
    expect(mcuDebugLogger).toHaveBeenCalledWith(
      'balance on main-cam-control: error',
      expect.any(Error),
    );
  });
});
