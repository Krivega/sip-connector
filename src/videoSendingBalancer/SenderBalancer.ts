import { EEventsMainCAM } from '@/ApiManager';
import hasIncludesString from '@/utils/hasIncludesString';
import { calcMaxBitrateByWidthAndCodec, getMaximumBitrate, getMinimumBitrate } from './calcBitrate';
import { calcScaleResolutionDownBy } from './calcResolution';

import type { TResult } from '@/setParametersToSender';
import type {
  IBalancingContext,
  ICodecProvider,
  IEncodingParameters,
  IMainCamHeaders,
  IParametersSetter,
  ISenderFinder,
} from './types';

/**
 * Бизнес-логика балансировки отправителей
 * Отвечает за определение стратегии и применение параметров к отправителю
 */
export class SenderBalancer {
  private readonly ignoreForCodec?: string;

  private readonly senderFinder: ISenderFinder;

  private readonly codecProvider: ICodecProvider;

  private readonly parametersSetter: IParametersSetter;

  private readonly resultNoChanged: TResult = {
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
  public async balance(connection: RTCPeerConnection, headers?: IMainCamHeaders): Promise<TResult> {
    const senders = connection.getSenders();
    const sender = this.senderFinder.findVideoSender(senders);

    if (!sender?.track) {
      return this.resultNoChanged;
    }

    const codec = await this.codecProvider.getCodecFromSender(sender);

    if (hasIncludesString(codec, this.ignoreForCodec)) {
      return this.resultNoChanged;
    }

    const { mainCam, resolutionMainCam } = headers ?? {};

    return this.processSender(
      { mainCam, resolutionMainCam },
      {
        sender,
        codec,
        videoTrack: sender.track as MediaStreamVideoTrack,
      },
    );
  }

  /**
   * Обрабатывает отправитель в зависимости от команды управления
   * @param context - Контекст балансировки
   * @returns Promise с результатом обработки
   */
  private async processSender(
    headers: IMainCamHeaders,
    context: IBalancingContext,
  ): Promise<TResult> {
    const { mainCam, resolutionMainCam } = headers;

    switch (mainCam) {
      case EEventsMainCAM.PAUSE_MAIN_CAM: {
        return this.downgradeResolutionSender(context);
      }
      case EEventsMainCAM.RESUME_MAIN_CAM: {
        return this.setBitrateByTrackResolution(context);
      }
      case EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION: {
        if (resolutionMainCam !== undefined) {
          return this.setResolutionSender(resolutionMainCam, context);
        }

        return this.setBitrateByTrackResolution(context);
      }
      case EEventsMainCAM.ADMIN_STOP_MAIN_CAM:
      case EEventsMainCAM.ADMIN_START_MAIN_CAM:
      case undefined: {
        return this.setBitrateByTrackResolution(context);
      }
      default: {
        return this.setBitrateByTrackResolution(context);
      }
    }
  }

  /**
   * Понижает разрешение отправителя (пауза камеры)
   * @param context - Контекст балансировки
   * @returns Promise с результатом
   */
  private async downgradeResolutionSender(context: IBalancingContext): Promise<TResult> {
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
  private async setBitrateByTrackResolution(context: IBalancingContext): Promise<TResult> {
    const { sender, videoTrack, codec } = context;
    const settings = videoTrack.getSettings();
    const widthCurrent = settings.width;

    const maxBitrate =
      widthCurrent === undefined
        ? getMaximumBitrate(codec)
        : calcMaxBitrateByWidthAndCodec(widthCurrent, codec);

    return this.parametersSetter.setEncodingsToSender(sender, {
      scaleResolutionDownBy: 1,
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
  ): Promise<TResult> {
    const [widthTarget, heightTarget] = resolutionMainCam.split('x');
    const { sender, videoTrack, codec } = context;
    const targetSize = {
      width: Number(widthTarget),
      height: Number(heightTarget),
    };

    const scaleResolutionDownBy = calcScaleResolutionDownBy({
      videoTrack,
      targetSize,
    });
    const maxBitrate = calcMaxBitrateByWidthAndCodec(targetSize.width, codec);

    const parameters: IEncodingParameters = {
      scaleResolutionDownBy,
      maxBitrate,
    };

    return this.parametersSetter.setEncodingsToSender(sender, parameters);
  }
}
