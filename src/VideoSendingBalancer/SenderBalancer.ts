import hasIncludesString from '@/utils/hasIncludesString';
import {
  resolveEncodingParameters,
  resolveLoosenedEncodingParameters,
  resolveStrictestEncodingParameters,
  resolveTracklessEncodingParameters,
} from './resolveEncodingParameters';

import type { TResultSetParametersToSender } from '@/tools';
import type { TResolutionSize } from '@/types';
import type {
  IEncodingParameters,
  IMainCamHeaders,
  IParametersSetter,
  TSenderEncodingParameters,
} from './types';

// каждый вызов — новый объект: потребитель может изменить полученный результат, и это не должно задеть другие результаты
export const createResultNoChanged = (): TResultSetParametersToSender => {
  return {
    isChanged: false,
    parameters: {
      encodings: [{}],
      transactionId: '0',
      codecs: [],
      headerExtensions: [],
      rtcp: {},
    },
  };
};

type TApplyOptions = {
  codec?: string;
  upcomingTrack?: MediaStreamTrack;
  // команда сервера, если её можно применять этому отправителю
  serverHeaders?: IMainCamHeaders;
  // применить только то, что ослабляет текущие параметры отправителя
  isLooseningOnly?: boolean;
};

/**
 * Применение параметров к отправителю без состояния:
 * рассчитывает параметры чистыми функциями по переданному кодеку и применяет их к отправителю
 */
export class SenderBalancer {
  private readonly ignoreForCodec?: string;

  private readonly parametersSetter: IParametersSetter;

  private readonly getMaxResolution: () => TResolutionSize | undefined;

  public constructor(
    { parametersSetter }: { parametersSetter: IParametersSetter },
    options: {
      ignoreForCodec?: string;
      getMaxResolution: () => TResolutionSize | undefined;
    },
  ) {
    this.parametersSetter = parametersSetter;
    this.ignoreForCodec = options.ignoreForCodec;
    this.getMaxResolution = options.getMaxResolution;
  }

  /**
   * Применяет к отправителю параметры на основе переданной команды сервера.
   * Перед заменой трека применяет более строгие из параметров текущего и ожидаемого трека,
   * чтобы кадры нового трека не ушли с параметрами старого; без текущего трека — параметры ожидаемого.
   * Отправителю без трека снимает ограничение: трек, который на нём появится, не должен унаследовать прежнее.
   * Без кодека меняет только масштаб, а при заданном ignoreForCodec не меняет ничего
   * @param sender - Отправитель видео
   * @param options - Кодек отправителя, трек, на который заменяется текущий, команда сервера
   * и разрешено ли только ослабление
   * @returns Promise с результатом применения
   */
  public async apply(
    sender: RTCRtpSender,
    options: TApplyOptions,
  ): Promise<TResultSetParametersToSender> {
    const { codec, isLooseningOnly = false } = options;
    const targetParameters = this.resolveTargetParameters(sender, options);

    if (this.isIgnoredCodec(codec)) {
      return createResultNoChanged();
    }

    // битрейт зависит от кодека: без кодека его не трогаем
    const parameters: TSenderEncodingParameters =
      codec === undefined
        ? { scaleResolutionDownBy: targetParameters.scaleResolutionDownBy }
        : targetParameters;

    return this.parametersSetter.setEncodingsToSender(
      sender,
      isLooseningOnly
        ? resolveLoosenedEncodingParameters(parameters, sender.getParameters().encodings[0])
        : parameters,
    );
  }

  private resolveTargetParameters(
    sender: RTCRtpSender,
    { codec, upcomingTrack, serverHeaders }: TApplyOptions,
  ): IEncodingParameters {
    const track = sender.track ?? upcomingTrack;

    if (!track) {
      return resolveTracklessEncodingParameters(codec);
    }

    const resolveParameters = (videoTrack: MediaStreamTrack): IEncodingParameters => {
      return resolveEncodingParameters(
        serverHeaders,
        { codec, videoTrack: videoTrack as MediaStreamVideoTrack },
        this.getMaxResolution(),
      );
    };
    const trackParameters = resolveParameters(track);

    return upcomingTrack
      ? resolveStrictestEncodingParameters(trackParameters, resolveParameters(upcomingTrack))
      : trackParameters;
  }

  private isIgnoredCodec(codec?: string): boolean {
    // без кодека исключение проверить нельзя, поэтому при заданном ignoreForCodec параметры не трогаем
    return (
      this.ignoreForCodec !== undefined &&
      (codec === undefined || hasIncludesString(codec, this.ignoreForCodec))
    );
  }
}
