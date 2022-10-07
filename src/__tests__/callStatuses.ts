import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import type SipConnector from '../SipConnector';

describe('call statuses', () => {
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let conference: string;
  let mockFn: jest.Mock<void, any>;
  let mockFnConnecting: jest.Mock<void, any>;
  let mockFnEnterRoom: jest.Mock<void, any>;
  let mockFnAccepted: jest.Mock<void, any>;
  let mockFnConfirmed: jest.Mock<void, any>;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
    mockFn = jest.fn(() => {
      return undefined;
    });
    mockFnConnecting = jest.fn();
    mockFnEnterRoom = jest.fn();
    mockFnAccepted = jest.fn();
    mockFnConfirmed = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('call statuses events should be triggered in correct order', async () => {
    expect.assertions(6);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const number = `10000`;

    const promiseCallStatuses = new Promise<void>((resolve) => {
      sipConnector.onSession('connecting', () => {
        mockFnConnecting();

        sipConnector.onSession('enterRoom', (room: string) => {
          conference = room;

          mockFnEnterRoom();

          sipConnector.onSession('accepted', () => {
            mockFnAccepted();

            sipConnector.onSession('confirmed', () => {
              mockFnConfirmed();
              resolve();
            });
          });
        });
      });
    });

    sipConnector.call({ number, mediaStream, ontrack: mockFn });

    return promiseCallStatuses.then(() => {
      expect(conference).toBe(number);
      expect(sipConnector.isCallActive).toBe(true);
      expect(mockFnConnecting).toHaveBeenCalledTimes(1);
      expect(mockFnEnterRoom).toHaveBeenCalledTimes(1);
      expect(mockFnAccepted).toHaveBeenCalledTimes(1);
      expect(mockFnConfirmed).toHaveBeenCalledTimes(1);
    });
  });
});
