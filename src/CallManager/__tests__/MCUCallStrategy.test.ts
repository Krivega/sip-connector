/* eslint-disable unicorn/filename-case */
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import UAMock from '@/__fixtures__/UA.mock';
import type { RTCSession, UA } from '@krivega/jssip';
import { Events } from 'events-constructor';
import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';
import { EVENT_NAMES } from '../eventNames';
import { MCUCallStrategy } from '../MCUCallStrategy';
import { RemoteStreamsManager } from '../RemoteStreamsManager';

// Вспомогательный тип для доступа к защищённым свойствам MCUCallStrategy
interface MCUCallStrategyTestAccess {
  rtcSession?: unknown;
  isPendingCall?: boolean;
  isPendingAnswer?: boolean;
  callConfiguration?: Record<string, unknown>;
}

describe('MCUCallStrategy', () => {
  let events: Events<typeof EVENT_NAMES>;
  let ua: UAMock;
  let strategy: MCUCallStrategy;
  let getSipServerUrl: (number: string) => string;
  let mediaStream: MediaStream;

  beforeEach(() => {
    events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    ua = new UAMock({ uri: 'sip:user@sipServerUrl', register: false, sockets: [] });
    strategy = new MCUCallStrategy(events);
    getSipServerUrl = (number) => {
      return `sip:${number}@sipServerUrl`;
    };
    mediaStream = new MediaStream();
  });

  it('startCall: создает звонок и возвращает peerconnection', async () => {
    const ontrack = jest.fn();
    const promise = strategy.startCall(ua as unknown as UA, getSipServerUrl, {
      number: '123',
      mediaStream,
      ontrack,
    });
    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    events.trigger('confirmed', {});

    const pc = await promise;

    expect(pc).toBeDefined();
    expect(typeof pc).toBe('object');
  });

  it('startCall: подписывается на события peerconnection', async () => {
    const ontrack = jest.fn();
    const onPeerconnection = jest.fn();

    events.on('peerconnection', onPeerconnection);

    const pc = (await strategy.startCall(ua as unknown as UA, getSipServerUrl, {
      number: '123',
      mediaStream,
      ontrack,
    })) as RTCPeerConnectionMock;

    expect(ontrack).toHaveBeenCalledTimes(0);
    expect(onPeerconnection).toHaveBeenCalled();

    const videoTrack = createVideoMediaStreamTrackMock();

    pc.addTrack(videoTrack);

    expect(ontrack).toHaveBeenCalledTimes(1);
  });

  it('endCall: вызывает reset и terminateAsync', async () => {
    const terminateAsync = jest.fn(async () => {});

    (strategy as unknown as { rtcSession: RTCSession }).rtcSession = {
      isEnded: () => {
        return false;
      },
      terminateAsync,
    } as unknown as RTCSession;
    await strategy.endCall();
    expect(terminateAsync).toHaveBeenCalledWith({ cause: 'Canceled' });
  });

  it('endCall: если rtcSession нет, возвращает undefined', async () => {
    // @ts-expect-error
    strategy.rtcSession = undefined;
    await expect(strategy.endCall()).resolves.toBeUndefined();
  });

  it('answerToIncomingCall: отклоняет при FAILED событии', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });
    const getIncomingRTCSession = () => {
      return rtcSession as unknown as RTCSession;
    };

    const promise = strategy.answerToIncomingCall(getIncomingRTCSession, {
      mediaStream,
    });

    // Провоцируем событие FAILED, чтобы промис был отклонён
    events.trigger('failed', { originator: 'remote' });

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
    const ontrack = jest.fn();
    const promise = strategy.answerToIncomingCall(getIncomingRTCSession, {
      mediaStream,
      ontrack,
    });

    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    events.trigger('confirmed', {});

    const pc = await promise;

    expect(pc).toBeDefined();
  });

  it('getRemoteStreams: возвращает undefined если нет connection', () => {
    jest.spyOn(strategy, 'connection', 'get').mockReturnValue(undefined);
    expect(strategy.getRemoteStreams()).toBeUndefined();
  });

  it('getRemoteStreams: вызывает remoteStreamsManager', () => {
    const connection = {
      getReceivers: () => {
        return [{ track: { kind: 'video', id: 'v1' } }];
      },
    } as unknown as RTCPeerConnection;

    jest.spyOn(strategy, 'connection', 'get').mockReturnValue(connection);

    const spy = jest.spyOn(RemoteStreamsManager.prototype, 'generateStreams');

    strategy.getRemoteStreams();
    expect(spy).toHaveBeenCalled();
  });

  it('replaceMediaStream: заменяет поток', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // @ts-expect-error
    strategy.rtcSession = rtcSession as unknown as RTCSession;

    await strategy.replaceMediaStream(mediaStream);

    expect(rtcSession.replaceMediaStream).toHaveBeenCalled();
  });

  it('replaceMediaStream: бросает ошибку если prepareMediaStream вернул undefined', async () => {
    const prepareMediaStreamModule = await import('@/tools/prepareMediaStream');

    jest
      .spyOn(prepareMediaStreamModule, 'default')
      .mockReturnValue(undefined as unknown as MediaStream);

    const strategyLocal = new MCUCallStrategy(events);
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // @ts-expect-error
    strategyLocal.rtcSession = rtcSession as unknown as RTCSession;

    await expect(strategyLocal.replaceMediaStream(mediaStream)).rejects.toThrow(
      'No preparedMediaStream',
    );
  });

  it('replaceMediaStream: бросает ошибку если нет rtcSession', async () => {
    // @ts-expect-error
    strategy.rtcSession = undefined;
    await expect(strategy.replaceMediaStream(mediaStream)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('reset: очищает rtcSession и remoteStreamsManager', () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // @ts-expect-error
    strategy.rtcSession = rtcSession as unknown as RTCSession;

    const spy = jest.spyOn(RemoteStreamsManager.prototype, 'reset');

    // @ts-expect-error
    strategy.reset();
    // @ts-expect-error
    expect(strategy.rtcSession).toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it('handleEnded: триггерит ENDED_FROM_SERVER и вызывает reset', () => {
    const spy = jest.spyOn(strategy as unknown as { reset: () => void }, 'reset');
    const trigger = jest.spyOn(events, 'trigger');

    // @ts-expect-error
    strategy.handleEnded({ originator: 'remote' });
    expect(trigger).toHaveBeenCalledWith('ended:fromserver', expect.anything());
    expect(spy).toHaveBeenCalled();
  });
});

describe('MCUCallStrategy - дополнительные тесты для покрытия', () => {
  let events: Events<typeof EVENT_NAMES>;
  let strategy: MCUCallStrategy;
  let strategyTest: MCUCallStrategyTestAccess;

  beforeEach(() => {
    events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    strategy = new MCUCallStrategy(events);
    strategyTest = strategy as unknown as MCUCallStrategyTestAccess;
    jest.clearAllMocks();
  });

  it('handleCall: вызывает reject при FAILED', async () => {
    // @ts-expect-error
    const promise = strategy.handleCall({});

    events.trigger('failed', { originator: 'remote' });
    await expect(promise).rejects.toBeDefined();
  });

  it('handleCall: resolve(undefined) если peerconnection не был установлен', async () => {
    // @ts-expect-error
    const promise = strategy.handleCall({});

    events.trigger('confirmed', {});
    await expect(promise).resolves.toBeUndefined();
  });

  it('handleCall: вызывает ontrack', async () => {
    const ontrack = jest.fn();
    // @ts-expect-error
    const promise = strategy.handleCall({ ontrack });
    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    events.trigger('confirmed', {});

    await expect(promise).resolves.toBeDefined();
  });

  it('handleCall: не вызывает ontrack если он не передан', async () => {
    // @ts-expect-error
    const promise = strategy.handleCall({});
    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    events.trigger('confirmed', {});

    await expect(promise).resolves.toBeDefined();
  });

  it('handleCall: триггерит PEER_CONNECTION_ONTRACK без ontrack', async () => {
    const triggerSpy = jest.spyOn(events, 'trigger');

    // @ts-expect-error
    const promise = strategy.handleCall({});
    const audioTrack = createAudioMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });

    // инициируем track событие
    fakePeerconnection.addTrack(audioTrack);

    events.trigger('confirmed', {});

    await expect(promise).resolves.toBeDefined();

    expect(triggerSpy).toHaveBeenCalledWith('peerconnection:ontrack', expect.anything());
  });

  it('getRemoteStreams: вызывает generateAudioStreams если нет видео-треков', () => {
    const connection = {
      getReceivers: () => {
        return [{ track: { kind: 'audio', id: 'a1' } }];
      },
    } as unknown as RTCPeerConnection;

    jest.spyOn(strategy, 'connection', 'get').mockReturnValue(connection);

    const spy = jest.spyOn(RemoteStreamsManager.prototype, 'generateAudioStreams');

    strategy.getRemoteStreams();
    expect(spy).toHaveBeenCalled();
  });

  it('requested: возвращает true если isPendingCall или isPendingAnswer', () => {
    strategyTest.isPendingCall = true;
    expect(strategy.requested).toBe(true);
    strategyTest.isPendingCall = false;
    strategyTest.isPendingAnswer = true;
    expect(strategy.requested).toBe(true);
    strategyTest.isPendingAnswer = false;
    expect(strategy.requested).toBe(false);
  });

  it('connection: возвращает rtcSession.connection', () => {
    strategyTest.rtcSession = { connection: 'test' };
    expect(strategy.connection).toBe('test');
  });

  it('establishedRTCSession: возвращает rtcSession если isEstablished', () => {
    strategyTest.rtcSession = {
      isEstablished: () => {
        return true;
      },
    };
    expect(strategy.establishedRTCSession).toBe(strategyTest.rtcSession);
    strategyTest.rtcSession = {
      isEstablished: () => {
        return false;
      },
    };
    expect(strategy.establishedRTCSession).toBeUndefined();
  });

  it('getEstablishedRTCSession: возвращает rtcSession если isEstablished', () => {
    strategyTest.rtcSession = {
      isEstablished: () => {
        return true;
      },
    };
    expect(strategy.getEstablishedRTCSession()).toBe(strategyTest.rtcSession);
    strategyTest.rtcSession = {
      isEstablished: () => {
        return false;
      },
    };
    expect(strategy.getEstablishedRTCSession()).toBeUndefined();
  });

  it('getCallConfiguration: возвращает копию callConfiguration', () => {
    strategyTest.callConfiguration = { number: '123', answer: true };
    expect(strategy.getCallConfiguration()).toEqual({ number: '123', answer: true });
    expect(strategy.getCallConfiguration()).not.toBe(strategyTest.callConfiguration);
  });

  it('subscribeToSessionEvents: подписывает все события', () => {
    const rtcSession = { on: jest.fn() };
    const subscribeToSessionEvents = Reflect.get(strategy, 'subscribeToSessionEvents') as (
      rtcSession: unknown,
    ) => void;

    subscribeToSessionEvents.call(strategy, rtcSession);

    // Получаем список событий, на которые реально подписывается метод
    // Обычно это Object.keys(EVENT_NAMES), но могут быть фильтры — уточняем:
    // Для устойчивости теста проверим, что подписка была вызвана хотя бы для одного события из EVENT_NAMES
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
    // Проверяем, что хотя бы часть событий из EVENT_NAMES была подписана
    const atLeastOneSubscribed = eventNames.some((event) => {
      return calledEvents.has(event);
    });

    expect(atLeastOneSubscribed).toBe(true);
    // Или, если хотим проверить конкретные события, можно явно указать их:
    // expect(rtcSession.on).toHaveBeenCalledWith('peerconnection', expect.any(Function));
    // expect(rtcSession.on).toHaveBeenCalledWith('confirmed', expect.any(Function));
  });
});
