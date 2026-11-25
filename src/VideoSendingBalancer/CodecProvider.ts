import getCodecFromSender from '@/utils/peerConnection/getCodecFromSender';

/**
 * Реализация провайдера кодеков: запрашивает кодек отправителя и помнит последний полученный.
 * Статистика без кодека (например, до согласования отправки) известный кодек не затирает
 */
export class CodecProvider {
  private readonly knownCodecs = new WeakMap<RTCRtpSender, string>();

  public async getCodecFromSender(sender: RTCRtpSender): Promise<string | undefined> {
    const codec = await getCodecFromSender(sender);

    if (codec === undefined) {
      return this.knownCodecs.get(sender);
    }

    this.knownCodecs.set(sender, codec);

    return codec;
  }

  // shortcut: кодек — от последней балансировки отправителя и может устареть до следующей
  public getKnownCodec(sender: RTCRtpSender): string | undefined {
    return this.knownCodecs.get(sender);
  }
}
