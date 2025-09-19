import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import RTCRtpTransceiverMock from '@/__fixtures__/RTCRtpTransceiverMock';
import { TransceiverManager } from '../TransceiverManager';

describe('TransceiverManager', () => {
  let transceiverManager: TransceiverManager;

  beforeEach(() => {
    transceiverManager = new TransceiverManager();
  });

  describe('initialization', () => {
    it('should start with empty storage', () => {
      expect(transceiverManager.isEmpty()).toBe(true);
      expect(transceiverManager.getCount()).toBe(0);
      expect(transceiverManager.getTransceivers()).toEqual({
        mainAudio: undefined,
        mainVideo: undefined,
        presentationVideo: undefined,
      });
    });
  });

  describe('storeTransceiver', () => {
    it('should store audio transceiver as mainAudio', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: audioTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '0';

      transceiverManager.storeTransceiver(transceiver, audioTrack);

      expect(transceiverManager.getMainAudioTransceiver()).toBe(transceiver);
      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(true);
      expect(transceiverManager.getCount()).toBe(1);
      expect(transceiverManager.isEmpty()).toBe(false);
    });

    it('should store video transceiver with mid="1" as mainVideo', () => {
      const videoTrack = createVideoMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: videoTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '1';

      transceiverManager.storeTransceiver(transceiver, videoTrack);

      expect(transceiverManager.getMainVideoTransceiver()).toBe(transceiver);
      expect(transceiverManager.hasTransceiver('mainVideo')).toBe(true);
      expect(transceiverManager.getCount()).toBe(1);
    });

    it('should store video transceiver with mid="2" as presentationVideo', () => {
      const videoTrack = createVideoMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: videoTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '2';

      transceiverManager.storeTransceiver(transceiver, videoTrack);

      expect(transceiverManager.getPresentationVideoTransceiver()).toBe(transceiver);
      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(true);
      expect(transceiverManager.getCount()).toBe(1);
    });

    it('should store video transceiver with other mid as mainVideo', () => {
      const videoTrack = createVideoMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: videoTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '3'; // Не '2', поэтому должен быть mainVideo

      transceiverManager.storeTransceiver(transceiver, videoTrack);

      expect(transceiverManager.getMainVideoTransceiver()).toBe(transceiver);
      expect(transceiverManager.hasTransceiver('mainVideo')).toBe(true);
      expect(transceiverManager.getPresentationVideoTransceiver()).toBeUndefined();
    });

    it('should not overwrite existing transceiver of the same type', () => {
      const audioTrack1 = createAudioMediaStreamTrackMock();
      const audioTrack2 = createAudioMediaStreamTrackMock();

      const sender1 = new RTCRtpSenderMock({ track: audioTrack1 });
      const transceiver1 = new RTCRtpTransceiverMock(sender1);

      transceiver1.mid = '0';

      const sender2 = new RTCRtpSenderMock({ track: audioTrack2 });
      const transceiver2 = new RTCRtpTransceiverMock(sender2);

      transceiver2.mid = '0';

      transceiverManager.storeTransceiver(transceiver1, audioTrack1);
      transceiverManager.storeTransceiver(transceiver2, audioTrack2);

      expect(transceiverManager.getMainAudioTransceiver()).toBe(transceiver1);
      expect(transceiverManager.getCount()).toBe(1);
    });

    it('should handle multiple different types of transceivers', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const videoTrack = createVideoMediaStreamTrackMock();
      const presentationVideoTrack = createVideoMediaStreamTrackMock();

      const audioSender = new RTCRtpSenderMock({ track: audioTrack });
      const audioTransceiver = new RTCRtpTransceiverMock(audioSender);

      audioTransceiver.mid = '0';

      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      const presentationSender = new RTCRtpSenderMock({ track: presentationVideoTrack });
      const presentationTransceiver = new RTCRtpTransceiverMock(presentationSender);

      presentationTransceiver.mid = '2';

      transceiverManager.storeTransceiver(audioTransceiver, audioTrack);
      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);
      transceiverManager.storeTransceiver(presentationTransceiver, presentationVideoTrack);

      expect(transceiverManager.getMainAudioTransceiver()).toBe(audioTransceiver);
      expect(transceiverManager.getMainVideoTransceiver()).toBe(videoTransceiver);
      expect(transceiverManager.getPresentationVideoTransceiver()).toBe(presentationTransceiver);
      expect(transceiverManager.getCount()).toBe(3);
      expect(transceiverManager.isEmpty()).toBe(false);
    });
  });

  describe('getTransceivers', () => {
    it('should return a copy of transceivers object', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: audioTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '0';

      transceiverManager.storeTransceiver(transceiver, audioTrack);

      const transceivers1 = transceiverManager.getTransceivers();
      const transceivers2 = transceiverManager.getTransceivers();

      expect(transceivers1).not.toBe(transceivers2); // Разные объекты
      expect(transceivers1).toEqual(transceivers2); // Но с одинаковым содержимым
      expect(transceivers1.mainAudio).toBe(transceiver);
    });
  });

  describe('hasTransceiver', () => {
    it('should return false for empty storage', () => {
      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(false);
      expect(transceiverManager.hasTransceiver('mainVideo')).toBe(false);
      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(false);
    });

    it('should return true for stored transceivers', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: audioTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '0';

      transceiverManager.storeTransceiver(transceiver, audioTrack);

      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(true);
      expect(transceiverManager.hasTransceiver('mainVideo')).toBe(false);
      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all stored transceivers', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const videoTrack = createVideoMediaStreamTrackMock();

      const audioSender = new RTCRtpSenderMock({ track: audioTrack });
      const audioTransceiver = new RTCRtpTransceiverMock(audioSender);

      audioTransceiver.mid = '0';

      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      transceiverManager.storeTransceiver(audioTransceiver, audioTrack);
      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);

      expect(transceiverManager.getCount()).toBe(2);
      expect(transceiverManager.isEmpty()).toBe(false);

      transceiverManager.clear();

      expect(transceiverManager.getCount()).toBe(0);
      expect(transceiverManager.isEmpty()).toBe(true);
      expect(transceiverManager.getMainAudioTransceiver()).toBeUndefined();
      expect(transceiverManager.getMainVideoTransceiver()).toBeUndefined();
      expect(transceiverManager.getPresentationVideoTransceiver()).toBeUndefined();
    });
  });

  describe('getCount and isEmpty', () => {
    it('should track count correctly', () => {
      expect(transceiverManager.getCount()).toBe(0);
      expect(transceiverManager.isEmpty()).toBe(true);

      // Добавляем один transceiver
      const audioTrack = createAudioMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: audioTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '0';

      transceiverManager.storeTransceiver(transceiver, audioTrack);
      expect(transceiverManager.getCount()).toBe(1);
      expect(transceiverManager.isEmpty()).toBe(false);

      // Добавляем второй transceiver
      const videoTrack = createVideoMediaStreamTrackMock();
      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);
      expect(transceiverManager.getCount()).toBe(2);
      expect(transceiverManager.isEmpty()).toBe(false);
    });
  });
});
