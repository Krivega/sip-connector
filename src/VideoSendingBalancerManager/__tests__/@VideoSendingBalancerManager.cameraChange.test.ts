import { createManagers } from '@/__fixtures__/createManagers';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { replaceMediaStreamInConnection } from '@/utils/peerConnection/replaceMediaStream';
import { createBalancerOptions } from '@/VideoSendingBalancer/__fixtures__';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';
import {
  BALANCING_START_DELAY,
  confirmCall,
  createObservedSender,
  createVideoTrack,
  deferNextGetStats,
  ENCODING_4K_LIMITED_TO_360P,
  ENCODING_4K_LIMITED_TO_720P,
  ENCODING_720P_LIMITED_TO_360P,
  getSettledResult,
  HEADERS_MAX_360P,
  POLL_INTERVAL,
  sendMainCamInfo,
  setConnection,
  settle,
  TRACK_SIZE_POLLING_WINDOW,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { TObservedSender } from '../__fixtures__';

// maxAvailableResolution: по нему SipConnector считает sendEncodings вызывающего и ограничивает балансировщик
const MAX_AVAILABLE_RESOLUTION = { width: 1280, height: 720 };

// sendEncodings, которые SipConnector считает для 4K-трека по maxAvailableResolution 1280x720
const CALLER_SCALE_RESOLUTION_DOWN_BY = 3;

// масштаб 4K-трека по команде MAX 640x360
const COMMAND_SCALE_RESOLUTION_DOWN_BY = ENCODING_4K_LIMITED_TO_360P.scaleResolutionDownBy;

// отличаются от параметров балансировщика для 4K-трека по команде MAX 640x360
const FOREIGN_ENCODING = { scaleResolutionDownBy: 4, maxBitrate: 100_000 };

const isCallerEncoding = (encoding: RTCRtpEncodingParameters) => {
  return encoding.scaleResolutionDownBy === CALLER_SCALE_RESOLUTION_DOWN_BY;
};

describe('VideoSendingBalancerManager: смена камеры вызывающим кодом при команде сервера', () => {
  let callManager: CallManager;
  let apiManager: ApiManager;
  let connection: RTCPeerConnectionMock;
  let manager: VideoSendingBalancerManager;
  let observed: TObservedSender;
  let track4K: MediaStreamVideoTrack;

  const useSenderWithTrack = (track: MediaStreamVideoTrack) => {
    observed = createObservedSender(track);
    connection.senders = [observed.sender];
  };

  // балансировка запущена, команда MAX 640x360 применена, опрос дорос до максимального интервала
  const startWithMaxResolution360p = async () => {
    manager = new VideoSendingBalancerManager(
      callManager,
      apiManager,
      createBalancerOptions({ maxResolution: MAX_AVAILABLE_RESOLUTION }),
    );
    confirmCall(callManager, connection);
    await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
    await settle();
    sendMainCamInfo(callManager, HEADERS_MAX_360P);
    await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);
  };

  // смена камеры так, как её делает пакет: replaceTrack и сразу после него запись sendEncodings вызывающего
  const changeCamera = async (track: MediaStreamVideoTrack) => {
    return replaceMediaStreamInConnection({
      connection: connection as RTCPeerConnection,
      stream: new MediaStream([track]),
      renegotiate: async () => {
        return true;
      },
      options: { sendEncodings: [{ scaleResolutionDownBy: CALLER_SCALE_RESOLUTION_DOWN_BY }] },
    });
  };

  // первый тик сверки после замены: замена возвращает опрос к начальному интервалу
  const advanceToFirstTickAfterReplacement = async () => {
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL);
    await settle();
  };

  const getCallerWrites = (logLengthBeforeChange: number) => {
    return observed.log.slice(logLengthBeforeChange).filter((entry) => {
      return (
        entry.type === 'setParameters' &&
        entry.scaleResolutionDownBy === CALLER_SCALE_RESOLUTION_DOWN_BY
      );
    });
  };

  const getWritesOtherThanCommandScale = (logLengthBefore: number) => {
    return observed.log.slice(logLengthBefore).filter((entry) => {
      return (
        entry.type === 'setParameters' &&
        entry.scaleResolutionDownBy !== COMMAND_SCALE_RESOLUTION_DOWN_BY
      );
    });
  };

  // после первого тика масштаб команды держится всё окно опроса
  const expectCommandScaleHeldForPollingWindow = async () => {
    const logLengthAfterFirstTick = observed.log.length;

    await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

    expect(getWritesOtherThanCommandScale(logLengthAfterFirstTick)).toEqual([]);
    expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);
  };

  beforeEach(() => {
    jest.useFakeTimers();

    ({ callManager, apiManager } = createManagers());

    track4K = createVideoTrack(3840, 2160);
    connection = new RTCPeerConnectionMock(undefined, []);
    useSenderWithTrack(createVideoTrack(1280, 720));

    setConnection(callManager, connection as RTCPeerConnection);
  });

  afterEach(() => {
    manager.stopBalancing();
    jest.useRealTimers();
  });

  describe('запись вызывающего пересеклась с чтением параметров балансировкой', () => {
    it('выставляет 4K-треку scaleResolutionDownBy 6 к первому тику сверки и держит его окно опроса, если при MAX 640x360 камера 720p сменена на 4K с sendEncodings масштаба 3, а балансировка после замены прочитала параметры до завершения записи вызывающего', async () => {
      await startWithMaxResolution360p();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_LIMITED_TO_360P);

      const logLengthBeforeChange = observed.log.length;
      const releaseStats = deferNextGetStats(observed.sender);
      const callerWrite = observed.deferNextSetParameters(isCallerEncoding);
      const changingCamera = changeCamera(track4K);

      await settle();
      releaseStats();
      await settle();

      // балансировка после замены получила кодек и отработала, а запись вызывающего ещё не применена
      expect(observed.sender.track).toBe(track4K);
      expect(await getSettledResult(changingCamera)).toEqual({ status: 'pending' });
      expect(getCallerWrites(logLengthBeforeChange)).toEqual([]);

      callerWrite.resolve(undefined);
      await changingCamera;

      expect(getCallerWrites(logLengthBeforeChange)).toEqual([
        { type: 'setParameters', scaleResolutionDownBy: CALLER_SCALE_RESOLUTION_DOWN_BY },
      ]);

      await advanceToFirstTickAfterReplacement();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      await expectCommandScaleHeldForPollingWindow();
    });

    it('выставляет 4K-треку scaleResolutionDownBy 6 к первому тику сверки и держит его окно опроса, если при MAX 640x360 4K-камера сменена на другую 4K-камеру с sendEncodings масштаба 3, а балансировка после замены прочитала параметры до завершения записи вызывающего', async () => {
      useSenderWithTrack(createVideoTrack(3840, 2160));
      await startWithMaxResolution360p();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      const logLengthBeforeChange = observed.log.length;
      const releaseStats = deferNextGetStats(observed.sender);
      const callerWrite = observed.deferNextSetParameters(isCallerEncoding);
      const changingCamera = changeCamera(track4K);

      await settle();
      releaseStats();
      await settle();

      expect(observed.sender.track).toBe(track4K);
      expect(await getSettledResult(changingCamera)).toEqual({ status: 'pending' });

      callerWrite.resolve(undefined);
      await changingCamera;

      expect(getCallerWrites(logLengthBeforeChange)).toEqual([
        { type: 'setParameters', scaleResolutionDownBy: CALLER_SCALE_RESOLUTION_DOWN_BY },
      ]);

      await advanceToFirstTickAfterReplacement();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      await expectCommandScaleHeldForPollingWindow();
    });

    it('выставляет 4K-треку scaleResolutionDownBy 6 к первому тику сверки и держит его окно опроса, если после смены камеры 720p на 4K с sendEncodings масштаба 3 до первого тика пришла повторная MAX 640x360, и балансировка после замены и балансировка команды прочитали параметры до завершения записи вызывающего', async () => {
      await startWithMaxResolution360p();

      const logLengthBeforeChange = observed.log.length;
      const releaseStats = deferNextGetStats(observed.sender);
      const callerWrite = observed.deferNextSetParameters(isCallerEncoding);
      const changingCamera = changeCamera(track4K);

      await settle();
      releaseStats();
      await settle();
      sendMainCamInfo(callManager, HEADERS_MAX_360P);
      await settle();

      // обе балансировки отработали, а запись вызывающего ещё не применена
      expect(await getSettledResult(changingCamera)).toEqual({ status: 'pending' });
      expect(getCallerWrites(logLengthBeforeChange)).toEqual([]);

      callerWrite.resolve(undefined);
      await changingCamera;

      expect(getCallerWrites(logLengthBeforeChange)).toEqual([
        { type: 'setParameters', scaleResolutionDownBy: CALLER_SCALE_RESOLUTION_DOWN_BY },
      ]);

      await advanceToFirstTickAfterReplacement();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      await expectCommandScaleHeldForPollingWindow();
    });

    it('выставляет 4K-треку scaleResolutionDownBy 6 к первому тику сверки после второй смены камеры и держит его окно опроса, если при MAX 640x360 вторая смена 4K на 4K с sendEncodings масштаба 3 завершилась, пока балансировка первого тика после смены 720p на 4K ждала getStats, а запись вызывающего завершилась после этой балансировки', async () => {
      await startWithMaxResolution360p();
      await changeCamera(track4K);
      await settle();

      const getStats = jest.spyOn(observed.sender, 'getStats');
      const releaseFirstTickStats = deferNextGetStats(observed.sender);

      await advanceToFirstTickAfterReplacement();

      // первый тик после смены камеры балансирует и ждёт ответа getStats
      expect(getStats).toHaveBeenCalledTimes(1);

      // вторая замена завершается во время балансировки первого тика: её отметка должна пережить этот тик
      const secondTrack4K = createVideoTrack(3840, 2160);
      const logLengthBeforeSecondChange = observed.log.length;
      const callerWrite = observed.deferNextSetParameters(isCallerEncoding);
      const changingCamera = changeCamera(secondTrack4K);

      await settle();

      // вторая замена завершилась, пока балансировка первого тика ждёт кодек
      expect(observed.sender.track).toBe(secondTrack4K);

      releaseFirstTickStats();
      await settle();

      // балансировка первого тика и балансировка после второй замены отработали, а запись вызывающего ещё не применена
      expect(await getSettledResult(changingCamera)).toEqual({ status: 'pending' });
      expect(getCallerWrites(logLengthBeforeSecondChange)).toEqual([]);

      callerWrite.resolve(undefined);
      await changingCamera;

      expect(getCallerWrites(logLengthBeforeSecondChange)).toEqual([
        { type: 'setParameters', scaleResolutionDownBy: CALLER_SCALE_RESOLUTION_DOWN_BY },
      ]);

      await advanceToFirstTickAfterReplacement();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      await expectCommandScaleHeldForPollingWindow();
    });

    it('выставляет 4K-треку scaleResolutionDownBy 6 к первому тику сверки и держит его окно опроса, если при смене камеры 720p на 4K с sendEncodings масштаба 3 повторная MAX 640x360 пришла во время оригинального replaceTrack, а балансировка после замены прочитала параметры до завершения записи вызывающего', async () => {
      await startWithMaxResolution360p();

      const logLengthBeforeChange = observed.log.length;
      const originalReplacement = observed.deferNextReplaceTrack();
      const changingCamera = changeCamera(track4K);

      await settle();
      // балансировка команды стоит в очереди за заменой и учитывает 4K-трек до балансировки после замены:
      // к первому тику входы не меняются, сверить параметры его заставляет только сама замена
      sendMainCamInfo(callManager, HEADERS_MAX_360P);
      await settle();

      // оригинальный replaceTrack ещё не завершён
      expect(observed.sender.track).not.toBe(track4K);

      const releaseStats = deferNextGetStats(observed.sender);
      const callerWrite = observed.deferNextSetParameters(isCallerEncoding);

      originalReplacement.resolve(undefined);
      await settle();
      releaseStats();
      await settle();

      // замена, балансировка команды и балансировка после замены отработали, а запись вызывающего ещё не применена
      expect(observed.sender.track).toBe(track4K);
      expect(await getSettledResult(changingCamera)).toEqual({ status: 'pending' });
      expect(getCallerWrites(logLengthBeforeChange)).toEqual([]);

      callerWrite.resolve(undefined);
      await changingCamera;

      expect(getCallerWrites(logLengthBeforeChange)).toEqual([
        { type: 'setParameters', scaleResolutionDownBy: CALLER_SCALE_RESOLUTION_DOWN_BY },
      ]);

      await advanceToFirstTickAfterReplacement();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      await expectCommandScaleHeldForPollingWindow();
    });
  });

  describe('запись вызывающего завершилась до чтения параметров балансировкой', () => {
    it('выставляет 4K-треку scaleResolutionDownBy 6 и держит его окно опроса, если при MAX 640x360 камера 720p сменена на 4K с sendEncodings масштаба 3, а запись вызывающего завершилась раньше ответа getStats балансировке после замены', async () => {
      await startWithMaxResolution360p();

      const logLengthBeforeChange = observed.log.length;
      const releaseStats = deferNextGetStats(observed.sender);
      const changingCamera = changeCamera(track4K);

      await settle();

      // замена и запись вызывающего завершены, а балансировка после замены ещё ждёт кодек
      expect(await getSettledResult(changingCamera)).toEqual({
        status: 'fulfilled',
        value: expect.any(MediaStream) as MediaStream,
      });
      expect(getCallerWrites(logLengthBeforeChange)).toEqual([
        { type: 'setParameters', scaleResolutionDownBy: CALLER_SCALE_RESOLUTION_DOWN_BY },
      ]);

      releaseStats();
      await settle();

      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      await expectCommandScaleHeldForPollingWindow();
    });
  });

  describe('после первого тика сверки, следующего за сменой камеры', () => {
    it('не перезаписывает масштаб и битрейт, выставленные другим модулем после первого тика, следующего за сменой камеры 720p на 4K при MAX 640x360, в течение окна опроса', async () => {
      await startWithMaxResolution360p();
      await changeCamera(track4K);
      await settle();
      await advanceToFirstTickAfterReplacement();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      await observed.applyForeignEncoding(FOREIGN_ENCODING);

      const logLengthAfterForeignChange = observed.log.length;

      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(observed.log.slice(logLengthAfterForeignChange)).toEqual([]);
      expect(observed.getAppliedEncoding()).toEqual(FOREIGN_ENCODING);
    });
  });

  describe('остановка балансировки до первого тика после смены камеры', () => {
    it('только сбрасывает параметры 4K-трека по треку и maxAvailableResolution 1280x720 и больше не запрашивает getStats и не пишет в отправитель, если stopBalancing вызван после смены камеры 720p на 4K при MAX 640x360 до первого тика сверки', async () => {
      await startWithMaxResolution360p();
      await changeCamera(track4K);
      await settle();

      const getStats = jest.spyOn(observed.sender, 'getStats');
      const logLengthBeforeStop = observed.log.length;

      manager.stopBalancing();
      await settle();
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(observed.log.slice(logLengthBeforeStop)).toEqual([
        {
          type: 'setParameters',
          scaleResolutionDownBy: ENCODING_4K_LIMITED_TO_720P.scaleResolutionDownBy,
        },
      ]);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(getStats).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
