import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import createSipConnector from '../__fixtures__/doMock';

const number = `10000`;

describe('call with no video tracks', () => {
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mockFunction = jest.fn();

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
    });
    mockFunction = jest.fn(() => {});
  });

  it('should exist peerconnection when call with no video tracks', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const peerconnection = await sipConnector.call({ number, mediaStream, ontrack: mockFunction });

    expect(!!peerconnection).toBe(true);
  });

  it('isCallActive is true after call', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.isCallActive).toBe(false);

    await sipConnector.call({ number, mediaStream, ontrack: mockFunction });

    expect(sipConnector.isCallActive).toBe(true);
  });

  it('getRemoteStreams', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFunction });

    const remoteStreams = sipConnector.getRemoteStreams();

    expect(remoteStreams!.length).toBe(1);
  });

  it('should no exist video tracks in incoming mediaStream when call with no video', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFunction });

    const remoteStreams = sipConnector.getRemoteStreams();

    const videoTrack = remoteStreams![0].getVideoTracks();

    expect(videoTrack.length).toBe(0);
  });

  it('tracks on senders', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const peerconnection = await sipConnector.call({ number, mediaStream, ontrack: mockFunction });

    // @ts-expect-error
    expect(peerconnection._senders[0].track.kind).toBe('audio');
    // @ts-expect-error
    expect(peerconnection._senders[1]).toBe(undefined);
  });
});
