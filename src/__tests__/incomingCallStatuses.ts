/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import remoteCallerData from '../__fixtures__/remoteCallerData';
import { doMockSipConnector } from '../doMock';
import type SipConnector from '../SipConnector';

describe('incoming call statuses', () => {
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mockFunction: jest.Mock<void>;
  let mockFunctionConnecting: jest.Mock<void>;
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
    mockFunctionAccepted = jest.fn();
    mockFunctionConfirmed = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('call statuses events should be triggered in correct order', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const promiseCallStatuses = new Promise<void>((resolve) => {
      sipConnector.onSession('connecting', () => {
        mockFunctionConnecting();

        sipConnector.onSession('accepted', () => {
          mockFunctionAccepted();

          sipConnector.onSession('confirmed', () => {
            mockFunctionConfirmed();
            resolve();
          });
        });
      });
    });

    sipConnector.on('incomingCall', () => {
      sipConnector.answerToIncomingCall({
        mediaStream,
        ontrack: mockFunction,
      });
    });

    // @ts-expect-error
    JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);

    return promiseCallStatuses.then(() => {
      expect(sipConnector.isCallActive).toBe(true);
      expect(mockFunctionConnecting).toHaveBeenCalledTimes(1);
      expect(mockFunctionAccepted).toHaveBeenCalledTimes(1);
      expect(mockFunctionConfirmed).toHaveBeenCalledTimes(1);
    });
  });
});
