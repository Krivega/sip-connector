import delayPromise from 'promise-delay';
import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { FAILED_CONFERENCE_NUMBER } from '../__mocks__/jssip.mock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import { hasCanceledCallError } from '../SipConnector';
import type SipConnector from '../SipConnector';

describe('call', () => {
  let sipConnector: SipConnector;
  let mediaStream;
  let mockFn;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
    mockFn = jest.fn(() => {
      return undefined;
    });
  });

  it('base call', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const number = `10000`;
    const peerconnection = await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    expect(!!peerconnection).toBe(true);
    expect(sipConnector.ua.call.mock.calls.length).toBe(1);
    expect(sipConnector.ua.call.mock.calls[0][0]).toBe('sip:10000@SIP_SERVER_URL');
  });

  it('connectionConfiguration after call', async () => {
    expect.assertions(8);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.getConnectionConfiguration().answer).toBe(undefined);

    const number = `10000`;
    const callPromise = sipConnector.call({ number, mediaStream, ontrack: mockFn });
    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration.number).toBe(number);
    expect(connectionConfiguration.answer).toBe(false);
    expect(connectionConfiguration.sipServerUrl).toBe(
      dataForConnectionWithAuthorization.sipServerUrl,
    );
    expect(connectionConfiguration.displayName).toBe('');
    expect(connectionConfiguration.register).toBe(dataForConnectionWithAuthorization.register);
    expect(connectionConfiguration.user).toBe(dataForConnectionWithAuthorization.user);
    expect(connectionConfiguration.password).toBe(dataForConnectionWithAuthorization.password);

    return callPromise;
  });

  it('isCallActive is true after call', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.isCallActive).toBe(false);

    const number = `10000`;

    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    expect(sipConnector.isCallActive).toBe(true);
  });

  it('order tracks mediaStream: call', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const number = `10000`;
    const peerconnection = await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    // @ts-ignore
    expect(peerconnection._senders[0].track.kind).toBe('audio');
    // @ts-ignore
    expect(peerconnection._senders[1].track.kind).toBe('video');
  });

  it('order tracks mediaStream: call: reverse', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    mediaStream.tracks.reverse();

    const number = `10000`;
    const peerconnection = await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    // @ts-ignore
    expect(peerconnection._senders[0].track.kind).toBe('audio');
    // @ts-ignore
    expect(peerconnection._senders[1].track.kind).toBe('video');
  });

  it('getRemoteStreams', async () => {
    expect.assertions(1);

    const number = `10000`;

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    const remoteStreams = sipConnector.getRemoteStreams();

    expect(remoteStreams!.length).toBe(1);
  });

  it('hangUp', async () => {
    expect.assertions(2);

    const number = `10000`;

    const endedPromise = new Promise((resolve) => {
      sipConnector.onceSession('ended', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFn });
    sipConnector.hangUp();
    await endedPromise;
    await delayPromise(100); // wait restore session

    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(sipConnector.session).toBe(undefined);
    expect(connectionConfiguration.number).toBe(undefined);
  });

  it('disconnect after end call from server', async () => {
    expect.assertions(1);

    const number = `10000`;
    const disconnectPromise = new Promise((resolve, reject) => {
      sipConnector.onceSession('ended', () => {
        // order is important!!!
        sipConnector.disconnect().then(resolve).catch(reject);
      });
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    sipConnector.session!.terminate(); // end call from server

    return expect(disconnectPromise).resolves.toBeUndefined();
  });

  it('disconnect after decline call from server: wait to decline', async () => {
    expect.assertions(2);

    const number = FAILED_CONFERENCE_NUMBER;

    // order is important!!!
    const disconnectPromise = new Promise((resolve, reject) => {
      sipConnector.onceSession('failed', () => {
        // order is important!!!
        sipConnector.disconnect().then(resolve).catch(reject);
      });
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const promiseCall = sipConnector.call({ number, mediaStream, ontrack: mockFn });

    return Promise.all([
      promiseCall.catch((error) => {
        expect(hasCanceledCallError(error)).toBeTruthy();
      }),
      disconnectPromise.then((result) => {
        expect(result).toBeUndefined();
      }),
    ]);
  });

  it('disconnect after decline call from server: dont wait to decline', async () => {
    expect.assertions(2);

    const number = FAILED_CONFERENCE_NUMBER;

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const promiseCall = sipConnector.call({ number, mediaStream, ontrack: mockFn });

    const disconnectPromise = new Promise((resolve, reject) => {
      sipConnector.disconnect().then(resolve).catch(reject);
    });

    return Promise.all([
      promiseCall.catch((error) => {
        expect(hasCanceledCallError(error)).toBeTruthy();
      }),
      disconnectPromise.then((result) => {
        expect(result).toBeUndefined();
      }),
    ]);
  });

  it('disconnect after confirm call from server: dont wait to confirm', async () => {
    expect.assertions(2);

    const number = `10000`;

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const promiseCall = sipConnector.call({ number, mediaStream, ontrack: mockFn });

    const disconnectPromise = new Promise((resolve, reject) => {
      sipConnector.disconnect().then(resolve).catch(reject);
    });

    return Promise.all([
      promiseCall.catch((error) => {
        expect(hasCanceledCallError(error)).toBeTruthy();
      }),
      disconnectPromise.then((result) => {
        expect(result).toBeUndefined();
      }),
    ]);
  });

  it('disconnect after confirm call from server: wait to confirm', async () => {
    expect.assertions(1);

    const number = `10000`;

    await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    sipConnector.session!.terminate(); // end call from server

    return sipConnector.disconnect().then((result) => {
      expect(result).toBeUndefined();
    });
  });

  it('Clean up remoteStreams after end call from server', async () => {
    expect.assertions(1);

    const remoteStreams = {};
    const number = `10000`;

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    const disconnectPromise = new Promise<void>((resolve) => {
      sipConnector.onceSession('ended', () => {
        resolve();
      });
    });

    sipConnector.getRemoteStreams(); // for fill media streams in sipConnector._remoteStreams
    sipConnector.session!.terminate(); // end call from server

    return disconnectPromise.then(() => {
      // @ts-ignore
      expect(sipConnector!._remoteStreams).toEqual(remoteStreams);
    });
  });

  it('end call from server', async () => {
    expect.assertions(1);

    const number = `10000`;
    const data = { originator: 'remote' };

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    const endedFromServer = new Promise((resolve) => {
      sipConnector.onSession('ended:fromserver', resolve);
    });

    // @ts-ignore
    sipConnector.session!.terminateRemote();

    return expect(endedFromServer).resolves.toEqual(data);
  });

  it('calls without videoMode and audioMode', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const number = `10000`;

    await sipConnector.call({ number, mediaStream, ontrack: mockFn });

    const params = sipConnector.ua.call.mock.calls[0][1];

    expect(params.videoMode).toBe(undefined);
    expect(params.audioMode).toBe(undefined);
    expect(params.mediaStream.getVideoTracks().length).toBe(1);
    expect(params.mediaStream.getAudioTracks().length).toBe(1);
  });

  it('calls with videoMode=recvonly', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const number = `10000`;

    await sipConnector.call({ number, mediaStream, videoMode: 'recvonly', ontrack: mockFn });

    const params = sipConnector.ua.call.mock.calls[0][1];

    expect(params.videoMode).toBe('recvonly');
    expect(params.audioMode).toBe(undefined);
    expect(params.mediaStream.getVideoTracks().length).toBe(0);
    expect(params.mediaStream.getAudioTracks().length).toBe(1);
  });

  it('calls with audioMode=recvonly', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const number = `10000`;

    await sipConnector.call({ number, mediaStream, audioMode: 'recvonly', ontrack: mockFn });

    const params = sipConnector.ua.call.mock.calls[0][1];

    expect(params.videoMode).toBe(undefined);
    expect(params.audioMode).toBe('recvonly');
    expect(params.mediaStream.getVideoTracks().length).toBe(1);
    expect(params.mediaStream.getAudioTracks().length).toBe(0);
  });

  it('calls with videoMode=recvonly audioMode=recvonly', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const number = `10000`;

    await sipConnector.call({
      number,
      mediaStream,
      videoMode: 'recvonly',
      audioMode: 'recvonly',
      ontrack: mockFn,
    });

    const params = sipConnector.ua.call.mock.calls[0][1];

    expect(params.videoMode).toBe('recvonly');
    expect(params.audioMode).toBe('recvonly');
    expect(params.mediaStream).toBe(undefined);
  });
});
