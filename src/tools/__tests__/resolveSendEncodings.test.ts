/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import resolveSendEncodings from '../resolveSendEncodings';

import type { TResolutionSize } from '@/types';

const RESOLUTION_4K = { width: 3840, height: 2160 };
const RESOLUTION_HD = { width: 1280, height: 720 };
const MAX_RESOLUTION = { width: 1920, height: 1080 };

const createStream = ({ width, height }: TResolutionSize) => {
  return createMediaStreamMock({
    video: {
      deviceId: { exact: 'videoDeviceId' },
      width: { exact: width },
      height: { exact: height },
    },
  });
};

describe('resolveSendEncodings', () => {
  it('должен добавлять scaleResolutionDownBy для видеопотока выше maxResolution', () => {
    const stream = createStream(RESOLUTION_4K);

    const result = resolveSendEncodings({
      stream,
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ scaleResolutionDownBy: 2 }]);
  });

  it('должен добавлять scaleResolutionDownBy, если sendEncodings пустой', () => {
    const stream = createStream(RESOLUTION_4K);

    const result = resolveSendEncodings({
      stream,
      sendEncodings: [],
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ scaleResolutionDownBy: 2 }]);
  });

  it('должен добавлять scaleResolutionDownBy в encoding, если он не задан', () => {
    const stream = createStream(RESOLUTION_4K);

    const result = resolveSendEncodings({
      stream,
      sendEncodings: [{ maxBitrate: 1_000_000 }],
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }]);
  });

  it('не должен уменьшать существующий scaleResolutionDownBy, если он сильнее ограничения maxResolution', () => {
    const stream = createStream(RESOLUTION_4K);

    const result = resolveSendEncodings({
      stream,
      sendEncodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }],
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }]);
  });

  it('не должен добавлять ограничение, если видеопоток не выше maxResolution', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const stream = createStream(RESOLUTION_HD);

    const result = resolveSendEncodings({
      stream,
      sendEncodings,
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toBe(sendEncodings);
  });

  it('не должен изменять sendEncodings, если maxResolution отсутствует', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const stream = createStream(RESOLUTION_4K);

    const result = resolveSendEncodings({
      stream,
      sendEncodings,
    });

    expect(result).toBe(sendEncodings);
  });

  it('не должен изменять sendEncodings, если в stream нет video track', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const streamWithoutVideoTrack = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
    });

    const result = resolveSendEncodings({
      sendEncodings,
      stream: streamWithoutVideoTrack,
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toBe(sendEncodings);
  });
});
