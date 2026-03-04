/// <reference types="jest" />
import getCodecFromSender from '@/utils/getCodecFromSender';
import BitrateStateManager, {
  MAXIMUM_BITRATE_AUDIO,
  MINIMUM_BITRATE_AUDIO,
  MINIMUM_BITRATE_VIDEO,
} from '../BitrateStateManager';

jest.mock('@/utils/getCodecFromSender');

describe('BitrateStateManager', () => {
  let manager: BitrateStateManager;
  let mockSender: RTCRtpSender;

  beforeEach(() => {
    manager = new BitrateStateManager();
    mockSender = {
      getParameters: jest.fn(() => {
        return {
          encodings: [{ maxBitrate: 1_000_000 }, { maxBitrate: 500_000 }],
        };
      }),
    } as unknown as RTCRtpSender;
  });

  it('should save current bitrate', () => {
    manager.saveCurrentBitrate(mockSender, {
      encodings: [{ maxBitrate: 1_000_000 }, { maxBitrate: 500_000 }],
    } as RTCRtpSendParameters);

    expect(manager.hasSavedBitrate(mockSender)).toBe(true);
    expect(manager.getSavedCount()).toBe(1);
  });

  it('should return saved bitrate', () => {
    manager.saveCurrentBitrate(mockSender, {
      encodings: [{ maxBitrate: 1_000_000 }, { maxBitrate: 500_000 }],
    } as RTCRtpSendParameters);

    const saved = manager.getSavedBitrate(mockSender);

    expect(saved).toEqual([{ maxBitrate: 1_000_000 }, { maxBitrate: 500_000 }]);
  });

  it('should return undefined for unsaved sender', () => {
    const unsavedSender = {} as RTCRtpSender;

    expect(manager.getSavedBitrate(unsavedSender)).toBeUndefined();
  });

  it('should clear saved bitrate', () => {
    manager.saveCurrentBitrate(mockSender, {
      encodings: [{ maxBitrate: 1_000_000 }, { maxBitrate: 500_000 }],
    } as RTCRtpSendParameters);
    expect(manager.hasSavedBitrate(mockSender)).toBe(true);

    manager.clearSavedBitrate(mockSender);
    expect(manager.hasSavedBitrate(mockSender)).toBe(false);
    expect(manager.getSavedCount()).toBe(0);
  });

  it('should clear all saved bitrates', () => {
    manager.saveCurrentBitrate(mockSender, {
      encodings: [{ maxBitrate: 1_000_000 }, { maxBitrate: 500_000 }],
    } as RTCRtpSendParameters);

    const anotherSender = {} as RTCRtpSender;

    manager.saveCurrentBitrate(anotherSender, {
      encodings: [],
    } as unknown as RTCRtpSendParameters);

    expect(manager.getSavedCount()).toBe(2);

    manager.clearAll();
    expect(manager.getSavedCount()).toBe(0);
  });

  it('should return false for hasSavedBitrate when no bitrate saved', () => {
    expect(manager.hasSavedBitrate(mockSender)).toBe(false);
  });

  describe('setMinBitrateForSenders & restoreBitrateForSenders', () => {
    it('should do nothing when connection is undefined in setMinBitrateForSenders', async () => {
      // не должно бросать и не должно падать при отсутствии connection
      await expect(manager.setMinBitrateForSenders(undefined)).resolves.toBeUndefined();
    });

    it('should do nothing when connection is undefined in restoreBitrateForSenders', async () => {
      await expect(manager.restoreBitrateForSenders(undefined)).resolves.toBeUndefined();
    });

    it('should set minimum bitrate for audio and video senders', async () => {
      const audioSender = {
        track: { kind: 'audio' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: 200_000 }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const videoSender = {
        track: { kind: 'video' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: 1_000_000 }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const connection = {
        getSenders: () => {
          return [audioSender, videoSender];
        },
      } as unknown as RTCPeerConnection;

      await manager.setMinBitrateForSenders(connection);

      expect(audioSender.setParameters).toHaveBeenCalledTimes(1);
      expect(videoSender.setParameters).toHaveBeenCalledTimes(1);

      const [audioParams] = (audioSender.setParameters as jest.Mock).mock.calls[0] as [
        RTCRtpSendParameters,
      ];
      const [videoParams] = (videoSender.setParameters as jest.Mock).mock.calls[0] as [
        RTCRtpSendParameters,
      ];

      expect(audioParams.encodings[0].maxBitrate).toBe(MINIMUM_BITRATE_AUDIO);
      // getMinimumBitrateByWidthAndCodec(undefined) возвращает 60000 (MINIMUM_BITRATE для video)
      expect(videoParams.encodings[0].maxBitrate).toBe(60_000);

      // убедимся, что исходные значения сохранились для последующего восстановления
      const savedAudio = manager.getSavedBitrate(audioSender);
      const savedVideo = manager.getSavedBitrate(videoSender);

      expect(savedAudio?.[0].maxBitrate).toBe(200_000);
      expect(savedVideo?.[0].maxBitrate).toBe(1_000_000);
    });

    it('should affect only audio senders when kinds = "audio"', async () => {
      const audioSender = {
        track: { kind: 'audio' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: 200_000 }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const videoSender = {
        track: { kind: 'video' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: 1_000_000 }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const connection = {
        getSenders: () => {
          return [audioSender, videoSender];
        },
      } as unknown as RTCPeerConnection;

      await manager.setMinBitrateForSenders(connection, 'audio');

      expect(audioSender.setParameters).toHaveBeenCalledTimes(1);
      expect(videoSender.setParameters).not.toHaveBeenCalled();
    });

    it('should affect only video senders when kinds = "video"', async () => {
      const audioSender = {
        track: { kind: 'audio' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: 200_000 }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const videoSender = {
        track: { kind: 'video' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: 1_000_000 }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const connection = {
        getSenders: () => {
          return [audioSender, videoSender];
        },
      } as unknown as RTCPeerConnection;

      await manager.setMinBitrateForSenders(connection, 'video');

      expect(videoSender.setParameters).toHaveBeenCalledTimes(1);
      expect(audioSender.setParameters).not.toHaveBeenCalled();
    });

    it('should restore previous bitrate values for senders', async () => {
      const audioSender = {
        track: { kind: 'audio' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: 8000 }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const connection = {
        getSenders: () => {
          return [audioSender];
        },
      } as unknown as RTCPeerConnection;

      // предварительно сохраняем исходное состояние
      manager.saveCurrentBitrate(audioSender, {
        encodings: [{ maxBitrate: 200_000 }],
      } as RTCRtpSendParameters);

      // затем восстанавливаем исходные значения
      await manager.restoreBitrateForSenders(connection, 'audio');

      // setParameters должен быть вызван один раз — при восстановлении прежнего значения
      expect(audioSender.setParameters).toHaveBeenCalledTimes(1);

      const restoreCall = (audioSender.setParameters as jest.Mock).mock.calls[0] as [
        RTCRtpSendParameters,
      ];
      const restoreParams = restoreCall[0];

      expect(restoreParams.encodings[0].maxBitrate).toBe(200_000);
      // после восстановления сохраненное состояние должно быть очищено
      expect(manager.getSavedBitrate(audioSender)).toBeUndefined();
    });

    it('should restore previous bitrate only for video senders when kinds = "video"', async () => {
      const audioSender = {
        track: { kind: 'audio' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: 8000 }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const videoSender = {
        track: { kind: 'video' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: MINIMUM_BITRATE_VIDEO }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const connection = {
        getSenders: () => {
          return [audioSender, videoSender];
        },
      } as unknown as RTCPeerConnection;

      // сохраняем состояние только для видео‑сендера
      manager.saveCurrentBitrate(videoSender, {
        encodings: [{ maxBitrate: 1_000_000 }],
      } as RTCRtpSendParameters);

      await manager.restoreBitrateForSenders(connection, 'video');

      expect(videoSender.setParameters).toHaveBeenCalledTimes(1);
      expect(audioSender.setParameters).not.toHaveBeenCalled();

      const [restoreParams] = (videoSender.setParameters as jest.Mock).mock.calls[0] as [
        RTCRtpSendParameters,
      ];

      expect(restoreParams.encodings[0].maxBitrate).toBe(1_000_000);

      // сохраненное состояние для видео должно быть очищено
      expect(manager.getSavedBitrate(videoSender)).toBeUndefined();
      // а для аудио его и не было
      expect(manager.getSavedBitrate(audioSender)).toBeUndefined();
    });

    it('should not call setParameters on restore when there is no saved state', async () => {
      const audioSender = {
        track: { kind: 'audio' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: 8000 }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const connection = {
        getSenders: () => {
          return [audioSender];
        },
      } as unknown as RTCPeerConnection;

      await manager.restoreBitrateForSenders(connection, 'audio');

      expect(audioSender.setParameters).not.toHaveBeenCalled();
    });

    it('should save encodings with undefined maxBitrate (Safari-like behavior)', () => {
      manager.saveCurrentBitrate(mockSender, {
        encodings: [{ maxBitrate: undefined }, { rid: '1' }],
      } as RTCRtpSendParameters);

      const saved = manager.getSavedBitrate(mockSender);

      expect(saved).toBeDefined();
      expect(saved?.[0].maxBitrate).toBeUndefined();
      expect(saved?.[1].maxBitrate).toBeUndefined();
    });

    it('should use MAXIMUM_BITRATE_AUDIO when restoring audio with saved encodings without maxBitrate', async () => {
      const audioSender = {
        track: { kind: 'audio' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: MINIMUM_BITRATE_AUDIO }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const connection = {
        getSenders: () => {
          return [audioSender];
        },
      } as unknown as RTCPeerConnection;

      manager.saveCurrentBitrate(audioSender, {
        encodings: [{ maxBitrate: undefined }],
      } as RTCRtpSendParameters);

      await manager.restoreBitrateForSenders(connection, 'audio');

      const [restoreParams] = (audioSender.setParameters as jest.Mock).mock.calls[0] as [
        RTCRtpSendParameters,
      ];

      expect(restoreParams.encodings[0].maxBitrate).toBe(MAXIMUM_BITRATE_AUDIO);
    });

    it('should use getMaximumBitrateByWidthAndCodec when restoring video with saved encodings without maxBitrate', async () => {
      const codec = 'video/VP8';

      jest.mocked(getCodecFromSender).mockResolvedValue(codec);

      const videoSender = {
        track: { kind: 'video' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: MINIMUM_BITRATE_VIDEO }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const connection = {
        getSenders: () => {
          return [videoSender];
        },
      } as unknown as RTCPeerConnection;

      manager.saveCurrentBitrate(videoSender, {
        encodings: [{ maxBitrate: undefined }],
      } as RTCRtpSendParameters);

      await manager.restoreBitrateForSenders(connection, 'video');

      const [restoreParams] = (videoSender.setParameters as jest.Mock).mock.calls[0] as [
        RTCRtpSendParameters,
      ];

      // getMaximumBitrateByWidthAndCodec('video/VP8') возвращает 4_000_000 (MAXIMUM_BITRATE для VP8)
      expect(restoreParams.encodings[0].maxBitrate).toBe(4_000_000);
      expect(getCodecFromSender).toHaveBeenCalledWith(videoSender);
    });

    it('should preserve existing maxBitrate when restoring with saved encodings that have maxBitrate', async () => {
      const audioSender = {
        track: { kind: 'audio' } as MediaStreamTrack,
        getParameters: jest.fn(() => {
          return {
            encodings: [{ maxBitrate: MINIMUM_BITRATE_AUDIO }],
          } as RTCRtpSendParameters;
        }),
        setParameters: jest.fn(async () => {
          return undefined;
        }),
      } as unknown as RTCRtpSender;

      const connection = {
        getSenders: () => {
          return [audioSender];
        },
      } as unknown as RTCPeerConnection;

      const originalBitrate = 300_000;

      manager.saveCurrentBitrate(audioSender, {
        encodings: [{ maxBitrate: originalBitrate }],
      } as RTCRtpSendParameters);

      await manager.restoreBitrateForSenders(connection, 'audio');

      const [restoreParams] = (audioSender.setParameters as jest.Mock).mock.calls[0] as [
        RTCRtpSendParameters,
      ];

      expect(restoreParams.encodings[0].maxBitrate).toBe(originalBitrate);
    });
  });
});
