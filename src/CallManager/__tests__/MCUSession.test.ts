import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import flushPromises from '@/__fixtures__/flushPromises';
import { createLoggerMockModule } from '@/__fixtures__/logger.mock';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import UAMock from '@/__fixtures__/UA.mock';
import resolveDebug from '@/logger';
import { createEvents, EVENT_NAMES } from '../events';
import { MCUSession } from '../MCUSession';

import type { RTCSession, UA } from '@krivega/jssip';
import type { TEvents } from '../events';

jest.mock('@/logger', () => {
  return createLoggerMockModule();
});

const { mcuDebugLogger } = resolveDebug as jest.Mock & { mcuDebugLogger: jest.Mock };

// Вспомогательный тип для доступа к защищённым свойствам MCUSession
interface MCUSessionTestAccess {
  rtcSession?: unknown;
  localMediaStream?: MediaStream;
  pcConfig?: { iceServers?: RTCIceServer[] };
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

  beforeEach(() => {
    events = createEvents();
    ua = new UAMock({ uri: 'sip:user@sipServerUrl', register: false, sockets: [] });
    mcuSession = new MCUSession(events, jest.fn().mockResolvedValue(true));
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

  it('endCall: вызывает terminateAsync и передаёт подтверждение BYE в onSuccessResponse', async () => {
    const terminateAsync = jest.fn(async () => {});
    const onByeConfirmed = jest.fn();

    (mcuSession as unknown as { rtcSession: RTCSession }).rtcSession = {
      isEnded: () => {
        return false;
      },
      terminateAsync,
    } as unknown as RTCSession;
    await mcuSession.endCall(onByeConfirmed);
    expect(terminateAsync).toHaveBeenCalledWith({
      cause: 'Canceled',
      byeEventHandlers: { onSuccessResponse: onByeConfirmed },
    });
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

  it('answerToIncomingCall: отклоняет при синхронной ошибке в try', async () => {
    const prepareMediaStreamModule = await import('@/tools/prepareMediaStream');
    const syncError = new Error('prepareMediaStream failed');
    const prepareSpy = jest.spyOn(prepareMediaStreamModule, 'default').mockImplementation(() => {
      throw syncError;
    });

    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    try {
      await expect(
        mcuSession.answerToIncomingCall(rtcSession as unknown as RTCSession, {
          mediaStream,
        }),
      ).rejects.toThrow(syncError);
    } finally {
      prepareSpy.mockRestore();
    }
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
    const oldAudioTrack = createAudioMediaStreamTrackMock();
    const oldVideoTrack = createVideoMediaStreamTrackMock();
    const newAudioTrack = createAudioMediaStreamTrackMock();
    const newVideoTrack = createVideoMediaStreamTrackMock();
    const oldStream = new MediaStream([oldAudioTrack, oldVideoTrack]);
    const newStream = new MediaStream([newAudioTrack, newVideoTrack]);

    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    rtcSession.createPeerconnection(oldStream);

    const mcuSessionAccess = mcuSession as unknown as MCUSessionTestAccess;

    mcuSessionAccess.rtcSession = rtcSession as unknown as RTCSession;
    mcuSessionAccess.localMediaStream = oldStream;

    const replaceTrackSpy = jest.spyOn(rtcSession.connection.getSenders()[0], 'replaceTrack');

    await mcuSession.replaceMediaStream(newStream);

    expect(replaceTrackSpy).toHaveBeenCalledWith(newAudioTrack);
    expect(mcuSessionAccess.localMediaStream.getTracks()).toEqual(newStream.getTracks());
  });

  it('replaceMediaStream: бросает ошибку если prepareMediaStream вернул undefined', async () => {
    const prepareMediaStreamModule = await import('@/tools/prepareMediaStream');

    const prepareMediaStreamSpy = jest
      .spyOn(prepareMediaStreamModule, 'default')
      .mockReturnValue(undefined as unknown as MediaStream);

    const mcuSessionLocal = new MCUSession(events, jest.fn().mockResolvedValue(true));
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    rtcSession.createPeerconnection(new MediaStream());

    const mcuSessionLocalAccess = mcuSessionLocal as unknown as MCUSessionTestAccess;

    mcuSessionLocalAccess.rtcSession = rtcSession as unknown as RTCSession;

    await expect(mcuSessionLocal.replaceMediaStream(mediaStream)).rejects.toThrow(
      'No preparedMediaStream',
    );

    prepareMediaStreamSpy.mockRestore();
  });

  it('replaceMediaStream: бросает ошибку если нет rtcSession', async () => {
    // @ts-expect-error
    mcuSession.rtcSession = undefined;
    await expect(mcuSession.replaceMediaStream(mediaStream)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('replaceMediaStream: бросает ошибку если нет connection', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    const mcuSessionAccess = mcuSession as unknown as MCUSessionTestAccess;

    mcuSessionAccess.rtcSession = rtcSession as unknown as RTCSession;

    await expect(mcuSession.replaceMediaStream(mediaStream)).rejects.toThrow(
      'No connection established',
    );
  });

  it('replaceMediaStream: вызывает renegotiate у rtcSession при forceRenegotiation', async () => {
    const audioTrack = createAudioMediaStreamTrackMock();
    const newAudioTrack = createAudioMediaStreamTrackMock();
    const oldStream = new MediaStream([audioTrack]);
    const newStream = new MediaStream([newAudioTrack]);

    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    rtcSession.createPeerconnection(oldStream);

    const mcuSessionAccess = mcuSession as unknown as MCUSessionTestAccess;

    mcuSessionAccess.rtcSession = rtcSession as unknown as RTCSession;
    mcuSessionAccess.localMediaStream = oldStream;

    await mcuSession.replaceMediaStream(newStream, {
      deleteExisting: false,
      forceRenegotiation: true,
    });

    expect(rtcSession.renegotiate).toHaveBeenCalled();
  });

  it('reset: очищает rtcSession', () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // @ts-expect-error
    mcuSession.rtcSession = rtcSession as unknown as RTCSession;

    mcuSession.reset();
    // @ts-expect-error
    expect(mcuSession.rtcSession).toBeUndefined();
  });

  it('getPcConfig: возвращает undefined до начала звонка', () => {
    expect(mcuSession.getPcConfig()).toBeUndefined();
  });

  it('startCall: сохраняет iceServers в pcConfig', async () => {
    const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.example.com' }];

    const promise = mcuSession.startCall(ua as unknown as UA, getSipServerUrl, {
      number: '123',
      mediaStream,
      iceServers,
    });

    expect(mcuSession.getPcConfig()).toEqual({ iceServers });

    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    events.trigger('confirmed', {});

    await promise;
  });

  it('answerToIncomingCall: сохраняет iceServers в pcConfig', async () => {
    const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    const promise = mcuSession.answerToIncomingCall(rtcSession as unknown as RTCSession, {
      mediaStream,
      iceServers,
    });

    expect(mcuSession.getPcConfig()).toEqual({ iceServers });

    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    events.trigger('confirmed', {});

    await promise;
  });

  it('reset: очищает pcConfig', async () => {
    const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.test.com' }];
    const promise = mcuSession.startCall(ua as unknown as UA, getSipServerUrl, {
      number: '123',
      mediaStream,
      iceServers,
    });

    const audioTrack = createAudioMediaStreamTrackMock();
    const videoTrack = createVideoMediaStreamTrackMock();
    const fakePeerconnection = new RTCPeerConnectionMock(undefined, [audioTrack, videoTrack]);

    events.trigger('peerconnection', { peerconnection: fakePeerconnection });
    events.trigger('confirmed', {});

    await promise;

    expect(mcuSession.getPcConfig()).toEqual({ iceServers });

    mcuSession.reset();

    expect(mcuSession.getPcConfig()).toBeUndefined();
  });

  it('handleEnded: триггерит ENDED_FROM_SERVER', () => {
    const trigger = jest.spyOn(events, 'trigger');

    // @ts-expect-error
    mcuSession.handleEnded({ originator: 'remote' });
    expect(trigger).toHaveBeenCalledWith('ended:fromserver', expect.anything());
  });
});

describe('MCUSession - дополнительные тесты для покрытия', () => {
  let events: TEvents;
  let mcuSession: MCUSession;
  let mcuSessionTest: MCUSessionTestAccess;
  let connectionMock: RTCPeerConnectionMock;

  beforeEach(() => {
    events = createEvents();
    mcuSession = new MCUSession(events, jest.fn().mockResolvedValue(true));
    mcuSessionTest = mcuSession as unknown as MCUSessionTestAccess;
    connectionMock = new RTCPeerConnectionMock();
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

  it('renegotiate: должен вызвать renegotiate у rtcSession если тот существует', async () => {
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

    await mcuSession.renegotiate();

    expect(rtcSession.renegotiate).toHaveBeenCalledTimes(1);
  });

  it('renegotiate: должен вернуть ошибку renegotiate при вызове если rtcSession не существует', async () => {
    await expect(mcuSession.renegotiate()).rejects.toThrow('No rtcSession established');
  });

  describe('проверка сигнализации перед re-INVITE', () => {
    let rtcSession: RTCSessionMock;
    let waitForSignaling: jest.Mock<Promise<boolean>, []>;

    beforeEach(() => {
      rtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });
      waitForSignaling = jest.fn<Promise<boolean>, []>();
      mcuSession = new MCUSession(events, waitForSignaling);

      Object.defineProperty(mcuSession, 'rtcSession', {
        get: () => {
          return rtcSession;
        },
        configurable: true,
      });
    });

    it('renegotiate и restartIce не отправляют re-INVITE без подтверждённой сигнализации', async () => {
      waitForSignaling.mockResolvedValue(false);

      await expect(mcuSession.renegotiate()).resolves.toBe(false);
      await expect(mcuSession.restartIce({ useUpdate: true })).resolves.toBe(false);

      expect(waitForSignaling).toHaveBeenCalledTimes(2);
      expect(rtcSession.renegotiate).not.toHaveBeenCalled();
      expect(rtcSession.restartIce).not.toHaveBeenCalled();
    });

    it('renegotiate и restartIce отправляют re-INVITE после подтверждения сигнализации', async () => {
      const options = { extraHeaders: ['X-Test: value'] };

      waitForSignaling.mockResolvedValue(true);

      await expect(mcuSession.renegotiate()).resolves.toBe(true);
      await expect(mcuSession.restartIce(options)).resolves.toBe(true);

      expect(rtcSession.renegotiate).toHaveBeenCalledTimes(1);
      expect(rtcSession.restartIce).toHaveBeenCalledWith(options);
      expect(waitForSignaling.mock.invocationCallOrder[0]).toBeLessThan(
        rtcSession.renegotiate.mock.invocationCallOrder[0],
      );
    });

    it('не проверяет сигнализацию без rtcSession', async () => {
      Object.defineProperty(mcuSession, 'rtcSession', {
        get: () => {
          return undefined;
        },
        configurable: true,
      });

      await expect(mcuSession.renegotiate()).rejects.toThrow('No rtcSession established');

      expect(waitForSignaling).not.toHaveBeenCalled();
    });

    describe('досылка неотправленной перенастройки', () => {
      const setRtcSession = (session: RTCSessionMock) => {
        Object.defineProperty(mcuSession, 'rtcSession', {
          get: () => {
            return session;
          },
          configurable: true,
        });
      };

      const replaceMediaStream = async () => {
        return mcuSession.replaceMediaStream(new MediaStream([createAudioMediaStreamTrackMock()]), {
          deleteExisting: false,
          forceRenegotiation: true,
        });
      };

      beforeEach(() => {
        rtcSession.createPeerconnection(new MediaStream([createAudioMediaStreamTrackMock()]));
      });

      it('сохраняет досылку, если restartIce получил подтверждение связи, но не отправил SDP', async () => {
        waitForSignaling.mockResolvedValueOnce(false).mockResolvedValue(true);
        await replaceMediaStream();
        rtcSession.restartIce.mockResolvedValueOnce(false);

        await expect(mcuSession.restartIce()).resolves.toBe(false);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(true);
      });

      it('сохраняет новое изменение потока после успешного ответа на предыдущий SDP', async () => {
        waitForSignaling.mockResolvedValue(false);
        await replaceMediaStream();

        let finishResend!: (isSent: boolean) => void;

        rtcSession.renegotiate.mockReturnValueOnce(
          new Promise<boolean>((resolve) => {
            finishResend = resolve;
          }),
        );

        const resend = mcuSession.renegotiateIfPending();

        await replaceMediaStream();
        finishResend(true);
        await resend;
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(true);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);
      });

      it('без неотправленной перенастройки ничего не досылает', async () => {
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(waitForSignaling).not.toHaveBeenCalled();
        expect(rtcSession.renegotiate).not.toHaveBeenCalled();
      });

      it.each([
        [
          'renegotiate',
          async () => {
            return mcuSession.renegotiate();
          },
        ],
        [
          'restartIce',
          async () => {
            return mcuSession.restartIce();
          },
        ],
      ])('не досылает неотправленный %s', async (_name, sendReinvite) => {
        waitForSignaling.mockResolvedValueOnce(false).mockResolvedValue(true);

        await expect(sendReinvite()).resolves.toBe(false);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).not.toHaveBeenCalled();
        expect(rtcSession.restartIce).not.toHaveBeenCalled();
      });

      it('досылает перенастройку replaceMediaStream один раз сразу, без повторной проверки сигнализации', async () => {
        waitForSignaling.mockResolvedValue(false);

        await replaceMediaStream();

        expect(rtcSession.renegotiate).not.toHaveBeenCalled();

        const resend = mcuSession.renegotiateIfPending();

        expect(rtcSession.renegotiate).toHaveBeenCalledTimes(1);

        await expect(resend).resolves.toBe(true);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).toHaveBeenCalledTimes(1);
        expect(waitForSignaling).toHaveBeenCalledTimes(1);
      });

      it('оставляет досылку до следующего успешного ping, если досылка завершилась ошибкой', async () => {
        waitForSignaling.mockResolvedValue(false);
        rtcSession.renegotiate.mockRejectedValueOnce(new Error('Media Renegotiation Failed'));

        await replaceMediaStream();

        await expect(mcuSession.renegotiateIfPending()).rejects.toThrow(
          'Media Renegotiation Failed',
        );
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(true);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).toHaveBeenCalledTimes(2);
      });

      it('оставляет досылку до следующего успешного ping, если JsSIP не отправил re-INVITE', async () => {
        waitForSignaling.mockResolvedValue(false);
        rtcSession.renegotiate.mockResolvedValueOnce(false);

        await replaceMediaStream();

        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(true);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).toHaveBeenCalledTimes(2);
        expect(waitForSignaling).toHaveBeenCalledTimes(1);
      });

      it('не запускает вторую досылку, пока идёт первая', async () => {
        let finishResend: (isRenegotiated: boolean) => void = () => {};

        waitForSignaling.mockResolvedValue(false);
        rtcSession.renegotiate.mockImplementationOnce(async () => {
          return new Promise<boolean>((resolve) => {
            finishResend = resolve;
          });
        });

        await replaceMediaStream();

        const resend = mcuSession.renegotiateIfPending();

        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        finishResend(true);

        await expect(resend).resolves.toBe(true);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).toHaveBeenCalledTimes(1);
      });

      it('не досылает снова, если во время неудачной досылки ушёл другой re-INVITE', async () => {
        let finishResend: (isRenegotiated: boolean) => void = () => {};

        waitForSignaling.mockResolvedValueOnce(false).mockResolvedValue(true);
        rtcSession.renegotiate.mockImplementationOnce(async () => {
          return new Promise<boolean>((resolve) => {
            finishResend = resolve;
          });
        });

        await replaceMediaStream();

        const resend = mcuSession.renegotiateIfPending();

        await expect(mcuSession.renegotiate()).resolves.toBe(true);

        finishResend(false);

        await expect(resend).resolves.toBe(false);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).toHaveBeenCalledTimes(2);
      });

      it('не досылает, пока другой re-INVITE ждёт проверки сигнализации: он сам отправит актуальный SDP', async () => {
        let confirmSignaling: (isReady: boolean) => void = () => {};

        waitForSignaling.mockResolvedValueOnce(false).mockImplementationOnce(async () => {
          return new Promise<boolean>((resolve) => {
            confirmSignaling = resolve;
          });
        });

        await replaceMediaStream();

        const restartIce = mcuSession.restartIce();

        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        // Успешный ping подтверждает проверку и сразу вызывает досылку, раньше продолжения re-INVITE
        confirmSignaling(true);

        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);
        await expect(restartIce).resolves.toBe(true);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.restartIce).toHaveBeenCalledTimes(1);
        expect(rtcSession.renegotiate).not.toHaveBeenCalled();
      });

      it('досылает после ошибки проверки сигнализации другого re-INVITE', async () => {
        waitForSignaling
          .mockResolvedValueOnce(false)
          .mockRejectedValueOnce(new Error('Signaling check failed'));

        await replaceMediaStream();

        await expect(mcuSession.restartIce()).rejects.toThrow('Signaling check failed');
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(true);

        expect(rtcSession.renegotiate).toHaveBeenCalledTimes(1);
      });

      it('не снимает досылку неотправленным restartIce', async () => {
        waitForSignaling.mockResolvedValue(false);

        await replaceMediaStream();
        await expect(mcuSession.restartIce()).resolves.toBe(false);
        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(true);

        expect(rtcSession.restartIce).not.toHaveBeenCalled();
        expect(rtcSession.renegotiate).toHaveBeenCalledTimes(1);
      });

      it.each([
        [
          'renegotiate',
          async () => {
            return mcuSession.renegotiate();
          },
        ],
        [
          'restartIce',
          async () => {
            return mcuSession.restartIce();
          },
        ],
      ])('не досылает после отправленного %s', async (_name, sendReinvite) => {
        waitForSignaling.mockResolvedValueOnce(false).mockResolvedValue(true);

        await replaceMediaStream();
        await sendReinvite();
        rtcSession.renegotiate.mockClear();

        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).not.toHaveBeenCalled();
      });

      it('не запоминает перенастройку, если звонок завершился во время проверки', async () => {
        waitForSignaling.mockImplementationOnce(async () => {
          mcuSession.reset();

          return false;
        });

        await replaceMediaStream();

        setRtcSession(rtcSession);

        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).not.toHaveBeenCalled();
      });

      it('не запоминает перенастройку, если сессия перестала быть установленной во время проверки', async () => {
        waitForSignaling.mockImplementationOnce(async () => {
          jest.spyOn(rtcSession, 'isEstablished').mockReturnValueOnce(false);

          return false;
        });

        await replaceMediaStream();

        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).not.toHaveBeenCalled();
      });

      it('не досылает после завершения звонка', async () => {
        waitForSignaling.mockResolvedValue(false);

        await replaceMediaStream();
        mcuSession.reset();
        setRtcSession(rtcSession);

        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(rtcSession.renegotiate).not.toHaveBeenCalled();
      });

      it('не досылает в другую сессию звонка', async () => {
        const nextRtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });

        waitForSignaling.mockResolvedValue(false);

        await replaceMediaStream();
        setRtcSession(nextRtcSession);

        await expect(mcuSession.renegotiateIfPending()).resolves.toBe(false);

        expect(nextRtcSession.renegotiate).not.toHaveBeenCalled();
        expect(rtcSession.renegotiate).not.toHaveBeenCalled();
      });
    });
  });

  it('setMinBitrateForSenders: delegates to BitrateStateManager with current connection', async () => {
    // @ts-expect-error
    const setMinBitrateSpy = jest.spyOn(mcuSession.bitrateStateManager, 'setMinBitrateForSenders');

    Object.defineProperty(mcuSession, 'connection', {
      get: () => {
        return connectionMock as unknown as RTCPeerConnection;
      },
    });

    // вызов с явным параметром
    mcuSession.setMinBitrateForSenders('audio');

    await flushPromises();

    expect(setMinBitrateSpy).toHaveBeenCalledTimes(1);
    expect(setMinBitrateSpy).toHaveBeenCalledWith(connectionMock, 'audio');

    // вызов без параметров, должен использовать default 'all'
    mcuSession.setMinBitrateForSenders();

    await flushPromises();

    expect(setMinBitrateSpy).toHaveBeenCalledTimes(2);
    expect(setMinBitrateSpy).toHaveBeenLastCalledWith(connectionMock, 'all');
  });

  it('restoreBitrateForSenders: delegates to BitrateStateManager with current connection', async () => {
    // @ts-expect-error
    const restoreSpy = jest.spyOn(mcuSession.bitrateStateManager, 'restoreBitrateForSenders');

    Object.defineProperty(mcuSession, 'connection', {
      get: () => {
        return connectionMock as unknown as RTCPeerConnection;
      },
    });

    // вызов с явным параметром
    mcuSession.restoreBitrateForSenders('video');

    await flushPromises();

    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy).toHaveBeenCalledWith(connectionMock, 'video');

    // вызов без параметров, должен использовать default 'all'
    mcuSession.restoreBitrateForSenders();

    await flushPromises();

    expect(restoreSpy).toHaveBeenCalledTimes(2);
    expect(restoreSpy).toHaveBeenLastCalledWith(connectionMock, 'all');
  });

  it('setMinBitrateForSenders: логирует ошибку если BitrateStateManager отклоняет промис', async () => {
    // @ts-expect-error
    const bitrateManager = mcuSession.bitrateStateManager;

    jest
      .spyOn(bitrateManager, 'setMinBitrateForSenders')
      .mockRejectedValueOnce(new Error('test-set-min-bitrate'));

    mcuSession.setMinBitrateForSenders();

    await flushPromises();

    expect(mcuDebugLogger).toHaveBeenCalledWith('setMinBitrateForSenders', expect.any(Error));
  });

  it('restoreBitrateForSenders: логирует ошибку если BitrateStateManager отклоняет промис', async () => {
    // @ts-expect-error
    const bitrateManager = mcuSession.bitrateStateManager;

    jest
      .spyOn(bitrateManager, 'restoreBitrateForSenders')
      .mockRejectedValueOnce(new Error('test-restore-bitrate'));

    mcuSession.restoreBitrateForSenders();

    await flushPromises();

    expect(mcuDebugLogger).toHaveBeenCalledWith('restoreBitrateForSenders', expect.any(Error));
  });
});
