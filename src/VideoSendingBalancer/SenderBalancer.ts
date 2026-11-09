import { EContentMainCAM } from '@/ApiManager';
import hasIncludesString from '@/utils/hasIncludesString';
import { calcMaxBitrateByWidthAndCodec, getMaximumBitrate, getMinimumBitrate } from './calcBitrate';
import { calcScaleResolutionDownBy } from './calcResolution';

import type { TResultSetParametersToSender } from '@/tools';
import type { TResolutionSize } from '@/types';
import type {
  IBalancingContext,
  ICodecProvider,
  IEncodingParameters,
  IMainCamHeaders,
  IParametersSetter,
  ISenderFinder,
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
 * Бизнес-логика балансировки отправителей
 * Отвечает за определение стратегии и применение параметров к отправителю
 */
export class SenderBalancer {
  private readonly ignoreForCodec?: string;

  private readonly senderFinder: ISenderFinder;

  private readonly codecProvider: ICodecProvider;

  private readonly parametersSetter: IParametersSetter;

  private readonly getMaxResolution: () => TResolutionSize | undefined;

  private readonly getServerHeaders: () => IMainCamHeaders | undefined;

  private pendingReplacement?: { sender: RTCRtpSender; track: MediaStreamTrack };

  private readonly resultNoChanged: TResultSetParametersToSender = {
    isChanged: false,
    parameters: {
      encodings: [{}],
      transactionId: '0',
      codecs: [],
      headerExtensions: [],
      rtcp: {},
    },
  };

  public constructor(
    {
      senderFinder,
      codecProvider,
      parametersSetter,
    }: {
      senderFinder: ISenderFinder;
      codecProvider: ICodecProvider;
      parametersSetter: IParametersSetter;
    },
    options: {
      ignoreForCodec?: string;
      getMaxResolution: () => TResolutionSize | undefined;
      getServerHeaders: () => IMainCamHeaders | undefined;
    },
  ) {
    this.senderFinder = senderFinder;
    this.codecProvider = codecProvider;
    this.parametersSetter = parametersSetter;
    this.ignoreForCodec = options.ignoreForCodec;
    this.getMaxResolution = options.getMaxResolution;
    this.getServerHeaders = options.getServerHeaders;
  }

  /**
   * Выполняет балансировку на основе текущих заголовков от сервера
   * @param connection - RTCPeerConnection для получения отправителей
   * @returns Promise с результатом балансировки
   */
  public async balance(
    connection: RTCPeerConnection,
  ): Promise<TResultSetParametersToSender & { sender: RTCRtpSender | undefined }> {
    const senders = connection.getSenders();
    const sender = this.senderFinder.findVideoSender(senders);

    if (!sender?.track) {
      return { ...this.resultNoChanged, sender };
    }

    const codec = await this.codecProvider.getCodecFromSender(sender);

    if (hasIncludesString(codec, this.ignoreForCodec)) {
      return { ...this.resultNoChanged, sender };
    }

    // состояние читается после await, чтобы параллельная балансировка не применила устаревшую команду
    const parameters = this.resolveStrictestParameters(sender, this.getServerHeaders(), {
      codec,
      videoTrack: sender.track as MediaStreamVideoTrack,
    });
    const result = await this.parametersSetter.setEncodingsToSender(sender, parameters);

    return { ...result, sender };
  }

  /**
   * Сбрасывает все эффекты балансировки — восстанавливает параметры на основе разрешения трека
   * @param connection - RTCPeerConnection для получения отправителей
   * @returns Promise с результатом сброса
   */
  public async reset(
    connection: RTCPeerConnection,
  ): Promise<TResultSetParametersToSender & { sender: RTCRtpSender | undefined }> {
    const senders = connection.getSenders();
    const sender = this.senderFinder.findVideoSender(senders);

    if (!sender?.track) {
      return { ...this.resultNoChanged, sender };
    }

    const codec = await this.codecProvider.getCodecFromSender(sender);

    if (hasIncludesString(codec, this.ignoreForCodec)) {
      return { ...this.resultNoChanged, sender };
    }

    const parameters = this.resolveStrictestParameters(sender, undefined, {
      codec,
      videoTrack: sender.track as MediaStreamVideoTrack,
    });
    const result = await this.parametersSetter.setEncodingsToSender(sender, parameters);

    return { ...result, sender };
  }

  /**
   * Заранее ужесточает ограничение отправителя перед заменой трека,
   * чтобы кадры нового трека не ушли с параметрами старого.
   * До completeTrackReplacement любая балансировка этого отправителя учитывает новый трек
   * @param sender - Отправитель, у которого заменяется трек
   * @param newTrack - Новый трек
   */
  public async prepareTrackReplacement(
    sender: RTCRtpSender,
    newTrack: MediaStreamTrack,
  ): Promise<void> {
    this.pendingReplacement = { sender, track: newTrack };

    if (!sender.track) {
      return;
    }

    const codec = await this.codecProvider.getCodecFromSender(sender);

    if (hasIncludesString(codec, this.ignoreForCodec)) {
      return;
    }

    const headers = this.getServerHeaders();
    const currentParameters = this.resolveEncodingParameters(headers, {
      codec,
      videoTrack: sender.track as MediaStreamVideoTrack,
    });
    const nextParameters = this.resolveEncodingParameters(headers, {
      codec,
      videoTrack: newTrack as MediaStreamVideoTrack,
    });

    if (nextParameters.scaleResolutionDownBy > currentParameters.scaleResolutionDownBy) {
      await this.parametersSetter.setEncodingsToSender(sender, nextParameters);
    }
  }

  /**
   * Завершает замену трека: балансировка снова считается только по текущему треку
   * @param sender - Отправитель, у которого заменялся трек
   * @param newTrack - Новый трек
   */
  public completeTrackReplacement(sender: RTCRtpSender, newTrack: MediaStreamTrack): void {
    if (this.pendingReplacement?.sender === sender && this.pendingReplacement.track === newTrack) {
      this.pendingReplacement = undefined;
    }
  }

  /**
   * Рассчитывает параметры для текущего трека, а во время замены трека —
   * более строгие из параметров текущего и ожидаемого трека
   * @param sender - Отправитель
   * @param headers - Заголовки от сервера с командами управления
   * @param context - Контекст балансировки текущего трека
   * @returns Параметры кодирования
   */
  private resolveStrictestParameters(
    sender: RTCRtpSender,
    headers: IMainCamHeaders | undefined,
    context: IBalancingContext,
  ): IEncodingParameters {
    const parameters = this.resolveEncodingParameters(headers, context);

    if (this.pendingReplacement?.sender !== sender) {
      return parameters;
    }

    const pendingParameters = this.resolveEncodingParameters(headers, {
      ...context,
      videoTrack: this.pendingReplacement.track as MediaStreamVideoTrack,
    });

    return pendingParameters.scaleResolutionDownBy > parameters.scaleResolutionDownBy
      ? pendingParameters
      : parameters;
  }

  /**
   * Рассчитывает параметры кодирования в зависимости от команды управления
   * @param headers - Заголовки от сервера с командами управления
   * @param context - Контекст балансировки
   * @returns Параметры кодирования
   */
  private resolveEncodingParameters(
    headers: IMainCamHeaders | undefined,
    context: IBalancingContext,
  ): IEncodingParameters {
    const { mainCam, resolutionMainCam } = headers ?? {};

    switch (mainCam) {
      case EContentMainCAM.PAUSE_MAIN_CAM: {
        return resolvePausedParameters(context);
      }
      case EContentMainCAM.RESUME_MAIN_CAM: {
        return resolveParametersByTrackResolution(context, this.getMaxResolution());
      }
      case EContentMainCAM.MAX_MAIN_CAM_RESOLUTION: {
        if (resolutionMainCam !== undefined) {
          return resolveParametersByResolutionMainCam(resolutionMainCam, context);
        }

        return resolveParametersByTrackResolution(context, this.getMaxResolution());
      }
      case EContentMainCAM.ADMIN_STOP_MAIN_CAM:
      case EContentMainCAM.ADMIN_START_MAIN_CAM:
      case undefined: {
        return resolveParametersByTrackResolution(context, this.getMaxResolution());
      }
      default: {
        return resolveParametersByTrackResolution(context, this.getMaxResolution());
      }
    }
  }
}
