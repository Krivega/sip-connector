/* eslint-disable jest/expect-expect */
/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { doMockSipConnector } from '../doMock';

import type { TMaxResolution } from '../PresentationManager/types';
import type { SipConnector } from '../SipConnector';

const RESOLUTION_FHD = { width: 1920, height: 1080 };
const RESOLUTION_4K = { width: 3840, height: 2160 };
const MAX_RESOLUTION = { width: 1920, height: 1080 };

const createPresentationTrack = ({ width, height }: TMaxResolution) => {
  return createMediaStreamMock({
    video: {
      deviceId: { exact: `video-${width}x${height}` },
      width: { exact: width },
      height: { exact: height },
    },
  }).getVideoTracks()[0] as MediaStreamVideoTrack;
};

describe('presentation maxResolution after stop/start', () => {
  const number = '111';
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;

  const getPresentationSenderEncodings = () => {
    const { videoTrackPresentationCurrent } = sipConnector.presentationManager;
    const { connection } = sipConnector.callManager;
    const sender = connection?.getSenders().find((itemSender) => {
      return itemSender.track === videoTrackPresentationCurrent;
    });

    return sender?.getParameters().encodings;
  };

  const expectPresentationScale = (scaleResolutionDownBy: number) => {
    expect(getPresentationSenderEncodings()?.[0]).toEqual(
      expect.objectContaining({
        scaleResolutionDownBy,
        maxBitrate: 1_000_000,
      }),
    );
  };

  beforeEach(async () => {
    sipConnector = doMockSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      maxAvailableResolution: MAX_RESOLUTION,
    });
    await sipConnector.call({ number, mediaStream });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('FHD → stop → 4K применяет scaleResolutionDownBy: 2', async () => {
    const fhdTrack = createPresentationTrack(RESOLUTION_FHD);
    const track4K = createPresentationTrack(RESOLUTION_4K);

    await sipConnector.startPresentation(fhdTrack);
    await sipConnector.stopPresentation();

    await sipConnector.startPresentation(track4K);

    expectPresentationScale(2);
  });

  it('4K → stop → FHD сбрасывает scaleResolutionDownBy до 1', async () => {
    const track4K = createPresentationTrack(RESOLUTION_4K);
    const fhdTrack = createPresentationTrack(RESOLUTION_FHD);

    await sipConnector.startPresentation(track4K);
    await sipConnector.stopPresentation();

    await sipConnector.startPresentation(fhdTrack);

    expectPresentationScale(1);
  });

  it('4K → stop → 4K сохраняет scaleResolutionDownBy: 2', async () => {
    const track4K = createPresentationTrack(RESOLUTION_4K);
    const track4KNext = createPresentationTrack(RESOLUTION_4K);

    await sipConnector.startPresentation(track4K);
    await sipConnector.stopPresentation();

    await sipConnector.startPresentation(track4KNext);

    expectPresentationScale(2);
  });

  it('FHD → stop → FHD не применяет downscale', async () => {
    const fhdTrack = createPresentationTrack(RESOLUTION_FHD);
    const fhdTrackNext = createPresentationTrack(RESOLUTION_FHD);

    await sipConnector.startPresentation(fhdTrack);
    await sipConnector.stopPresentation();

    await sipConnector.startPresentation(fhdTrackNext);

    const encodings = getPresentationSenderEncodings()?.[0];

    expect(encodings?.maxBitrate).toBe(1_000_000);
    expect(encodings?.scaleResolutionDownBy ?? 1).toBe(1);
  });

  it('4K → stop → FHD → stop → 4K корректно переключает scale между циклами', async () => {
    const track4K = createPresentationTrack(RESOLUTION_4K);
    const fhdTrack = createPresentationTrack(RESOLUTION_FHD);

    await sipConnector.startPresentation(track4K);
    expectPresentationScale(2);

    await sipConnector.stopPresentation();
    await sipConnector.startPresentation(fhdTrack);
    expectPresentationScale(1);

    await sipConnector.stopPresentation();
    await sipConnector.startPresentation(track4K);
    expectPresentationScale(2);
  });
});
