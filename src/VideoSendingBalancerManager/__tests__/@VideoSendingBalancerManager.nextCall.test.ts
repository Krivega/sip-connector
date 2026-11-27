import { createManagers } from '@/__fixtures__/createManagers';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import {
  createBalancerOptions,
  NO_MAX_RESOLUTION_BALANCER_OPTIONS,
} from '@/VideoSendingBalancer/__fixtures__';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';
import {
  BALANCING_START_DELAY,
  confirmCall,
  createObservedSender,
  createVideoTrack,
  ENCODING_360P_BY_TRACK,
  ENCODING_4K_LIMITED_TO_720P,
  ENCODING_720P_BY_TRACK,
  ENCODING_PAUSED,
  getSettledResult,
  HEADERS_MAX_720P,
  HEADERS_PAUSE,
  sendMainCamInfo,
  setConnection,
  settle,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';
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

  const startPreviousCall = async (
    options: IBalancerOptions = NO_MAX_RESOLUTION_BALANCER_OPTIONS,
  ) => {
    manager = new VideoSendingBalancerManager(callManager, apiManager, options);
    startCall(observed);
    await waitBalancingStart();
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

  beforeEach(() => {
    jest.useFakeTimers();

    ({ callManager, apiManager } = createManagers());

    observed = createObservedSender(createVideoTrack(1280, 720));
    nextObserved = createObservedSender(createVideoTrack(3840, 2160));
    nextTrack4K = createVideoTrack(3840, 2160);
    startedHandler = jest.fn();
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
      await startPreviousCall();
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

  it('не меняет параметры отправителя следующего звонка во время прогрева при maxAvailableResolution 1920x1080, если замена трека предыдущего звонка завершилась после начала следующего', async () => {
    await startPreviousCall(
      createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }),
    );

    const originalReplacement = observed.deferNextReplaceTrack();
    const replacing = Promise.allSettled([
      observed.sender.replaceTrack(createVideoTrack(3840, 2160)),
    ]);

    await settle();
    await endCall();
    startCall(nextObserved);
    await settle();
    originalReplacement.resolve(undefined);
    await replacing;
    await settle();

    expect(nextObserved.log).toEqual([]);
    expect(manager.isBalancingScheduled).toBe(true);
  });

  it('применяет к отправителю предыдущего звонка после его завершения только параметры по оставшемуся на нём треку 360p и не применяет PAUSE_MAIN_CAM следующего звонка, если его вторая замена трека, ждавшая в очереди, отклонена оригинальным replaceTrack после PAUSE_MAIN_CAM следующего звонка', async () => {
    const replaceTrackError = new Error('replaceTrack failed');
    const track360 = createVideoTrack(640, 360);

    await startPreviousCall();

    const firstOriginalReplacement = observed.deferNextReplaceTrack();

    observed.rejectNextReplaceTrack(replaceTrackError);

    const replacements = Promise.allSettled([
      observed.sender.replaceTrack(track360),
      observed.sender.replaceTrack(createVideoTrack(3840, 2160)),
    ]);

    await settle();
    await endCall();

    const logLengthAfterCallEnd = observed.log.length;

    startCall(nextObserved);
    await waitBalancingStart();
    sendMainCamInfo(callManager, HEADERS_PAUSE);
    await settle();
    firstOriginalReplacement.resolve(undefined);

    const results = await replacements;

    await settle();

    const entriesAfterCallEnd = observed.log.slice(logLengthAfterCallEnd);

    expect(results).toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: replaceTrackError },
    ]);
    expect(nextObserved.getAppliedEncoding()).toEqual(ENCODING_PAUSED);
    expect(entriesAfterCallEnd[0]).toEqual({
      type: 'replaceTrack',
      appliedScaleResolutionDownBy: 1,
    });
    expect(
      entriesAfterCallEnd.filter((entry) => {
        return entry.type === 'setParameters' && entry.scaleResolutionDownBy !== 1;
      }),
    ).toEqual([]);
    expect(observed.sender.track).toBe(track360);
    expect(observed.getAppliedEncoding()).toEqual(ENCODING_360P_BY_TRACK);
  });

  it('возвращает треку 720p предыдущего звонка параметры по треку и не применяет к нему PAUSE_MAIN_CAM следующего звонка, если его замена на 4K, начатая при ограничении 1280x720, отклонена оригинальным replaceTrack после PAUSE_MAIN_CAM следующего звонка', async () => {
    await startPreviousCall();
    sendMainCamInfo(callManager, HEADERS_MAX_720P);
    await settle();

    const originalReplacement = observed.deferNextReplaceTrack();
    const replacing = Promise.allSettled([
      observed.sender.replaceTrack(createVideoTrack(3840, 2160)),
    ]);

    await settle();
    await endCall();
    startCall(nextObserved);
    await waitBalancingStart();
    sendMainCamInfo(callManager, HEADERS_PAUSE);
    await settle();
    originalReplacement.reject(new Error('replaceTrack failed'));
    await replacing;
    await settle();

    expect(nextObserved.getAppliedEncoding()).toEqual(ENCODING_PAUSED);
    expect(observed.log).not.toContainEqual({
      type: 'setParameters',
      scaleResolutionDownBy: 200,
    });
    expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_BY_TRACK);
  });
});
