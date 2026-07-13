import { createMediaStreamMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import RTCRtpTransceiverMock from '@/__fixtures__/RTCRtpTransceiverMock';
import { createUaParser } from '@/tools/createUaParser';
import * as peerConnectionUtils from '@/utils/peerConnection';
import {
  isFirefoxOrLower,
  resetUaParserCacheForTests,
} from '../../utils/peerConnection/isFirefoxOrLower';
import PresentationTrackService from '../PresentationTrackService';

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

describe('PresentationTrackService', () => {
  let connection: RTCPeerConnectionMock;
  let trackService: PresentationTrackService;
  let videoTrack: MediaStreamVideoTrack;

  beforeEach(() => {
    connection = new RTCPeerConnectionMock();
    trackService = new PresentationTrackService();
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

  describe('addOrReplace', () => {
    it('добавляет трек через addTransceiver без options', async () => {
      await trackService.addOrReplace(connection, videoTrack);

      expect(connection.addTransceiver).toHaveBeenCalled();
      expect(connection.getSenders()).toHaveLength(1);
    });

    it('вызывает onAddedTransceiver и применяет encodings', async () => {
      const onAddedTransceiver = jest.fn().mockResolvedValue(undefined);

      await trackService.addOrReplace(connection, videoTrack, {
        onAddedTransceiver,
        sendEncodings: [{ maxBitrate: 1_000_000 }],
        degradationPreference: 'maintain-resolution',
      });

      expect(onAddedTransceiver).toHaveBeenCalled();
    });

    it('не применяет sender params при direction=recvonly', async () => {
      const setParametersSpy = jest.fn();

      jest.spyOn(RTCRtpSenderMock.prototype, 'setParameters').mockImplementation(setParametersSpy);

      await trackService.addOrReplace(connection, videoTrack, {
        direction: 'recvonly',
        sendEncodings: [{ maxBitrate: 1_000_000 }],
      });

      expect(setParametersSpy).not.toHaveBeenCalled();
    });

    it('добавляет трек через addTrack на Firefox <= 109', async () => {
      mockUaParser({ isFirefox: true, isLessOrEqual: true });

      const addTrackSpy = jest.spyOn(connection, 'addTrack');

      await trackService.addOrReplace(connection, videoTrack);

      expect(addTrackSpy).toHaveBeenCalled();
      expect(connection.addTransceiver).not.toHaveBeenCalled();
    });

    it('заменяет track у существующего presentation sender', async () => {
      await trackService.addOrReplace(connection, videoTrack);

      const [existingSender] = connection.getSenders();
      const replaceTrackSpy = jest.spyOn(existingSender, 'replaceTrack');
      const nextVideoTrack = createMediaStreamMock({
        video: { deviceId: { exact: 'videoDeviceId2' } },
      }).getVideoTracks()[0] as MediaStreamVideoTrack;

      await trackService.addOrReplace(connection, nextVideoTrack, {
        sendEncodings: [{ maxBitrate: 500_000 }],
      });

      expect(replaceTrackSpy).toHaveBeenCalledWith(nextVideoTrack);
    });

    it('сбрасывает scaleResolutionDownBy при replaceTrack, если presentation ниже лимита', async () => {
      await trackService.addOrReplace(connection, videoTrack, {
        sendEncodings: [{ scaleResolutionDownBy: 2 }],
      });

      const [existingSender] = connection.getSenders();
      const nextVideoTrack = createMediaStreamMock({
        video: { deviceId: { exact: 'videoDeviceId2' } },
      }).getVideoTracks()[0] as MediaStreamVideoTrack;

      await trackService.addOrReplace(connection, nextVideoTrack, {
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

      await trackService.addOrReplace(connection, videoTrack, {
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

      await trackService.addOrReplace(connection, videoTrack, {
        direction: 'sendonly',
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

      await trackService.addOrReplace(connection, videoTrack, {
        direction: 'sendonly',
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

      await trackService.addOrReplace(connection, videoTrack, {
        direction: 'sendonly',
      });

      expect(setDirection).not.toHaveBeenCalled();
    });

    it('не регистрирует sender если track не найден после addTransceiver', async () => {
      const addTransceiverSpy = jest.spyOn(connection, 'addTransceiver');
      const stopSpy = jest.spyOn(videoTrack, 'stop');

      jest
        .spyOn(peerConnectionUtils, 'addVideoTrackInTransceiver')
        .mockImplementationOnce(async () => {
          return undefined;
        });

      await trackService.addOrReplace(connection, videoTrack);

      expect(addTransceiverSpy).not.toHaveBeenCalled();
      trackService.stop(connection);
      expect(stopSpy).not.toHaveBeenCalled();
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
        trackService.addOrReplace(connection, videoTrack, {
          direction: 'sendonly',
          onAddedTransceiver: jest.fn(),
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('stop / clear', () => {
    it('останавливает presentation tracks после addOrReplace', async () => {
      await trackService.addOrReplace(connection, videoTrack);

      const [sender] = connection.getSenders();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stopSpy = jest.spyOn(sender.track!, 'stop');

      trackService.stop(connection);

      expect(stopSpy).toHaveBeenCalled();
    });

    it('не останавливает sender без track', async () => {
      await trackService.addOrReplace(connection, videoTrack);

      const [sender] = connection.getSenders();

      // @ts-expect-error
      // eslint-disable-next-line unicorn/no-null
      sender.track = null;

      expect(() => {
        trackService.stop(connection);
      }).not.toThrow();
    });

    it('clear сбрасывает зарегистрированные senders', async () => {
      await trackService.addOrReplace(connection, videoTrack);

      trackService.clear();

      const [sender] = connection.getSenders();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stopSpy = jest.spyOn(sender.track!, 'stop');

      trackService.stop(connection);

      expect(stopSpy).not.toHaveBeenCalled();
    });
  });
});
