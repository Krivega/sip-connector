import { createMediaStreamMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import RTCRtpTransceiverMock from '@/__fixtures__/RTCRtpTransceiverMock';
import { createUaParser } from '@/tools/createUaParser';
import PresentationSenders from '../PresentationSenders';
import { addOrReplacePresentationVideoTrack, isFirefoxOrLower } from '../presentationSession';

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

describe('presentationSession', () => {
  let connection: RTCPeerConnectionMock;
  let presentationSenders: PresentationSenders;
  let videoTrack: MediaStreamVideoTrack;

  beforeEach(() => {
    connection = new RTCPeerConnectionMock();
    presentationSenders = new PresentationSenders();
    videoTrack = createMediaStreamMock({
      video: { deviceId: { exact: 'videoDeviceId' } },
    }).getVideoTracks()[0] as MediaStreamVideoTrack;
    mockUaParser();
  });

  describe('isFirefoxOrLower', () => {
    it('возвращает false без Firefox', () => {
      mockUaParser({ isFirefox: false, isLessOrEqual: true });

      expect(isFirefoxOrLower(109)).toBe(false);
    });

    it('возвращает false если версия выше порога', () => {
      mockUaParser({ isFirefox: true, isLessOrEqual: false });

      expect(isFirefoxOrLower(109)).toBe(false);
    });

    it('возвращает true для Firefox с версией <= порога', () => {
      mockUaParser({ isFirefox: true, isLessOrEqual: true });

      expect(isFirefoxOrLower(109)).toBe(true);
    });
  });

  describe('addOrReplacePresentationVideoTrack', () => {
    it('добавляет трек через addTransceiver без options', async () => {
      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack);

      expect(connection.addTransceiver).toHaveBeenCalled();
      expect(connection.getSenders()).toHaveLength(1);
    });

    it('вызывает onAddedTransceiver и применяет encodings', async () => {
      const onAddedTransceiver = jest.fn().mockResolvedValue(undefined);

      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack, {
        onAddedTransceiver,
        sendEncodings: [{ maxBitrate: 1_000_000 }],
        degradationPreference: 'maintain-resolution',
      });

      expect(onAddedTransceiver).toHaveBeenCalled();
    });

    it('не применяет sender params при directionVideo=recvonly', async () => {
      const setParametersSpy = jest.fn();

      jest.spyOn(RTCRtpSenderMock.prototype, 'setParameters').mockImplementation(setParametersSpy);

      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack, {
        directionVideo: 'recvonly',
        sendEncodings: [{ maxBitrate: 1_000_000 }],
      });

      expect(setParametersSpy).not.toHaveBeenCalled();
    });

    it('добавляет трек через addTrack на Firefox <= 109', async () => {
      mockUaParser({ isFirefox: true, isLessOrEqual: true });

      const addTrackSpy = jest.spyOn(connection, 'addTrack');

      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack);

      expect(addTrackSpy).toHaveBeenCalled();
      expect(connection.addTransceiver).not.toHaveBeenCalled();
    });

    it('заменяет track у существующего presentation sender', async () => {
      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack);
      presentationSenders.markTrack(connection, videoTrack);

      const [existingSender] = connection.getSenders();
      const replaceTrackSpy = jest.spyOn(existingSender, 'replaceTrack');
      const nextVideoTrack = createMediaStreamMock({
        video: { deviceId: { exact: 'videoDeviceId2' } },
      }).getVideoTracks()[0] as MediaStreamVideoTrack;

      await addOrReplacePresentationVideoTrack(connection, presentationSenders, nextVideoTrack, {
        sendEncodings: [{ maxBitrate: 500_000 }],
      });

      expect(replaceTrackSpy).toHaveBeenCalledWith(nextVideoTrack);
    });

    it('сбрасывает scaleResolutionDownBy при replaceTrack, если presentation ниже лимита', async () => {
      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack, {
        sendEncodings: [{ scaleResolutionDownBy: 2 }],
      });
      presentationSenders.markTrack(connection, videoTrack);

      const [existingSender] = connection.getSenders();
      const nextVideoTrack = createMediaStreamMock({
        video: { deviceId: { exact: 'videoDeviceId2' } },
      }).getVideoTracks()[0] as MediaStreamVideoTrack;

      await addOrReplacePresentationVideoTrack(connection, presentationSenders, nextVideoTrack, {
        sendEncodings: [{ scaleResolutionDownBy: 1 }],
      });

      expect(existingSender.getParameters().encodings).toEqual([{ scaleResolutionDownBy: 1 }]);
    });

    it('использует addVideoTrackInSender при recvonly transceiver', async () => {
      const recvonlySender = new RTCRtpSenderMock();
      const recvonlyTransceiver = new RTCRtpTransceiverMock(recvonlySender);

      Object.defineProperty(recvonlyTransceiver, 'currentDirection', {
        value: 'recvonly',
      });
      connection.transceivers.push(recvonlyTransceiver);

      const onAddedTransceiver = jest.fn().mockResolvedValue(undefined);
      const addTrackSpy = jest.spyOn(connection, 'addTrack');

      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack, {
        direction: 'sendonly',
        onAddedTransceiver,
        sendEncodings: [{ maxBitrate: 800_000 }],
      });

      expect(addTrackSpy).toHaveBeenCalled();
      expect(connection.addTransceiver).not.toHaveBeenCalled();
      expect(onAddedTransceiver).toHaveBeenCalled();
    });

    it('вызывает setDirection если метод доступен', async () => {
      const recvonlySender = new RTCRtpSenderMock();
      const recvonlyTransceiver = new RTCRtpTransceiverMock(recvonlySender);
      const setDirection = jest.fn();

      Object.defineProperty(recvonlyTransceiver, 'currentDirection', {
        value: 'recvonly',
      });
      connection.transceivers.push(recvonlyTransceiver);

      const originalGetTransceivers = connection.getTransceivers.bind(connection);

      jest.spyOn(connection, 'getTransceivers').mockImplementation(() => {
        const transceivers = originalGetTransceivers();

        for (const item of transceivers) {
          if (item === recvonlyTransceiver) {
            // eslint-disable-next-line no-continue
            continue;
          }

          Object.defineProperty(item, 'direction', {
            value: 'sendrecv',
            writable: true,
            configurable: true,
          });
          Object.defineProperty(item, 'setDirection', {
            value: setDirection,
            configurable: true,
          });
        }

        return transceivers;
      });

      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack, {
        directionVideo: 'sendonly',
      });

      expect(setDirection).toHaveBeenCalledWith('sendonly');
    });

    it('меняет direction напрямую если setDirection отсутствует', async () => {
      const recvonlySender = new RTCRtpSenderMock();
      const recvonlyTransceiver = new RTCRtpTransceiverMock(recvonlySender);
      let capturedTransceiver: RTCRtpTransceiver | undefined;

      Object.defineProperty(recvonlyTransceiver, 'currentDirection', {
        value: 'recvonly',
      });
      connection.transceivers.push(recvonlyTransceiver);

      const originalGetTransceivers = connection.getTransceivers.bind(connection);

      jest.spyOn(connection, 'getTransceivers').mockImplementation(() => {
        const transceivers = originalGetTransceivers();

        for (const item of transceivers) {
          if (item === recvonlyTransceiver) {
            // eslint-disable-next-line no-continue
            continue;
          }

          if (Object.getOwnPropertyDescriptor(item, 'direction')?.writable === false) {
            Object.defineProperty(item, 'direction', {
              value: 'sendrecv',
              writable: true,
              configurable: true,
            });
            Object.defineProperty(item, 'setDirection', {
              value: undefined,
              configurable: true,
            });
          }
        }

        return transceivers;
      });

      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack, {
        directionVideo: 'sendonly',
        onAddedTransceiver: async (transceiver) => {
          capturedTransceiver = transceiver;
        },
      });

      expect(capturedTransceiver?.direction).toBe('sendonly');
    });

    it('не меняет direction если он уже совпадает', async () => {
      const recvonlySender = new RTCRtpSenderMock();
      const recvonlyTransceiver = new RTCRtpTransceiverMock(recvonlySender);
      const setDirection = jest.fn();

      Object.defineProperty(recvonlyTransceiver, 'currentDirection', {
        value: 'recvonly',
      });
      connection.transceivers.push(recvonlyTransceiver);

      const originalGetTransceivers = connection.getTransceivers.bind(connection);

      jest.spyOn(connection, 'getTransceivers').mockImplementation(() => {
        const transceivers = originalGetTransceivers();

        for (const item of transceivers) {
          if (item === recvonlyTransceiver) {
            // eslint-disable-next-line no-continue
            continue;
          }

          Object.defineProperty(item, 'direction', {
            value: 'sendonly',
            writable: true,
            configurable: true,
          });
          Object.defineProperty(item, 'setDirection', {
            value: setDirection,
            configurable: true,
          });
        }

        return transceivers;
      });

      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack, {
        directionVideo: 'sendonly',
      });

      expect(setDirection).not.toHaveBeenCalled();
    });

    it('не падает если transceiver не найден после addTrack', async () => {
      const recvonlySender = new RTCRtpSenderMock();
      const recvonlyTransceiver = new RTCRtpTransceiverMock(recvonlySender);

      Object.defineProperty(recvonlyTransceiver, 'currentDirection', {
        value: 'recvonly',
      });
      connection.transceivers.push(recvonlyTransceiver);

      jest.spyOn(connection, 'getTransceivers').mockReturnValue([recvonlyTransceiver]);

      await expect(
        addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack, {
          directionVideo: 'sendonly',
          onAddedTransceiver: jest.fn(),
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('PresentationSenders markTrack / stopTracks', () => {
    it('не добавляет sender если track не найден в connection', () => {
      presentationSenders.markTrack(
        connection,
        createMediaStreamMock({
          video: { deviceId: { exact: 'unknown' } },
        }).getVideoTracks()[0] as MediaStreamVideoTrack,
      );

      expect(presentationSenders.getFromConnection(connection)).toHaveLength(0);
    });

    it('останавливает только presentation tracks', async () => {
      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack);
      presentationSenders.markTrack(connection, videoTrack);

      const [sender] = connection.getSenders();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stopSpy = jest.spyOn(sender.track!, 'stop');

      presentationSenders.stopTracks(connection);

      expect(stopSpy).toHaveBeenCalled();
    });

    it('не останавливает sender без track', async () => {
      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack);
      presentationSenders.markTrack(connection, videoTrack);

      const [sender] = connection.getSenders();

      // @ts-expect-error
      // eslint-disable-next-line unicorn/no-null
      sender.track = null;

      expect(() => {
        presentationSenders.stopTracks(connection);
      }).not.toThrow();
    });

    it('clear очищает отмеченные senders', async () => {
      await addOrReplacePresentationVideoTrack(connection, presentationSenders, videoTrack);
      presentationSenders.markTrack(connection, videoTrack);

      expect(presentationSenders.getFromConnection(connection)).toHaveLength(1);

      presentationSenders.clear();

      expect(presentationSenders.getFromConnection(connection)).toHaveLength(0);
    });
  });
});
