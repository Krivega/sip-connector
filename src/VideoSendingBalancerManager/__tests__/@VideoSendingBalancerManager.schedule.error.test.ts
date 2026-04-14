import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { doMockSipConnector } from '@/doMock';
import resolveDebug from '@/logger';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';

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
  let videoSendingBalancerManager: VideoSendingBalancerManager;

  beforeEach(() => {
    const sipConnector = doMockSipConnector();

    callManager = sipConnector.callManager;

    // Убираем connection из CallManager
    Object.defineProperty(callManager, 'connection', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    videoSendingBalancerManager = new VideoSendingBalancerManager(
      callManager,
      sipConnector.apiManager,
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
});
