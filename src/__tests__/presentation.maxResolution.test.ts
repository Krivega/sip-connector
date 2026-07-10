/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { doMockSipConnectorWithPresentationSession } from '../doMock';
import findSenderByStream from '../utils/findSenderByStream';

import type { SipConnector } from '../SipConnector';

const number = '111';
const MAX_AVAILABLE_RESOLUTION = { width: 1920, height: 1080 };
const RESOLUTION_FHD = { width: 1920, height: 1080 };
const RESOLUTION_4K = { width: 3840, height: 2160 };

const createPresentationStream = ({ width, height }: { width: number; height: number }) => {
  return createMediaStreamMock({
    video: {
      deviceId: { exact: 'presentation-video' },
      width: { exact: width },
      height: { exact: height },
    },
  });
};

const getPresentationSenderScale = (
  sipConnector: SipConnector,
  presentationStream: MediaStream,
): number | undefined => {
  const { connection } = sipConnector;

  if (!connection) {
    throw new Error('connection is not exist');
  }

  const sender = findSenderByStream(connection.getSenders(), presentationStream);

  if (!sender) {
    return undefined;
  }

  return sender.getParameters().encodings[0]?.scaleResolutionDownBy;
};

describe('presentation maxAvailableResolution (stop → start)', () => {
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;

  beforeEach(() => {
    sipConnector = doMockSipConnectorWithPresentationSession();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  const connectAndCall = async () => {
    await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      maxAvailableResolution: MAX_AVAILABLE_RESOLUTION,
    });
    await sipConnector.call({ number, mediaStream });
  };

  it('должен применять scaleResolutionDownBy: 2 после stop/start с более высоким разрешением', async () => {
    const streamFhd = createPresentationStream(RESOLUTION_FHD);
    const stream4K = createPresentationStream(RESOLUTION_4K);

    await connectAndCall();

    await sipConnector.startPresentation(streamFhd);
    await sipConnector.stopPresentation();

    await sipConnector.startPresentation(stream4K);

    expect(getPresentationSenderScale(sipConnector, stream4K)).toBe(2);
  });

  it('должен сбрасывать scaleResolutionDownBy до 1 после stop/start с допустимым разрешением', async () => {
    const stream4K = createPresentationStream(RESOLUTION_4K);
    const streamFhd = createPresentationStream(RESOLUTION_FHD);

    await connectAndCall();

    await sipConnector.startPresentation(stream4K);
    expect(getPresentationSenderScale(sipConnector, stream4K)).toBe(2);

    await sipConnector.stopPresentation();

    await sipConnector.startPresentation(streamFhd);

    expect(getPresentationSenderScale(sipConnector, streamFhd)).toBe(1);
  });

  it('должен применять scaleResolutionDownBy: 2 при двух последовательных шарах 4K', async () => {
    const stream4KFirst = createPresentationStream(RESOLUTION_4K);
    const stream4KSecond = createPresentationStream(RESOLUTION_4K);

    await connectAndCall();

    await sipConnector.startPresentation(stream4KFirst);
    expect(getPresentationSenderScale(sipConnector, stream4KFirst)).toBe(2);

    await sipConnector.stopPresentation();

    await sipConnector.startPresentation(stream4KSecond);

    expect(getPresentationSenderScale(sipConnector, stream4KSecond)).toBe(2);
  });
});
