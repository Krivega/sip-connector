import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import CallManager from '../@CallManager';
import { RemoteStreamsManager } from '../RemoteStreamsManager';

import type { RTCSession } from '@krivega/jssip';

// Вспомогательный тип для доступа к защищённым свойствам CallManager
interface CallManagerTestAccess {
  rtcSession?: unknown;
  isPendingCall?: boolean;
  isPendingAnswer?: boolean;
  callConfiguration?: Record<string, unknown>;
}

describe('CallManager', () => {
  let callManager: CallManager;
  let mediaStream: MediaStream;

  beforeEach(() => {
    callManager = new CallManager();
    mediaStream = new MediaStream();
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

  it('getRemoteStreams: возвращает undefined если нет connection', () => {
    jest.spyOn(callManager, 'connection', 'get').mockReturnValue(undefined);
    expect(callManager.getRemoteStreams()).toBeUndefined();
  });

  it('getRemoteStreams: вызывает remoteStreamsManager', () => {
    const connection = {
      getReceivers: () => {
        return [{ track: { kind: 'video', id: 'v1' } }];
      },
    } as unknown as RTCPeerConnection;

    // @ts-expect-error
    jest.spyOn(callManager.mcuSession, 'connection', 'get').mockReturnValue(connection);

    const spy = jest.spyOn(RemoteStreamsManager.prototype, 'generateStreams');

    callManager.getRemoteStreams();
    expect(spy).toHaveBeenCalled();
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

    const callManagerLocal = new CallManager();
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
});

describe('CallManager - дополнительные тесты для покрытия', () => {
  let callManager: CallManager;
  let callManagerTest: CallManagerTestAccess;

  beforeEach(() => {
    callManager = new CallManager();
    callManagerTest = callManager as unknown as CallManagerTestAccess;
    jest.clearAllMocks();
  });

  it('getRemoteStreams: вызывает generateAudioStreams если нет видео-треков', () => {
    const connection = {
      getReceivers: () => {
        return [{ track: { kind: 'audio', id: 'a1' } }];
      },
    } as unknown as RTCPeerConnection;

    // @ts-expect-error
    jest.spyOn(callManager.mcuSession, 'connection', 'get').mockReturnValue(connection);

    const spy = jest.spyOn(RemoteStreamsManager.prototype, 'generateAudioStreams');

    callManager.getRemoteStreams();
    expect(spy).toHaveBeenCalled();
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

  it('getCallConfiguration: возвращает копию callConfiguration', () => {
    callManagerTest.callConfiguration = { number: '123', answer: true };
    expect(callManager.getCallConfiguration()).toEqual({ number: '123', answer: true });
    expect(callManager.getCallConfiguration()).not.toBe(callManagerTest.callConfiguration);
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

  describe('addTransceiver', () => {
    it('should call addTransceiver on rtcSession with audio kind', async () => {
      const mockTransceiver = {} as RTCRtpTransceiver;
      const mockRtcSession = {
        addTransceiver: jest.fn().mockResolvedValue(mockTransceiver),
      } as unknown as RTCSession;

      // Мокаем rtcSession
      // @ts-expect-error
      Object.defineProperty(callManager.mcuSession, 'rtcSession', {
        value: mockRtcSession,
        configurable: true,
      });

      const result = await callManager.addTransceiver('audio');

      expect(mockRtcSession.addTransceiver).toHaveBeenCalledWith('audio', undefined);
      expect(result).toBe(mockTransceiver);
    });

    it('should call addTransceiver on rtcSession with video kind', async () => {
      const mockTransceiver = {} as RTCRtpTransceiver;
      const mockRtcSession = {
        addTransceiver: jest.fn().mockResolvedValue(mockTransceiver),
      } as unknown as RTCSession;

      // Мокаем rtcSession
      // @ts-expect-error
      Object.defineProperty(callManager.mcuSession, 'rtcSession', {
        value: mockRtcSession,
        configurable: true,
      });

      const result = await callManager.addTransceiver('video');

      expect(mockRtcSession.addTransceiver).toHaveBeenCalledWith('video', undefined);
      expect(result).toBe(mockTransceiver);
    });

    it('should call addTransceiver on rtcSession with options', async () => {
      const mockTransceiver = {} as RTCRtpTransceiver;
      const options: RTCRtpTransceiverInit = {
        direction: 'sendrecv',
        streams: [],
        sendEncodings: [{ rid: 'test', maxBitrate: 1_000_000 }],
      };
      const mockRtcSession = {
        addTransceiver: jest.fn().mockResolvedValue(mockTransceiver),
      } as unknown as RTCSession;

      // Мокаем rtcSession
      // @ts-expect-error
      Object.defineProperty(callManager.mcuSession, 'rtcSession', {
        value: mockRtcSession,
        configurable: true,
      });

      const result = await callManager.addTransceiver('video', options);

      expect(mockRtcSession.addTransceiver).toHaveBeenCalledWith('video', options);
      expect(result).toBe(mockTransceiver);
    });

    it('should throw error if no rtcSession established', async () => {
      // Мокаем rtcSession чтобы вернуть undefined
      // @ts-expect-error
      Object.defineProperty(callManager.mcuSession, 'rtcSession', {
        get: () => {
          return undefined;
        },
        configurable: true,
      });

      await expect(callManager.addTransceiver('audio')).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('should handle rtcSession.addTransceiver rejection', async () => {
      const error = new Error('Failed to add transceiver');
      const mockRtcSession = {
        addTransceiver: jest.fn().mockRejectedValue(error),
      } as unknown as RTCSession;

      // Мокаем rtcSession
      // @ts-expect-error
      Object.defineProperty(callManager.mcuSession, 'rtcSession', {
        value: mockRtcSession,
        configurable: true,
      });

      await expect(callManager.addTransceiver('audio')).rejects.toThrow(
        'Failed to add transceiver',
      );
      expect(mockRtcSession.addTransceiver).toHaveBeenCalledWith('audio', undefined);
    });

    it('should pass through RTCRtpTransceiverInit options with sendonly direction', async () => {
      const mockTransceiver = {} as RTCRtpTransceiver;
      const addTransceiverMock = jest.fn().mockResolvedValue(mockTransceiver);
      const mockRtcSession = {
        addTransceiver: addTransceiverMock,
      } as unknown as RTCSession;

      // Мокаем rtcSession
      // @ts-expect-error
      Object.defineProperty(callManager.mcuSession, 'rtcSession', {
        value: mockRtcSession,
        configurable: true,
      });

      const options: RTCRtpTransceiverInit = { direction: 'sendonly' };

      await callManager.addTransceiver('audio', options);

      expect(addTransceiverMock).toHaveBeenCalledWith('audio', options);
    });

    it('should pass through RTCRtpTransceiverInit options with sendEncodings', async () => {
      const mockTransceiver = {} as RTCRtpTransceiver;
      const addTransceiverMock = jest.fn().mockResolvedValue(mockTransceiver);
      const mockRtcSession = {
        addTransceiver: addTransceiverMock,
      } as unknown as RTCSession;

      // Мокаем rtcSession
      // @ts-expect-error
      Object.defineProperty(callManager.mcuSession, 'rtcSession', {
        value: mockRtcSession,
        configurable: true,
      });

      const options: RTCRtpTransceiverInit = {
        direction: 'sendrecv',
        sendEncodings: [{ rid: 'high', maxBitrate: 2_000_000 }],
      };

      await callManager.addTransceiver('video', options);

      expect(addTransceiverMock).toHaveBeenCalledWith('video', options);
    });
  });
});
