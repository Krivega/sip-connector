import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import type SipConnector from '../SipConnector';

describe('call with no video tracks', () => {
  let sipConnector: SipConnector;
  let mediaStream;
  let mockFn;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
    });
    mockFn = jest.fn(() => {
      return undefined;
    });
  });

  it('should exist peerconnection when call with no video tracks', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const number = `10000`;
    const peerconnection = await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    expect(!!peerconnection).toBe(true);
  });

  it('isCallActive is true after call', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.isCallActive).toBe(false);

    const number = `10000`;

    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    expect(sipConnector.isCallActive).toBe(true);
  });

  it('getRemoteStreams', async () => {
    expect.assertions(1);

    const number = `10000`;

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    const remoteStreams = sipConnector.getRemoteStreams();

    expect(remoteStreams!.length).toBe(1);
  });
});
