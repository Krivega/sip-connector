/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import delayPromise from '../__fixtures__/delayPromise';
import JsSIP from '../__fixtures__/jssip.mock';
import remoteCallerData from '../__fixtures__/remoteCallerData';
import { doMockSipConnector } from '../src/doMock';
import type SipConnector from '../src/SipConnector';

describe('incoming call', () => {
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mockFunction = jest.fn();

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
    mockFunction = jest.fn();
  });

  it('init', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.isAvailableIncomingCall).toBe(false);

    try {
      await sipConnector.answerToIncomingCall({ mediaStream });
    } catch {
      expect(true).toBe(true);
    }

    try {
      await sipConnector.declineToIncomingCall();
    } catch {
      expect(true).toBe(true);
    }
  });

  it('answer', async () => {
    expect.assertions(7);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on(
        'incomingCall',
        async ({
          displayName,
          host,
          incomingNumber,
        }: {
          displayName: string;
          host: string;
          incomingNumber: string;
        }) => {
          expect(sipConnector.isAvailableIncomingCall).toBe(true);
          expect(displayName).toBe(remoteCallerData.displayName);
          expect(host).toBe(remoteCallerData.host);
          expect(incomingNumber).toBe(remoteCallerData.incomingNumber);

          await delayPromise(100); // wait for to decline incoming call

          const peerconnection = await sipConnector.answerToIncomingCall({
            mediaStream,
            ontrack: mockFunction,
          });

          expect(sipConnector.getConnectionConfiguration().answer).toBe(true);
          expect(!!peerconnection).toBe(true);
          // @ts-expect-error
          expect(sipConnector.rtcSession.answer.mock.calls.length).toBe(1);

          resolve();
        },
      );

      // @ts-expect-error
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

      // @ts-expect-error
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
          ontrack: mockFunction,
        });

        // @ts-expect-error
        expect(peerconnection._senders[0].track.kind).toBe('audio');
        // @ts-expect-error
        expect(peerconnection._senders[1].track.kind).toBe('video');

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('order tracks mediaStream: answer: reverse', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call

        // @ts-expect-error
        mediaStream.tracks.reverse();

        const peerconnection = await sipConnector.answerToIncomingCall({
          mediaStream,
          ontrack: mockFunction,
        });

        // @ts-expect-error
        expect(peerconnection._senders[0].track.kind).toBe('audio');
        // @ts-expect-error
        expect(peerconnection._senders[1].track.kind).toBe('video');

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('decline', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise((resolve) => {
      sipConnector.on('incomingCall', async () => {
        return delayPromise(100).then(resolve);
      }); // wait for to decline incoming call);

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    })
      .then(async () => {
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
      .then(([{ displayName, host, incomingNumber }, incomingRTCSession]) => {
        // @ts-expect-error
        expect(incomingRTCSession.status_code).toBe(487);
        expect(incomingNumber).toBe(remoteCallerData.incomingNumber);
        expect(host).toBe(remoteCallerData.host);
        expect(displayName).toBe(remoteCallerData.displayName);
      });
  });

  it('failed', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise((resolve) => {
      sipConnector.on('incomingCall', async () => {
        return delayPromise(100).then(resolve);
      }); // wait for to decline incoming call);

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    })
      .then(async () => {
        return new Promise<{
          displayName: string;
          host: string;
          incomingNumber: string;
        }>((resolve) => {
          sipConnector.on('failedIncomingCall', resolve);

          JsSIP.triggerFailIncomingSession(sipConnector.incomingRTCSession);
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
      sipConnector.on('incomingCall', async () => {
        return delayPromise(100).then(resolve);
      }); // wait for to decline incoming call);

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    })
      .then(async () => {
        return new Promise<{
          displayName: string;
          host: string;
          incomingNumber: string;
        }>((resolve) => {
          sipConnector.on('terminatedIncomingCall', resolve);

          JsSIP.triggerFailIncomingSession(sipConnector.incomingRTCSession, {
            originator: 'local',
          });
        });
      })
      .then(({ displayName, host, incomingNumber }) => {
        expect(incomingNumber).toBe(remoteCallerData.incomingNumber);
        expect(host).toBe(remoteCallerData.host);
        expect(displayName).toBe(remoteCallerData.displayName);
      });
  });

  it('answer without directionVideo and directionAudio', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call
        await sipConnector.answerToIncomingCall({
          mediaStream,
          ontrack: mockFunction,
        });

        // @ts-expect-error
        const parameters = sipConnector.rtcSession.answer.mock.calls[0][0];

        expect(parameters.directionVideo).toBe(undefined);
        expect(parameters.directionAudio).toBe(undefined);
        expect(parameters.mediaStream.getVideoTracks().length).toBe(1);
        expect(parameters.mediaStream.getAudioTracks().length).toBe(1);

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('answer with directionVideo=recvonly', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call
        await sipConnector.answerToIncomingCall({
          mediaStream,
          directionVideo: 'recvonly',
          ontrack: mockFunction,
        });

        // @ts-expect-error
        const parameters = sipConnector.rtcSession.answer.mock.calls[0][0];

        expect(parameters.directionVideo).toBe('recvonly');
        expect(parameters.directionAudio).toBe(undefined);
        expect(parameters.mediaStream.getVideoTracks().length).toBe(0);
        expect(parameters.mediaStream.getAudioTracks().length).toBe(1);

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('answer with directionAudio=recvonly', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call
        await sipConnector.answerToIncomingCall({
          mediaStream,
          directionAudio: 'recvonly',
          ontrack: mockFunction,
        });

        // @ts-expect-error
        const parameters = sipConnector.rtcSession.answer.mock.calls[0][0];

        expect(parameters.directionVideo).toBe(undefined);
        expect(parameters.directionAudio).toBe('recvonly');
        expect(parameters.mediaStream.getVideoTracks().length).toBe(1);
        expect(parameters.mediaStream.getAudioTracks().length).toBe(0);

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('answer with directionVideo=recvonly directionAudio=recvonly', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await delayPromise(100); // wait for to decline incoming call
        await sipConnector.answerToIncomingCall({
          mediaStream,
          directionVideo: 'recvonly',
          directionAudio: 'recvonly',
          ontrack: mockFunction,
        });

        // @ts-expect-error
        const parameters = sipConnector.rtcSession.answer.mock.calls[0][0];

        expect(parameters.directionVideo).toBe('recvonly');
        expect(parameters.directionAudio).toBe('recvonly');
        expect(parameters.mediaStream).toBe(undefined);

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });
});
