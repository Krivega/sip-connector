/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import resolvePresentationSendEncodings from '../resolvePresentationSendEncodings';

import type { TMaxResolution } from '../types';

const RESOLUTION_4K = { width: 3840, height: 2160 };
const RESOLUTION_HD = { width: 1280, height: 720 };
const MAX_RESOLUTION = { width: 1920, height: 1080 };

const createStream = ({ width, height }: TMaxResolution) => {
  return createMediaStreamMock({
    video: {
      deviceId: { exact: 'videoDeviceId' },
      width: { exact: width },
      height: { exact: height },
    },
  });
};

describe('resolvePresentationSendEncodings', () => {
  it('должен добавлять scaleResolutionDownBy для presentation выше maxResolution', () => {
    const stream = createStream(RESOLUTION_4K);

    const result = resolvePresentationSendEncodings({
      stream,
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ scaleResolutionDownBy: 2 }]);
  });

  it('должен добавлять scaleResolutionDownBy, если sendEncodings пустой', () => {
    const stream = createStream(RESOLUTION_4K);

    const result = resolvePresentationSendEncodings({
      stream,
      sendEncodings: [],
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ scaleResolutionDownBy: 2 }]);
  });

  it('не должен уменьшать существующий scaleResolutionDownBy, если он сильнее ограничения maxResolution', () => {
    const stream = createStream(RESOLUTION_4K);

    const result = resolvePresentationSendEncodings({
      stream,
      sendEncodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }],
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }]);
  });

  it('не должен добавлять ограничение, если presentation не выше maxResolution', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const stream = createStream(RESOLUTION_HD);

    const result = resolvePresentationSendEncodings({
      stream,
      sendEncodings,
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toBe(sendEncodings);
  });

  it('не должен изменять sendEncodings, если maxResolution отсутствует', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const stream = createStream(RESOLUTION_4K);

    const result = resolvePresentationSendEncodings({
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

    const result = resolvePresentationSendEncodings({
      sendEncodings,
      stream: streamWithoutVideoTrack,
      maxResolution: MAX_RESOLUTION,
    });

    expect(result).toBe(sendEncodings);
  });
});
