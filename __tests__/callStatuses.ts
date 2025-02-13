/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { doMockSipConnector } from '../src/doMock';
import type SipConnector from '../src/SipConnector';

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
    mockFunctionConnecting = jest.fn();
    mockFunctionEnterRoom = jest.fn();
    mockFunctionAccepted = jest.fn();
    mockFunctionConfirmed = jest.fn();
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
        mockFunctionConnecting();

        sipConnector.onSession('enterRoom', ({ room }: { room: string }) => {
          conference = room;

          mockFunctionEnterRoom();

          sipConnector.onSession('accepted', () => {
            mockFunctionAccepted();

            sipConnector.onSession('confirmed', () => {
              mockFunctionConfirmed();
              resolve();
            });
          });
        });
      });
    });

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
