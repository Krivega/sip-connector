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
 * Бизнес-логика балансировки отправителей
 * Отвечает за определение стратегии и применение параметров к отправителю
 */
export class SenderBalancer {
  private readonly ignoreForCodec?: string;

  private readonly senderFinder: ISenderFinder;

  private readonly codecProvider: ICodecProvider;

  private readonly parametersSetter: IParametersSetter;

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
    },
  ) {
    this.senderFinder = senderFinder;
    this.codecProvider = codecProvider;
    this.parametersSetter = parametersSetter;
    this.ignoreForCodec = options.ignoreForCodec;
  }

  /**
   * Выполняет балансировку на основе заголовков от сервера
   * @param connection - RTCPeerConnection для получения отправителей
   * @param headers - Заголовки от сервера с командами управления
   * @returns Promise с результатом балансировки
   */
  public async balance(
    connection: RTCPeerConnection,
    headers?: IMainCamHeaders,
    maxResolution?: TResolutionSize,
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

    const { mainCam, resolutionMainCam } = headers ?? {};

    return this.processSender(
      { mainCam, resolutionMainCam },
      {
        sender,
        codec,
        videoTrack: sender.track as MediaStreamVideoTrack,
      },
      maxResolution,
    ).then((result) => {
      return { ...result, sender };
    });
  }

  /**
   * Сбрасывает все эффекты балансировки — восстанавливает параметры на основе разрешения трека
   * @param connection - RTCPeerConnection для получения отправителей
   * @returns Promise с результатом сброса
   */
  public async reset(
    connection: RTCPeerConnection,
    maxResolution?: TResolutionSize,
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

    const context: IBalancingContext = {
      sender,
      codec,
      videoTrack: sender.track as MediaStreamVideoTrack,
    };

    const result = await this.setBitrateByTrackResolution(context, maxResolution);

    return { ...result, sender };
  }

  /**
   * Обрабатывает отправитель в зависимости от команды управления
   * @param context - Контекст балансировки
   * @returns Promise с результатом обработки
   */
  private async processSender(
    headers: IMainCamHeaders,
    context: IBalancingContext,
    maxResolution?: TResolutionSize,
  ): Promise<TResultSetParametersToSender> {
    const { mainCam, resolutionMainCam } = headers;

    switch (mainCam) {
      case EContentMainCAM.PAUSE_MAIN_CAM: {
        return this.downgradeResolutionSender(context);
      }
      case EContentMainCAM.RESUME_MAIN_CAM: {
        return this.setBitrateByTrackResolution(context, maxResolution);
      }
      case EContentMainCAM.MAX_MAIN_CAM_RESOLUTION: {
        if (resolutionMainCam !== undefined) {
          return this.setResolutionSender(resolutionMainCam, context, maxResolution);
        }

        return this.setBitrateByTrackResolution(context, maxResolution);
      }
      case EContentMainCAM.ADMIN_STOP_MAIN_CAM:
      case EContentMainCAM.ADMIN_START_MAIN_CAM:
      case undefined: {
        return this.setBitrateByTrackResolution(context, maxResolution);
      }
      default: {
        return this.setBitrateByTrackResolution(context, maxResolution);
      }
    }
  }

  /**
   * Понижает разрешение отправителя (пауза камеры)
   * @param context - Контекст балансировки
   * @returns Promise с результатом
   */
  private async downgradeResolutionSender(
    context: IBalancingContext,
  ): Promise<TResultSetParametersToSender> {
    const { sender, codec } = context;
    const parameters: IEncodingParameters = {
      scaleResolutionDownBy: 200,
      maxBitrate: getMinimumBitrate(codec),
    };

    return this.parametersSetter.setEncodingsToSender(sender, parameters);
  }

  /**
   * Устанавливает битрейт на основе разрешения трека
   * @param context - Контекст балансировки
   * @returns Promise с результатом
   */
  private async setBitrateByTrackResolution(
    context: IBalancingContext,
    maxResolution?: TResolutionSize,
  ): Promise<TResultSetParametersToSender> {
    const { sender, videoTrack, codec } = context;
    const scaleResolutionDownBy = resolveScaleResolutionDownBy(videoTrack, maxResolution);
    const maxBitrate = resolveMaxBitrate(videoTrack, codec, scaleResolutionDownBy);

    return this.parametersSetter.setEncodingsToSender(sender, {
      scaleResolutionDownBy,
      maxBitrate,
    });
  }

  /**
   * Устанавливает разрешение отправителя на основе заголовка
   * @param resolutionMainCam - Разрешение главной камеры
   * @param context - Контекст балансировки
   * @returns Promise с результатом
   */
  private async setResolutionSender(
    resolutionMainCam: string,
    context: IBalancingContext,
    maxResolution?: TResolutionSize,
  ): Promise<TResultSetParametersToSender> {
    const [widthTarget, heightTarget] = resolutionMainCam.split('x');
    const { sender, videoTrack, codec } = context;
    const targetSize = {
      width: Number(widthTarget),
      height: Number(heightTarget),
    };

    const scaleResolutionDownByByMainCam = calcScaleResolutionDownBy({
      videoTrack,
      targetSize,
    });
    const scaleResolutionDownByByConnection = resolveScaleResolutionDownBy(
      videoTrack,
      maxResolution,
    );
    const scaleResolutionDownBy = Math.max(
      scaleResolutionDownByByMainCam,
      scaleResolutionDownByByConnection,
    );
    const maxBitrate =
      scaleResolutionDownByByConnection > scaleResolutionDownByByMainCam
        ? resolveMaxBitrate(videoTrack, codec, scaleResolutionDownBy)
        : calcMaxBitrateByWidthAndCodec(targetSize.width, codec);

    const parameters: IEncodingParameters = {
      scaleResolutionDownBy,
      maxBitrate,
    };

    return this.parametersSetter.setEncodingsToSender(sender, parameters);
  }
}
