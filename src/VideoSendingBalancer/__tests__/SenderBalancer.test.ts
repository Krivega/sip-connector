import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM } from '@/ApiManager';
import { createBalancerOptions, createVideoTrack } from '../__fixtures__';
import {
  calcMaxBitrateByWidthAndCodec,
  getMaximumBitrate,
  getMinimumBitrate,
} from '../calcBitrate';
import { RESULT_NO_CHANGED, SenderBalancer } from '../SenderBalancer';

import type { TResultSetParametersToSender } from '@/tools';
import type { TResolutionSize } from '@/types';
import type { IMainCamHeaders, IParametersSetter } from '../types';

const CODEC_H264 = 'video/h264';
const CODEC_VP8 = 'video/VP8';
const CODEC_AV1 = 'video/AV1';
const CODEC_UNKNOWN = '';
const MAX_RESOLUTION_1080P = { width: 1920, height: 1080 };

const HEADERS_MAX_720P: IMainCamHeaders = {
  mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
  resolutionMainCam: '1280x720',
};
const HEADERS_PAUSE: IMainCamHeaders = { mainCam: EContentMainCAM.PAUSE_MAIN_CAM };

const PARAMETERS_720P_BY_TRACK = {
  scaleResolutionDownBy: 1,
  maxBitrate: calcMaxBitrateByWidthAndCodec(1280, CODEC_H264),
};
const PARAMETERS_4K_BY_TRACK = {
  scaleResolutionDownBy: 1,
  maxBitrate: calcMaxBitrateByWidthAndCodec(3840, CODEC_H264),
};
const PARAMETERS_4K_LIMITED_TO_720P = {
  scaleResolutionDownBy: 3,
  maxBitrate: calcMaxBitrateByWidthAndCodec(1280, CODEC_H264),
};
const PARAMETERS_4K_LIMITED_TO_1080P = {
  scaleResolutionDownBy: 2,
  maxBitrate: calcMaxBitrateByWidthAndCodec(1920, CODEC_H264),
};
const PARAMETERS_PAUSED = {
  scaleResolutionDownBy: 200,
  maxBitrate: getMinimumBitrate(CODEC_H264),
};

const RESULT_CHANGED: TResultSetParametersToSender = {
  isChanged: true,
  parameters: {
    encodings: [PARAMETERS_4K_BY_TRACK],
    transactionId: '1',
    codecs: [],
    headerExtensions: [],
    rtcp: {},
  },
};

describe('SenderBalancer', () => {
  let parametersSetter: jest.Mocked<IParametersSetter>;
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;
  let sender720: RTCRtpSender;
  let sender4K: RTCRtpSender;

  const createSenderBalancer = (
    options: { ignoreForCodec?: string; maxResolution?: TResolutionSize } = {},
  ) => {
    return new SenderBalancer({ parametersSetter }, createBalancerOptions(options));
  };

  const getAppliedParameters = () => {
    return parametersSetter.setEncodingsToSender.mock.calls.map(([, parameters]) => {
      return parameters;
    });
  };

  beforeEach(() => {
    parametersSetter = {
      setEncodingsToSender: jest.fn().mockResolvedValue(RESULT_CHANGED),
    };
    track720 = createVideoTrack(1280, 720);
    track4K = createVideoTrack(3840, 2160);
    sender720 = new RTCRtpSenderMock({ track: track720 });
    sender4K = new RTCRtpSenderMock({ track: track4K });
  });

  describe('применение с кодеком', () => {
    it('должен вернуть результат установки параметров', async () => {
      const result = await createSenderBalancer().apply(sender4K, { codec: CODEC_H264 });

      expect(result).toBe(RESULT_CHANGED);
    });

    it('должен установить параметры по разрешению трека без команды сервера', async () => {
      await createSenderBalancer().apply(sender4K, { codec: CODEC_H264 });

      expect(parametersSetter.setEncodingsToSender).toHaveBeenCalledTimes(1);
      expect(parametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender4K,
        PARAMETERS_4K_BY_TRACK,
      );
    });

    it('должен установить параметры по команде сервера', async () => {
      await createSenderBalancer().apply(sender4K, {
        codec: CODEC_H264,
        serverHeaders: HEADERS_MAX_720P,
      });

      expect(parametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender4K,
        PARAMETERS_4K_LIMITED_TO_720P,
      );
    });

    it('должен ограничить параметры по maxResolution', async () => {
      await createSenderBalancer({ maxResolution: MAX_RESOLUTION_1080P }).apply(sender4K, {
        codec: CODEC_H264,
      });

      expect(parametersSetter.setEncodingsToSender).toHaveBeenCalledWith(
        sender4K,
        PARAMETERS_4K_LIMITED_TO_1080P,
      );
    });

    it('должен рассчитать битрейт по переданному кодеку', async () => {
      await createSenderBalancer().apply(sender4K, { codec: CODEC_AV1 });

      expect(parametersSetter.setEncodingsToSender).toHaveBeenCalledWith(sender4K, {
        scaleResolutionDownBy: 1,
        maxBitrate: calcMaxBitrateByWidthAndCodec(3840, CODEC_AV1),
      });
    });

    it('должен установить параметры ожидаемого трека, если его ограничение строже', async () => {
      await createSenderBalancer().apply(sender720, {
        codec: CODEC_H264,
        upcomingTrack: track4K,
        serverHeaders: HEADERS_MAX_720P,
      });

      expect(getAppliedParameters()).toEqual([PARAMETERS_4K_LIMITED_TO_720P]);
    });

    it('должен установить параметры текущего трека, если ограничения текущего и ожидаемого треков равны', async () => {
      await createSenderBalancer().apply(sender720, { codec: CODEC_H264, upcomingTrack: track4K });

      expect(getAppliedParameters()).toEqual([PARAMETERS_720P_BY_TRACK]);
    });

    it('должен установить параметры паузы при PAUSE_MAIN_CAM', async () => {
      await createSenderBalancer().apply(sender720, {
        codec: CODEC_H264,
        upcomingTrack: track4K,
        serverHeaders: HEADERS_PAUSE,
      });

      expect(getAppliedParameters()).toEqual([PARAMETERS_PAUSED]);
    });

    it('должен установить параметры ожидаемого трека, если у отправителя нет трека', async () => {
      await createSenderBalancer().apply(new RTCRtpSenderMock(), {
        codec: CODEC_H264,
        upcomingTrack: track4K,
        serverHeaders: HEADERS_MAX_720P,
      });

      expect(getAppliedParameters()).toEqual([PARAMETERS_4K_LIMITED_TO_720P]);
    });
  });

  describe('применение без кодека', () => {
    it('должен установить только scaleResolutionDownBy по текущему треку', async () => {
      await createSenderBalancer().apply(sender4K, { serverHeaders: HEADERS_MAX_720P });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 3 }]);
    });

    it('должен установить только scaleResolutionDownBy ожидаемого трека, если его ограничение строже', async () => {
      await createSenderBalancer().apply(sender720, {
        upcomingTrack: track4K,
        serverHeaders: HEADERS_MAX_720P,
      });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 3 }]);
    });

    it('должен установить только scaleResolutionDownBy текущего трека, если ограничение ожидаемого трека мягче', async () => {
      await createSenderBalancer().apply(sender4K, {
        upcomingTrack: track720,
        serverHeaders: HEADERS_MAX_720P,
      });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 3 }]);
    });

    it('должен установить только scaleResolutionDownBy 1, если ограничения текущего и ожидаемого треков равны', async () => {
      await createSenderBalancer().apply(sender720, { upcomingTrack: track4K });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 1 }]);
    });

    it('должен установить только scaleResolutionDownBy ожидаемого трека, если у отправителя нет трека', async () => {
      await createSenderBalancer().apply(new RTCRtpSenderMock(), {
        upcomingTrack: track4K,
        serverHeaders: HEADERS_MAX_720P,
      });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 3 }]);
    });

    it('должен установить только scaleResolutionDownBy ожидаемого трека, ограниченного maxResolution', async () => {
      await createSenderBalancer({ maxResolution: MAX_RESOLUTION_1080P }).apply(sender720, {
        upcomingTrack: track4K,
      });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 2 }]);
    });
  });

  describe('только ослабление', () => {
    const setCurrentEncoding = async (sender: RTCRtpSender, encoding: RTCRtpEncodingParameters) => {
      const parameters = sender.getParameters();

      parameters.encodings = [encoding];

      await sender.setParameters(parameters);
    };

    it('не должен увеличивать scaleResolutionDownBy и уменьшать maxBitrate относительно текущих параметров отправителя', async () => {
      await setCurrentEncoding(sender4K, PARAMETERS_4K_BY_TRACK);
      await createSenderBalancer().apply(sender4K, {
        codec: CODEC_H264,
        serverHeaders: HEADERS_PAUSE,
        isLooseningOnly: true,
      });

      expect(getAppliedParameters()).toEqual([PARAMETERS_4K_BY_TRACK]);
    });

    it('должен уменьшить scaleResolutionDownBy и увеличить maxBitrate до желаемых', async () => {
      await setCurrentEncoding(sender4K, PARAMETERS_PAUSED);
      await createSenderBalancer().apply(sender4K, { codec: CODEC_H264, isLooseningOnly: true });

      expect(getAppliedParameters()).toEqual([PARAMETERS_4K_BY_TRACK]);
    });

    it('должен уменьшить только scaleResolutionDownBy, если кодек не передан', async () => {
      await setCurrentEncoding(sender4K, PARAMETERS_PAUSED);
      await createSenderBalancer().apply(sender4K, { isLooseningOnly: true });

      expect(getAppliedParameters()).toEqual([{ scaleResolutionDownBy: 1, maxBitrate: undefined }]);
    });

    it('не должен задавать maxBitrate отправителю без ограничения битрейта', async () => {
      await createSenderBalancer().apply(sender4K, { codec: CODEC_H264, isLooseningOnly: true });

      expect(getAppliedParameters()).toEqual([{ scaleResolutionDownBy: 1, maxBitrate: undefined }]);
    });
  });

  describe('отправитель без трека', () => {
    it('должен снять ограничение даже при команде сервера: scaleResolutionDownBy 1 и максимальный битрейт кодека', async () => {
      await createSenderBalancer({ maxResolution: MAX_RESOLUTION_1080P }).apply(
        new RTCRtpSenderMock(),
        { codec: CODEC_H264, serverHeaders: HEADERS_PAUSE },
      );

      expect(getAppliedParameters()).toEqual([
        { scaleResolutionDownBy: 1, maxBitrate: getMaximumBitrate(CODEC_H264) },
      ]);
    });

    it('должен вернуть только scaleResolutionDownBy 1, если кодек не передан', async () => {
      await createSenderBalancer().apply(new RTCRtpSenderMock(), {});

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 1 }]);
    });

    it('не должен менять параметры при ignoreForCodec h264, если кодек не передан', async () => {
      const result = await createSenderBalancer({ ignoreForCodec: 'h264' }).apply(
        new RTCRtpSenderMock(),
        {},
      );

      expect(result).toBe(RESULT_NO_CHANGED);
      expect(parametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
    });
  });

  describe('без изменений', () => {
    it.each([
      ['кодек совпал с исключением', { codec: 'video/H264' }],
      ['кодек не передан', {}],
      ['кодек не передан перед заменой трека', { upcomingTrack: createVideoTrack(3840, 2160) }],
    ])(
      'должен вернуть RESULT_NO_CHANGED и не менять параметры при ignoreForCodec h264, если %s',
      async (_name, options) => {
        const result = await createSenderBalancer({ ignoreForCodec: 'h264' }).apply(sender4K, {
          ...options,
          serverHeaders: HEADERS_MAX_720P,
        });

        expect(result).toBe(RESULT_NO_CHANGED);
        expect(parametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
      },
    );
  });

  describe('кодек вне исключения ignoreForCodec h264', () => {
    it.each([
      ['VP8', CODEC_VP8],
      ['неизвестен (пустая строка)', CODEC_UNKNOWN],
    ])('должен установить полные параметры, если кодек %s', async (_name, codec) => {
      await createSenderBalancer({ ignoreForCodec: 'h264' }).apply(sender4K, {
        codec,
        serverHeaders: HEADERS_MAX_720P,
      });

      expect(getAppliedParameters()).toStrictEqual([
        { scaleResolutionDownBy: 3, maxBitrate: calcMaxBitrateByWidthAndCodec(1280, codec) },
      ]);
    });
  });

  describe('ошибка установки параметров', () => {
    it.each([
      ['с кодеком', { codec: CODEC_H264 }],
      ['без кодека перед заменой трека', { upcomingTrack: createVideoTrack(3840, 2160) }],
    ])('должен отклониться ошибкой установки параметров %s', async (_name, options) => {
      const error = new Error('setParameters failed');

      parametersSetter.setEncodingsToSender.mockRejectedValue(error);

      const applying = createSenderBalancer().apply(sender720, options);

      await expect(applying).rejects.toBe(error);
    });
  });
});
