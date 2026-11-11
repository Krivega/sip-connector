import { createManagers } from '@/__fixtures__/createManagers';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { NO_MAX_RESOLUTION_BALANCER_OPTIONS } from '@/VideoSendingBalancer/__fixtures__';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';
import {
  BALANCING_START_DELAY,
  confirmCall,
  createObservedSender,
  createVideoTrack,
  ENCODING_4K_LIMITED_TO_720P,
  getSettledResult,
  HEADERS_MAX_720P,
  HEADERS_PAUSE,
  sendMainCamInfo,
  setConnection,
  settle,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { TObservedSender } from '../__fixtures__';

describe('VideoSendingBalancerManager: следующий звонок после незавершённых операций предыдущего', () => {
  let callManager: CallManager;
  let apiManager: ApiManager;
  let manager: VideoSendingBalancerManager;
  let observed: TObservedSender;
  let nextObserved: TObservedSender;
  let nextTrack4K: MediaStreamVideoTrack;
  let startedHandler: jest.Mock;

  const startCall = (observedSender: TObservedSender) => {
    const connection = new RTCPeerConnectionMock(undefined, []);

    connection.senders = [observedSender.sender];
    setConnection(callManager, connection as RTCPeerConnection);
    confirmCall(callManager, connection);
  };

  const waitBalancingStart = async () => {
    await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
    await settle();
  };

  const endCall = async () => {
    callManager.events.trigger('ended', {
      originator: 'remote',
      cause: 'Terminated',
    } as never);
    await settle();
  };

  const hangOriginalReplaceTrack = async () => {
    observed.hangNextReplaceTrack();
    observed.sender.replaceTrack(createVideoTrack(3840, 2160)).catch(() => {});
    await settle();
  };

  const hangSetParametersOfBalancing = async () => {
    observed.hangNextSetParameters();
    sendMainCamInfo(callManager, HEADERS_PAUSE);
    await settle();
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    ({ callManager, apiManager } = createManagers());

    observed = createObservedSender(createVideoTrack(1280, 720));
    nextObserved = createObservedSender(createVideoTrack(3840, 2160));
    nextTrack4K = createVideoTrack(3840, 2160);
    startedHandler = jest.fn();
    manager = new VideoSendingBalancerManager(
      callManager,
      apiManager,
      NO_MAX_RESOLUTION_BALANCER_OPTIONS,
    );
    startCall(observed);
    await waitBalancingStart();
  });

  afterEach(() => {
    manager.stopBalancing();
    jest.useRealTimers();
  });

  it.each([
    ['оригинальный replaceTrack не завершился', hangOriginalReplaceTrack],
    ['setParameters балансировки не ответил', hangSetParametersOfBalancing],
  ])(
    'отправляет balancing-started, применяет запомненную в прогреве MAX 1280x720 и заменяет трек при scaleResolutionDownBy 3 в следующем звонке, если в предыдущем %s',
    async (_name, hangPreviousCallOperation) => {
      await hangPreviousCallOperation();
      await endCall();
      manager.on('balancing-started', startedHandler);
      startCall(nextObserved);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await waitBalancingStart();

      const encodingAfterStart = nextObserved.getAppliedEncoding();
      const logLengthBeforeReplace = nextObserved.log.length;
      const replaceResult = await getSettledResult(nextObserved.sender.replaceTrack(nextTrack4K));

      await settle();

      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(encodingAfterStart).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(replaceResult).toEqual({ status: 'fulfilled', value: undefined });
      expect(nextObserved.log.slice(logLengthBeforeReplace)).toContainEqual({
        type: 'replaceTrack',
        appliedScaleResolutionDownBy: 3,
      });
      expect(nextObserved.sender.track).toBe(nextTrack4K);
    },
  );
});
