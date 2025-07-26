/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { doMockSipConnector } from '../doMock';
import type SipConnector from '../SipConnector';

describe('call statuses', () => {
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let conference: string;
  let mockFunction: jest.Mock<void>;
  let mockFunctionConnecting: jest.Mock<void>;
  let mockFunctionEnterRoom: jest.Mock<void>;
  let mockFunctionAccepted: jest.Mock<void>;
  let mockFunctionConfirmed: jest.Mock<void>;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    }) as MediaStream;
    mockFunction = jest.fn(() => {});
    mockFunctionConnecting = jest.fn() as jest.Mock<void>;
    mockFunctionEnterRoom = jest.fn() as jest.Mock<void>;
    mockFunctionAccepted = jest.fn() as jest.Mock<void>;
    mockFunctionConfirmed = jest.fn() as jest.Mock<void>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('call statuses events should be triggered in correct order', async () => {
    expect.assertions(6);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const number = '10000';

    const promiseCallStatuses = new Promise<void>((resolve) => {
      sipConnector.onCall('connecting', () => {
        mockFunctionConnecting();

        sipConnector.onApi('enterRoom', ({ room }: { room: string }) => {
          conference = room;

          mockFunctionEnterRoom();

          sipConnector.onCall('accepted', () => {
            mockFunctionAccepted();

            sipConnector.onCall('confirmed', () => {
              mockFunctionConfirmed();
              resolve();
            });
          });
        });
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.call({ number, mediaStream, ontrack: mockFunction });

    return promiseCallStatuses.then(() => {
      expect(conference).toBe(number);
      expect(sipConnector.isCallActive).toBe(true);
      expect(mockFunctionConnecting).toHaveBeenCalledTimes(1);
      expect(mockFunctionEnterRoom).toHaveBeenCalledTimes(1);
      expect(mockFunctionAccepted).toHaveBeenCalledTimes(1);
      expect(mockFunctionConfirmed).toHaveBeenCalledTimes(1);
    });
  });
});
