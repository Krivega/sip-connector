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
  ENCODING_4K_LIMITED_TO_1080P,
  ENCODING_4K_LIMITED_TO_720P,
  HEADERS_MAX_720P,
  sendMainCamInfo,
  setConnection,
  settle,
  TRACK_SIZE_POLLING_WINDOW,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { TResolutionSize } from '@/types';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';
import type { TObservedSender } from '../__fixtures__';

describe('VideoSendingBalancerManager: ручной balance()', () => {
  let callManager: CallManager;
  let apiManager: ApiManager;
  let connection: RTCPeerConnectionMock;
  let manager: VideoSendingBalancerManager;
  let observed: TObservedSender;
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;

  const createManager = (options: IBalancerOptions = NO_MAX_RESOLUTION_BALANCER_OPTIONS) => {
    manager = new VideoSendingBalancerManager(callManager, apiManager, options);
  };

  const confirmCallAndWaitBalancingStart = async () => {
    confirmCall(callManager, connection);
    await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
    await settle();
  };

  beforeEach(() => {
    jest.useFakeTimers();

    ({ callManager, apiManager } = createManagers());

    track720 = createVideoTrack(1280, 720);
    track4K = createVideoTrack(3840, 2160);
    observed = createObservedSender(track720);
    connection = new RTCPeerConnectionMock(undefined, []);
    connection.senders = [observed.sender];

    setConnection(callManager, connection as RTCPeerConnection);
  });

  afterEach(() => {
    manager.stopBalancing();
    jest.useRealTimers();
  });

  describe('при активной балансировке', () => {
    it('отклоняется ошибкой setParameters и оставляет балансировку активной', async () => {
      const setParametersError = new Error('setParameters failed');
      let maxResolution: TResolutionSize | undefined;

      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager({
        getMaxResolution: () => {
          return maxResolution;
        },
      });
      await confirmCallAndWaitBalancingStart();
      maxResolution = { width: 1920, height: 1080 };
      observed.rejectNextSetParameters(setParametersError);

      await expect(manager.balance()).rejects.toBe(setParametersError);
      expect(manager.isBalancingActive).toBe(true);
    });
  });

  describe('во время прогрева', () => {
    it('возвращает результат без изменения параметров', async () => {
      createManager();
      confirmCall(callManager, connection);

      await expect(manager.balance()).resolves.toMatchObject({ isChanged: false });
    });

    it('не меняет параметры, не включает слежение за отправителем и не отменяет запланированный старт с запомненной командой', async () => {
      createManager();
      confirmCall(callManager, connection);
      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await Promise.allSettled([manager.balance()]);
      await settle();
      await observed.sender.replaceTrack(track4K);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);

      expect(manager.isBalancingActive).toBe(false);
      expect(manager.isBalancingScheduled).toBe(true);
      expect(observed.log).toEqual([{ type: 'replaceTrack', appliedScaleResolutionDownBy: 1 }]);

      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('вне прогрева и активной балансировки', () => {
    it.each([
      ['балансировка не запускалась', async () => {}],
      [
        'балансировка остановлена через stopBalancing',
        async () => {
          await confirmCallAndWaitBalancingStart();
          manager.stopBalancing();
          await settle();
        },
      ],
    ])(
      'применяет параметры один раз и не включает слежение за отправителем, если %s',
      async (_name, prepareIdleManager) => {
        createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
        await prepareIdleManager();
        await observed.sender.replaceTrack(track4K);
        await settle();

        const logLengthBeforeBalance = observed.log.length;

        await manager.balance();
        await settle();
        jest.spyOn(track4K, 'getSettings').mockReturnValue({ width: 1280, height: 720 });
        await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);
        await observed.sender.replaceTrack(track720);
        await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

        expect(manager.isBalancingActive).toBe(false);
        expect(manager.isBalancingScheduled).toBe(false);
        expect(observed.log.slice(logLengthBeforeBalance)).toEqual([
          { type: 'setParameters', scaleResolutionDownBy: 2 },
          { type: 'replaceTrack', appliedScaleResolutionDownBy: 2 },
        ]);
        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_1080P);
      },
    );
  });
});
