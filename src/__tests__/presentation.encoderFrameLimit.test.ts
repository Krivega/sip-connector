/* eslint-disable jest/expect-expect */
/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import flushPromises from '../__fixtures__/flushPromises';
import JsSIP from '../__fixtures__/jssip.mock';
import { EContentMainCAM, EContentTypeReceived, EKeyHeader } from '../ApiManager';
import { doMockSipConnector } from '../doMock';
import { createMockTrack } from '../VideoSendingBalancer/__fixtures__';

import type { TResolutionSize } from '@/types';
import type { SipConnector } from '../SipConnector';

// OpenH264 не инициализирует энкодер, если в кадре больше 36 864 макроблоков 16×16
const ENCODER_MAX_MACROBLOCKS = 36_864;
const MACROBLOCK_SIZE = 16;
// Допуск к минимально достаточному уменьшению: кадр не должен ужиматься сильнее нужного
const SCALE_TOLERANCE = 1.01;
const PRESENTATION_MAX_BITRATE = 1_000_000;
const FRAME_CHECK_PERIOD_MS = 1000;
const LONG_PERIOD_MS = 10_000;
const RECONNECT_PERIOD_MS = 2000;
const CALL_SETUP_PERIOD_MS = 1000;
// Балансировщик основного видео стартует через 10 с после установки звонка
const BALANCING_START_PERIOD_MS = 12_000;
const MAX_FLUSHES = 50;

// Пауза основной камеры по команде сервера уменьшает её кадр в 200 раз
const PAUSED_MAIN_CAM_SCALE = 200;

const headersPauseMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.PAUSE_MAIN_CAM],
];

const SIZE_FHD = { width: 1920, height: 1080 };
const SIZE_4K = { width: 3840, height: 2160 };
const SIZE_OVER_LIMIT = { width: 3840, height: 2486 };
const SIZE_ONE_COLUMN_OVER_LIMIT = { width: 4097, height: 2304 };
const SIZE_FAR_OVER_LIMIT = { width: 6016, height: 3384 };
const MAX_RESOLUTION_FHD = { width: 1920, height: 1080 };
const MAX_RESOLUTION_8K = { width: 7680, height: 4320 };

const countMacroblocks = ({ width, height }: TResolutionSize): number => {
  return Math.ceil(width / MACROBLOCK_SIZE) * Math.ceil(height / MACROBLOCK_SIZE);
};

const getEncodedSize = ({ width, height }: TResolutionSize, scale: number): TResolutionSize => {
  return { width: Math.ceil(width / scale), height: Math.ceil(height / scale) };
};

const getMaxNeededScale = ({ width, height }: TResolutionSize): number => {
  return (
    SCALE_TOLERANCE * Math.sqrt((width * height) / (ENCODER_MAX_MACROBLOCKS * MACROBLOCK_SIZE ** 2))
  );
};

const createPresentationTrack = (size: TResolutionSize) => {
  const { track, setSize } = createMockTrack(size.width, size.height);

  return { track: track as unknown as MediaStreamVideoTrack, setSize };
};

const flushUntil = async (condition: () => boolean): Promise<void> => {
  for (let index = 0; index < MAX_FLUSHES && !condition(); index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await flushPromises();
  }

  if (!condition()) {
    throw new Error('Condition is not reached');
  }
};

describe('presentation: предел кадра H.264-энкодера', () => {
  let sipConnector: SipConnector;

  const startCall = async ({
    maxAvailableResolution,
  }: { maxAvailableResolution?: TResolutionSize } = {}): Promise<void> => {
    await sipConnector.connect({ ...dataForConnectionWithAuthorization, maxAvailableResolution });
    await sipConnector.call({
      number: '111',
      mediaStream: createMediaStreamMock({
        audio: { deviceId: { exact: 'audioDeviceId' } },
        video: { deviceId: { exact: 'videoDeviceId' } },
      }),
    });

    // Подменяем таймеры после установки звонка: размер кадра проверяется по таймеру
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  };

  // Таймер старта балансировщика ставится при установке звонка, поэтому подменяем таймеры до неё
  const startCallUnderFakeTimers = async (mediaStream: MediaStream): Promise<void> => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });

    const connecting = sipConnector.connect(dataForConnectionWithAuthorization);

    await jest.advanceTimersByTimeAsync(CALL_SETUP_PERIOD_MS);
    await connecting;

    const calling = sipConnector.call({ number: '111', mediaStream });

    await jest.advanceTimersByTimeAsync(CALL_SETUP_PERIOD_MS);
    await calling;
  };

  const reconnect = async (maxAvailableResolution?: TResolutionSize): Promise<void> => {
    const connecting = sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      maxAvailableResolution,
    });

    await jest.advanceTimersByTimeAsync(RECONNECT_PERIOD_MS);
    await connecting;
  };

  const getConnection = (): RTCPeerConnection => {
    const { connection } = sipConnector;

    if (!connection) {
      throw new Error('No connection');
    }

    return connection;
  };

  const getRtcSession = () => {
    const rtcSession = sipConnector.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No established rtcSession');
    }

    return rtcSession;
  };

  const holdNextInfo = () => {
    let answerInfo: () => void = () => {};
    const sendInfoMocked = jest
      .spyOn(getRtcSession(), 'sendInfo')
      .mockImplementationOnce(async () => {
        return new Promise<void>((resolve) => {
          answerInfo = resolve;
        });
      });

    return {
      sendInfoMocked,
      answerInfo: () => {
        answerInfo();
      },
    };
  };

  const findSender = (
    connection: RTCPeerConnection,
    track: MediaStreamTrack,
  ): RTCRtpSender | undefined => {
    return connection.getSenders().find((sender) => {
      return sender.track === track;
    });
  };

  const getSenderProtected = (track: MediaStreamTrack): RTCRtpSender => {
    const sender = findSender(getConnection(), track);

    if (!sender) {
      throw new Error('No presentation sender');
    }

    return sender;
  };

  const getEncoding = (track: MediaStreamTrack): RTCRtpEncodingParameters | undefined => {
    return getSenderProtected(track).getParameters().encodings[0];
  };

  const spyOnSetParameters = (connection: RTCPeerConnection) => {
    return connection.getSenders().map((sender) => {
      return jest.spyOn(sender, 'setParameters');
    });
  };

  const expectNoDownscale = (track: MediaStreamTrack): void => {
    const encoding = getEncoding(track);

    expect(encoding?.scaleResolutionDownBy ?? 1).toBe(1);
    expect(encoding?.maxBitrate).toBe(PRESENTATION_MAX_BITRATE);
  };

  const expectFitsEncoderLimit = (track: MediaStreamTrack, frameSize: TResolutionSize): void => {
    const encoding = getEncoding(track);
    const scale = encoding?.scaleResolutionDownBy ?? 1;

    expect(scale).toBeGreaterThan(1);
    expect(countMacroblocks(getEncodedSize(frameSize, scale))).toBeLessThanOrEqual(
      ENCODER_MAX_MACROBLOCKS,
    );
    expect(scale).toBeLessThanOrEqual(getMaxNeededScale(frameSize));
    expect(encoding?.maxBitrate).toBe(PRESENTATION_MAX_BITRATE);
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();
  });

  afterEach(async () => {
    if (sipConnector.isCallActive) {
      await sipConnector.hangUp();
    }

    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('старт демонстрации без maxAvailableResolution', () => {
    it('уменьшает кадр 3840x2486 ровно до предела энкодера и сохраняет битрейт', async () => {
      await startCall();

      const { track } = createPresentationTrack(SIZE_OVER_LIMIT);

      await sipConnector.startPresentation(track);

      expectFitsEncoderLimit(track, SIZE_OVER_LIMIT);
    });

    it.each([
      [1920, 1080],
      [2160, 3840],
      [5120, 1440],
      [4096, 2304],
    ])('не уменьшает кадр %ix%i в пределе энкодера', async (width, height) => {
      await startCall();

      const { track } = createPresentationTrack({ width, height });

      await sipConnector.startPresentation(track);

      expectNoDownscale(track);
    });

    it('уменьшает кадр 4097x2304, на столбец макроблоков больше предела', async () => {
      await startCall();

      const { track } = createPresentationTrack(SIZE_ONE_COLUMN_OVER_LIMIT);

      await sipConnector.startPresentation(track);

      expectFitsEncoderLimit(track, SIZE_ONE_COLUMN_OVER_LIMIT);
    });
  });

  describe('старт демонстрации с maxAvailableResolution', () => {
    it('применяет maxAvailableResolution 1920x1080, когда он строже предела энкодера', async () => {
      await startCall({ maxAvailableResolution: MAX_RESOLUTION_FHD });

      const { track } = createPresentationTrack(SIZE_4K);

      await sipConnector.startPresentation(track);

      expect(getEncoding(track)).toEqual(
        expect.objectContaining({
          scaleResolutionDownBy: 2,
          maxBitrate: PRESENTATION_MAX_BITRATE,
        }),
      );
    });

    it('применяет предел энкодера, когда maxAvailableResolution мягче него', async () => {
      await startCall({ maxAvailableResolution: MAX_RESOLUTION_8K });

      const { track } = createPresentationTrack(SIZE_OVER_LIMIT);

      await sipConnector.startPresentation(track);

      expectFitsEncoderLimit(track, SIZE_OVER_LIMIT);
    });
  });

  describe('updatePresentation', () => {
    it('замена трека 1920x1080 на 3840x2486 уменьшает кадр до предела энкодера', async () => {
      await startCall();

      const { track: trackFhd } = createPresentationTrack(SIZE_FHD);
      const { track: trackOverLimit } = createPresentationTrack(SIZE_OVER_LIMIT);

      await sipConnector.startPresentation(trackFhd);
      await sipConnector.updatePresentation(trackOverLimit);

      expectFitsEncoderLimit(trackOverLimit, SIZE_OVER_LIMIT);
    });

    it('замена трека 3840x2486 на 1920x1080 снимает уменьшение', async () => {
      await startCall();

      const { track: trackOverLimit } = createPresentationTrack(SIZE_OVER_LIMIT);
      const { track: trackFhd } = createPresentationTrack(SIZE_FHD);

      await sipConnector.startPresentation(trackOverLimit);
      expectFitsEncoderLimit(trackOverLimit, SIZE_OVER_LIMIT);

      await sipConnector.updatePresentation(trackFhd);

      expectNoDownscale(trackFhd);
    });
  });

  describe('изменение размера кадра во время демонстрации', () => {
    it('рост кадра с 1920x1080 до 3840x2486 пересчитывается не позже чем через 1 с', async () => {
      await startCall();

      const { track, setSize } = createPresentationTrack(SIZE_FHD);

      await sipConnector.startPresentation(track);
      expectNoDownscale(track);

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

      expectFitsEncoderLimit(track, SIZE_OVER_LIMIT);
    });

    it('рост кадра через 10 с после старта тоже пересчитывается не позже чем через 1 с', async () => {
      await startCall();

      const { track, setSize } = createPresentationTrack(SIZE_FHD);

      await sipConnector.startPresentation(track);
      await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);
      expectNoDownscale(track);

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

      expectFitsEncoderLimit(track, SIZE_OVER_LIMIT);
    });

    it('уменьшение кадра с 3840x2486 до 1920x1080 возвращает scale к 1', async () => {
      await startCall();

      const { track, setSize } = createPresentationTrack(SIZE_OVER_LIMIT);

      await sipConnector.startPresentation(track);
      expectFitsEncoderLimit(track, SIZE_OVER_LIMIT);

      setSize(SIZE_FHD);
      await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

      expectNoDownscale(track);
    });

    it('рост кадра с 1920x1080 до 3840x2160 при maxAvailableResolution 1920x1080 уменьшает кадр вдвое', async () => {
      await startCall({ maxAvailableResolution: MAX_RESOLUTION_FHD });

      const { track, setSize } = createPresentationTrack(SIZE_FHD);

      await sipConnector.startPresentation(track);
      expectNoDownscale(track);

      setSize(SIZE_4K);
      await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

      expect(getEncoding(track)).toEqual(
        expect.objectContaining({
          scaleResolutionDownBy: 2,
          maxBitrate: PRESENTATION_MAX_BITRATE,
        }),
      );
    });

    it('отклонённая запись параметров при росте кадра не завершает демонстрацию ошибкой и не останавливает пересчёт', async () => {
      await startCall();

      const { track, setSize } = createPresentationTrack(SIZE_FHD);
      const failedHandler = jest.fn();

      sipConnector.on('presentation:failed', failedHandler);
      await sipConnector.startPresentation(track);

      jest
        .spyOn(getSenderProtected(track), 'setParameters')
        .mockRejectedValueOnce(new Error('InvalidModificationError'));

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

      expect(failedHandler).not.toHaveBeenCalled();
      expectNoDownscale(track);

      setSize(SIZE_FAR_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

      expectFitsEncoderLimit(track, SIZE_FAR_OVER_LIMIT);
      expect(failedHandler).not.toHaveBeenCalled();
    });
  });

  describe('после завершения демонстрации', () => {
    it('после stopPresentation рост кадра не меняет параметры отправителя и не оставляет таймеров', async () => {
      await startCall();

      const { track, setSize } = createPresentationTrack(SIZE_FHD);

      await sipConnector.startPresentation(track);

      const sender = getSenderProtected(track);

      await sipConnector.stopPresentation();

      expect(jest.getTimerCount()).toBe(0);

      const setParametersSpy = jest.spyOn(sender, 'setParameters');

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

      expect(setParametersSpy).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('после hangUp рост кадра не меняет параметры отправителя и не оставляет таймеров', async () => {
      await startCall();

      const { track, setSize } = createPresentationTrack(SIZE_FHD);

      await sipConnector.startPresentation(track);

      const sender = getSenderProtected(track);

      await sipConnector.hangUp();

      expect(jest.getTimerCount()).toBe(0);

      const setParametersSpy = jest.spyOn(sender, 'setParameters');

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

      expect(setParametersSpy).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('балансировщик основного видео', () => {
    const createAudioStream = (): MediaStream => {
      return createMediaStreamMock({ audio: { deviceId: { exact: 'audioDeviceId' } } });
    };

    const startPresentationUntilBalancing = async (track: MediaStreamVideoTrack) => {
      const balancingStarted = jest.fn();

      sipConnector.on('video-balancer:balancing-started', balancingStarted);
      await sipConnector.startPresentation(track);
      await jest.advanceTimersByTimeAsync(BALANCING_START_PERIOD_MS);

      expect(balancingStarted).toHaveBeenCalled();
    };

    it('в звонке без камеры не перезаписывает кадр и битрейт демонстрации', async () => {
      await startCallUnderFakeTimers(createAudioStream());

      const { track } = createPresentationTrack(SIZE_OVER_LIMIT);

      await startPresentationUntilBalancing(track);

      expectFitsEncoderLimit(track, SIZE_OVER_LIMIT);
    });

    it('в звонке без камеры команда MainCAM от сервера не трогает отправитель демонстрации', async () => {
      await startCallUnderFakeTimers(createAudioStream());

      const { track } = createPresentationTrack(SIZE_OVER_LIMIT);
      const mainCamControl = jest.fn();

      sipConnector.on('api:main-cam-control', mainCamControl);
      await startPresentationUntilBalancing(track);

      const encodingBefore = getEncoding(track);
      const setParametersSpy = jest.spyOn(getSenderProtected(track), 'setParameters');

      JsSIP.triggerNewInfo(getRtcSession(), headersPauseMainCam);
      await flushUntil(() => {
        return mainCamControl.mock.calls.length > 0;
      });
      await flushPromises();

      expect(setParametersSpy).not.toHaveBeenCalled();
      expect(getEncoding(track)).toEqual(encodingBefore);
    });

    it('в звонке с камерой балансирует отправитель камеры, а демонстрацию не трогает', async () => {
      const cameraStream = createMediaStreamMock({
        audio: { deviceId: { exact: 'audioDeviceId' } },
        video: {
          deviceId: { exact: 'videoDeviceId' },
          width: { exact: 1280 },
          height: { exact: 720 },
        },
      });

      await startCallUnderFakeTimers(cameraStream);

      const { track } = createPresentationTrack(SIZE_OVER_LIMIT);
      const findCameraSender = () => {
        return getConnection()
          .getSenders()
          .find((sender) => {
            return sender.track?.kind === 'video' && sender.track !== track;
          });
      };

      expect(findCameraSender()?.getParameters().encodings[0]?.maxBitrate).toBeUndefined();

      await startPresentationUntilBalancing(track);

      expect(findCameraSender()?.getParameters().encodings[0]?.maxBitrate).toEqual(
        expect.any(Number),
      );
      expectFitsEncoderLimit(track, SIZE_OVER_LIMIT);
    });

    it('после остановки демонстрации балансирует камеру, попавшую на её бывший отправитель', async () => {
      await startCallUnderFakeTimers(createAudioStream());

      const { track } = createPresentationTrack(SIZE_FHD);
      const cameraStream = createMediaStreamMock({
        video: {
          deviceId: { exact: 'cameraDeviceId' },
          width: { exact: 1280 },
          height: { exact: 720 },
        },
      });
      const [cameraTrack] = cameraStream.getVideoTracks();
      const balancingStarted = jest.fn();
      const mainCamControl = jest.fn();

      sipConnector.on('video-balancer:balancing-started', balancingStarted);
      sipConnector.on('api:main-cam-control', mainCamControl);

      await sipConnector.startPresentation(track);

      const presentationSender = getSenderProtected(track);

      await sipConnector.stopPresentation();
      await sipConnector.replaceMediaStream(cameraStream, {
        addMissing: true,
        deleteExisting: false,
      });

      expect(findSender(getConnection(), cameraTrack)).toBe(presentationSender);

      await jest.advanceTimersByTimeAsync(BALANCING_START_PERIOD_MS);

      expect(balancingStarted).toHaveBeenCalled();

      JsSIP.triggerNewInfo(getRtcSession(), headersPauseMainCam);
      await flushUntil(() => {
        return mainCamControl.mock.calls.length > 0;
      });
      await flushPromises();

      expect(presentationSender.getParameters().encodings[0]?.scaleResolutionDownBy).toBe(
        PAUSED_MAIN_CAM_SCALE,
      );
    });

    describe('повторный старт демонстрации на отправителе, подключённом балансировщиком', () => {
      // Звонок без камеры: после остановки демонстрации балансировщик подключает её бывший отправитель
      const attachBalancerToStoppedPresentationSender = async (
        track: MediaStreamVideoTrack,
      ): Promise<RTCRtpSender> => {
        const balancingStarted = jest.fn();

        await startCallUnderFakeTimers(createAudioStream());
        sipConnector.on('video-balancer:balancing-started', balancingStarted);
        await sipConnector.startPresentation(track);

        const sender = getSenderProtected(track);

        await sipConnector.stopPresentation();
        await jest.advanceTimersByTimeAsync(BALANCING_START_PERIOD_MS);

        expect(balancingStarted).toHaveBeenCalled();

        return sender;
      };

      it('PAUSE_MAIN_CAM, полученная во время замены трека повторного старта, не попадает в отправитель демонстрации', async () => {
        const { track } = createPresentationTrack(SIZE_FHD);
        const { track: nextTrack } = createPresentationTrack(SIZE_FHD);
        const mainCamControl = jest.fn();
        const sender = await attachBalancerToStoppedPresentationSender(track);
        const replaceTrack = sender.replaceTrack.bind(sender);
        const setParametersSpy = jest.spyOn(sender, 'setParameters');
        let finishReplaceTrackWait: () => void = () => {};
        const replaceTrackSpy = jest
          .spyOn(sender, 'replaceTrack')
          .mockImplementationOnce(async (senderTrack) => {
            await new Promise<void>((resolve) => {
              finishReplaceTrackWait = resolve;
            });
            await replaceTrack(senderTrack);
          });

        sipConnector.on('api:main-cam-control', mainCamControl);

        const restarting = sipConnector.startPresentation(nextTrack);

        await flushUntil(() => {
          return replaceTrackSpy.mock.calls.length > 0;
        });
        JsSIP.triggerNewInfo(getRtcSession(), headersPauseMainCam);
        await flushUntil(() => {
          return mainCamControl.mock.calls.length > 0;
        });
        await flushPromises();
        finishReplaceTrackWait();
        await restarting;
        await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

        expect(sender.track).toBe(nextTrack);
        expect(
          setParametersSpy.mock.calls.filter(([parameters]) => {
            return parameters.encodings[0]?.scaleResolutionDownBy === PAUSED_MAIN_CAM_SCALE;
          }),
        ).toEqual([]);
      });

      it('stopBalancing во время повторно запущенной демонстрации не меняет её maxBitrate', async () => {
        const { track } = createPresentationTrack(SIZE_FHD);
        const { track: nextTrack } = createPresentationTrack(SIZE_FHD);

        await attachBalancerToStoppedPresentationSender(track);
        await sipConnector.startPresentation(nextTrack);
        sipConnector.videoSendingBalancerManager.stopBalancing();
        await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

        expect(getEncoding(nextTrack)?.maxBitrate).toBe(PRESENTATION_MAX_BITRATE);
      });
    });

    it('команда MainCAM во время updatePresentation не трогает отправитель, на котором ещё старый трек демонстрации', async () => {
      await startCallUnderFakeTimers(createAudioStream());

      const { track } = createPresentationTrack(SIZE_FHD);
      const { track: nextTrack } = createPresentationTrack(SIZE_FHD);
      const mainCamControl = jest.fn();

      sipConnector.on('api:main-cam-control', mainCamControl);
      await startPresentationUntilBalancing(track);

      const sender = getSenderProtected(track);
      const replaceTrack = sender.replaceTrack.bind(sender);
      let finishReplaceTrack: () => void = () => {};
      const replaceTrackSpy = jest
        .spyOn(sender, 'replaceTrack')
        .mockImplementationOnce(async (senderTrack) => {
          await new Promise<void>((resolve) => {
            finishReplaceTrack = resolve;
          });
          await replaceTrack(senderTrack);
        });

      const updatePromise = sipConnector.updatePresentation(nextTrack);

      await flushUntil(() => {
        return replaceTrackSpy.mock.calls.length > 0;
      });

      expect(sender.track).toBe(track);

      const setParametersSpy = jest.spyOn(sender, 'setParameters');

      JsSIP.triggerNewInfo(getRtcSession(), headersPauseMainCam);
      await flushUntil(() => {
        return mainCamControl.mock.calls.length > 0;
      });
      await flushPromises();

      expect(setParametersSpy).not.toHaveBeenCalled();

      finishReplaceTrack();
      await updatePromise;
    });

    it('запуск балансировки во время старта до регистрации отправителя демонстрации его не трогает', async () => {
      await startCallUnderFakeTimers(createAudioStream());

      const { track } = createPresentationTrack(SIZE_OVER_LIMIT);
      const balancingStarted = jest.fn();
      let isTransceiverAdded = false;
      let finishAddingTransceiver: () => void = () => {};

      sipConnector.on('video-balancer:balancing-started', balancingStarted);

      const startPromise = sipConnector.startPresentation(track, {
        onAddedTransceiver: async () => {
          isTransceiverAdded = true;
          await new Promise<void>((resolve) => {
            finishAddingTransceiver = resolve;
          });
        },
      });

      await flushUntil(() => {
        return isTransceiverAdded;
      });

      const setParametersSpy = jest.spyOn(getSenderProtected(track), 'setParameters');

      await jest.advanceTimersByTimeAsync(BALANCING_START_PERIOD_MS);

      expect(balancingStarted).toHaveBeenCalled();
      expect(setParametersSpy).not.toHaveBeenCalled();

      finishAddingTransceiver();
      await startPromise;
    });
  });

  describe('гонки обновления демонстрации', () => {
    it('updatePresentation во время незавершённой остановки не оставляет слежения за кадром', async () => {
      await startCall();

      const connection = getConnection();
      const { track } = createPresentationTrack(SIZE_FHD);
      const { track: nextTrack, setSize } = createPresentationTrack(SIZE_FHD);

      await sipConnector.startPresentation(track);

      const { sendInfoMocked, answerInfo } = holdNextInfo();
      const stopPromise = sipConnector.stopPresentation();

      await flushUntil(() => {
        return sendInfoMocked.mock.calls.length > 0;
      });

      const updatePromise = sipConnector.updatePresentation(nextTrack);

      await flushPromises();
      answerInfo();
      await Promise.allSettled([stopPromise, updatePromise]);
      await flushPromises();

      expect(findSender(connection, nextTrack)).toBeDefined();
      expect(jest.getTimerCount()).toBe(0);

      const setParametersSpies = spyOnSetParameters(connection);

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

      setParametersSpies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('гонки старта демонстрации', () => {
    it('stopPresentation во время ожидания ответа на INFO старта не оставляет пересчётов и таймеров', async () => {
      await startCall();

      const connection = getConnection();
      const { track, setSize } = createPresentationTrack(SIZE_FHD);
      const { sendInfoMocked, answerInfo } = holdNextInfo();

      const startPromise = sipConnector.startPresentation(track);

      await flushUntil(() => {
        return sendInfoMocked.mock.calls.length > 0;
      });

      const stopPromise = sipConnector.stopPresentation();

      answerInfo();

      const [startResult] = await Promise.allSettled([startPromise, stopPromise]);

      expect(startResult.status).toBe('rejected');
      expect(findSender(connection, track)).toBeUndefined();
      expect(jest.getTimerCount()).toBe(0);

      const setParametersSpies = spyOnSetParameters(connection);

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

      setParametersSpies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('hangUp во время ожидания ответа на INFO старта не оставляет пересчётов и таймеров', async () => {
      await startCall();

      const connection = getConnection();
      const { track, setSize } = createPresentationTrack(SIZE_FHD);
      const { sendInfoMocked, answerInfo } = holdNextInfo();

      const startPromise = sipConnector.startPresentation(track);

      await flushUntil(() => {
        return sendInfoMocked.mock.calls.length > 0;
      });

      await sipConnector.hangUp();
      answerInfo();

      const [startResult] = await Promise.allSettled([startPromise]);

      expect(startResult.status).toBe('rejected');
      expect(jest.getTimerCount()).toBe(0);

      const setParametersSpies = spyOnSetParameters(connection);

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

      setParametersSpies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('hangUp во время re-INVITE старта не оставляет пересчётов и таймеров', async () => {
      await startCall();

      const connection = getConnection();
      const { track, setSize } = createPresentationTrack(SIZE_FHD);
      let answerReinvite: (isRenegotiated: boolean) => void = () => {};
      const renegotiateMocked = jest
        .spyOn(getRtcSession(), 'renegotiate')
        .mockImplementationOnce(async () => {
          return new Promise<boolean>((resolve) => {
            answerReinvite = resolve;
          });
        });

      const startPromise = sipConnector.startPresentation(track);

      await flushUntil(() => {
        return renegotiateMocked.mock.calls.length > 0;
      });

      expect(findSender(connection, track)).toBeDefined();

      await sipConnector.hangUp();
      answerReinvite(true);

      const [startResult] = await Promise.allSettled([startPromise]);

      await flushPromises();

      expect(startResult.status).toBe('rejected');
      expect(jest.getTimerCount()).toBe(0);

      const setParametersSpies = spyOnSetParameters(connection);

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

      setParametersSpies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('stopPresentation во время re-INVITE старта не оставляет пересчётов и таймеров', async () => {
      await startCall();

      const connection = getConnection();
      const { track, setSize } = createPresentationTrack(SIZE_FHD);
      let answerReinvite: (isRenegotiated: boolean) => void = () => {};
      const renegotiateMocked = jest
        .spyOn(getRtcSession(), 'renegotiate')
        .mockImplementationOnce(async () => {
          return new Promise<boolean>((resolve) => {
            answerReinvite = resolve;
          });
        });

      const startPromise = sipConnector.startPresentation(track);

      await flushUntil(() => {
        return renegotiateMocked.mock.calls.length > 0;
      });

      expect(findSender(connection, track)).toBeDefined();

      const stopPromise = sipConnector.stopPresentation();

      answerReinvite(true);
      await Promise.allSettled([startPromise, stopPromise]);
      await flushPromises();

      expect(jest.getTimerCount()).toBe(0);

      const setParametersSpies = spyOnSetParameters(connection);

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

      setParametersSpies.forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('повторный старт после переподключения с maxAvailableResolution 1920x1080 применяет новый лимит', async () => {
      await startCall();

      const { track: firstTrack } = createPresentationTrack(SIZE_OVER_LIMIT);
      const { track: secondTrack } = createPresentationTrack(SIZE_OVER_LIMIT);

      await sipConnector.startPresentation(firstTrack);
      await sipConnector.stopPresentation();

      const connection = getConnection();

      await reconnect(MAX_RESOLUTION_FHD);

      expect(getConnection()).toBe(connection);

      await sipConnector.startPresentation(secondTrack);

      expect(getEncoding(secondTrack)?.scaleResolutionDownBy).toBeCloseTo(
        SIZE_OVER_LIMIT.height / MAX_RESOLUTION_FHD.height,
      );
      expect(getEncoding(secondTrack)?.maxBitrate).toBe(PRESENTATION_MAX_BITRATE);
    });

    it('повторный старт после переподключения без maxAvailableResolution применяет предел энкодера вместо прежнего лимита', async () => {
      await startCall({ maxAvailableResolution: MAX_RESOLUTION_FHD });

      const { track: firstTrack } = createPresentationTrack(SIZE_OVER_LIMIT);
      const { track: secondTrack } = createPresentationTrack(SIZE_OVER_LIMIT);

      await sipConnector.startPresentation(firstTrack);
      await sipConnector.stopPresentation();

      const connection = getConnection();

      await reconnect();

      expect(getConnection()).toBe(connection);

      await sipConnector.startPresentation(secondTrack);

      expectFitsEncoderLimit(secondTrack, SIZE_OVER_LIMIT);
    });
  });
});
