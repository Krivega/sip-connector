import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM } from '@/ApiManager';
import { createSenderBalancerOptions, createVideoTrack } from '../__fixtures__';
import { calcMaxBitrateByWidthAndCodec, getMinimumBitrate } from '../calcBitrate';
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
  let serverHeaders: IMainCamHeaders | undefined;
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;
  let sender720: RTCRtpSender;
  let sender4K: RTCRtpSender;

  const createSenderBalancer = ({
    ignoreForCodec,
    maxResolution,
  }: { ignoreForCodec?: string; maxResolution?: TResolutionSize } = {}) => {
    return new SenderBalancer(
      { parametersSetter },
      createSenderBalancerOptions({
        ignoreForCodec,
        maxResolution,
        getServerHeaders: () => {
          return serverHeaders;
        },
      }),
    );
  };

  const getAppliedParameters = () => {
    return parametersSetter.setEncodingsToSender.mock.calls.map(([, parameters]) => {
      return parameters;
    });
  };

  beforeEach(() => {
    serverHeaders = undefined;
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
      serverHeaders = HEADERS_MAX_720P;

      await createSenderBalancer().apply(sender4K, { codec: CODEC_H264 });

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
      serverHeaders = HEADERS_MAX_720P;

      await createSenderBalancer().apply(sender720, { codec: CODEC_H264, upcomingTrack: track4K });

      expect(getAppliedParameters()).toEqual([PARAMETERS_4K_LIMITED_TO_720P]);
    });

    it('должен установить параметры текущего трека, если ограничения текущего и ожидаемого треков равны', async () => {
      await createSenderBalancer().apply(sender720, { codec: CODEC_H264, upcomingTrack: track4K });

      expect(getAppliedParameters()).toEqual([PARAMETERS_720P_BY_TRACK]);
    });

    it('должен установить параметры паузы при PAUSE_MAIN_CAM', async () => {
      serverHeaders = HEADERS_PAUSE;

      await createSenderBalancer().apply(sender720, { codec: CODEC_H264, upcomingTrack: track4K });

      expect(getAppliedParameters()).toEqual([PARAMETERS_PAUSED]);
    });
  });

  describe('применение без кодека', () => {
    it('должен установить только scaleResolutionDownBy по текущему треку', async () => {
      serverHeaders = HEADERS_MAX_720P;

      await createSenderBalancer().apply(sender4K);

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 3 }]);
    });

    it('должен установить только scaleResolutionDownBy ожидаемого трека, если его ограничение строже', async () => {
      serverHeaders = HEADERS_MAX_720P;

      await createSenderBalancer().apply(sender720, { upcomingTrack: track4K });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 3 }]);
    });

    it('должен установить только scaleResolutionDownBy текущего трека, если ограничение ожидаемого трека мягче', async () => {
      serverHeaders = HEADERS_MAX_720P;

      await createSenderBalancer().apply(sender4K, { upcomingTrack: track720 });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 3 }]);
    });

    it('должен установить только scaleResolutionDownBy 1, если ограничения текущего и ожидаемого треков равны', async () => {
      await createSenderBalancer().apply(sender720, { upcomingTrack: track4K });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 1 }]);
    });

    it('должен установить только scaleResolutionDownBy ожидаемого трека, ограниченного maxResolution', async () => {
      await createSenderBalancer({ maxResolution: MAX_RESOLUTION_1080P }).apply(sender720, {
        upcomingTrack: track4K,
      });

      expect(getAppliedParameters()).toStrictEqual([{ scaleResolutionDownBy: 2 }]);
    });
  });

  describe('без изменений', () => {
    it.each([
      ['с кодеком', { codec: CODEC_H264 }],
      ['без кодека', {}],
    ])(
      'должен вернуть RESULT_NO_CHANGED и не менять параметры %s, если у отправителя нет трека',
      async (_name, options) => {
        const senderWithoutTrack = new RTCRtpSenderMock();

        const result = await createSenderBalancer().apply(senderWithoutTrack, options);

        expect(result).toBe(RESULT_NO_CHANGED);
        expect(parametersSetter.setEncodingsToSender).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['кодек совпал с исключением', { codec: 'video/H264' }],
      ['кодек не передан', {}],
      ['кодек не передан перед заменой трека', { upcomingTrack: createVideoTrack(3840, 2160) }],
    ])(
      'должен вернуть RESULT_NO_CHANGED и не менять параметры при ignoreForCodec h264, если %s',
      async (_name, options) => {
        serverHeaders = HEADERS_MAX_720P;

        const result = await createSenderBalancer({ ignoreForCodec: 'h264' }).apply(
          sender4K,
          options,
        );

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
      serverHeaders = HEADERS_MAX_720P;

      await createSenderBalancer({ ignoreForCodec: 'h264' }).apply(sender4K, { codec });

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
