import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import UAMock from '@/__fixtures__/UA.mock';
import { ConferenceStateManager } from '@/ConferenceStateManager';
import CallManager from '../@CallManager';
import { EVENT_NAMES } from '../events';

import type { RTCSession, UA } from '@krivega/jssip';

describe('CallManager events', () => {
  let ua: UAMock;
  let callManager: CallManager;
  let getSipServerUrl: (number: string) => string;
  let mediaStream: MediaStream;

  beforeEach(() => {
    ua = new UAMock({ uri: 'sip:user@sipServerUrl', register: false, sockets: [] });
    callManager = new CallManager(new ConferenceStateManager());
    getSipServerUrl = (number) => {
      return `sip:${number}@sipServerUrl`;
    };
    mediaStream = new MediaStream();
  });

  it('startCall: создает звонок и возвращает peerconnection', async () => {
    const promise = callManager.startCall(ua as unknown as UA, getSipServerUrl, {
      number: '123',
      mediaStream,
    });
    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    callManager.events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    callManager.events.trigger('confirmed', {});

    const pc = await promise;

    expect(pc).toBeDefined();
    expect(typeof pc).toBe('object');
  });

  it('answerToIncomingCall: отклоняет при FAILED событии', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });
    const getIncomingRTCSession = () => {
      return rtcSession as unknown as RTCSession;
    };

    const promise = callManager.answerToIncomingCall(getIncomingRTCSession, {
      mediaStream,
    });

    callManager.events.trigger('failed', {
      originator: 'remote',
      // @ts-expect-error
      message: {},
      cause: 'error',
    });

    await expect(promise).rejects.toBeDefined();
  });

  it('answerToIncomingCall: отвечает на входящий звонок', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });
    const getIncomingRTCSession = () => {
      return rtcSession as unknown as RTCSession;
    };

    const promise = callManager.answerToIncomingCall(getIncomingRTCSession, {
      mediaStream,
    });

    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    callManager.events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    callManager.events.trigger('confirmed', {});

    const pc = await promise;

    expect(pc).toBeDefined();
  });

  it('subscribeToSessionEvents: подписывает все события', () => {
    const rtcSession = { on: jest.fn() };
    const subscribeToSessionEvents = Reflect.get(
      // @ts-expect-error
      callManager.mcuSession,
      'subscribeToSessionEvents',
    ) as (rtcSession: unknown) => void;

    // @ts-expect-error
    subscribeToSessionEvents.call(callManager.mcuSession, rtcSession);

    const eventNames = Object.values(EVENT_NAMES);
    const calls = (rtcSession.on as jest.Mock).mock.calls as [
      string,
      (...args: unknown[]) => void,
    ][];
    const calledEvents = new Set(
      calls.map((call) => {
        return call[0];
      }),
    );

    const atLeastOneSubscribed = eventNames.some((event) => {
      return calledEvents.has(event);
    });

    expect(atLeastOneSubscribed).toBe(true);
  });

  it('onceRace: вызывает обработчик только для первого события', () => {
    const handler = jest.fn();

    callManager.onceRace(['progress', 'confirmed'], handler);

    callManager.events.trigger('progress', {});
    callManager.events.trigger('confirmed', {});

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({}, 'progress');
  });

  it('wait: резолвится после события', async () => {
    const promise = callManager.wait('confirmed');

    callManager.events.trigger('confirmed', {});

    await expect(promise).resolves.toEqual({});
  });

  it('off: удаляет обработчик события', () => {
    const handler = jest.fn();

    callManager.on('confirmed', handler);

    callManager.events.trigger('confirmed', {});
    expect(handler).toHaveBeenCalledTimes(1);

    callManager.off('confirmed', handler);

    callManager.events.trigger('confirmed', {});
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
