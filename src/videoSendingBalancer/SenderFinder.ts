import findVideoSender from '@/utils/findVideoSender';

import type { ISenderFinder } from './types';

/**
 * Реализация поиска видео отправителя
 */
export class SenderFinder implements ISenderFinder {
  // eslint-disable-next-line class-methods-use-this
  public findVideoSender(senders: RTCRtpSender[]): RTCRtpSender | undefined {
    return findVideoSender(senders);
  }
}
