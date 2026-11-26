import { createManagers } from '@/__fixtures__/createManagers';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import { applySenderParams } from '@/utils/peerConnection/applySenderParams';
import { replaceMediaStreamInConnection } from '@/utils/peerConnection/replaceMediaStream';
import { createBalancerOptions, createMockTrack } from '@/VideoSendingBalancer/__fixtures__';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';
import {
  BALANCING_START_DELAY,
  confirmCall,
  createObservedSender,
  createVideoTrack,
  deferNextGetStats,
  ENCODING_4K_LIMITED_TO_360P,
  ENCODING_4K_LIMITED_TO_720P,
  ENCODING_720P_BY_TRACK,
  ENCODING_720P_LIMITED_TO_360P,
  getSettledResult,
  hangNextGetStats,
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

// degradationPreference камеры: SipConnector пишет его при ответе на звонок и в replaceMediaStream при isDetail
const ANSWER_DEGRADATION_PREFERENCE: RTCDegradationPreference = 'balanced';
const DETAIL_DEGRADATION_PREFERENCE: RTCDegradationPreference = 'maintain-resolution';

// sendEncodings, которые SipConnector считает для 4K-трека по maxAvailableResolution 1280x720
const CALLER_SCALE_RESOLUTION_DOWN_BY = ENCODING_4K_LIMITED_TO_720P.scaleResolutionDownBy;
const CALLER_SEND_ENCODINGS = [{ scaleResolutionDownBy: CALLER_SCALE_RESOLUTION_DOWN_BY }];

describe('VideoSendingBalancerManager: degradationPreference отправителя камеры', () => {
  let callManager: CallManager;
  let apiManager: ApiManager;
  let connection: RTCPeerConnectionMock;
  let manager: VideoSendingBalancerManager;
  let observed: TObservedSender;
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;

  const useSenderWithTrack = (track: MediaStreamVideoTrack) => {
    observed = createObservedSender(track);
    connection.senders = [observed.sender];
  };

  const getDegradationPreference = () => {
    return observed.sender.getParameters().degradationPreference;
  };

  // так degradationPreference пишет SipConnector: applySenderParams, мимо балансировщика
  const applyCallerDegradationPreference = async (
    degradationPreference: RTCDegradationPreference = DETAIL_DEGRADATION_PREFERENCE,
  ) => {
    await applySenderParams(observed.sender, { degradationPreference });
  };

  const confirmCallAndWaitBalancingStart = async () => {
    confirmCall(callManager, connection);
    await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
    await settle();
  };

  const startWithMaxResolution360p = async () => {
    await confirmCallAndWaitBalancingStart();
    sendMainCamInfo(callManager, HEADERS_MAX_360P);
    await settle();
  };

  // смена камеры так, как её делает пакет: replaceTrack и сразу после него запись sendEncodings и degradationPreference вызывающего
  const changeCamera = async (
    track: MediaStreamVideoTrack,
    degradationPreference: RTCDegradationPreference = DETAIL_DEGRADATION_PREFERENCE,
  ) => {
    return replaceMediaStreamInConnection({
      connection: connection as RTCPeerConnection,
      stream: new MediaStream([track]),
      renegotiate: async () => {
        return true;
      },
      options: { sendEncodings: CALLER_SEND_ENCODINGS, degradationPreference },
    });
  };

  // первый тик сверки после замены: замена возвращает опрос к начальному интервалу
  const advanceToFirstTickAfterReplacement = async () => {
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL);
    await settle();
  };

  const subscribeParametersUpdated = () => {
    const handler = jest.fn();

    manager.on('parameters-updated', handler);

    return handler;
  };

  const getSetParametersEntries = (logLengthBefore: number) => {
    return observed.log.slice(logLengthBefore).filter((entry) => {
      return entry.type === 'setParameters';
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();

    ({ callManager, apiManager } = createManagers());

    track720 = createVideoTrack(1280, 720);
    track4K = createVideoTrack(3840, 2160);
    connection = new RTCPeerConnectionMock(undefined, []);
    useSenderWithTrack(track720);

    setConnection(callManager, connection as RTCPeerConnection);

    manager = new VideoSendingBalancerManager(
      callManager,
      apiManager,
      createBalancerOptions({ maxResolution: MAX_AVAILABLE_RESOLUTION }),
    );
  });

  afterEach(() => {
    manager.stopBalancing();
    jest.useRealTimers();
  });

  // перед проверяемой записью degradationPreference выставляется заново: так проверяется именно она, а не записи до неё
  describe('записи балансировщика сохраняют degradationPreference maintain-resolution, выставленный вызывающим', () => {
    it('сохраняет его при первой балансировке запуска, выставляя 4K-треку scaleResolutionDownBy 3 по maxAvailableResolution 1280x720', async () => {
      useSenderWithTrack(track4K);
      await applyCallerDegradationPreference();

      await confirmCallAndWaitBalancingStart();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });

    it('сохраняет его при балансировке по команде MAX 640x360, выставляя 4K-треку scaleResolutionDownBy 6', async () => {
      useSenderWithTrack(track4K);
      await confirmCallAndWaitBalancingStart();
      await applyCallerDegradationPreference();

      sendMainCamInfo(callManager, HEADERS_MAX_360P);
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });

    it('не пишет в отправитель и не шлёт parameters-updated по повторной команде MAX 640x360, параметры которой 4K-трек уже получил', async () => {
      useSenderWithTrack(track4K);
      await startWithMaxResolution360p();
      await applyCallerDegradationPreference();

      const parametersUpdated = subscribeParametersUpdated();
      const logLengthBeforeCommand = observed.log.length;

      sendMainCamInfo(callManager, HEADERS_MAX_360P);
      await settle();

      expect(getSetParametersEntries(logLengthBeforeCommand)).toEqual([]);
      expect(parametersUpdated).not.toHaveBeenCalled();
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });

    it('сохраняет его при подготовке к замене 720p на 4K при MAX 640x360: к вызову оригинального replaceTrack выставлен scaleResolutionDownBy 6', async () => {
      await startWithMaxResolution360p();
      await applyCallerDegradationPreference();

      const logLengthBeforeReplace = observed.log.length;
      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = observed.sender.replaceTrack(track4K);

      await settle();

      // оригинальный replaceTrack вызван и ещё не завершён: записана только подготовка
      expect(observed.log.slice(logLengthBeforeReplace)).toEqual([
        {
          type: 'setParameters',
          scaleResolutionDownBy: ENCODING_4K_LIMITED_TO_360P.scaleResolutionDownBy,
        },
        {
          type: 'replaceTrack',
          appliedScaleResolutionDownBy: ENCODING_4K_LIMITED_TO_360P.scaleResolutionDownBy,
        },
      ]);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);

      originalReplacement.resolve(undefined);
      await replacing;
    });

    it('сохраняет его при применении параметров нового трека после замены 4K на 720p при MAX 640x360, выставляя scaleResolutionDownBy 2', async () => {
      useSenderWithTrack(track4K);
      await startWithMaxResolution360p();

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = observed.sender.replaceTrack(track720);

      await settle();
      await applyCallerDegradationPreference();
      // балансировка, запрошенная заменой, не получает кодек: после замены пишет только её применение
      hangNextGetStats(observed.sender);
      originalReplacement.resolve(undefined);
      await replacing;
      await settle();

      expect(observed.sender.track).toBe(track720);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_LIMITED_TO_360P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });

    it('сохраняет его при откате параметров после ошибки оригинального replaceTrack замены 720p на 4K при MAX 640x360, возвращая 720p-треку scaleResolutionDownBy 2', async () => {
      await startWithMaxResolution360p();

      const replaceTrackError = new Error('replaceTrack failed');
      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();

      // подготовка ужесточила параметры до 4K-трека
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      await applyCallerDegradationPreference();
      originalReplacement.reject(replaceTrackError);

      const [result] = await replacing;

      await settle();

      expect(result).toEqual({ status: 'rejected', reason: replaceTrackError });
      expect(observed.sender.track).toBe(track720);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_LIMITED_TO_360P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });

    it('сохраняет его при балансировке после смены камеры 720p на 4K при MAX 640x360, выставляя scaleResolutionDownBy 6 поверх sendEncodings масштаба 3, записанных вызывающим вместе с maintain-resolution до чтения параметров балансировкой', async () => {
      await startWithMaxResolution360p();

      const releaseStats = deferNextGetStats(observed.sender);

      await changeCamera(track4K);

      // запись вызывающего применена, а балансировка после замены ещё ждёт кодек
      expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(
        CALLER_SCALE_RESOLUTION_DOWN_BY,
      );
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);

      releaseStats();
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });

    it('сохраняет его на первом тике сверки после смены камеры 720p на 4K при MAX 640x360, выставляя scaleResolutionDownBy 6 поверх sendEncodings масштаба 3, записанных вызывающим вместе с maintain-resolution после чтения параметров балансировкой', async () => {
      await startWithMaxResolution360p();

      const releaseStats = deferNextGetStats(observed.sender);
      const callerWrite = observed.deferNextSetParameters((encoding) => {
        return encoding.scaleResolutionDownBy === CALLER_SCALE_RESOLUTION_DOWN_BY;
      });
      const changingCamera = changeCamera(track4K);

      await settle();
      releaseStats();
      await settle();

      // балансировка после замены отработала, а запись вызывающего ещё не применена
      expect(await getSettledResult(changingCamera)).toEqual({ status: 'pending' });

      callerWrite.resolve(undefined);
      await changingCamera;

      expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(
        CALLER_SCALE_RESOLUTION_DOWN_BY,
      );
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);

      await advanceToFirstTickAfterReplacement();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });

    it('сохраняет его при сверке по тику после уменьшения размера 4K-трека до 1280x720 без замены, выставляя scaleResolutionDownBy 1 по maxAvailableResolution 1280x720', async () => {
      const { track, setSize } = createMockTrack(3840, 2160);

      useSenderWithTrack(track as MediaStreamVideoTrack);
      await confirmCallAndWaitBalancingStart();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);

      await applyCallerDegradationPreference();
      setSize({ width: 1280, height: 720 });
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_BY_TRACK);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });

    it('сохраняет его при сбросе параметров остановкой балансировки, возвращая 4K-треку scaleResolutionDownBy 3 по maxAvailableResolution 1280x720 после MAX 640x360', async () => {
      useSenderWithTrack(track4K);
      await startWithMaxResolution360p();
      await applyCallerDegradationPreference();

      manager.stopBalancing();
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });

    it('сохраняет его при ручной балансировке до начала звонка, выставляя 4K-треку scaleResolutionDownBy 3 по maxAvailableResolution 1280x720', async () => {
      useSenderWithTrack(track4K);
      await applyCallerDegradationPreference();

      await manager.balance();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });
  });

  describe('смена камеры, после которой вызывающий записал sendEncodings, совпадающие с параметрами балансировщика, и maintain-resolution', () => {
    it('не пишет в отправитель и не шлёт parameters-updated от завершения записи вызывающего до конца окна опроса после первого тика, если звонок принят с balanced, а камера 720p сменена на 4K с sendEncodings масштаба 3 при maxAvailableResolution 1280x720 и запись вызывающего завершилась до чтения параметров балансировкой', async () => {
      await applyCallerDegradationPreference(ANSWER_DEGRADATION_PREFERENCE);
      await confirmCallAndWaitBalancingStart();

      const releaseStats = deferNextGetStats(observed.sender);

      await changeCamera(track4K);

      // замена и запись вызывающего завершены, а балансировка после замены ещё ждёт кодек
      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);

      const parametersUpdated = subscribeParametersUpdated();
      const logLengthAfterCallerWrite = observed.log.length;

      releaseStats();
      await settle();
      await advanceToFirstTickAfterReplacement();
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(getSetParametersEntries(logLengthAfterCallerWrite)).toEqual([]);
      expect(parametersUpdated).not.toHaveBeenCalled();
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('не пишет в отправитель и не шлёт parameters-updated на первом тике сверки после замены, если звонок принят без degradationPreference, камера 720p сменена на 4K с sendEncodings масштаба 3 при maxAvailableResolution 1280x720, а балансировка после замены прочитала параметры до завершения записи вызывающего', async () => {
      await confirmCallAndWaitBalancingStart();

      const releaseStats = deferNextGetStats(observed.sender);
      const callerWrite = observed.deferNextSetParameters(
        (_encoding, { degradationPreference }) => {
          return degradationPreference === DETAIL_DEGRADATION_PREFERENCE;
        },
      );
      const changingCamera = changeCamera(track4K);

      await settle();
      releaseStats();
      await settle();

      // балансировка после замены отработала, а запись вызывающего ещё не применена
      expect(observed.sender.track).toBe(track4K);
      expect(await getSettledResult(changingCamera)).toEqual({ status: 'pending' });
      expect(getDegradationPreference()).toBeUndefined();

      callerWrite.resolve(undefined);
      await changingCamera;

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);

      const parametersUpdated = subscribeParametersUpdated();
      const logLengthAfterCallerWrite = observed.log.length;

      await advanceToFirstTickAfterReplacement();

      expect(getSetParametersEntries(logLengthAfterCallerWrite)).toEqual([]);
      expect(parametersUpdated).not.toHaveBeenCalled();
      expect(getDegradationPreference()).toBe(DETAIL_DEGRADATION_PREFERENCE);
    });
  });
});
