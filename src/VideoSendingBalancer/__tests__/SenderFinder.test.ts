/// <reference types="jest" />
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { SenderFinder } from '../SenderFinder';

describe('SenderFinder', () => {
  let senderFinder: SenderFinder;

  beforeEach(() => {
    senderFinder = new SenderFinder();
  });

  describe('findVideoSender', () => {
    it('должен найти видео sender', () => {
      const videoTrack = {
        kind: 'video',
      } as MediaStreamVideoTrack;

      const audioTrack = {
        kind: 'audio',
      } as MediaStreamAudioTrack;

      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const audioSender = new RTCRtpSenderMock({ track: audioTrack });

      const senders = [audioSender, videoSender, audioSender];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBe(videoSender);
    });

    it('должен вернуть undefined если видео sender не найден', () => {
      const audioTrack = {
        kind: 'audio',
      } as MediaStreamAudioTrack;

      const audioSender1 = new RTCRtpSenderMock({ track: audioTrack });
      const audioSender2 = new RTCRtpSenderMock({ track: audioTrack });

      const senders = [audioSender1, audioSender2];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBeUndefined();
    });

    it('должен вернуть undefined если senders пустой массив', () => {
      const senders: RTCRtpSender[] = [];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBeUndefined();
    });

    it('должен вернуть undefined если все senders не имеют track', () => {
      const sender1 = new RTCRtpSenderMock({ track: undefined });
      const sender2 = new RTCRtpSenderMock({ track: undefined });

      const senders = [sender1, sender2];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBeUndefined();
    });

    it('должен вернуть undefined если track не имеет kind', () => {
      const trackWithoutKind = {} as MediaStreamTrack;
      const sender = new RTCRtpSenderMock({ track: trackWithoutKind });

      const senders = [sender];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBeUndefined();
    });

    it('должен вернуть первый найденный видео sender', () => {
      const videoTrack1 = {
        kind: 'video',
      } as MediaStreamVideoTrack;

      const videoTrack2 = {
        kind: 'video',
      } as MediaStreamVideoTrack;

      const audioTrack = {
        kind: 'audio',
      } as MediaStreamAudioTrack;

      const videoSender1 = new RTCRtpSenderMock({ track: videoTrack1 });
      const videoSender2 = new RTCRtpSenderMock({ track: videoTrack2 });
      const audioSender = new RTCRtpSenderMock({ track: audioTrack });

      const senders = [audioSender, videoSender1, videoSender2];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBe(videoSender1);
    });

    it('должен обработать смешанные senders с undefined track', () => {
      const videoTrack = {
        kind: 'video',
      } as MediaStreamVideoTrack;

      const audioTrack = {
        kind: 'audio',
      } as MediaStreamAudioTrack;

      const sender1 = new RTCRtpSenderMock({ track: undefined });
      const sender2 = new RTCRtpSenderMock({ track: audioTrack });
      const sender3 = new RTCRtpSenderMock({ track: videoTrack });
      const sender4 = new RTCRtpSenderMock({ track: undefined });

      const senders = [sender1, sender2, sender3, sender4];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBe(sender3);
    });

    it('должен обработать senders с null track', () => {
      const videoTrack = {
        kind: 'video',
      } as MediaStreamVideoTrack;

      // @ts-expect-error
      // eslint-disable-next-line unicorn/no-null
      const sender1 = new RTCRtpSenderMock({ track: null });
      const sender2 = new RTCRtpSenderMock({ track: videoTrack });

      const senders = [sender1, sender2];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBe(sender2);
    });

    it('должен вернуть undefined для track с kind в верхнем регистре', () => {
      const videoTrack = {
        kind: 'VIDEO',
      } as unknown as MediaStreamVideoTrack;

      const sender = new RTCRtpSenderMock({ track: videoTrack });

      const senders = [sender];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBeUndefined();
    });

    it('должен вернуть undefined для track с kind в смешанном регистре', () => {
      const videoTrack = {
        kind: 'Video',
      } as unknown as MediaStreamVideoTrack;

      const sender = new RTCRtpSenderMock({ track: videoTrack });

      const senders = [sender];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBeUndefined();
    });

    it('должен найти track с kind "video" независимо от типа', () => {
      const trackWithVideoKind = {
        kind: 'video',
      } as MediaStreamTrack; // Не MediaStreamVideoTrack

      const sender = new RTCRtpSenderMock({ track: trackWithVideoKind });

      const senders = [sender];

      const result = senderFinder.findVideoSender(senders);

      expect(result).toBe(sender);
    });
  });
});
