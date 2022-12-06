import delayPromise from 'promise-delay';
import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import JsSIP from '../__mocks__/jssip.mock';
import remoteCallerData from '../__mocks__/remoteCallerData';
import type SipConnector from '../SipConnector';

describe('incoming call', () => {
  let sipConnector: SipConnector;
  let mediaStream;
  let mockFn;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
    mockFn = jest.fn();
  });

  it('init', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.isAvailableIncomingCall).toBe(false);

    try {
      await sipConnector.answerToIncomingCall({ mediaStream });
    } catch (e) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(true).toBe(true);
    }

    try {
      await sipConnector.declineToIncomingCall();
    } catch (e) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(true).toBe(true);
    }
  });

  it('answer', async () => {
    expect.assertions(7);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async ({ displayName, host, incomingNumber }) => {
        expect(sipConnector.isAvailableIncomingCall).toBe(true);
        expect(displayName).toBe(remoteCallerData.displayName);
        expect(host).toBe(remoteCallerData.host);
        expect(incomingNumber).toBe(remoteCallerData.incomingNumber);

        await delayPromise(100); // wait for to decline incoming call

        const peerconnection = await sipConnector.answerToIncomingCall({
          mediaStream,
          ontrack: mockFn,
        });

        expect(sipConnector.getConnectionConfiguration().answer).toBe(true);
        expect(!!peerconnection).toBe(true);
        //@ts-ignore
        expect(sipConnector.session.answer.mock.calls.length).toBe(1);

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('remote caller data', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        expect(sipConnector.isAvailableIncomingCall).toBe(true);
        expect(sipConnector.remoteCallerData.incomingNumber).toBe(remoteCallerData.incomingNumber);
        expect(sipConnector.remoteCallerData.host).toBe(remoteCallerData.host);
        expect(sipConnector.remoteCallerData.displayName).toBe(remoteCallerData.displayName);

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('order tracks mediaStream: answer', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call

        const peerconnection = await sipConnector.answerToIncomingCall({
          mediaStream,
          ontrack: mockFn,
        });

        // @ts-ignore
        expect(peerconnection._senders[0].track.kind).toBe('audio');
        // @ts-ignore
        expect(peerconnection._senders[1].track.kind).toBe('video');

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('order tracks mediaStream: answer: reverse', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call

        mediaStream.tracks.reverse();

        const peerconnection = await sipConnector.answerToIncomingCall({
          mediaStream,
          ontrack: mockFn,
        });

        // @ts-ignore
        expect(peerconnection._senders[0].track.kind).toBe('audio');
        // @ts-ignore
        expect(peerconnection._senders[1].track.kind).toBe('video');

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('decline', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise((resolve) => {
      sipConnector.on('incomingCall', () => {
        return delayPromise(100).then(resolve);
      }); // wait for to decline incoming call);

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    })
      .then(() => {
        return Promise.all([
          new Promise<{
            displayName: string;
            host: string;
            incomingNumber: string;
          }>((resolve) => {
            sipConnector.on('declinedIncomingCall', resolve);
          }),
          sipConnector.declineToIncomingCall(),
        ]);
      })
      .then(([{ displayName, host, incomingNumber }, incomingSession]) => {
        // @ts-ignore
        expect(incomingSession.status_code).toBe(487);
        expect(incomingNumber).toBe(remoteCallerData.incomingNumber);
        expect(host).toBe(remoteCallerData.host);
        expect(displayName).toBe(remoteCallerData.displayName);
      });
  });

  it('failed', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise((resolve) => {
      sipConnector.on('incomingCall', () => {
        return delayPromise(100).then(resolve);
      }); // wait for to decline incoming call);

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    })
      .then(() => {
        return new Promise<{
          displayName: string;
          host: string;
          incomingNumber: string;
        }>((resolve) => {
          sipConnector.on('failedIncomingCall', resolve);

          JsSIP.triggerFailIncomingSession(sipConnector.incomingSession);
        });
      })
      .then(({ displayName, host, incomingNumber }) => {
        expect(incomingNumber).toBe(remoteCallerData.incomingNumber);
        expect(host).toBe(remoteCallerData.host);
        expect(displayName).toBe(remoteCallerData.displayName);
      });
  });

  it('terminated', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise((resolve) => {
      sipConnector.on('incomingCall', () => {
        return delayPromise(100).then(resolve);
      }); // wait for to decline incoming call);

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    })
      .then(() => {
        return new Promise<{
          displayName: string;
          host: string;
          incomingNumber: string;
        }>((resolve) => {
          sipConnector.on('terminatedIncomingCall', resolve);

          JsSIP.triggerFailIncomingSession(sipConnector.incomingSession, { originator: 'local' });
        });
      })
      .then(({ displayName, host, incomingNumber }) => {
        expect(incomingNumber).toBe(remoteCallerData.incomingNumber);
        expect(host).toBe(remoteCallerData.host);
        expect(displayName).toBe(remoteCallerData.displayName);
      });
  });

  it('answer without videoMode and audioMode', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call
        await sipConnector.answerToIncomingCall({
          mediaStream,
          ontrack: mockFn,
        });

        //@ts-ignore
        const params = sipConnector.session.answer.mock.calls[0][0];

        expect(params.videoMode).toBe(undefined);
        expect(params.audioMode).toBe(undefined);
        expect(params.mediaStream.getVideoTracks().length).toBe(1);
        expect(params.mediaStream.getAudioTracks().length).toBe(1);

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('answer with videoMode=recvonly', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call
        await sipConnector.answerToIncomingCall({
          mediaStream,
          videoMode: 'recvonly',
          ontrack: mockFn,
        });

        //@ts-ignore
        const params = sipConnector.session.answer.mock.calls[0][0];

        expect(params.videoMode).toBe('recvonly');
        expect(params.audioMode).toBe(undefined);
        expect(params.mediaStream.getVideoTracks().length).toBe(0);
        expect(params.mediaStream.getAudioTracks().length).toBe(1);

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('answer with audioMode=recvonly', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call
        await sipConnector.answerToIncomingCall({
          mediaStream,
          audioMode: 'recvonly',
          ontrack: mockFn,
        });

        //@ts-ignore
        const params = sipConnector.session.answer.mock.calls[0][0];

        expect(params.videoMode).toBe(undefined);
        expect(params.audioMode).toBe('recvonly');
        expect(params.mediaStream.getVideoTracks().length).toBe(1);
        expect(params.mediaStream.getAudioTracks().length).toBe(0);

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('answer with videoMode=recvonly audioMode=recvonly', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call
        await sipConnector.answerToIncomingCall({
          mediaStream,
          videoMode: 'recvonly',
          audioMode: 'recvonly',
          ontrack: mockFn,
        });

        //@ts-ignore
        const params = sipConnector.session.answer.mock.calls[0][0];

        expect(params.videoMode).toBe('recvonly');
        expect(params.audioMode).toBe('recvonly');
        expect(params.mediaStream).toBe(undefined);

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });
});
