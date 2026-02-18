import { IncomingResponse } from '@krivega/jssip';
import { createAudioMediaStreamTrackMock } from 'webrtc-mock';

import { createManagers } from '@/__fixtures__/createManagers';
import flushPromises from '@/__fixtures__/flushPromises';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import CallManager, { getInRoomTokenOrThrow } from '../@CallManager';
import { EEvent } from '../events';
import { resolveRecvQuality } from '../quality';
import { RemoteStreamsManager } from '../RemoteStreamsManager';

import type { RTCSession } from '@krivega/jssip';
import type { TRecvQuality } from '../quality';
import type { TCallRoleSpectator, TCallRoleSpectatorSynthetic } from '../types';

const mockRecvSession = (() => {
  const state: {
    instance?: {
      peerConnection: {
        addEventListener: jest.Mock;
        removeEventListener: jest.Mock;
      };
      call: jest.Mock;
      renegotiate: jest.Mock;
      close: jest.Mock;
      setQuality: jest.Mock;
      applyQuality: jest.Mock;
      getEffectiveQuality: jest.Mock;
      getQuality: jest.Mock;
      config?: unknown;
      tools?: unknown;
    };
  } = {};

  const factory = () => {
    const peerConnection = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    const call = jest.fn().mockResolvedValue(undefined);
    const renegotiate = jest.fn().mockResolvedValue(true);
    const close = jest.fn();
    const setQuality = jest.fn().mockResolvedValue(true);
    const getEffectiveQuality = jest.fn().mockReturnValue('high');
    const getQuality = jest.fn().mockReturnValue('auto');
    const applyQuality = jest.fn().mockResolvedValue({ applied: true, effectiveQuality: 'high' });

    const inst: {
      peerConnection: typeof peerConnection;
      call: typeof call;
      renegotiate: typeof renegotiate;
      close: typeof close;
      setQuality: typeof setQuality;
      applyQuality: typeof applyQuality;
      getEffectiveQuality: typeof getEffectiveQuality;
      getQuality: typeof getQuality;
      config?: unknown;
      tools?: unknown;
    } = {
      peerConnection,
      call,
      renegotiate,
      close,
      setQuality,
      applyQuality,
      getEffectiveQuality,
      getQuality,
    };

    state.instance = inst;

    return inst;
  };

  return {
    reset() {
      state.instance = undefined;
    },
    get instance() {
      return state.instance;
    },
    create: factory,
  };
})();

jest.mock('../RecvSession', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((config, tools) => {
      const inst = mockRecvSession.create();
      const configTyped = config as { quality?: TRecvQuality; audioChannel: string };
      const qualityConfig = configTyped.quality ?? 'auto';

      inst.config = {
        ...configTyped,
        quality: qualityConfig,
        effectiveQuality: resolveRecvQuality(qualityConfig),
      };
      inst.tools = tools;
      inst.getQuality = jest.fn(() => {
        return (inst.config as { quality: TRecvQuality }).quality;
      });
      inst.getEffectiveQuality = jest.fn(() => {
        return resolveRecvQuality((inst.config as { quality: TRecvQuality }).quality);
      });
      inst.setQuality = jest.fn(async (quality: TRecvQuality) => {
        inst.config = {
          ...(inst.config as object),
          quality,
          effectiveQuality: resolveRecvQuality(quality),
        };

        return true;
      });

      return inst;
    }),
  };
});

// Вспомогательный тип для доступа к защищённым свойствам CallManager
interface CallManagerTestAccess {
  rtcSession?: unknown;
  isPendingCall?: boolean;
  isPendingAnswer?: boolean;
}

describe('CallManager', () => {
  let callManager: CallManager;
  let mediaStream: MediaStream;

  beforeEach(() => {
    const managers = createManagers();

    callManager = managers.callManager;

    mediaStream = new MediaStream();
    mockRecvSession.reset();
  });

  it('endCall: вызывает reset и terminateAsync', async () => {
    const terminateAsync = jest.fn(async () => {});

    // @ts-expect-error
    (callManager.mcuSession as unknown as { rtcSession: RTCSession }).rtcSession = {
      isEnded: () => {
        return false;
      },
      terminateAsync,
    } as unknown as RTCSession;
    await callManager.endCall();
    expect(terminateAsync).toHaveBeenCalledWith({ cause: 'Canceled' });
  });

  it('endCall: если rtcSession нет, возвращает undefined', async () => {
    // @ts-expect-error
    callManager.mcuSession.rtcSession = undefined;
    await expect(callManager.endCall()).resolves.toBeUndefined();
  });

  it('getRecvQuality: возвращает текущее качество', () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');
    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('test-token');

    callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

    expect(callManager.getRecvQuality()).toEqual({
      quality: 'auto',
      effectiveQuality: 'high',
    });
  });

  it('getRecvQuality: возвращает undefined если recvSession не создан', () => {
    expect(callManager.getRecvQuality()).toBeUndefined();
  });

  it('setRecvQuality: при роли participant не применяет качество', async () => {
    callManager.setCallRoleParticipant();

    const result = await callManager.setRecvQuality('low');

    expect(result).toBe(false);
    expect(mockRecvSession.instance).toBeUndefined();
  });

  it('setRecvQuality: при отсутствии recvSession возвращает false', async () => {
    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue(undefined);
    callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

    const result = await callManager.setRecvQuality('low');

    expect(result).toBe(false);
    expect(mockRecvSession.instance).toBeUndefined();
  });

  it('setRecvQuality: при роли spectator применяет качество через RecvSession', async () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');
    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('test-token');

    callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

    const result = await callManager.setRecvQuality('low');

    expect(result).toBe(true);
    expect(mockRecvSession.instance?.applyQuality).toHaveBeenCalledWith('low');
  });

  it('setRecvQuality: возвращает false при отсутствии effective change', async () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');
    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('test-token');

    callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

    mockRecvSession.instance?.applyQuality.mockResolvedValueOnce({
      applied: false,
      effectiveQuality: 'high',
    });

    const result = await callManager.setRecvQuality('low');

    expect(result).toBe(false);
  });

  it('setRecvQuality: при ошибке внутри RecvSession пробрасывает исключение', async () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');
    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('test-token');

    callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

    const error = new Error('recv-session-fail');

    mockRecvSession.instance?.applyQuality.mockRejectedValueOnce(error);

    await expect(callManager.setRecvQuality('low')).rejects.toThrow('recv-session-fail');
  });

  describe('setRecvQuality: событие recv-quality-changed', () => {
    it('триггерит событие recv-quality-changed при успешном изменении качества', async () => {
      jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');
      jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('test-token');

      callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

      const eventHandler = jest.fn();

      callManager.on(EEvent.RECV_QUALITY_CHANGED, eventHandler);

      // Устанавливаем начальное качество 'auto' (effectiveQuality: 'high')
      mockRecvSession.instance?.getQuality.mockReturnValue('auto');
      mockRecvSession.instance?.applyQuality.mockResolvedValueOnce({
        applied: true,
        effectiveQuality: 'low',
      });

      await callManager.setRecvQuality('low');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith({
        previousQuality: 'auto',
        quality: 'low',
        effectiveQuality: 'low',
      });
    });

    it('не триггерит событие recv-quality-changed когда applied === false', async () => {
      jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');
      jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('test-token');

      callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

      const eventHandler = jest.fn();

      callManager.on(EEvent.RECV_QUALITY_CHANGED, eventHandler);

      mockRecvSession.instance?.applyQuality.mockResolvedValueOnce({
        applied: false,
        effectiveQuality: 'high',
      });

      await callManager.setRecvQuality('high');

      expect(eventHandler).not.toHaveBeenCalled();
    });

    it('событие recv-quality-changed содержит правильные данные при изменении с auto на low', async () => {
      jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');
      jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('test-token');

      callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

      const eventHandler = jest.fn();

      callManager.on(EEvent.RECV_QUALITY_CHANGED, eventHandler);

      mockRecvSession.instance?.getQuality.mockReturnValue('auto');
      mockRecvSession.instance?.applyQuality.mockResolvedValueOnce({
        applied: true,
        effectiveQuality: 'low',
      });

      await callManager.setRecvQuality('low');

      expect(eventHandler).toHaveBeenCalledWith({
        previousQuality: 'auto',
        quality: 'low',
        effectiveQuality: 'low',
      });
    });

    it('событие recv-quality-changed содержит правильные данные при изменении с high на medium', async () => {
      jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');
      jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('test-token');

      callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

      const eventHandler = jest.fn();

      callManager.on(EEvent.RECV_QUALITY_CHANGED, eventHandler);

      mockRecvSession.instance?.getQuality.mockReturnValue('high');
      mockRecvSession.instance?.applyQuality.mockResolvedValueOnce({
        applied: true,
        effectiveQuality: 'medium',
      });

      await callManager.setRecvQuality('medium');

      expect(eventHandler).toHaveBeenCalledWith({
        previousQuality: 'high',
        quality: 'medium',
        effectiveQuality: 'medium',
      });
    });

    it('событие recv-quality-changed содержит правильные данные при изменении с low на auto', async () => {
      jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');
      jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('test-token');

      callManager.setCallRoleSpectator({ audioId: '1', sendOffer: jest.fn() });

      const eventHandler = jest.fn();

      callManager.on(EEvent.RECV_QUALITY_CHANGED, eventHandler);

      mockRecvSession.instance?.getQuality.mockReturnValue('low');
      mockRecvSession.instance?.applyQuality.mockResolvedValueOnce({
        applied: true,
        effectiveQuality: 'high', // auto разрешается в high
      });

      await callManager.setRecvQuality('auto');

      expect(eventHandler).toHaveBeenCalledWith({
        previousQuality: 'low',
        quality: 'auto',
        effectiveQuality: 'high',
      });
    });
  });

  it('renegotiate: должен вызывать renegotiate у rtcSession', async () => {
    const renegotiate = jest.fn().mockResolvedValue(true);

    // @ts-expect-error
    callManager.mcuSession.rtcSession = { renegotiate } as unknown as RTCSession;

    await expect(callManager.renegotiate()).resolves.toBe(true);

    expect(renegotiate).toHaveBeenCalledTimes(1);
  });

  it('renegotiate: должен выбрасывать ошибку если rtcSession отсутствует', async () => {
    // @ts-expect-error
    callManager.mcuSession.rtcSession = undefined;

    await expect(callManager.renegotiate()).rejects.toThrow('No rtcSession established');
  });

  it('renegotiate: должен вернуть false если rtcSession отсутствует', async () => {
    const sendOffer = jest.fn().mockResolvedValue(undefined);

    callManager.setCallRoleSpectator({
      audioId: 'audio-1',
      sendOffer,
    } as TCallRoleSpectator['recvParams']);

    const mcuRenegotiateSpy = jest
      .spyOn(
        (callManager as unknown as { mcuSession: { renegotiate: () => Promise<boolean> } })
          .mcuSession,
        'renegotiate',
      )
      .mockResolvedValue(true);

    await expect(callManager.renegotiate()).resolves.toBe(false);

    expect(mockRecvSession.instance).toBeUndefined();
    expect(mcuRenegotiateSpy).not.toHaveBeenCalled();
  });

  it('renegotiate: должен пересогласовать recvSession для наблюдателя', async () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('100');
    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('token');

    const sendOffer = jest.fn().mockResolvedValue(undefined);

    callManager.setCallRoleSpectator({
      audioId: 'audio-1',
      sendOffer,
    } as TCallRoleSpectator['recvParams']);

    const mcuRenegotiateSpy = jest
      .spyOn(
        (callManager as unknown as { mcuSession: { renegotiate: () => Promise<boolean> } })
          .mcuSession,
        'renegotiate',
      )
      .mockResolvedValue(true);

    await expect(callManager.renegotiate()).resolves.toBe(true);

    expect(mockRecvSession.instance?.renegotiate).toHaveBeenCalledTimes(1);
    expect(mockRecvSession.instance?.renegotiate).toHaveBeenCalledWith({
      conferenceNumber: '100',
      token: 'token',
    });
    expect(mcuRenegotiateSpy).not.toHaveBeenCalled();
  });

  it('renegotiate: должен вернуть ошибку при пересогласовании для наблюдателя если renegotiate вернул ошибку', async () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('100');
    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('token');

    const sendOffer = jest.fn().mockResolvedValue(undefined);

    callManager.setCallRoleSpectator({
      audioId: 'audio-1',
      sendOffer,
    } as TCallRoleSpectator['recvParams']);

    const error = new Error('renegotiate failed');

    mockRecvSession.instance?.renegotiate.mockRejectedValueOnce(error);

    const mcuRenegotiateSpy = jest
      .spyOn(
        (callManager as unknown as { mcuSession: { renegotiate: () => Promise<boolean> } })
          .mcuSession,
        'renegotiate',
      )
      .mockResolvedValue(true);

    await expect(callManager.renegotiate()).rejects.toThrow('renegotiate failed');

    expect(mockRecvSession.instance?.renegotiate).toHaveBeenCalledTimes(1);
    expect(mockRecvSession.instance?.renegotiate).toHaveBeenCalledWith({
      conferenceNumber: '100',
      token: 'token',
    });
    expect(mcuRenegotiateSpy).not.toHaveBeenCalled();
  });

  it('getRemoteStreams: возвращает undefined если нет connection', () => {
    jest.spyOn(RemoteStreamsManager.prototype, 'getStreams').mockReturnValue([]);

    expect(callManager.getRemoteStreams()).toEqual({});
  });

  it('getRemoteStreams: проксирует remoteStreamsManager.getStreams', () => {
    const stream = new MediaStream();
    const spy = jest.spyOn(RemoteStreamsManager.prototype, 'getStreams').mockReturnValue([stream]);

    expect(callManager.getRemoteStreams()).toEqual({ mainStream: stream });
    expect(spy).toHaveBeenCalled();
  });

  it('getMainRemoteStream: должен вернуть основной поток при его наличии', () => {
    const stream = new MediaStream();

    jest
      .spyOn(callManager.getStreamsManagerProvider(), 'getMainRemoteStreamsManagerTools')
      .mockReturnValue({
        manager: {} as RemoteStreamsManager,
        getRemoteStreams: () => {
          return { mainStream: stream };
        },
      });

    expect(callManager.getMainRemoteStream()).toBe(stream);
  });

  it('getMainRemoteStream: должен вернуть undefined при отсутствии основного потока', () => {
    jest
      .spyOn(callManager.getStreamsManagerProvider(), 'getMainRemoteStreamsManagerTools')
      .mockReturnValue({
        manager: {} as RemoteStreamsManager,
        getRemoteStreams: () => {
          return { mainStream: undefined };
        },
      });

    expect(callManager.getMainRemoteStream()).toBeUndefined();
  });

  it('getMainRemoteStream: должен вернуть поток из recvSession для наблюдателя', () => {
    const stream = new MediaStream();

    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('token');

    const sendOffer = jest.fn().mockResolvedValue(undefined);

    callManager.setCallRoleSpectator({
      audioId: 'audio-1',
      sendOffer,
    } as TCallRoleSpectator['recvParams']);

    jest
      .spyOn(callManager.getStreamsManagerProvider(), 'getRecvRemoteStreamsManagerTools')
      .mockReturnValue({
        manager: {} as RemoteStreamsManager,
        getRemoteStreams: () => {
          return { mainStream: stream };
        },
      });

    expect(callManager.getMainRemoteStream()).toBe(stream);
  });

  describe('getActivePeerConnection', () => {
    it('возвращает peerConnection из mcuSession для участника', () => {
      const peerConnection = {} as RTCPeerConnection;

      // @ts-expect-error
      callManager.mcuSession.rtcSession = { connection: peerConnection };

      expect(callManager.getActivePeerConnection()).toBeDefined();
      expect(callManager.getActivePeerConnection()).toBe(peerConnection);
    });

    it('возвращает peerConnection из recvSession для наблюдателя', () => {
      jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('100');
      jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('token');

      const sendOffer = jest.fn().mockResolvedValue(undefined);

      callManager.setCallRoleSpectator({
        audioId: 'audio-1',
        sendOffer,
      } as TCallRoleSpectator['recvParams']);

      expect(callManager.getActivePeerConnection()).toBeDefined();
      expect(callManager.getActivePeerConnection()).toBe(mockRecvSession.instance?.peerConnection);
    });
  });

  it('replaceMediaStream: заменяет поток', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // @ts-expect-error
    callManager.mcuSession.rtcSession = rtcSession as unknown as RTCSession;

    await callManager.replaceMediaStream(mediaStream);

    expect(rtcSession.replaceMediaStream).toHaveBeenCalled();
  });

  it('replaceMediaStream: бросает ошибку если prepareMediaStream вернул undefined', async () => {
    const prepareMediaStreamModule = await import('@/tools/prepareMediaStream');

    jest
      .spyOn(prepareMediaStreamModule, 'default')
      .mockReturnValue(undefined as unknown as MediaStream);

    const callManagerLocal = new CallManager(new ContentedStreamManager());
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // @ts-expect-error
    callManagerLocal.mcuSession.rtcSession = rtcSession as unknown as RTCSession;

    await expect(callManagerLocal.replaceMediaStream(mediaStream)).rejects.toThrow(
      'No preparedMediaStream',
    );
  });

  it('replaceMediaStream: бросает ошибку если нет rtcSession', async () => {
    // @ts-expect-error
    callManager.mcuSession.rtcSession = undefined;
    await expect(callManager.replaceMediaStream(mediaStream)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('reset: очищает remoteStreamsManager', () => {
    const spy = jest.spyOn(RemoteStreamsManager.prototype, 'reset');

    // @ts-expect-error
    callManager.reset();
    expect(spy).toHaveBeenCalled();
  });

  describe('deferred RecvSession command (race with conference:participant-token-issued)', () => {
    it('откладывает startRecvSession при CONNECTING без токена и выполняет после перехода в IN_ROOM', () => {
      const { callManager: cm, apiManager } = createManagers();
      const sendOffer = jest.fn().mockResolvedValue({} as RTCSessionDescription);

      cm.events.trigger('start-call', { number: '100', answer: false });
      expect(cm.stateMachine.state).toBe('call:connecting');
      expect(cm.getToken()).toBeUndefined();

      cm.setCallRoleSpectator({
        audioId: 'audio-1',
        sendOffer,
      } as TCallRoleSpectator['recvParams']);

      expect(mockRecvSession.instance).toBeUndefined();

      apiManager.events.trigger('enter-room', { room: 'r1', participantName: 'p1' });
      apiManager.events.trigger('conference:participant-token-issued', {
        jwt: 'token1',
        conference: 'c1',
        participant: 'part1',
      });

      expect(cm.stateMachine.state).toBe('call:inRoom');
      expect(mockRecvSession.instance).toBeDefined();
      expect(mockRecvSession.instance?.call).toHaveBeenCalledWith({
        conferenceNumber: '100',
        token: 'token1',
      });
    });

    it('отменяет отложенную команду при смене роли на участника до прихода токена', () => {
      const { callManager: cm, apiManager } = createManagers();
      const sendOffer = jest.fn().mockResolvedValue({} as RTCSessionDescription);

      cm.events.trigger('start-call', { number: '100', answer: false });
      cm.setCallRoleSpectator({
        audioId: 'audio-1',
        sendOffer,
      } as TCallRoleSpectator['recvParams']);

      cm.setCallRoleParticipant();

      apiManager.events.trigger('enter-room', { room: 'r1', participantName: 'p1' });
      apiManager.events.trigger('conference:participant-token-issued', {
        jwt: 'token1',
        conference: 'c1',
        participant: 'part1',
      });

      expect(cm.stateMachine.state).toBe('call:inRoom');
      expect(mockRecvSession.instance).toBeUndefined();
    });

    it('отменяет отложенную команду при failed до прихода токена (переход в IDLE)', () => {
      const { callManager: cm } = createManagers();
      const sendOffer = jest.fn().mockResolvedValue({} as RTCSessionDescription);

      cm.events.trigger('start-call', { number: '100', answer: false });
      cm.setCallRoleSpectator({
        audioId: 'audio-1',
        sendOffer,
      } as TCallRoleSpectator['recvParams']);

      cm.events.trigger('failed', {
        originator: 'local',
        message: new IncomingResponse(),
        cause: 'call failed',
      });
      expect(cm.stateMachine.state).toBe('call:idle');

      expect(mockRecvSession.instance).toBeUndefined();
    });

    it('getInRoomTokenOrThrow: выбрасывает ошибку при отсутствии inRoomContext', () => {
      const stateMachine = {
        get inRoomContext() {
          return undefined;
        },
      } as Parameters<typeof getInRoomTokenOrThrow>[0];

      expect(() => {
        getInRoomTokenOrThrow(stateMachine);
      }).toThrow(
        '[CallManager] Invariant: inRoomContext expected when deferred runner executes (state IN_ROOM)',
      );
    });

    it('getInRoomTokenOrThrow: возвращает token при наличии inRoomContext', () => {
      const stateMachine = {
        get inRoomContext() {
          return {
            token: 'jwt-token',
            number: '',
            answer: false,
            room: '',
            participantName: '',
            conference: '',
            participant: '',
          };
        },
      } as Parameters<typeof getInRoomTokenOrThrow>[0];

      expect(getInRoomTokenOrThrow(stateMachine)).toBe('jwt-token');
    });
  });
});

describe('CallManager - дополнительные тесты для покрытия', () => {
  let callManager: CallManager;
  let callManagerTest: CallManagerTestAccess;

  beforeEach(() => {
    callManager = new CallManager(new ContentedStreamManager());
    callManagerTest = callManager as unknown as CallManagerTestAccess;
    jest.clearAllMocks();
    mockRecvSession.reset();
  });

  it('requested: возвращает true если isPendingCall или isPendingAnswer', () => {
    callManagerTest.isPendingCall = true;
    expect(callManager.requested).toBe(true);
    callManagerTest.isPendingCall = false;
    callManagerTest.isPendingAnswer = true;
    expect(callManager.requested).toBe(true);
    callManagerTest.isPendingAnswer = false;
    expect(callManager.requested).toBe(false);
  });

  it('connection: возвращает rtcSession.connection', () => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    callManagerTest.mcuSession.rtcSession = { connection: 'test' };
    expect(callManager.connection).toBe('test');
  });

  it('number: возвращает number из контекста после start-call (инициатор)', () => {
    const managers = createManagers();
    const cm = managers.callManager;

    cm.events.trigger('start-call', { number: '100', answer: false });

    expect(cm.number).toBe('100');
  });

  it('number: возвращает number из контекста после start-call (принимающая сторона)', () => {
    const managers = createManagers();
    const cm = managers.callManager;

    cm.events.trigger('start-call', { number: '200', answer: true });

    expect(cm.number).toBe('200');
  });

  it('isCallInitiator: возвращает true для инициатора', () => {
    const managers = createManagers();
    const cm = managers.callManager;

    cm.events.trigger('start-call', { number: '100', answer: false });

    expect(cm.isCallInitiator).toBe(true);
  });

  it('isCallInitiator: возвращает false для принимающей стороны', () => {
    const managers = createManagers();
    const cm = managers.callManager;

    cm.events.trigger('start-call', { number: '100', answer: true });

    expect(cm.isCallInitiator).toBe(false);
  });

  it('establishedRTCSession: возвращает rtcSession если isEstablished', () => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    callManagerTest.mcuSession.rtcSession = {
      isEstablished: () => {
        return true;
      },
    };

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(callManager.getEstablishedRTCSession()).toBe(callManagerTest.mcuSession.rtcSession);

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    callManagerTest.mcuSession.rtcSession = {
      isEstablished: () => {
        return false;
      },
    };
    expect(callManager.getEstablishedRTCSession()).toBeUndefined();
  });

  it('getEstablishedRTCSession: возвращает rtcSession если isEstablished', () => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    callManagerTest.mcuSession.rtcSession = {
      isEstablished: () => {
        return true;
      },
    };

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(callManager.getEstablishedRTCSession()).toBe(callManagerTest.mcuSession.rtcSession);

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    callManagerTest.mcuSession.rtcSession = {
      isEstablished: () => {
        return false;
      },
    };
    expect(callManager.getEstablishedRTCSession()).toBeUndefined();
  });

  it('restartIce: вызывает restartIce на rtcSession', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // Мокаем rtcSession
    // @ts-expect-error
    Object.defineProperty(callManager.mcuSession, 'rtcSession', {
      get: () => {
        return rtcSession;
      },
      configurable: true,
    });

    const result = await callManager.restartIce();

    expect(rtcSession.restartIce).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('restartIce: передает опции в rtcSession.restartIce', async () => {
    const rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'remote',
    });

    // Мокаем rtcSession
    // @ts-expect-error
    Object.defineProperty(callManager.mcuSession, 'rtcSession', {
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

    await callManager.restartIce(options);

    expect(rtcSession.restartIce).toHaveBeenCalledWith(options);
  });

  it('restartIce: выбрасывает ошибку если нет rtcSession', async () => {
    // Мокаем rtcSession чтобы вернуть undefined
    // @ts-expect-error
    Object.defineProperty(callManager.mcuSession, 'rtcSession', {
      get: () => {
        return undefined;
      },
      configurable: true,
    });

    await expect(callManager.restartIce()).rejects.toThrow('No rtcSession established');
  });

  describe('failed', () => {
    const message = new IncomingResponse();

    it('триггерит failed с переданными message и cause', async () => {
      const cause = 'call failed';
      const failedSpy = jest.fn();

      callManager.events.on(EEvent.FAILED, failedSpy);

      await callManager.failed(message, cause);

      expect(failedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          originator: 'local',
          message,
          cause,
        }),
      );
    });

    it('вызывает endCall после эмита failed', async () => {
      const endCallSpy = jest.fn().mockResolvedValue(undefined);

      // @ts-expect-error доступ к приватному члену для теста
      jest.spyOn(callManager.mcuSession, 'endCall').mockImplementation(endCallSpy);

      await callManager.failed(message, 'test');

      expect(endCallSpy).toHaveBeenCalled();
    });

    it('при ошибке endCall пробрасывает ошибку', async () => {
      const endCallError = new Error('end call failed');

      // @ts-expect-error доступ к приватному члену для теста
      jest.spyOn(callManager.mcuSession, 'endCall').mockRejectedValue(endCallError);

      await expect(callManager.failed(message, 'test')).rejects.toThrow('end call failed');
    });
  });

  it('handleChangedRemoteTracks: не эмитит, если менеджер не активный', () => {
    const activeManager = {
      getStreams: jest.fn().mockReturnValue([new MediaStream()]),
    } as unknown as RemoteStreamsManager;
    const inactiveManager = {} as RemoteStreamsManager;
    const triggerSpy = jest.spyOn(callManager.events, 'trigger');
    const mainStream = new MediaStream();

    // Мокаем getActiveStreamsManagerTools для возврата активного менеджера
    // @ts-expect-error
    callManager.getActiveStreamsManagerTools = jest.fn().mockReturnValue({
      manager: activeManager,
      getRemoteStreams: () => {
        return { mainStream };
      },
    });

    // Случай активного менеджера
    // @ts-expect-error
    callManager.handleChangedRemoteTracks(activeManager, 'added', {
      isAddedStream: true,
      isRemovedStream: true,
      trackId: 't1',
      participantId: 'p1',
    });
    expect(triggerSpy).toHaveBeenCalledTimes(2);
    expect(triggerSpy).toHaveBeenCalledWith(
      'remote-tracks-changed',
      expect.objectContaining({
        streams: { mainStream },
        changeType: 'added',
        participantId: 'p1',
        trackId: 't1',
      }),
    );
    expect(triggerSpy).toHaveBeenCalledWith(
      'remote-streams-changed',
      expect.objectContaining({
        streams: { mainStream },
      }),
    );

    // Случай неактивного менеджера — не должно быть нового эмита
    // @ts-expect-error
    callManager.handleChangedRemoteTracks(inactiveManager, 'removed', {
      trackId: 't2',
      participantId: 'p2',
    });
    expect(triggerSpy).toHaveBeenCalledTimes(2);
  });

  it('addRemoteTrack: не эмитит, если трек уже добавлен (isAdded=false)', () => {
    const managerMock = {
      addTrack: jest.fn().mockReturnValue({ isAddedTrack: false, isAddedStream: false }),
    } as unknown as RemoteStreamsManager;
    const emitSpy = jest.spyOn(
      callManager,
      // @ts-expect-error
      'handleChangedRemoteTracks',
    );

    // @ts-expect-error
    callManager.addRemoteTrack(managerMock, createAudioMediaStreamTrackMock(), 'hint');

    expect(managerMock.addTrack).toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('addRemoteTrack: эмитит изменение, если менеджер активный', () => {
    const managerMock = {
      addTrack: jest
        .fn()
        .mockReturnValue({ isAddedTrack: true, isAddedStream: true, participantId: 'p1' }),
      getStreams: jest.fn().mockReturnValue([new MediaStream()]),
    } as unknown as RemoteStreamsManager;

    // @ts-expect-error
    callManager.mainRemoteStreamsManager = managerMock;

    const emitSpy = jest.spyOn(
      callManager,
      // @ts-expect-error
      'handleChangedRemoteTracks',
    );

    const track = createAudioMediaStreamTrackMock();

    // @ts-expect-error
    callManager.addRemoteTrack(managerMock, track, 'hint');

    expect(managerMock.addTrack).toHaveBeenCalledWith(
      track,
      expect.objectContaining({ streamHint: 'hint' }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      managerMock,
      'added',
      expect.objectContaining({
        isAddedStream: true,
        isRemovedStream: false,
        trackId: track.id,
        participantId: 'p1',
      }),
    );
  });

  it('addRemoteTrack: эмитит removed при удалении трека через onRemoved', () => {
    let onRemovedCallback:
      | ((event: { trackId: string; participantId: string }) => void)
      | undefined;

    const managerMock = {
      addTrack: jest.fn().mockImplementation(
        (
          _track,
          options?: {
            streamHint?: string;
            onRemoved?: (event: { trackId: string; participantId: string }) => void;
          },
        ) => {
          // Сохраняем колбэк onRemoved для последующего вызова
          onRemovedCallback = options?.onRemoved;

          return { isAddedTrack: true, isAddedStream: true, participantId: 'p1' };
        },
      ),
      getStreams: jest.fn().mockReturnValue([new MediaStream()]),
    } as unknown as RemoteStreamsManager;

    // @ts-expect-error
    callManager.mainRemoteStreamsManager = managerMock;

    const emitSpy = jest.spyOn(
      callManager,
      // @ts-expect-error
      'handleChangedRemoteTracks',
    );

    const track = createAudioMediaStreamTrackMock();

    // @ts-expect-error
    callManager.addRemoteTrack(managerMock, track, 'hint');

    // Проверяем, что колбэк был сохранен
    expect(onRemovedCallback).toBeDefined();

    // Симулируем удаление трека через вызов колбэка onRemoved (строка 224)
    if (onRemovedCallback) {
      onRemovedCallback({ trackId: 'track-123', participantId: 'p1' });
    }

    // Проверяем, что handleChangedRemoteTracks был вызван с 'removed'
    expect(emitSpy).toHaveBeenCalledWith(managerMock, 'removed', {
      isAddedStream: false,
      isRemovedStream: undefined,
      trackId: 'track-123',
      participantId: 'p1',
    });
  });

  it('onRoleChanged: вызывает startRecvSession при входе в spectator и stopRecvSession при выходе', () => {
    const stopSpy = jest
      // @ts-expect-error
      .spyOn(callManager, 'stopRecvSession');

    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('token');

    const startSpy = jest
      // @ts-expect-error
      .spyOn(callManager, 'startRecvSession');

    const spectatorRole: TCallRoleSpectator = {
      type: 'spectator',
      recvParams: {
        audioId: 'a1',

        sendOffer: async () => {
          return {} as RTCSessionDescription;
        },
      },
    };

    // Вход в spectator
    // @ts-expect-error
    callManager.onRoleChanged({ previous: { type: 'participant' }, next: spectatorRole });
    expect(startSpy).toHaveBeenCalledWith('a1', {
      sendOffer: spectatorRole.recvParams.sendOffer,
      token: 'token',
    });

    startSpy.mockClear();

    // Выход из spectator
    // @ts-expect-error
    callManager.onRoleChanged({ previous: spectatorRole, next: { type: 'spectator_synthetic' } });
    expect(stopSpy).toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('onRoleChanged: устанавливает минимальный битрейт при входе в spectator', () => {
    const spectatorRole: TCallRoleSpectator = {
      type: 'spectator',
      recvParams: {
        audioId: 'a1',
        sendOffer: async () => {
          return {} as RTCSessionDescription;
        },
      },
    };

    const setMinSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'setMinBitrateForSenders')
      .mockImplementation(() => {});
    const restoreSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'restoreBitrateForSenders')
      .mockImplementation(() => {});

    // Вход в spectator из participant
    // @ts-expect-error
    callManager.onRoleChanged({ previous: { type: 'participant' }, next: spectatorRole });

    expect(setMinSpy).toHaveBeenCalledTimes(1);
    expect(setMinSpy).toHaveBeenCalledWith();
    expect(restoreSpy).not.toHaveBeenCalled();
  });

  it('onRoleChanged: восстанавливает битрейт при выходе из spectator', () => {
    const spectatorRole: TCallRoleSpectator = {
      type: 'spectator',
      recvParams: {
        audioId: 'a1',
        sendOffer: async () => {
          return {} as RTCSessionDescription;
        },
      },
    };

    const setMinSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'setMinBitrateForSenders')
      .mockImplementation(() => {});
    const restoreSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'restoreBitrateForSenders')
      .mockImplementation(() => {});

    // Выход из spectator в participant
    // @ts-expect-error
    callManager.onRoleChanged({ previous: spectatorRole, next: { type: 'participant' } });

    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy).toHaveBeenCalledWith();
    expect(setMinSpy).not.toHaveBeenCalled();
  });

  it('onRoleChanged: не трогает битрейт при смене audioId в spectator', () => {
    const firstSpectatorRole: TCallRoleSpectator = {
      type: 'spectator',
      recvParams: {
        audioId: 'a1',
        sendOffer: async () => {
          return {} as RTCSessionDescription;
        },
      },
    };

    const secondSpectatorRole: TCallRoleSpectator = {
      type: 'spectator',
      recvParams: {
        audioId: 'a2',
        sendOffer: async () => {
          return {} as RTCSessionDescription;
        },
      },
    };

    const setMinSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'setMinBitrateForSenders')
      .mockImplementation(() => {});
    const restoreSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'restoreBitrateForSenders')
      .mockImplementation(() => {});

    // смена роли spectator -> spectator с другим audioId
    // @ts-expect-error
    callManager.onRoleChanged({ previous: firstSpectatorRole, next: secondSpectatorRole });

    expect(setMinSpy).not.toHaveBeenCalled();
    expect(restoreSpy).not.toHaveBeenCalled();
  });

  it('onRoleChanged: устанавливает минимальный битрейт при входе в spectator_synthetic', () => {
    const spectatorSyntheticRole: TCallRoleSpectatorSynthetic = {
      type: 'spectator_synthetic',
    };

    const setMinSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'setMinBitrateForSenders')
      .mockImplementation(() => {});
    const restoreSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'restoreBitrateForSenders')
      .mockImplementation(() => {});

    // Вход в spectator_synthetic из participant
    // @ts-expect-error
    callManager.onRoleChanged({ previous: { type: 'participant' }, next: spectatorSyntheticRole });

    expect(setMinSpy).toHaveBeenCalledTimes(1);
    expect(setMinSpy).toHaveBeenCalledWith();
    expect(restoreSpy).not.toHaveBeenCalled();
  });

  it('onRoleChanged: восстанавливает битрейт при выходе из spectator_synthetic', () => {
    const spectatorSyntheticRole: TCallRoleSpectatorSynthetic = {
      type: 'spectator_synthetic',
    };

    const setMinSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'setMinBitrateForSenders')
      .mockImplementation(() => {});
    const restoreSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'restoreBitrateForSenders')
      .mockImplementation(() => {});

    // Выход из spectator_synthetic в participant
    // @ts-expect-error
    callManager.onRoleChanged({ previous: spectatorSyntheticRole, next: { type: 'participant' } });

    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy).toHaveBeenCalledWith();
    expect(setMinSpy).not.toHaveBeenCalled();
  });

  it('onRoleChanged: не трогает битрейт при переходе между spectator и spectator_synthetic', () => {
    const spectatorRole: TCallRoleSpectator = {
      type: 'spectator',
      recvParams: {
        audioId: 'a1',
        sendOffer: async () => {
          return {} as RTCSessionDescription;
        },
      },
    };
    const spectatorSyntheticRole: TCallRoleSpectatorSynthetic = {
      type: 'spectator_synthetic',
    };

    const setMinSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'setMinBitrateForSenders')
      .mockImplementation(() => {});
    const restoreSpy = jest
      // @ts-expect-error
      .spyOn(callManager.mcuSession, 'restoreBitrateForSenders')
      .mockImplementation(() => {});

    // spectator -> spectator_synthetic
    // @ts-expect-error
    callManager.onRoleChanged({ previous: spectatorRole, next: spectatorSyntheticRole });
    // spectator_synthetic -> spectator
    // @ts-expect-error
    callManager.onRoleChanged({ previous: spectatorSyntheticRole, next: spectatorRole });

    expect(setMinSpy).not.toHaveBeenCalled();
    expect(restoreSpy).not.toHaveBeenCalled();
  });

  it('onRoleChanged: вызывает emitEventChangedRemoteStreams с типом updated при выходе из роли spectator', () => {
    const emitSpy = jest.spyOn(
      callManager,
      // @ts-expect-error
      'emitEventChangedRemoteStreams',
    );

    const spectatorRole: TCallRoleSpectator = {
      type: 'spectator',
      recvParams: {
        audioId: 'a1',
        sendOffer: async () => {
          return {} as RTCSessionDescription;
        },
      },
    };

    // Выход из spectator в spectator_synthetic
    // @ts-expect-error
    callManager.onRoleChanged({ previous: spectatorRole, next: { type: 'spectator_synthetic' } });

    const stateInfo = {
      isAvailable: true,
    };

    expect(emitSpy).toHaveBeenCalledWith(
      // @ts-expect-error
      callManager.streamsManagerProvider
        .getMainRemoteStreamsManagerTools({ stateInfo })
        .getRemoteStreams(),
    );

    emitSpy.mockClear();

    // Выход из spectator в participant
    // @ts-expect-error
    callManager.onRoleChanged({ previous: spectatorRole, next: { type: 'participant' } });

    expect(emitSpy).toHaveBeenCalledWith(
      // @ts-expect-error
      callManager.streamsManagerProvider
        .getMainRemoteStreamsManagerTools({ stateInfo })
        .getRemoteStreams(),
    );

    emitSpy.mockClear();

    // Вход в spectator (не должно вызывать handleChangedRemoteTracks)
    // @ts-expect-error
    callManager.onRoleChanged({ previous: { type: 'participant' }, next: spectatorRole });
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('onRoleChanged: перезапускает recv сессию при смене audioId в роли spectator', () => {
    const startSpy = jest
      // @ts-expect-error
      .spyOn(callManager, 'startRecvSession')
      // @ts-expect-error
      .mockImplementation(() => {});

    const firstSpectatorRole: TCallRoleSpectator = {
      type: 'spectator',
      recvParams: {
        audioId: 'a1',
        sendOffer: async () => {
          return {} as RTCSessionDescription;
        },
      },
    };

    const secondSpectatorRole: TCallRoleSpectator = {
      type: 'spectator',
      recvParams: {
        audioId: 'a2',
        sendOffer: async () => {
          return {} as RTCSessionDescription;
        },
      },
    };

    jest.spyOn(callManager.stateMachine, 'token', 'get').mockReturnValue('token');

    // Вход в spectator с первым audioId
    // @ts-expect-error
    callManager.onRoleChanged({ previous: { type: 'participant' }, next: firstSpectatorRole });
    expect(startSpy).toHaveBeenCalledWith('a1', {
      sendOffer: firstSpectatorRole.recvParams.sendOffer,
      token: 'token',
    });
    expect(startSpy).toHaveBeenCalledTimes(1);

    startSpy.mockClear();

    // Смена audioId в той же роли spectator
    // @ts-expect-error
    callManager.onRoleChanged({ previous: firstSpectatorRole, next: secondSpectatorRole });

    // startRecvSession вызывается с новым audioId, что означает перезапуск сессии
    // (startRecvSession внутри вызывает stopRecvSession перед созданием новой сессии)
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith('a2', {
      sendOffer: secondSpectatorRole.recvParams.sendOffer,
      token: 'token',
    });
  });

  it('setCallRoleParticipant: делегирует в roleManager', () => {
    const spy = jest.spyOn(
      // @ts-expect-error
      callManager.roleManager,
      'setCallRoleParticipant',
    );

    callManager.setCallRoleParticipant();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('attachRecvSessionTracks: добавляет и снимает слушатель track', () => {
    const addRemoteTrackSpy = jest
      .spyOn(callManager as unknown as { addRemoteTrack: () => void }, 'addRemoteTrack')
      .mockImplementation(() => {});
    const peerConnection = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    const session = { peerConnection } as unknown as { peerConnection: RTCPeerConnection };

    // @ts-expect-error
    callManager.attachRecvSessionTracks(session);

    // capture handler
    const [[, handler]] = peerConnection.addEventListener.mock.calls as [
      [string, (event: RTCTrackEvent) => void],
    ];

    const track = createAudioMediaStreamTrackMock();

    handler({ track, streams: [new MediaStream()] } as unknown as RTCTrackEvent);

    expect(addRemoteTrackSpy).toHaveBeenCalledWith(
      callManager['recvRemoteStreamsManager' as unknown as keyof CallManager],
      track,
      expect.any(String),
    );

    // dispose
    (
      callManager as unknown as { disposeRecvSessionTrackListener?: () => void }
    ).disposeRecvSessionTrackListener?.();
    expect(peerConnection.removeEventListener).toHaveBeenCalledWith('track', handler);
  });

  it('startRecvSession: не стартует без conferenceNumber', () => {
    (
      callManager as unknown as { startRecvSession: (id: string, sendOffer: () => void) => void }
    ).startRecvSession('audio-id', jest.fn());

    const RecvSessionModule = jest.requireMock('../RecvSession') as { default: jest.Mock };

    expect(RecvSessionModule.default).not.toHaveBeenCalled();
  });

  it('startRecvSession: создаёт RecvSession, ресетит менеджер и вызывает call', async () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');

    const recvManager = Reflect.get(
      callManager as unknown as object,
      'recvRemoteStreamsManager',
    ) as RemoteStreamsManager;
    const recvResetSpy = jest.spyOn(recvManager, 'reset');
    const attachSpy = jest
      .spyOn(
        callManager as unknown as {
          attachRecvSessionTracks: () => void;
        },
        'attachRecvSessionTracks',
      )
      .mockImplementation(() => {});
    const stopSpy = jest
      .spyOn(
        callManager as unknown as {
          stopRecvSession: () => void;
        },
        'stopRecvSession',
      )
      .mockImplementation(() => {});

    (
      callManager as unknown as {
        startRecvSession: (id: string, params: { sendOffer: () => void; token: string }) => void;
      }
    ).startRecvSession('audio-id', { sendOffer: jest.fn(), token: 'test-token' });

    expect(recvResetSpy).toHaveBeenCalled();
    expect(attachSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalledTimes(1); // initial stop before creating new session
    expect(mockRecvSession.instance?.call).toHaveBeenCalledWith({
      conferenceNumber: '123',
      token: 'test-token',
    });
    expect(mockRecvSession.instance?.config).toMatchObject({
      audioChannel: 'audio-id',
      quality: 'auto',
      effectiveQuality: 'high',
    });
  });

  it('startRecvSession: триггерит событие recv-session-started при успешном завершении call', async () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');

    jest
      .spyOn(
        callManager as unknown as {
          attachRecvSessionTracks: () => void;
        },
        'attachRecvSessionTracks',
      )
      .mockImplementation(() => {});
    jest
      .spyOn(
        callManager as unknown as {
          stopRecvSession: () => void;
        },
        'stopRecvSession',
      )
      .mockImplementation(() => {});

    const eventHandler = jest.fn();

    callManager.on(EEvent.RECV_SESSION_STARTED, eventHandler);

    (
      callManager as unknown as {
        startRecvSession: (id: string, params: { sendOffer: () => void; token: string }) => void;
      }
    ).startRecvSession('audio-id', { sendOffer: jest.fn(), token: 'test-token' });

    // Ждем завершения промиса call
    await flushPromises();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 0);
    });
    await flushPromises();

    expect(eventHandler).toHaveBeenCalledTimes(1);
  });

  it('startRecvSession: при ошибке call выполняет stopRecvSession', async () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');

    const stopSpy = jest
      .spyOn(
        callManager as unknown as {
          stopRecvSession: () => void;
        },
        'stopRecvSession',
      )
      .mockImplementation(() => {});

    // Мокаем фабрику так, чтобы она возвращала экземпляр с call, который отклоняется
    const RecvSessionModule = jest.requireMock('../RecvSession') as { default: jest.Mock };

    RecvSessionModule.default.mockImplementationOnce((config, tools) => {
      const inst = mockRecvSession.create();

      inst.config = config;
      inst.tools = tools;
      // Устанавливаем мок на call, который отклоняется - это покрывает строку 299
      inst.call = jest.fn().mockRejectedValueOnce(new Error('fail'));

      return inst;
    });

    (
      callManager as unknown as {
        startRecvSession: (id: string, params: { sendOffer: () => void; token: string }) => void;
      }
    ).startRecvSession('audio-id', { sendOffer: jest.fn(), token: 'test-token' });

    // Ждем завершения промиса и выполнения catch-блока на строке 299
    // Используем несколько вызовов flushPromises и setTimeout для гарантии выполнения всех микротасок
    await flushPromises();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 0);
    });
    await flushPromises();
    await flushPromises();

    // stopRecvSession вызывается дважды: в начале startRecvSession (строка 285) и в catch-блоке (строка 299)
    expect(stopSpy).toHaveBeenCalledTimes(2);
    expect(mockRecvSession.instance?.call).toHaveBeenCalledWith({
      conferenceNumber: '123',
      token: 'test-token',
    });
  });

  it('startRecvSession: не триггерит событие recv-session-started при ошибке call', async () => {
    jest.spyOn(callManager.stateMachine, 'number', 'get').mockReturnValue('123');

    const startedEventHandler = jest.fn();
    const endedEventHandler = jest.fn();

    callManager.on(EEvent.RECV_SESSION_STARTED, startedEventHandler);
    callManager.on(EEvent.RECV_SESSION_ENDED, endedEventHandler);

    // Мокаем фабрику так, чтобы она возвращала экземпляр с call, который отклоняется
    const RecvSessionModule = jest.requireMock('../RecvSession') as { default: jest.Mock };

    RecvSessionModule.default.mockImplementationOnce((config, tools) => {
      const inst = mockRecvSession.create();

      inst.config = config;
      inst.tools = tools;
      inst.call = jest.fn().mockRejectedValueOnce(new Error('fail'));

      return inst;
    });

    (
      callManager as unknown as {
        startRecvSession: (id: string, params: { sendOffer: () => void; token: string }) => void;
      }
    ).startRecvSession('audio-id', { sendOffer: jest.fn(), token: 'test-token' });

    // Ждем завершения промиса и выполнения catch-блока
    await flushPromises();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 0);
    });
    await flushPromises();
    await flushPromises();

    expect(startedEventHandler).not.toHaveBeenCalled();
    expect(endedEventHandler).toHaveBeenCalledTimes(2); // один раз в начале startRecvSession, второй раз в catch
  });

  it('stopRecvSession: закрывает сессию, сбрасывает слушатель и менеджер', () => {
    const recvManager = Reflect.get(
      callManager as unknown as object,
      'recvRemoteStreamsManager',
    ) as RemoteStreamsManager;
    const recvManagerResetSpy = jest.spyOn(recvManager, 'reset');

    // подготовим сессию
    const closeSpy = jest.fn();

    (callManager as unknown as { recvSession?: { close: () => void } }).recvSession = {
      close: closeSpy,
    };

    (
      callManager as unknown as { disposeRecvSessionTrackListener?: () => void }
    ).disposeRecvSessionTrackListener = jest.fn();

    (callManager as unknown as { stopRecvSession: () => void }).stopRecvSession();

    expect(closeSpy).toHaveBeenCalled();
    expect(Reflect.get(callManager as unknown as object, 'recvSession')).toBeUndefined();
    expect(
      Reflect.get(callManager as unknown as object, 'disposeRecvSessionTrackListener'),
    ).toBeUndefined();
    expect(recvManagerResetSpy).toHaveBeenCalled();
  });

  it('stopRecvSession: триггерит событие recv-session-ended', () => {
    const eventHandler = jest.fn();

    callManager.on(EEvent.RECV_SESSION_ENDED, eventHandler);

    // подготовим сессию
    const closeSpy = jest.fn();

    (callManager as unknown as { recvSession?: { close: () => void } }).recvSession = {
      close: closeSpy,
    };

    (
      callManager as unknown as { disposeRecvSessionTrackListener?: () => void }
    ).disposeRecvSessionTrackListener = jest.fn();

    (callManager as unknown as { stopRecvSession: () => void }).stopRecvSession();

    expect(eventHandler).toHaveBeenCalledTimes(1);
  });

  it('remote-streams-changed: вызывается при добавлении нового потока (isAddedStream: true)', () => {
    const activeManager = {
      getStreams: jest.fn().mockReturnValue([new MediaStream()]),
    } as unknown as RemoteStreamsManager;
    const triggerSpy = jest.spyOn(callManager.events, 'trigger');
    const mainStream = new MediaStream();

    // Мокаем getActiveStreamsManagerTools для возврата активного менеджера
    // @ts-expect-error
    callManager.getActiveStreamsManagerTools = jest.fn().mockReturnValue({
      manager: activeManager,
      getRemoteStreams: () => {
        return { mainStream };
      },
    });

    // @ts-expect-error
    callManager.handleChangedRemoteTracks(activeManager, 'added', {
      isAddedStream: true,
      isRemovedStream: false,
      trackId: 't1',
      participantId: 'p1',
    });

    expect(triggerSpy).toHaveBeenCalledTimes(2);
    expect(triggerSpy).toHaveBeenCalledWith(
      'remote-tracks-changed',
      expect.objectContaining({
        streams: { mainStream },
        changeType: 'added',
        participantId: 'p1',
        trackId: 't1',
      }),
    );
    expect(triggerSpy).toHaveBeenCalledWith(
      'remote-streams-changed',
      expect.objectContaining({
        streams: { mainStream },
      }),
    );
  });

  it('remote-streams-changed: НЕ вызывается при добавлении трека в существующий поток (isAddedStream: false)', () => {
    const activeManager = {
      getStreams: jest.fn().mockReturnValue([new MediaStream()]),
    } as unknown as RemoteStreamsManager;
    const triggerSpy = jest.spyOn(callManager.events, 'trigger');
    const mainStream = new MediaStream();

    // Мокаем getActiveStreamsManagerTools для возврата активного менеджера
    // @ts-expect-error
    callManager.getActiveStreamsManagerTools = jest.fn().mockReturnValue({
      manager: activeManager,
      getRemoteStreams: () => {
        return { mainStream };
      },
    });

    // @ts-expect-error
    callManager.handleChangedRemoteTracks(activeManager, 'added', {
      isAddedStream: false,
      isRemovedStream: false,
      trackId: 't1',
      participantId: 'p1',
    });

    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy).toHaveBeenCalledWith(
      'remote-tracks-changed',
      expect.objectContaining({
        streams: { mainStream },
        changeType: 'added',
        participantId: 'p1',
        trackId: 't1',
      }),
    );
    expect(triggerSpy).not.toHaveBeenCalledWith('remote-streams-changed', expect.anything());
  });

  it('remote-streams-changed: вызывается при удалении потока (isRemovedStream: true)', () => {
    const activeManager = {
      getStreams: jest.fn().mockReturnValue([new MediaStream()]),
    } as unknown as RemoteStreamsManager;
    const triggerSpy = jest.spyOn(callManager.events, 'trigger');
    const mainStream = new MediaStream();

    // Мокаем getActiveStreamsManagerTools для возврата активного менеджера
    // @ts-expect-error
    callManager.getActiveStreamsManagerTools = jest.fn().mockReturnValue({
      manager: activeManager,
      getRemoteStreams: () => {
        return { mainStream };
      },
    });

    // @ts-expect-error
    callManager.handleChangedRemoteTracks(activeManager, 'removed', {
      isAddedStream: false,
      isRemovedStream: true,
      trackId: 't1',
      participantId: 'p1',
    });

    expect(triggerSpy).toHaveBeenCalledTimes(2);
    expect(triggerSpy).toHaveBeenCalledWith(
      'remote-tracks-changed',
      expect.objectContaining({
        streams: { mainStream },
        changeType: 'removed',
        participantId: 'p1',
        trackId: 't1',
      }),
    );
    expect(triggerSpy).toHaveBeenCalledWith(
      'remote-streams-changed',
      expect.objectContaining({
        streams: { mainStream },
      }),
    );
  });

  it('remote-streams-changed: НЕ вызывается при удалении трека из потока (isRemovedStream: false)', () => {
    const activeManager = {
      getStreams: jest.fn().mockReturnValue([new MediaStream()]),
    } as unknown as RemoteStreamsManager;
    const triggerSpy = jest.spyOn(callManager.events, 'trigger');
    const mainStream = new MediaStream();

    // Мокаем getActiveStreamsManagerTools для возврата активного менеджера
    // @ts-expect-error
    callManager.getActiveStreamsManagerTools = jest.fn().mockReturnValue({
      manager: activeManager,
      getRemoteStreams: () => {
        return { mainStream };
      },
    });

    // @ts-expect-error
    callManager.handleChangedRemoteTracks(activeManager, 'removed', {
      isAddedStream: false,
      isRemovedStream: false,
      trackId: 't1',
      participantId: 'p1',
    });

    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy).toHaveBeenCalledWith(
      'remote-tracks-changed',
      expect.objectContaining({
        streams: { mainStream },
        changeType: 'removed',
        participantId: 'p1',
        trackId: 't1',
      }),
    );
    expect(triggerSpy).not.toHaveBeenCalledWith('remote-streams-changed', expect.anything());
  });
});
