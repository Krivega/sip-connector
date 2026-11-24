import { EContentMainCAM } from '@/ApiManager';
import { calcMaxBitrateByWidthAndCodec, getMaximumBitrate, getMinimumBitrate } from './calcBitrate';
import { calcScaleResolutionDownBy } from './calcResolution';

import type { TResolutionSize } from '@/types';
import type {
  IBalancingContext,
  IEncodingParameters,
  IMainCamHeaders,
  TSenderEncodingParameters,
} from './types';

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

  return widthCurrent === undefined
    ? getMaximumBitrate(codec)
    : calcMaxBitrateByWidthAndCodec(widthCurrent / scaleResolutionDownBy, codec);
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

const isPositiveFinite = (value: number): boolean => {
  return Number.isFinite(value) && value > 0;
};

/**
 * Разбирает разрешение из заголовка сервера «ШИРИНАxВЫСОТА»; корректность проверяется при приёме команды
 * @param resolutionMainCam - Значение заголовка
 * @returns Части значения между «x», приведённые к числу
 */
const parseResolutionMainCam = (resolutionMainCam: string): number[] => {
  return resolutionMainCam.split('x').map(Number);
};

/**
 * Проверяет, что команду можно принять: разрешение MAX_MAIN_CAM_RESOLUTION, если оно задано, разбирается
 * @param headers - Заголовки от сервера
 * @returns false для MAX_MAIN_CAM_RESOLUTION с некорректным разрешением
 */
export const hasValidResolutionMainCam = ({ mainCam, resolutionMainCam }: IMainCamHeaders) => {
  if (mainCam !== EContentMainCAM.MAX_MAIN_CAM_RESOLUTION || resolutionMainCam === undefined) {
    return true;
  }

  const sizes = parseResolutionMainCam(resolutionMainCam);

  return sizes.length === 2 && sizes.every(isPositiveFinite);
};

/**
 * Параметры на основе разрешения из заголовка сервера
 */
const resolveParametersByResolutionMainCam = (
  resolutionMainCam: string,
  { videoTrack, codec }: IBalancingContext,
): IEncodingParameters => {
  const [width, height] = parseResolutionMainCam(resolutionMainCam);
  const targetSize = { width, height };

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
      return resolutionMainCam === undefined
        ? resolveParametersByTrackResolution(context, maxResolution)
        : resolveParametersByResolutionMainCam(resolutionMainCam, context);
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
 * Оставляет от желаемых параметров только ослабление текущих параметров отправителя
 * @param desired - Желаемые параметры
 * @param current - Текущие параметры кодирования отправителя
 * @returns Параметры с масштабом не больше текущего и битрейтом не меньше текущего
 */
export const resolveLoosenedEncodingParameters = (
  desired: TSenderEncodingParameters,
  { scaleResolutionDownBy = 1, maxBitrate }: RTCRtpEncodingParameters = {},
): TSenderEncodingParameters => {
  return {
    scaleResolutionDownBy: Math.min(desired.scaleResolutionDownBy, scaleResolutionDownBy),
    // отправитель без потолка битрейта уже ослаблен, а без желаемого битрейта (кодек неизвестен) его не трогаем
    maxBitrate:
      desired.maxBitrate === undefined || maxBitrate === undefined
        ? undefined
        : Math.max(desired.maxBitrate, maxBitrate),
  };
};

/**
 * Параметры отправителя без трека: та же формула, что у трека с неизвестными размерами
 * @param codec - Кодек отправителя
 * @returns Параметры без ограничения разрешения
 */
export const resolveTracklessEncodingParameters = (codec?: string): IEncodingParameters => {
  return {
    scaleResolutionDownBy: 1,
    maxBitrate: getMaximumBitrate(codec),
  };
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
