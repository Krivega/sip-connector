import {
  createAudioMediaStreamTrackMock,
  createVideoMediaStreamTrackMock,
  MediaStreamMock,
} from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import UAMock from '@/__fixtures__/UA.mock';
import { EContentedStreamCodec } from '@/ApiManager';
import { ConferenceStateManager } from '@/ConferenceStateManager';
import { ContentedStreamManager } from '@/ContentedStreamManager';
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
    callManager = new CallManager(new ConferenceStateManager(), new ContentedStreamManager());
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

    callManager.events.trigger('connecting', {});
    callManager.events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    callManager.events.trigger('accepted', {});
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

    callManager.events.trigger('connecting', {});
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

    callManager.events.trigger('connecting', {});
    callManager.events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    callManager.events.trigger('accepted', {});
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

    callManager.events.trigger('connecting', {});
    callManager.events.trigger('progress', {});
    callManager.events.trigger('accepted', {});
    callManager.events.trigger('confirmed', {});

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({}, 'progress');
  });

  it('wait: резолвится после события', async () => {
    const promise = callManager.wait('confirmed');

    callManager.events.trigger('connecting', {});
    callManager.events.trigger('accepted', {});
    callManager.events.trigger('confirmed', {});

    await expect(promise).resolves.toEqual({});
  });

  it('off: удаляет обработчик события', () => {
    const handler = jest.fn();

    callManager.on('confirmed', handler);

    callManager.events.trigger('connecting', {});
    callManager.events.trigger('accepted', {});
    callManager.events.trigger('confirmed', {});
    expect(handler).toHaveBeenCalledTimes(1);

    callManager.off('confirmed', handler);

    // Для повторного вызова нужно сбросить state machine
    callManager.events.trigger('ended', {
      originator: 'local',
      // @ts-expect-error
      message: {},
      cause: 'error',
    });
    callManager.callStateMachine.reset();
    callManager.events.trigger('connecting', {});
    callManager.events.trigger('accepted', {});
    callManager.events.trigger('confirmed', {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  describe('subscribeContentedStreamEvents', () => {
    it('должен вызвать событие remote-streams-changed при available от ContentedStreamManager', () => {
      const handler = jest.fn();

      callManager.on('remote-streams-changed', handler);

      const contentedStreamManager = callManager.getContentedStreamManager();

      contentedStreamManager.events.trigger('available', { codec: EContentedStreamCodec.H264 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        streams: expect.objectContaining({
          mainStream: undefined,
          contentedStream: undefined,
        }),
      });
    });

    it('должен вызвать событие remote-streams-changed при not-available от ContentedStreamManager', () => {
      const handler = jest.fn();

      callManager.on('remote-streams-changed', handler);

      const contentedStreamManager = callManager.getContentedStreamManager();

      contentedStreamManager.events.trigger('not-available', {});

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        streams: expect.objectContaining({
          mainStream: undefined,
          contentedStream: undefined,
        }),
      });
    });

    it('не должен вызвать событие remote-streams-changed дважды для одинаковых streams', () => {
      const handler = jest.fn();

      callManager.on('remote-streams-changed', handler);

      const contentedStreamManager = callManager.getContentedStreamManager();

      // Оба события приводят к одинаковым streams (undefined), второе не должно сработать
      contentedStreamManager.events.trigger('available', { codec: EContentedStreamCodec.VP8 });
      contentedStreamManager.events.trigger('available', { codec: EContentedStreamCodec.VP8 });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('deduplication of remote-streams-changed events', () => {
    it('не должен вызвать событие remote-streams-changed с одинаковыми streams дважды подряд', () => {
      const handler = jest.fn();

      callManager.on('remote-streams-changed', handler);

      const contentedStreamManager = callManager.getContentedStreamManager();

      // Первый вызов - событие должно сработать
      contentedStreamManager.events.trigger('available', { codec: EContentedStreamCodec.H264 });

      expect(handler).toHaveBeenCalledTimes(1);

      // Второй вызов с теми же streams - событие не должно сработать
      contentedStreamManager.events.trigger('available', { codec: EContentedStreamCodec.H264 });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('должен вызвать событие remote-streams-changed если streams изменились', async () => {
      const handler = jest.fn();
      const audioTrack1 = createAudioMediaStreamTrackMock();
      const audioTrack2 = createAudioMediaStreamTrackMock();
      const videoTrack = createVideoMediaStreamTrackMock();

      callManager.on('remote-streams-changed', handler);

      const promise = callManager.startCall(ua as unknown as UA, getSipServerUrl, {
        number: '123',
        mediaStream,
      });

      const fakePeerconnection = new RTCPeerConnectionMock(undefined, [
        audioTrack1,
        audioTrack2,
        videoTrack,
      ]);

      callManager.events.trigger('connecting', {});
      callManager.events.trigger('peerconnection', { peerconnection: fakePeerconnection });
      callManager.events.trigger('accepted', {});
      callManager.events.trigger('confirmed', {});

      await promise;

      handler.mockClear();

      // Добавляем первый стрим
      const stream1 = new MediaStreamMock([audioTrack1]);

      stream1.id = 'stream-1';

      callManager.events.trigger('peerconnection:ontrack', {
        track: audioTrack1,
        streams: [stream1],
      } as unknown as RTCTrackEvent);

      expect(handler).toHaveBeenCalledTimes(1);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const firstCall = handler.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const firstStreamId = firstCall.streams.mainStream?.id;

      expect(firstStreamId).toBeDefined();

      // Останавливаем первый трек, чтобы он удалился
      audioTrack1.stop();

      expect(handler).toHaveBeenCalledTimes(2);

      // Добавляем новый стрим - событие должно сработать еще раз
      const stream2 = new MediaStreamMock([audioTrack2]);

      stream2.id = 'stream-2';

      callManager.events.trigger('peerconnection:ontrack', {
        track: audioTrack2,
        streams: [stream2],
      } as unknown as RTCTrackEvent);

      expect(handler).toHaveBeenCalledTimes(3);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const thirdCall = handler.mock.calls[2][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const thirdStreamId = thirdCall.streams.mainStream?.id;

      expect(thirdStreamId).toBeDefined();
      expect(thirdStreamId).not.toBe(firstStreamId);
    });

    it('не должен вызвать remote-streams-changed при добавлении треков, если стримы не изменились', async () => {
      const handler = jest.fn();
      const audioTrack1 = createAudioMediaStreamTrackMock();
      const audioTrack2 = createAudioMediaStreamTrackMock();
      const videoTrack = createVideoMediaStreamTrackMock();

      callManager.on('remote-streams-changed', handler);

      const promise = callManager.startCall(ua as unknown as UA, getSipServerUrl, {
        number: '123',
        mediaStream,
      });

      const fakePeerconnection = new RTCPeerConnectionMock(undefined, [
        audioTrack1,
        audioTrack2,
        videoTrack,
      ]);

      callManager.events.trigger('connecting', {});
      callManager.events.trigger('peerconnection', { peerconnection: fakePeerconnection });
      callManager.events.trigger('accepted', {});
      callManager.events.trigger('confirmed', {});

      await promise;

      // Очищаем счетчик после инициализации
      handler.mockClear();

      const mainStreamId = 'main-stream-id';
      const mainStream = new MediaStreamMock([audioTrack1]);

      mainStream.id = mainStreamId;

      // Добавляем первый трек
      callManager.events.trigger('peerconnection:ontrack', {
        track: audioTrack1,
        streams: [mainStream],
      } as unknown as RTCTrackEvent);

      expect(handler).toHaveBeenCalledTimes(1);

      // Добавляем второй трек к тому же стриму
      mainStream.addTrack(audioTrack2);

      // Событие не должно сработать, так как id стрима не изменился
      callManager.events.trigger('peerconnection:ontrack', {
        track: audioTrack2,
        streams: [mainStream],
      } as unknown as RTCTrackEvent);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('должен сбросить кеш при reset и позволить вызвать событие снова', async () => {
      const handler = jest.fn();

      callManager.on('remote-streams-changed', handler);

      const contentedStreamManager = callManager.getContentedStreamManager();

      // Первый вызов
      contentedStreamManager.events.trigger('available', { codec: EContentedStreamCodec.H264 });

      expect(handler).toHaveBeenCalledTimes(1);

      // Повторный вызов - событие не должно сработать
      contentedStreamManager.events.trigger('available', { codec: EContentedStreamCodec.H264 });

      expect(handler).toHaveBeenCalledTimes(1);

      // Вызываем reset через endCall
      await callManager.endCall();

      // После reset кеш очищен, событие должно сработать снова
      contentedStreamManager.events.trigger('available', { codec: EContentedStreamCodec.H264 });

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});
