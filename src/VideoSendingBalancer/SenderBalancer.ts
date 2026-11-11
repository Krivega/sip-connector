import hasIncludesString from '@/utils/hasIncludesString';
import {
  resolveEncodingParameters,
  resolveStrictestEncodingParameters,
} from './resolveEncodingParameters';

import type { TResultSetParametersToSender } from '@/tools';
import type { TResolutionSize } from '@/types';
import type { IEncodingParameters, IMainCamHeaders, IParametersSetter } from './types';

export const RESULT_NO_CHANGED: TResultSetParametersToSender = {
  isChanged: false,
  parameters: {
    encodings: [{}],
    transactionId: '0',
    codecs: [],
    headerExtensions: [],
    rtcp: {},
  },
};

/**
 * Применение параметров к отправителю без состояния:
 * рассчитывает параметры чистыми функциями по переданному кодеку и применяет их к отправителю
 */
export class SenderBalancer {
  private readonly ignoreForCodec?: string;

  private readonly parametersSetter: IParametersSetter;

  private readonly getMaxResolution: () => TResolutionSize | undefined;

  private readonly getServerHeaders: () => IMainCamHeaders | undefined;

  public constructor(
    { parametersSetter }: { parametersSetter: IParametersSetter },
    options: {
      ignoreForCodec?: string;
      getMaxResolution: () => TResolutionSize | undefined;
      getServerHeaders: () => IMainCamHeaders | undefined;
    },
  ) {
    this.parametersSetter = parametersSetter;
    this.ignoreForCodec = options.ignoreForCodec;
    this.getMaxResolution = options.getMaxResolution;
    this.getServerHeaders = options.getServerHeaders;
  }

  /**
   * Применяет к отправителю параметры на основе текущих заголовков от сервера.
   * Перед заменой трека применяет более строгие из параметров текущего и ожидаемого трека,
   * чтобы кадры нового трека не ушли с параметрами старого.
   * Без кодека меняет только масштаб, а при заданном ignoreForCodec не меняет ничего
   * @param sender - Отправитель видео
   * @param options - Кодек отправителя и трек, на который заменяется текущий
   * @returns Promise с результатом применения
   */
  public async apply(
    sender: RTCRtpSender,
    { codec, upcomingTrack }: { codec?: string; upcomingTrack?: MediaStreamTrack } = {},
  ): Promise<TResultSetParametersToSender> {
    if (!sender.track || this.isIgnoredCodec(codec)) {
      return RESULT_NO_CHANGED;
    }

    const trackParameters = this.resolveParameters(sender.track, codec);
    const parameters = upcomingTrack
      ? resolveStrictestEncodingParameters(
          trackParameters,
          this.resolveParameters(upcomingTrack, codec),
        )
      : trackParameters;
    const { scaleResolutionDownBy } = parameters;

    // битрейт зависит от кодека: без кодека его не трогаем
    return this.parametersSetter.setEncodingsToSender(
      sender,
      codec === undefined ? { scaleResolutionDownBy } : parameters,
    );
  }

  private isIgnoredCodec(codec?: string): boolean {
    // без кодека исключение проверить нельзя, поэтому при заданном ignoreForCodec параметры не трогаем
    return (
      this.ignoreForCodec !== undefined &&
      (codec === undefined || hasIncludesString(codec, this.ignoreForCodec))
    );
  }

  private resolveParameters(track: MediaStreamTrack, codec?: string): IEncodingParameters {
    return resolveEncodingParameters(
      this.getServerHeaders(),
      { codec, videoTrack: track as MediaStreamVideoTrack },
      this.getMaxResolution(),
    );
  }
}
