import { createManagers } from '@/__fixtures__/createManagers';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { createBalancerOptions } from '@/VideoSendingBalancer/__fixtures__';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';
import {
  confirmCall,
  createObservedSender,
  createVideoTrack,
  ENCODING_4K_LIMITED_TO_720P,
  HEADERS_MAX_720P,
  sendMainCamInfo,
  setConnection,
  settle,
  TRACK_SIZE_POLLING_WINDOW,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { TObservedSender } from '../__fixtures__';

// прогрев дольше окна опроса: окно целиком помещается в прогрев
const BALANCING_START_DELAY = 2 * TRACK_SIZE_POLLING_WINDOW;

// отличаются от параметров балансировщика для 4K-трека при maxAvailableResolution 1920x1080 (масштаб 2)
const FOREIGN_ENCODING = { scaleResolutionDownBy: 4, maxBitrate: 100_000 };
const FOREIGN_MAX_BITRATE = 100_000;

describe('VideoSendingBalancerManager: параметры отправителя, изменённые другим модулем', () => {
  let callManager: CallManager;
  let apiManager: ApiManager;
  let connection: RTCPeerConnectionMock;
  let manager: VideoSendingBalancerManager;
  let observed: TObservedSender;

  const confirmCallAndWaitBalancingStart = async () => {
    confirmCall(callManager, connection);
    await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
    await settle();
  };

  beforeEach(() => {
    jest.useFakeTimers();

    ({ callManager, apiManager } = createManagers());

    observed = createObservedSender(createVideoTrack(3840, 2160));
    connection = new RTCPeerConnectionMock(undefined, []);
    connection.senders = [observed.sender];

    setConnection(callManager, connection as RTCPeerConnection);

    manager = new VideoSendingBalancerManager(callManager, apiManager, {
      ...createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }),
      balancingStartDelay: BALANCING_START_DELAY,
    });
  });

  afterEach(() => {
    manager.stopBalancing();
    jest.useRealTimers();
  });

  describe('вне активной балансировки', () => {
    it.each([
      ['звонок не начат', async () => {}],
      [
        'балансировка остановлена через stopBalancing',
        async () => {
          await confirmCallAndWaitBalancingStart();
          manager.stopBalancing();
          await settle();
        },
      ],
    ])(
      'не трогает масштаб и битрейт, выставленные отправителю другим модулем, в течение окна опроса, если %s',
      async (_name, prepareIdleManager) => {
        await prepareIdleManager();
        await observed.applyForeignEncoding(FOREIGN_ENCODING);

        const logLengthAfterForeignChange = observed.log.length;

        await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

        expect(observed.log.slice(logLengthAfterForeignChange)).toEqual([]);
        expect(observed.getAppliedEncoding()).toEqual(FOREIGN_ENCODING);
      },
    );

    it('не трогает масштаб и битрейт, выставленные отправителю другим модулем во время прогрева, в течение окна опроса', async () => {
      confirmCall(callManager, connection);
      await settle();
      await observed.applyForeignEncoding(FOREIGN_ENCODING);

      const logLengthAfterForeignChange = observed.log.length;

      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(manager.isBalancingScheduled).toBe(true);
      expect(observed.log.slice(logLengthAfterForeignChange)).toEqual([]);
      expect(observed.getAppliedEncoding()).toEqual(FOREIGN_ENCODING);
    });
  });

  describe('при активной балансировке', () => {
    it('не перезаписывает maxBitrate, выставленный отправителю другим модулем, пока не изменились команда, трек и его размер, а по следующей MAX 1280x720 применяет свои параметры', async () => {
      await confirmCallAndWaitBalancingStart();
      await observed.applyForeignEncoding({ maxBitrate: FOREIGN_MAX_BITRATE });

      const logLengthAfterForeignChange = observed.log.length;

      await jest.advanceTimersByTimeAsync(2 * TRACK_SIZE_POLLING_WINDOW);

      expect(observed.log.slice(logLengthAfterForeignChange)).toEqual([]);
      expect(observed.getAppliedEncoding()).toEqual({
        scaleResolutionDownBy: 2,
        maxBitrate: FOREIGN_MAX_BITRATE,
      });

      sendMainCamInfo(callManager, HEADERS_MAX_720P);
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });
});
