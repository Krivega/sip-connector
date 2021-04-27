import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import type SipConnector from '../SipConnector';

const number = `10000`;

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

    const peerconnection = await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    expect(!!peerconnection).toBe(true);
  });

  it('isCallActive is true after call', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.isCallActive).toBe(false);

    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    expect(sipConnector.isCallActive).toBe(true);
  });

  it('getRemoteStreams', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    const remoteStreams = sipConnector.getRemoteStreams();

    expect(remoteStreams!.length).toBe(1);
  });

  it('should no exist video tracks in incoming mediaStream when call with no video', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    const remoteStreams = sipConnector.getRemoteStreams();

    // @ts-ignore
    const videoTrack = remoteStreams[0].getVideoTracks();

    expect(videoTrack.length).toBe(0);
  });
});
