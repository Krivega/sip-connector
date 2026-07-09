/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import resolvePresentationSendEncodings from '../resolvePresentationSendEncodings';

const RESOLUTION_4K = { width: 3840, height: 2160 };
const RESOLUTION_HD = { width: 1280, height: 720 };
const MAX_AVAILABLE_RESOLUTION = { width: 1920, height: 1080 };

const createPresentationMediaStream = ({ width, height }: { width: number; height: number }) => {
  return createMediaStreamMock({
    video: {
      deviceId: { exact: 'videoDeviceId' },
      width: { exact: width },
      height: { exact: height },
    },
  });
};

describe('resolvePresentationSendEncodings', () => {
  it('должен добавлять scaleResolutionDownBy для presentation выше maxAvailableResolution', () => {
    const mediaStream = createPresentationMediaStream(RESOLUTION_4K);

    const result = resolvePresentationSendEncodings({
      mediaStream,
      maxAvailableResolution: MAX_AVAILABLE_RESOLUTION,
    });

    expect(result).toEqual([{ scaleResolutionDownBy: 2 }]);
  });

  it('должен добавлять scaleResolutionDownBy, если sendEncodings пустой', () => {
    const mediaStream = createPresentationMediaStream(RESOLUTION_4K);

    const result = resolvePresentationSendEncodings({
      mediaStream,
      sendEncodings: [],
      maxAvailableResolution: MAX_AVAILABLE_RESOLUTION,
    });

    expect(result).toEqual([{ scaleResolutionDownBy: 2 }]);
  });

  it('не должен уменьшать существующий scaleResolutionDownBy, если он сильнее ограничения maxAvailableResolution', () => {
    const mediaStream = createPresentationMediaStream(RESOLUTION_4K);

    const result = resolvePresentationSendEncodings({
      mediaStream,
      sendEncodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }],
      maxAvailableResolution: MAX_AVAILABLE_RESOLUTION,
    });

    expect(result).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 3 }]);
  });

  it('не должен добавлять ограничение, если presentation не выше maxAvailableResolution', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const mediaStream = createPresentationMediaStream(RESOLUTION_HD);

    const result = resolvePresentationSendEncodings({
      mediaStream,
      sendEncodings,
      maxAvailableResolution: MAX_AVAILABLE_RESOLUTION,
    });

    expect(result).toBe(sendEncodings);
  });

  it('не должен изменять sendEncodings, если maxAvailableResolution отсутствует', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const mediaStream = createPresentationMediaStream(RESOLUTION_4K);

    const result = resolvePresentationSendEncodings({
      mediaStream,
      sendEncodings,
    });

    expect(result).toBe(sendEncodings);
  });

  it('не должен изменять sendEncodings, если в mediaStream нет video track', () => {
    const sendEncodings = [{ maxBitrate: 1_000_000 }];
    const mediaStreamWithoutVideoTrack = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
    });

    const result = resolvePresentationSendEncodings({
      sendEncodings,
      mediaStream: mediaStreamWithoutVideoTrack,
      maxAvailableResolution: MAX_AVAILABLE_RESOLUTION,
    });

    expect(result).toBe(sendEncodings);
  });
});
