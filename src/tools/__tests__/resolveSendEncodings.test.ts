/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import resolveSendEncodings from '../resolveSendEncodings';

import type { TResolutionSize } from '@/types';

const RESOLUTION_4K = { width: 3840, height: 2160 };
const RESOLUTION_HD = { width: 1280, height: 720 };
const MAX_RESOLUTION = { width: 1920, height: 1080 };

const createVideoTrack = ({ width, height }: TResolutionSize) => {
  const stream = createMediaStreamMock({
    video: {
      deviceId: { exact: 'videoDeviceId' },
      width: { exact: width },
      height: { exact: height },
    },
  });

  return stream.getVideoTracks()[0] as MediaStreamVideoTrack;
};

describe('resolveSendEncodings', () => {
  it('должен добавлять scaleResolutionDownBy для videoTrack выше maxResolution', () => {
    const videoTrack = createVideoTrack(RESOLUTION_4K);

    const result = resolveSendEncodings({
      videoTrack,
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ scaleResolutionDownBy: 2 }]);
  });

  it('должен добавлять scaleResolutionDownBy, если sendEncodings пустой', () => {
    const videoTrack = createVideoTrack(RESOLUTION_4K);

    const result = resolveSendEncodings({
      videoTrack,
      sendEncodings: [],
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ scaleResolutionDownBy: 2 }]);
  });

  it('должен добавлять scaleResolutionDownBy в encoding, если он не задан', () => {
    const videoTrack = createVideoTrack(RESOLUTION_4K);

    const result = resolveSendEncodings({
      videoTrack,
      sendEncodings: [{ maxBitrate: 1_000_000 }],
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }]);
  });

  it('не должен уменьшать существующий scaleResolutionDownBy, если он сильнее ограничения maxResolution', () => {
    const videoTrack = createVideoTrack(RESOLUTION_4K);

    const result = resolveSendEncodings({
      videoTrack,
      sendEncodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }],
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }]);
  });

  it('не должен добавлять ограничение, если videoTrack не выше maxResolution', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const videoTrack = createVideoTrack(RESOLUTION_HD);

    const result = resolveSendEncodings({
      videoTrack,
      sendEncodings,
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 1 }]);
  });

  it('должен явно задавать scaleResolutionDownBy: 1, если videoTrack ниже maxResolution', () => {
    const videoTrack = createVideoTrack(RESOLUTION_HD);

    const result = resolveSendEncodings({
      videoTrack,
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ scaleResolutionDownBy: 1 }]);
  });

  it('должен сбрасывать scaleResolutionDownBy до 1, если videoTrack ниже maxResolution', () => {
    const videoTrack = createVideoTrack(RESOLUTION_HD);

    const result = resolveSendEncodings({
      videoTrack,
      sendEncodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }],
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 1 }]);
  });

  it('не должен изменять sendEncodings, если maxResolution отсутствует', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const videoTrack = createVideoTrack(RESOLUTION_4K);

    const result = resolveSendEncodings({
      videoTrack,
      sendEncodings,
    });

    expect(result).toBe(sendEncodings);
  });

  describe('minScaleResolutionDownBy', () => {
    it('должен задавать minScaleResolutionDownBy без maxResolution', () => {
      const result = resolveSendEncodings({
        videoTrack: createVideoTrack(RESOLUTION_4K),
        minScaleResolutionDownBy: 1.5,
      });

      expect(result).toEqual([{ scaleResolutionDownBy: 1.5 }]);
    });

    it('должен добавлять minScaleResolutionDownBy в encoding без maxResolution, сохраняя остальные поля', () => {
      const result = resolveSendEncodings({
        videoTrack: createVideoTrack(RESOLUTION_4K),
        sendEncodings: [{ maxBitrate: 1_000_000 }],
        minScaleResolutionDownBy: 1.5,
      });

      expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 1.5 }]);
    });

    it('не должен изменять sendEncodings при minScaleResolutionDownBy: 1 без maxResolution', () => {
      const sendEncodings = [{ maxBitrate: 1_000_000 }];

      const result = resolveSendEncodings({
        videoTrack: createVideoTrack(RESOLUTION_4K),
        sendEncodings,
        minScaleResolutionDownBy: 1,
      });

      expect(result).toBe(sendEncodings);
    });

    it('должен применять maxResolution, если он строже minScaleResolutionDownBy', () => {
      const result = resolveSendEncodings({
        videoTrack: createVideoTrack(RESOLUTION_4K),
        maxResolution: MAX_RESOLUTION,
        minScaleResolutionDownBy: 1.5,
      });

      expect(result).toEqual([{ scaleResolutionDownBy: 2 }]);
    });

    it('должен применять minScaleResolutionDownBy, если он строже maxResolution', () => {
      const result = resolveSendEncodings({
        videoTrack: createVideoTrack(RESOLUTION_4K),
        maxResolution: MAX_RESOLUTION,
        minScaleResolutionDownBy: 2.5,
      });

      expect(result).toEqual([{ scaleResolutionDownBy: 2.5 }]);
    });

    it('должен применять minScaleResolutionDownBy, если videoTrack ниже maxResolution', () => {
      const result = resolveSendEncodings({
        videoTrack: createVideoTrack(RESOLUTION_HD),
        maxResolution: MAX_RESOLUTION,
        minScaleResolutionDownBy: 1.2,
      });

      expect(result).toEqual([{ scaleResolutionDownBy: 1.2 }]);
    });

    it('не должен уменьшать пользовательский scaleResolutionDownBy, если он сильнее minScaleResolutionDownBy', () => {
      const result = resolveSendEncodings({
        videoTrack: createVideoTrack(RESOLUTION_4K),
        sendEncodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }],
        minScaleResolutionDownBy: 1.5,
      });

      expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }]);
    });

    it('должен поднимать пользовательский scaleResolutionDownBy до minScaleResolutionDownBy', () => {
      const result = resolveSendEncodings({
        videoTrack: createVideoTrack(RESOLUTION_4K),
        sendEncodings: [{ scaleResolutionDownBy: 1.2 }],
        minScaleResolutionDownBy: 1.5,
      });

      expect(result).toEqual([{ scaleResolutionDownBy: 1.5 }]);
    });
  });
});
