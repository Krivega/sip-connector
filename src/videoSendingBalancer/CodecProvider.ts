import getCodecFromSender from '@/utils/getCodecFromSender';

import type { ICodecProvider } from './types';

/**
 * Реализация провайдера кодеков
 */
export class CodecProvider implements ICodecProvider {
  // eslint-disable-next-line class-methods-use-this
  public async getCodecFromSender(sender: RTCRtpSender): Promise<string> {
    const codec = await getCodecFromSender(sender);

    return codec ?? '';
  }
}
