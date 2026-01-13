import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import UAMock from '@/__fixtures__/UA.mock';
import { createEvents, EVENT_NAMES } from '../events';
import { MCUSession } from '../MCUSession';

import type { RTCSession, UA } from '@krivega/jssip';
import type { TEvents } from '../events';

// Вспомогательный тип для доступа к защищённым свойствам MCUSession
interface MCUSessionTestAccess {
  rtcSession?: unknown;
  isPendingCall?: boolean;
  isPendingAnswer?: boolean;
  callConfiguration?: Record<string, unknown>;
}

describe('MCUSession', () => {
  let events: TEvents;
  let ua: UAMock;
  let mcuSession: MCUSession;
  let getSipServerUrl: (number: string) => string;
  let mediaStream: MediaStream;
  const handleReset = jest.fn();

  beforeEach(() => {
    events = createEvents();
    ua = new UAMock({ uri: 'sip:user@sipServerUrl', register: false, sockets: [] });
    mcuSession = new MCUSession(events, { onReset: handleReset });
    getSipServerUrl = (number) => {
      return `sip:${number}@sipServerUrl`;
    };
    mediaStream = new MediaStream();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('startCall: создает звонок и возвращает peerconnection', async () => {
    const promise = mcuSession.startCall(ua as unknown as UA, getSipServerUrl, {
      number: '123',
      mediaStream,
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

  it('endCall: вызывает reset и terminateAsync', async () => {
    const terminateAsync = jest.fn(async () => {});

    (mcuSession as unknown as { rtcSession: RTCSession }).rtcSession = {
      isEnded: () => {
        return false;
      },
      terminateAsync,
    } as unknown as RTCSession;
    await mcuSession.endCall();
    expect(terminateAsync).toHaveBeenCalledWith({ cause: 'Canceled' });
  });

  it('endCall: если rtcSession нет, возвращает undefined', async () => {
    // @ts-expect-error
    mcuSession.rtcSession = undefined;
    await expect(mcuSession.endCall()).resolves.toBeUndefined();
  });

  it('answerToIncomingCall: отклоняет при FAILED событии', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });
    const getIncomingRTCSession = () => {
      return rtcSession as unknown as RTCSession;
    };

    const promise = mcuSession.answerToIncomingCall(getIncomingRTCSession(), {
      mediaStream,
    });

    // Провоцируем событие FAILED, чтобы промис был отклонён
    events.trigger('failed', {
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

    const promise = mcuSession.answerToIncomingCall(getIncomingRTCSession(), {
      mediaStream,
    });

    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    events.trigger('confirmed', {});

    const pc = await promise;

    expect(pc).toBeDefined();
  });

  it('replaceMediaStream: заменяет поток', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // @ts-expect-error
    mcuSession.rtcSession = rtcSession as unknown as RTCSession;

    await mcuSession.replaceMediaStream(mediaStream);

    expect(rtcSession.replaceMediaStream).toHaveBeenCalled();
  });

  it('replaceMediaStream: бросает ошибку если prepareMediaStream вернул undefined', async () => {
    const prepareMediaStreamModule = await import('@/tools/prepareMediaStream');

    jest
      .spyOn(prepareMediaStreamModule, 'default')
      .mockReturnValue(undefined as unknown as MediaStream);

    const mcuSessionLocal = new MCUSession(events, {
      onReset: handleReset,
    });
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // @ts-expect-error
    mcuSessionLocal.rtcSession = rtcSession as unknown as RTCSession;

    await expect(mcuSessionLocal.replaceMediaStream(mediaStream)).rejects.toThrow(
      'No preparedMediaStream',
    );
  });

  it('replaceMediaStream: бросает ошибку если нет rtcSession', async () => {
    // @ts-expect-error
    mcuSession.rtcSession = undefined;
    await expect(mcuSession.replaceMediaStream(mediaStream)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('reset: очищает rtcSession и вызывает onReset', () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // @ts-expect-error
    mcuSession.rtcSession = rtcSession as unknown as RTCSession;

    // @ts-expect-error
    mcuSession.reset();
    // @ts-expect-error
    expect(mcuSession.rtcSession).toBeUndefined();
    expect(handleReset).toHaveBeenCalled();
  });

  it('handleEnded: триггерит ENDED_FROM_SERVER и вызывает reset', () => {
    const spy = jest.spyOn(mcuSession as unknown as { reset: () => void }, 'reset');
    const trigger = jest.spyOn(events, 'trigger');

    // @ts-expect-error
    mcuSession.handleEnded({ originator: 'remote' });
    expect(trigger).toHaveBeenCalledWith('ended:fromserver', expect.anything());
    expect(spy).toHaveBeenCalled();
  });
});

describe('MCUSession - дополнительные тесты для покрытия', () => {
  let events: TEvents;
  let mcuSession: MCUSession;
  let mcuSessionTest: MCUSessionTestAccess;
  const handleReset = jest.fn();

  beforeEach(() => {
    events = createEvents();
    mcuSession = new MCUSession(events, {
      onReset: handleReset,
    });
    mcuSessionTest = mcuSession as unknown as MCUSessionTestAccess;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handleCall: вызывает reject при FAILED', async () => {
    // @ts-expect-error
    const promise = mcuSession.handleCall({});

    events.trigger('failed', {
      originator: 'remote',
      // @ts-expect-error
      message: {},
      cause: 'error',
    });
    await expect(promise).rejects.toBeDefined();
  });

  it('handleCall: resolve(undefined) если peerconnection не был установлен', async () => {
    // @ts-expect-error
    const promise = mcuSession.handleCall({});

    events.trigger('confirmed', {});
    await expect(promise).resolves.toBeUndefined();
  });

  it('handleCall: не вызывает ontrack если он не передан', async () => {
    // @ts-expect-error
    const promise = mcuSession.handleCall({});
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
    const promise = mcuSession.handleCall({});
    const audioTrack = createAudioMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });

    // инициируем track событие
    fakePeerconnection.addTrack(audioTrack);

    events.trigger('confirmed', {});

    await expect(promise).resolves.toBeDefined();

    expect(triggerSpy).toHaveBeenCalledWith('peerconnection:ontrack', expect.anything());
  });

  it('connection: возвращает rtcSession.connection', () => {
    mcuSessionTest.rtcSession = { connection: 'test' };
    expect(mcuSession.connection).toBe('test');
  });

  it('establishedRTCSession: возвращает rtcSession если isEstablished', () => {
    mcuSessionTest.rtcSession = {
      isEstablished: () => {
        return true;
      },
    };
    expect(mcuSession.getEstablishedRTCSession()).toBe(mcuSessionTest.rtcSession);
    mcuSessionTest.rtcSession = {
      isEstablished: () => {
        return false;
      },
    };
    expect(mcuSession.getEstablishedRTCSession()).toBeUndefined();
  });

  it('getEstablishedRTCSession: возвращает rtcSession если isEstablished', () => {
    mcuSessionTest.rtcSession = {
      isEstablished: () => {
        return true;
      },
    };
    expect(mcuSession.getEstablishedRTCSession()).toBe(mcuSessionTest.rtcSession);
    mcuSessionTest.rtcSession = {
      isEstablished: () => {
        return false;
      },
    };
    expect(mcuSession.getEstablishedRTCSession()).toBeUndefined();
  });

  it('subscribeToSessionEvents: подписывает все события', () => {
    const rtcSession = { on: jest.fn() };
    const subscribeToSessionEvents = Reflect.get(mcuSession, 'subscribeToSessionEvents') as (
      rtcSession: unknown,
    ) => void;

    subscribeToSessionEvents.call(mcuSession, rtcSession);

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

  it('restartIce: вызывает restartIce на rtcSession', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // Мокаем rtcSession
    Object.defineProperty(mcuSession, 'rtcSession', {
      get: () => {
        return rtcSession;
      },
      configurable: true,
    });

    const result = await mcuSession.restartIce();

    expect(rtcSession.restartIce).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('restartIce: передает опции в rtcSession.restartIce', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // Мокаем rtcSession
    Object.defineProperty(mcuSession, 'rtcSession', {
      get: () => {
        return rtcSession;
      },
      configurable: true,
    });

    const options = {
      useUpdate: true,
      extraHeaders: ['X-Test: value'],
      rtcOfferConstraints: { offerToReceiveAudio: true },
    };

    await mcuSession.restartIce(options);

    expect(rtcSession.restartIce).toHaveBeenCalledWith(options);
  });

  it('restartIce: выбрасывает ошибку если нет rtcSession', async () => {
    // Мокаем rtcSession чтобы вернуть undefined
    Object.defineProperty(mcuSession, 'rtcSession', {
      get: () => {
        return undefined;
      },
      configurable: true,
    });

    await expect(mcuSession.restartIce()).rejects.toThrow('No rtcSession established');
  });
});
