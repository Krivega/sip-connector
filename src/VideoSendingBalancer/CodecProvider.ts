import getCodecFromSender from '@/utils/peerConnection/getCodecFromSender';
import { BROWSER_RESPONSE_TIMEOUT_MS } from './constants';
import { raceWithTimeout } from './raceWithTimeout';

// обёртка даёт запросу идентичность, по которой сверяется актуальность ответа; isJoinable — принимает ли запрос новых ждущих
type TCodecRequest = { readonly codec: Promise<string | undefined>; isJoinable: boolean };

/**
 * Реализация провайдера кодеков: запрашивает кодек отправителя из статистики и помнит последний полученный.
 * Вызов присоединяется к последнему запущенному запросу, пока тот принимает новых ждущих (isJoinable), иначе запускает новый.
 * Ответ ждётся не дольше BROWSER_RESPONSE_TIMEOUT_MS: по таймауту ожидания и по завершении запрос перестаёт принимать новых ждущих,
 * поэтому при зависшем getStats отправителю уходит не больше одного нового запроса за таймаут. Сам запрос не отменяется.
 * Актуален исход только последнего запущенного запроса: ответ и ошибка устаревшего превращаются в undefined,
 * ошибка последнего уходит ждущим, а поздний ответ последнего тоже обновляет известный кодек.
 * undefined — кодека нет в отчёте (например, до согласования отправки), ответа нет за таймаут или запрос устарел
 */
export class CodecProvider {
  private readonly knownCodecs = new WeakMap<RTCRtpSender, string>();

  private readonly lastRequests = new WeakMap<RTCRtpSender, TCodecRequest>();

  public async getCodecFromSender(sender: RTCRtpSender): Promise<string | undefined> {
    const lastRequest = this.lastRequests.get(sender);
    const request = lastRequest?.isJoinable === true ? lastRequest : this.startRequest(sender);

    return raceWithTimeout([request.codec], BROWSER_RESPONSE_TIMEOUT_MS, () => {
      request.isJoinable = false;

      return undefined;
    });
  }

  // shortcut: кодек — от последнего ответа статистики и может устареть до следующего
  public getKnownCodec(sender: RTCRtpSender): string | undefined {
    return this.knownCodecs.get(sender);
  }

  private startRequest(sender: RTCRtpSender): TCodecRequest {
    const request: TCodecRequest = {
      isJoinable: true,
      codec: getCodecFromSender(sender)
        .then((codec) => {
          // ответ запроса, запущенного раньше последнего, затёр бы более свежий кодек
          if (this.lastRequests.get(sender) !== request) {
            return undefined;
          }

          // статистика без кодека известный кодек не затирает
          if (codec !== undefined) {
            this.knownCodecs.set(sender, codec);
          }

          return codec;
        })
        .catch((error: unknown) => {
          // ошибка устаревшего запроса так же неактуальна, как его ответ
          if (this.lastRequests.get(sender) !== request) {
            return undefined;
          }

          throw error;
        })
        .finally(() => {
          request.isJoinable = false;
        }),
    };

    this.lastRequests.set(sender, request);

    return request;
  }
}
