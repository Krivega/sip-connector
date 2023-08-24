import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import createSipConnector from '../__fixtures__/doMock';
import JsSIP from '../__fixtures__/jssip.mock';
import remoteCallerData from '../__fixtures__/remoteCallerData';

describe('incoming call statuses', () => {
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mockFn: jest.Mock<void, any>;
  let mockFnConnecting: jest.Mock<void, any>;
  let mockFnAccepted: jest.Mock<void, any>;
  let mockFnConfirmed: jest.Mock<void, any>;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    }) as MediaStream;
    mockFn = jest.fn(() => {
      return undefined;
    });
    mockFnConnecting = jest.fn();
    mockFnAccepted = jest.fn();
    mockFnConfirmed = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('call statuses events should be triggered in correct order', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const promiseCallStatuses = new Promise<void>((resolve) => {
      sipConnector.onSession('connecting', () => {
        mockFnConnecting();

        sipConnector.onSession('accepted', () => {
          mockFnAccepted();

          sipConnector.onSession('confirmed', () => {
            mockFnConfirmed();
            resolve();
          });
        });
      });
    });

    sipConnector.on('incomingCall', () => {
      sipConnector.answerToIncomingCall({
        mediaStream,
        ontrack: mockFn,
      });
    });

    // @ts-ignore
    JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);

    return promiseCallStatuses.then(() => {
      expect(sipConnector.isCallActive).toBe(true);
      expect(mockFnConnecting).toHaveBeenCalledTimes(1);
      expect(mockFnAccepted).toHaveBeenCalledTimes(1);
      expect(mockFnConfirmed).toHaveBeenCalledTimes(1);
    });
  });
});
