import { EContentMainCAM } from '@/ApiManager';
import { createVideoTrack } from '../__fixtures__';
import {
  calcMaxBitrateByWidthAndCodec,
  getMaximumBitrate,
  getMinimumBitrate,
} from '../calcBitrate';
import {
  resolveEncodingParameters,
  resolveStrictestEncodingParameters,
} from '../resolveEncodingParameters';

import type { IBalancingContext, IEncodingParameters, IMainCamHeaders } from '../types';

const CODEC_H264 = 'video/h264';
const CODEC_AV1 = 'video/AV1';
const MAX_RESOLUTION_1080P = { width: 1920, height: 1080 };
const PAUSED_SCALE_RESOLUTION_DOWN_BY = 200;

const HEADERS_PAUSE: IMainCamHeaders = { mainCam: EContentMainCAM.PAUSE_MAIN_CAM };
const HEADERS_RESUME: IMainCamHeaders = { mainCam: EContentMainCAM.RESUME_MAIN_CAM };
const HEADERS_MAX_720P: IMainCamHeaders = {
  mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
  resolutionMainCam: '1280x720',
};

// заголовки, при которых параметры считаются по разрешению трека
const HEADERS_WITHOUT_LIMIT: [string, IMainCamHeaders | undefined][] = [
  ['заголовков нет', undefined],
  ['в заголовках нет mainCam', {}],
  ['пришла RESUME_MAIN_CAM', HEADERS_RESUME],
  ['пришла ADMIN_STOP_MAIN_CAM', { mainCam: EContentMainCAM.ADMIN_STOP_MAIN_CAM }],
  ['пришла ADMIN_START_MAIN_CAM', { mainCam: EContentMainCAM.ADMIN_START_MAIN_CAM }],
  [
    'пришла MAX_MAIN_CAM_RESOLUTION без resolutionMainCam',
    { mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION },
  ],
  ['пришла неизвестная команда', { mainCam: 'UNKNOWN_COMMAND' as EContentMainCAM }],
];

describe('resolveEncodingParameters', () => {
  let track4K: MediaStreamVideoTrack;
  let context: IBalancingContext;

  beforeEach(() => {
    track4K = createVideoTrack(3840, 2160);
    context = { videoTrack: track4K, codec: CODEC_H264 };
  });

  describe('параметры по разрешению трека', () => {
    it.each(HEADERS_WITHOUT_LIMIT)(
      'должен вернуть scaleResolutionDownBy 1 и битрейт по ширине трека, если %s',
      (_name, headers) => {
        const parameters = resolveEncodingParameters(headers, context);

        expect(parameters).toEqual({
          scaleResolutionDownBy: 1,
          maxBitrate: calcMaxBitrateByWidthAndCodec(3840, CODEC_H264),
        });
      },
    );

    it.each(HEADERS_WITHOUT_LIMIT)(
      'должен ограничить 4K-трек до maxResolution 1920x1080, если %s',
      (_name, headers) => {
        const parameters = resolveEncodingParameters(headers, context, MAX_RESOLUTION_1080P);

        expect(parameters).toEqual({
          scaleResolutionDownBy: 2,
          maxBitrate: calcMaxBitrateByWidthAndCodec(1920, CODEC_H264),
        });
      },
    );

    it('должен вернуть максимальный битрейт кодека, если ширина трека неизвестна', () => {
      jest.spyOn(track4K, 'getSettings').mockReturnValue({ height: 2160 });

      const parameters = resolveEncodingParameters(undefined, {
        videoTrack: track4K,
        codec: CODEC_AV1,
      });

      expect(parameters).toEqual({
        scaleResolutionDownBy: 1,
        maxBitrate: getMaximumBitrate(CODEC_AV1),
      });
    });
  });

  describe('PAUSE_MAIN_CAM', () => {
    it.each([
      ['без maxResolution', undefined],
      ['с maxResolution 1920x1080', MAX_RESOLUTION_1080P],
    ])(
      'должен вернуть scaleResolutionDownBy 200 и минимальный битрейт %s',
      (_name, maxResolution) => {
        const parameters = resolveEncodingParameters(HEADERS_PAUSE, context, maxResolution);

        expect(parameters).toEqual({
          scaleResolutionDownBy: PAUSED_SCALE_RESOLUTION_DOWN_BY,
          maxBitrate: getMinimumBitrate(CODEC_H264),
        });
      },
    );
  });

  describe('MAX_MAIN_CAM_RESOLUTION с resolutionMainCam', () => {
    it.each([
      ['1280x720', 3, 1280],
      ['1920x720', 3, 1920],
      ['960x1080', 4, 960],
    ])(
      'должен ограничить 4K-трек до %s: scaleResolutionDownBy %d и битрейт по ширине %d',
      (resolutionMainCam, scaleResolutionDownBy, widthTarget) => {
        const parameters = resolveEncodingParameters(
          { mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION, resolutionMainCam },
          context,
        );

        expect(parameters).toEqual({
          scaleResolutionDownBy,
          maxBitrate: calcMaxBitrateByWidthAndCodec(widthTarget, CODEC_H264),
        });
      },
    );

    it.each(['', '1280', 'invalid-format', 'abcxdef'])(
      'должен вернуть scaleResolutionDownBy NaN для некорректного resolutionMainCam "%s"',
      (resolutionMainCam) => {
        const parameters = resolveEncodingParameters(
          { mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION, resolutionMainCam },
          context,
        );

        expect(parameters.scaleResolutionDownBy).toBeNaN();
      },
    );
  });

  describe('кодек', () => {
    it.each([
      ['PAUSE_MAIN_CAM', HEADERS_PAUSE, getMinimumBitrate(CODEC_AV1)],
      [
        'MAX_MAIN_CAM_RESOLUTION 1280x720',
        HEADERS_MAX_720P,
        calcMaxBitrateByWidthAndCodec(1280, CODEC_AV1),
      ],
      ['RESUME_MAIN_CAM', HEADERS_RESUME, calcMaxBitrateByWidthAndCodec(3840, CODEC_AV1)],
    ])('должен рассчитать битрейт для AV1 при %s', (_name, headers, maxBitrate) => {
      const parameters = resolveEncodingParameters(headers, {
        videoTrack: track4K,
        codec: CODEC_AV1,
      });

      expect(parameters.maxBitrate).toBe(maxBitrate);
    });
  });
});

describe('resolveStrictestEncodingParameters', () => {
  const createParameters = (scaleResolutionDownBy: number): IEncodingParameters => {
    return { scaleResolutionDownBy, maxBitrate: 1_000_000 };
  };

  it('должен вернуть параметры ожидаемого трека, если их scaleResolutionDownBy больше', () => {
    const current = createParameters(1);
    const upcoming = createParameters(3);

    expect(resolveStrictestEncodingParameters(current, upcoming)).toBe(upcoming);
  });

  it('должен вернуть параметры текущего трека, если их scaleResolutionDownBy больше', () => {
    const current = createParameters(3);
    const upcoming = createParameters(1);

    expect(resolveStrictestEncodingParameters(current, upcoming)).toBe(current);
  });

  it('должен вернуть параметры текущего трека, если scaleResolutionDownBy равны', () => {
    const current = createParameters(2);
    const upcoming = createParameters(2);

    expect(resolveStrictestEncodingParameters(current, upcoming)).toBe(current);
  });
});
