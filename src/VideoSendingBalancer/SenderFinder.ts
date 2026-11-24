import findVideoSender from '@/utils/peerConnection/findVideoSender';

import type { IBalancerOptions, ISenderFinder } from './types';

/**
 * Реализация поиска видео отправителя
 */
export class SenderFinder implements ISenderFinder {
  private readonly isExcludedSender: NonNullable<IBalancerOptions['isExcludedSender']>;

  public constructor({
    isExcludedSender = () => {
      return false;
    },
  }: Pick<IBalancerOptions, 'isExcludedSender'> = {}) {
    this.isExcludedSender = isExcludedSender;
  }

  public findVideoSender(senders: RTCRtpSender[]): RTCRtpSender | undefined {
    return findVideoSender(
      senders.filter((sender) => {
        return !this.isExcludedSender(sender);
      }),
    );
  }
}
