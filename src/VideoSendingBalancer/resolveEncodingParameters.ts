import { EContentMainCAM } from '@/ApiManager';
import { calcMaxBitrateByWidthAndCodec, getMaximumBitrate, getMinimumBitrate } from './calcBitrate';
import { calcScaleResolutionDownBy } from './calcResolution';

import type { TResolutionSize } from '@/types';
import type { IBalancingContext, IEncodingParameters, IMainCamHeaders } from './types';

const resolveScaleResolutionDownBy = (
  videoTrack: MediaStreamVideoTrack,
  maxResolution?: TResolutionSize,
): number => {
  if (maxResolution === undefined) {
    return 1;
  }

  return calcScaleResolutionDownBy({
    videoTrack,
    targetSize: maxResolution,
  });
};

const resolveMaxBitrate = (
  videoTrack: MediaStreamVideoTrack,
  codec: string | undefined,
  scaleResolutionDownBy: number,
): number => {
  const widthCurrent = videoTrack.getSettings().width;

  if (widthCurrent === undefined) {
    return getMaximumBitrate(codec);
  }

  return calcMaxBitrateByWidthAndCodec(widthCurrent / scaleResolutionDownBy, codec);
};

/**
 * Параметры паузы камеры: минимальное разрешение и битрейт
 */
const resolvePausedParameters = ({ codec }: IBalancingContext): IEncodingParameters => {
  return {
    scaleResolutionDownBy: 200,
    maxBitrate: getMinimumBitrate(codec),
  };
};

/**
 * Параметры на основе разрешения трека и максимального доступного разрешения
 */
const resolveParametersByTrackResolution = (
  { videoTrack, codec }: IBalancingContext,
  maxResolution?: TResolutionSize,
): IEncodingParameters => {
  const scaleResolutionDownBy = resolveScaleResolutionDownBy(videoTrack, maxResolution);
  const maxBitrate = resolveMaxBitrate(videoTrack, codec, scaleResolutionDownBy);

  return {
    scaleResolutionDownBy,
    maxBitrate,
  };
};

/**
 * Параметры на основе разрешения из заголовка сервера
 */
const resolveParametersByResolutionMainCam = (
  resolutionMainCam: string,
  { videoTrack, codec }: IBalancingContext,
): IEncodingParameters => {
  const [widthTarget, heightTarget] = resolutionMainCam.split('x');
  const targetSize = {
    width: Number(widthTarget),
    height: Number(heightTarget),
  };

  const scaleResolutionDownBy = calcScaleResolutionDownBy({
    videoTrack,
    targetSize,
  });
  const maxBitrate = calcMaxBitrateByWidthAndCodec(targetSize.width, codec);

  return {
    scaleResolutionDownBy,
    maxBitrate,
  };
};

/**
 * Рассчитывает параметры кодирования в зависимости от команды управления
 * @param headers - Заголовки от сервера с командами управления
 * @param context - Контекст балансировки
 * @param maxResolution - Максимальное доступное разрешение
 * @returns Параметры кодирования
 */
export const resolveEncodingParameters = (
  headers: IMainCamHeaders | undefined,
  context: IBalancingContext,
  maxResolution?: TResolutionSize,
): IEncodingParameters => {
  const { mainCam, resolutionMainCam } = headers ?? {};

  switch (mainCam) {
    case EContentMainCAM.PAUSE_MAIN_CAM: {
      return resolvePausedParameters(context);
    }
    case EContentMainCAM.RESUME_MAIN_CAM: {
      return resolveParametersByTrackResolution(context, maxResolution);
    }
    case EContentMainCAM.MAX_MAIN_CAM_RESOLUTION: {
      if (resolutionMainCam !== undefined) {
        return resolveParametersByResolutionMainCam(resolutionMainCam, context);
      }

      return resolveParametersByTrackResolution(context, maxResolution);
    }
    case EContentMainCAM.ADMIN_STOP_MAIN_CAM:
    case EContentMainCAM.ADMIN_START_MAIN_CAM:
    case undefined: {
      return resolveParametersByTrackResolution(context, maxResolution);
    }
    default: {
      return resolveParametersByTrackResolution(context, maxResolution);
    }
  }
};

/**
 * Выбирает более строгие параметры из параметров текущего и ожидаемого трека
 * @param current - Параметры текущего трека
 * @param upcoming - Параметры ожидаемого трека
 * @returns Параметры с большим scaleResolutionDownBy
 */
export const resolveStrictestEncodingParameters = (
  current: IEncodingParameters,
  upcoming: IEncodingParameters,
): IEncodingParameters => {
  return upcoming.scaleResolutionDownBy > current.scaleResolutionDownBy ? upcoming : current;
};
