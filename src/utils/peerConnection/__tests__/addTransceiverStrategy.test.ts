/// <reference types="jest" />
import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { createUaParser } from '@/tools/createUaParser';
import { addTrackInTransceiver, addVideoTrackInTransceiver } from '../addTransceiverStrategy';
import { resetUaParserCacheForTests } from '../isFirefoxOrLower';

jest.mock('@/tools/createUaParser', () => {
  return {
    createUaParser: jest.fn(),
  };
});

const mockedCreateUaParser = createUaParser as jest.MockedFunction<typeof createUaParser>;

const mockUaParser = ({
  isFirefox = false,
  isLessOrEqual = false,
}: {
  isFirefox?: boolean;
  isLessOrEqual?: boolean;
} = {}) => {
  resetUaParserCacheForTests();
  mockedCreateUaParser.mockReturnValue({
    isFirefox,
    isChrome: false,
    isYandexBrowser: false,
    isSafari: false,
    isOpera: false,
    isWindows: false,
    isMobileDevice: false,
    hasGreaterThanBrowserVersion: () => {
      return false;
    },
    hasLessOrEqualBrowserVersion: () => {
      return isLessOrEqual;
    },
  });
};

describe('addTrackInTransceiver', () => {
  let connection: RTCPeerConnectionMock;
  let audioTrack: MediaStreamTrack;

  beforeEach(() => {
    connection = new RTCPeerConnectionMock();
    audioTrack = createAudioMediaStreamTrackMock();
    mockUaParser();
  });

  it('добавляет трек через addTransceiver с streams', async () => {
    const stream = new MediaStream([audioTrack]);

    await addTrackInTransceiver(connection, audioTrack, {}, [stream]);

    expect(connection.addTransceiver).toHaveBeenCalledWith(
      audioTrack,
      expect.objectContaining({
        streams: [stream],
        direction: 'sendrecv',
      }),
    );
  });

  it('добавляет трек через addTrack на Firefox <= 109', async () => {
    mockUaParser({ isFirefox: true, isLessOrEqual: true });

    const stream = new MediaStream([audioTrack]);
    const addTrackSpy = jest.spyOn(connection, 'addTrack');

    await addTrackInTransceiver(connection, audioTrack, {}, [stream]);

    expect(addTrackSpy).toHaveBeenCalledWith(audioTrack, stream);
    expect(connection.addTransceiver).not.toHaveBeenCalled();
  });

  it('не применяет sender params при direction=recvonly', async () => {
    const setParametersSpy = jest.fn();

    jest.spyOn(RTCRtpSenderMock.prototype, 'setParameters').mockImplementation(setParametersSpy);

    await addTrackInTransceiver(connection, audioTrack, {
      direction: 'recvonly',
      sendEncodings: [{ maxBitrate: 1_000_000 }],
    });

    expect(setParametersSpy).not.toHaveBeenCalled();
  });

  it('вызывает onAddedTransceiver после добавления трека', async () => {
    const onAddedTransceiver = jest.fn(async () => {});

    await addTrackInTransceiver(connection, audioTrack, {
      onAddedTransceiver,
    });

    expect(onAddedTransceiver).toHaveBeenCalled();
  });

  it('не вызывает onAddedTransceiver если transceiver не найден на Firefox', async () => {
    mockUaParser({ isFirefox: true, isLessOrEqual: true });

    jest.spyOn(connection, 'getTransceivers').mockReturnValue([]);

    const onAddedTransceiver = jest.fn(async () => {});

    await addTrackInTransceiver(connection, audioTrack, {
      onAddedTransceiver,
    });

    expect(onAddedTransceiver).not.toHaveBeenCalled();
  });

  it('использует явное direction отличное от recvonly', async () => {
    await addTrackInTransceiver(connection, audioTrack, {
      direction: 'sendonly',
      sendEncodings: [{ maxBitrate: 500_000 }],
    });

    expect(connection.addTransceiver).toHaveBeenCalledWith(
      audioTrack,
      expect.objectContaining({
        direction: 'sendonly',
      }),
    );
  });

  it('делегирует addVideoTrackInTransceiver в addTrackInTransceiver', async () => {
    const videoTrack = createVideoMediaStreamTrackMock() as MediaStreamVideoTrack;

    await addVideoTrackInTransceiver(connection, videoTrack, {
      direction: 'sendonly',
    });

    expect(connection.addTransceiver).toHaveBeenCalledWith(
      videoTrack,
      expect.objectContaining({
        direction: 'sendonly',
      }),
    );
  });
});
