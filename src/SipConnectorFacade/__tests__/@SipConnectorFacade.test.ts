import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '@/__fixtures__';
import delayPromise from '@/__fixtures__/delayPromise';
import JsSIP from '@/__fixtures__/jssip.mock';
import remoteCallerData from '@/__fixtures__/remoteCallerData';
import resolveParameters from '@/ConnectionManager/utils/resolveParameters';
import { doMockSipConnector } from '@/doMock';
import SipConnectorFacade, { TEST_HOOKS } from '../@SipConnectorFacade';

import type { TConnectionConfigurationWithUa } from '@/ConnectionManager';
import type { SipConnector } from '@/SipConnector';

describe('SipConnectorFacade comprehensive', () => {
  let sipConnector: SipConnector;
  let sipConnectorFacade: SipConnectorFacade;

  beforeEach(() => {
    jest.clearAllMocks();
    sipConnector = doMockSipConnector();
    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  describe('Proxy methods', () => {
    it('должен проксировать методы SipConnector через Proxy', () => {
      // Проверяем, что прокси методы работают
      expect(sipConnectorFacade.on).toBeDefined();
      expect(sipConnectorFacade.once).toBeDefined();
      expect(sipConnectorFacade.onceRace).toBeDefined();
      expect(sipConnectorFacade.wait).toBeDefined();
      expect(sipConnectorFacade.off).toBeDefined();
      expect(sipConnectorFacade.sendDTMF).toBeDefined();
      expect(sipConnectorFacade.hangUp).toBeDefined();
      expect(sipConnectorFacade.declineToIncomingCall).toBeDefined();
      expect(sipConnectorFacade.sendChannels).toBeDefined();
      expect(sipConnectorFacade.checkTelephony).toBeDefined();
      expect(sipConnectorFacade.waitChannels).toBeDefined();
      expect(sipConnectorFacade.ping).toBeDefined();
      expect(sipConnectorFacade.isConfigured).toBeDefined();
      expect(sipConnectorFacade.isRegistered).toBeDefined();
    });

    it('должен правильно привязывать контекст для прокси методов', () => {
      const onSpy = jest.spyOn(sipConnector, 'on');
      const handler = jest.fn();

      sipConnectorFacade.on('connection:connected', handler);

      expect(onSpy).toHaveBeenCalledWith('connection:connected', handler);
      expect(onSpy.mock.instances[0]).toBe(sipConnector);
    });
  });

  describe('connectToServer', () => {
    it('должен успешно подключиться к серверу', async () => {
      const connectSpy = jest
        .spyOn(sipConnector, 'connect')
        .mockResolvedValue({} as unknown as TConnectionConfigurationWithUa);

      const result = await sipConnectorFacade.connectToServer({
        displayName: 'DISPLAY_NAME',
        userAgent: 'Chrome',
        sipServerUrl: 'wss://sip.example.com/ws',
        sipServerIp: 'sip.example.com',
        user: 'testuser',
        password: 'testpass',
        register: true,
      });

      const connectParameters = connectSpy.mock.calls[0][0];
      const expectedParameters = await resolveParameters(connectParameters);

      expect(result.isSuccessful).toBe(true);
      expect(result.configuration).toBeDefined();
      expect(expectedParameters).toEqual({
        userAgent: 'Chrome',
        sipServerUrl: 'wss://sip.example.com/ws',
        sipServerIp: 'sip.example.com',
        displayName: 'DISPLAY_NAME',
        password: 'testpass',
        user: 'testuser',
        register: true,
        remoteAddress: undefined,
      });
    });

    it('должен обработать ошибку подключения без отключения', async () => {
      const connectSpy = jest
        .spyOn(sipConnector, 'connect')
        .mockRejectedValue(new Error('Connection failed'));

      await expect(
        sipConnectorFacade.connectToServer({
          displayName: 'DISPLAY_NAME',
          userAgent: 'Chrome',
          sipServerUrl: 'wss://sip.example.com/ws',
          sipServerIp: 'sip.example.com',
        }),
      ).rejects.toThrow('Connection failed');

      expect(connectSpy).toHaveBeenCalled();
    });

    it('должен вернуть isSuccessful=false для canceled-ошибки без отключения', async () => {
      jest.resetModules();

      jest.doMock('@krivega/cancelable-promise', () => {
        return {
          isCanceledError: () => {
            return true;
          },
        };
      });
      jest.doMock('repeated-calls', () => {
        return {
          hasCanceledError: () => {
            return true;
          },
        };
      });

      const { default: SipConnectorFacadeIsolated } = (await import('../@SipConnectorFacade')) as {
        default: typeof SipConnectorFacade;
      };

      const localSipConnector = doMockSipConnector();

      jest.spyOn(localSipConnector, 'connect').mockRejectedValue(new Error('canceled'));

      const facade = new SipConnectorFacadeIsolated(localSipConnector);
      const result = await facade.connectToServer({
        displayName: 'DISPLAY_NAME',
        userAgent: 'Chrome',
        sipServerUrl: 'wss://sip.example.com/ws',
        sipServerIp: 'sip.example.com',
      });

      expect(result.isSuccessful).toBe(false);
    });

    it('должен вернуть isSuccessful=false для canceled-ошибки', async () => {
      jest.resetModules();

      jest.doMock('@krivega/cancelable-promise', () => {
        return {
          isCanceledError: () => {
            return true;
          },
        };
      });
      jest.doMock('repeated-calls', () => {
        return {
          hasCanceledError: () => {
            return true;
          },
        };
      });

      const { default: SipConnectorFacadeIsolated } = (await import('../@SipConnectorFacade')) as {
        default: typeof SipConnectorFacade;
      };

      const localSipConnector = doMockSipConnector();

      jest.spyOn(localSipConnector, 'connect').mockRejectedValue(new Error('canceled'));

      const facade = new SipConnectorFacadeIsolated(localSipConnector);
      const result = await facade.connectToServer({
        displayName: 'DISPLAY_NAME',
        userAgent: 'Chrome',
        sipServerUrl: 'wss://sip.example.com/ws',
        sipServerIp: 'sip.example.com',
      });

      expect(result.isSuccessful).toBe(false);
    });
  });

  describe('callToServer', () => {
    const mockMediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    const mockCallParams = {
      conference: 'test-conference',
      mediaStream: mockMediaStream,
      setRemoteStreams: jest.fn(),
      onBeforeProgressCall: jest.fn(),
      onSuccessProgressCall: jest.fn(),
      onEnterPurgatory: jest.fn(),
      onEnterConference: jest.fn(),
      onFailProgressCall: jest.fn(),
      onFinishProgressCall: jest.fn(),
      onEndedCall: jest.fn(),
    };

    beforeEach(() => {
      jest.spyOn(sipConnector, 'call').mockResolvedValue({} as unknown as RTCPeerConnection);
      jest.spyOn(sipConnector, 'on').mockReturnValue(() => {});
      jest.spyOn(sipConnector, 'onceRace').mockReturnValue(() => {});
    });

    it('должен успешно выполнить звонок', async () => {
      const result = await sipConnectorFacade.callToServer(mockCallParams);

      expect(result).toBeDefined();
      expect(mockCallParams.onBeforeProgressCall).toHaveBeenCalledWith('test-conference');
      expect(mockCallParams.onSuccessProgressCall).toHaveBeenCalledWith({ isPurgatory: false });
      expect(mockCallParams.onFinishProgressCall).toHaveBeenCalled();
    });

    it('должен обработать успешный прогресс звонка', async () => {
      jest.spyOn(sipConnector, 'on').mockImplementation((event, handler) => {
        if (event === 'api:enterRoom') {
          // Симулируем событие enterRoom
          setTimeout(() => {
            handler({ room: 'test-room' });
          }, 0);
        }

        return () => {};
      });

      await sipConnectorFacade.callToServer(mockCallParams);

      // Ждем обработки события
      await delayPromise(10);

      expect(mockCallParams.onSuccessProgressCall).toHaveBeenCalledWith({ isPurgatory: false });
      expect(mockCallParams.onEnterConference).toHaveBeenCalledWith({
        isSuccessProgressCall: true,
      });
    });

    it('должен обработать вход в purgatory', async () => {
      jest.spyOn(sipConnector, 'on').mockImplementation((event, handler) => {
        if (event === 'api:enterRoom') {
          // Симулируем событие enterRoom с purgatory
          setTimeout(() => {
            handler({ room: 'purgatory' });
          }, 0);
        }

        return () => {};
      });

      await sipConnectorFacade.callToServer(mockCallParams);

      // Ждем обработки события
      await delayPromise(10);

      expect(mockCallParams.onEnterPurgatory).toHaveBeenCalled();
    });

    it('должен обработать ошибку звонка', async () => {
      jest.spyOn(sipConnector, 'call').mockRejectedValue(new Error('Call failed'));

      await expect(sipConnectorFacade.callToServer(mockCallParams)).rejects.toThrow('Call failed');

      expect(mockCallParams.onFailProgressCall).toHaveBeenCalled();
      expect(mockCallParams.onFinishProgressCall).toHaveBeenCalled();
    });

    it('должен обработать завершение звонка', async () => {
      jest.spyOn(sipConnector, 'onceRace').mockImplementation((events, handler) => {
        // Симулируем событие завершения звонка
        const timeout = setTimeout(() => {
          handler(undefined, events[0]);
        }, 0);

        return () => {
          clearTimeout(timeout);
        };
      });

      await sipConnectorFacade.callToServer(mockCallParams);

      // Ждем обработки события
      await delayPromise(10);

      expect(mockCallParams.onEndedCall).toHaveBeenCalled();
    });

    it('должен вызвать onEnterConference без onEnterPurgatory', async () => {
      const onEnterConference = jest.fn();
      const paramsWithoutPurgatory = {
        conference: mockCallParams.conference,
        mediaStream: mockCallParams.mediaStream,
        setRemoteStreams: mockCallParams.setRemoteStreams,
        onBeforeProgressCall: mockCallParams.onBeforeProgressCall,
        onSuccessProgressCall: mockCallParams.onSuccessProgressCall,
        onEnterConference,
        onFailProgressCall: mockCallParams.onFailProgressCall,
        onFinishProgressCall: mockCallParams.onFinishProgressCall,
        onEndedCall: mockCallParams.onEndedCall,
      };

      jest.spyOn(sipConnector, 'on').mockImplementation((event, handler) => {
        if (event === 'api:enterRoom') {
          setTimeout(() => {
            handler({ room: 'test-room' });
          }, 0);
        }

        return () => {};
      });

      await sipConnectorFacade.callToServer(paramsWithoutPurgatory as never);

      await delayPromise(10);

      expect(onEnterConference).toHaveBeenCalledWith({ isSuccessProgressCall: true });
    });

    it('не должен вызывать onEnterConference при входе в purgatory без onEnterPurgatory', async () => {
      const onEnterConference = jest.fn();
      const paramsWithoutPurgatory = {
        conference: mockCallParams.conference,
        mediaStream: mockCallParams.mediaStream,
        setRemoteStreams: mockCallParams.setRemoteStreams,
        onBeforeProgressCall: mockCallParams.onBeforeProgressCall,
        onSuccessProgressCall: mockCallParams.onSuccessProgressCall,
        onEnterConference,
        onFailProgressCall: mockCallParams.onFailProgressCall,
        onFinishProgressCall: mockCallParams.onFinishProgressCall,
        onEndedCall: mockCallParams.onEndedCall,
      };

      jest.spyOn(sipConnector, 'on').mockImplementation((event, handler) => {
        if (event === 'api:enterRoom') {
          setTimeout(() => {
            handler({ room: 'purgatory' });
          }, 0);
        }

        return () => {};
      });

      await sipConnectorFacade.callToServer(paramsWithoutPurgatory as never);

      await delayPromise(10);

      expect(onEnterConference).not.toHaveBeenCalled();
    });

    it('должен дергать debounced обработчик при событии ontrack (покрытие 258 строки)', async () => {
      jest.useFakeTimers();

      const setRemoteStreams = jest.fn();
      const params = {
        conference: mockCallParams.conference,
        mediaStream: mockMediaStream,
        setRemoteStreams,
      } as const;

      jest.spyOn(sipConnector, 'getRemoteStreams').mockReturnValue([mockMediaStream]);

      const callSpy = jest.spyOn(sipConnector, 'call');

      callSpy.mockImplementation((async (options: unknown) => {
        const callOptions = options as { ontrack?: (event: { track: MediaStreamTrack }) => void };

        if (callOptions.ontrack) {
          const videoTrack = { kind: 'video', readyState: 'live' } as MediaStreamTrack;

          callOptions.ontrack({ track: videoTrack });
        }

        return {} as unknown as RTCPeerConnection;
      }) as unknown as typeof sipConnector.call);

      await sipConnectorFacade.callToServer(params as never);

      jest.advanceTimersByTime(250);

      expect(setRemoteStreams).toHaveBeenCalledWith([mockMediaStream]);

      jest.useRealTimers();
    });

    it('не должен вызывать handleEnterRoomEvent, когда onEnterPurgatory и onEnterConference не заданы', async () => {
      let enterHandler: ((args: { room: string }) => void) | undefined;

      jest.spyOn(sipConnector, 'on').mockImplementation((event, handler) => {
        if (event === 'api:enterRoom') {
          enterHandler = handler as (args: { room: string }) => void;
        }

        return () => {};
      });

      const handleEnterRoomEventSpy = jest.spyOn(TEST_HOOKS, 'handleEnterRoomEvent');

      await sipConnectorFacade.callToServer({
        conference: mockCallParams.conference,
        mediaStream: mockMediaStream,
        setRemoteStreams: mockCallParams.setRemoteStreams,
      } as never);

      // триггерим enterRoom без установленных обработчиков onEnterPurgatory/onEnterConference
      enterHandler?.({ room: 'test-room' });

      expect(handleEnterRoomEventSpy).not.toHaveBeenCalled();
    });
  });

  describe('answerToIncomingCall', () => {
    const mockMediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    const mockAnswerParams = {
      mediaStream: mockMediaStream,
      setRemoteStreams: jest.fn(),
      onBeforeProgressCall: jest.fn(),
      onSuccessProgressCall: jest.fn(),
      onEnterPurgatory: jest.fn(),
      onEnterConference: jest.fn(),
      onFailProgressCall: jest.fn(),
      onFinishProgressCall: jest.fn(),
      onEndedCall: jest.fn(),
    };

    beforeEach(() => {
      jest
        .spyOn(sipConnector, 'answerToIncomingCall')
        .mockResolvedValue({} as unknown as RTCPeerConnection);
      jest.spyOn(sipConnector, 'on').mockReturnValue(() => {});
      jest.spyOn(sipConnector, 'onceRace').mockReturnValue(() => {});
      Object.defineProperty(sipConnector, 'remoteCallerData', {
        get: () => {
          return { incomingNumber: '12345' };
        },
        configurable: true,
      });
    });

    it('должен успешно ответить на входящий звонок', async () => {
      const result = await sipConnectorFacade.answerToIncomingCall(mockAnswerParams);

      expect(result).toBeDefined();
      expect(mockAnswerParams.onBeforeProgressCall).toHaveBeenCalledWith('12345');
      expect(mockAnswerParams.onSuccessProgressCall).toHaveBeenCalledWith({ isPurgatory: false });
      expect(mockAnswerParams.onFinishProgressCall).toHaveBeenCalled();
    });

    it('должен вызвать onBeforeProgressCall с undefined если нет incomingNumber', async () => {
      Object.defineProperty(sipConnector, 'remoteCallerData', {
        get: () => {
          return {} as unknown as { incomingNumber?: string };
        },
        configurable: true,
      });

      await sipConnectorFacade.answerToIncomingCall(mockAnswerParams);

      expect(mockAnswerParams.onBeforeProgressCall).toHaveBeenCalledWith(undefined);
    });

    it('должен обработать ошибку ответа на звонок', async () => {
      jest
        .spyOn(sipConnector, 'answerToIncomingCall')
        .mockRejectedValue(new Error('Answer failed'));

      await expect(sipConnectorFacade.answerToIncomingCall(mockAnswerParams)).rejects.toThrow(
        'Answer failed',
      );

      expect(mockAnswerParams.onFailProgressCall).toHaveBeenCalled();
      expect(mockAnswerParams.onFinishProgressCall).toHaveBeenCalled();
    });

    it('должен обработать завершение звонка (answer)', async () => {
      jest.spyOn(sipConnector, 'onceRace').mockImplementation((events, handler) => {
        const timeout = setTimeout(() => {
          handler(undefined, events[0]);
        }, 0);

        return () => {
          clearTimeout(timeout);
        };
      });

      await sipConnectorFacade.answerToIncomingCall(mockAnswerParams);

      await delayPromise(10);

      expect(mockAnswerParams.onEndedCall).toHaveBeenCalled();
    });

    it('должен вызвать onEnterPurgatory при входе в purgatory', async () => {
      const onEnterPurgatory = jest.fn();
      const paramsWithPurgatory = {
        mediaStream: mockMediaStream,
        setRemoteStreams: mockAnswerParams.setRemoteStreams,
        onBeforeProgressCall: mockAnswerParams.onBeforeProgressCall,
        onSuccessProgressCall: mockAnswerParams.onSuccessProgressCall,
        onEnterPurgatory,
        onFailProgressCall: mockAnswerParams.onFailProgressCall,
        onFinishProgressCall: mockAnswerParams.onFinishProgressCall,
        onEndedCall: mockAnswerParams.onEndedCall,
      } as const;

      jest.spyOn(sipConnector, 'on').mockImplementation((event, handler) => {
        if (event === 'api:enterRoom') {
          setTimeout(() => {
            (handler as (args: { room: string }) => void)({ room: 'purgatory' });
          }, 0);
        }

        return () => {};
      });

      await sipConnectorFacade.answerToIncomingCall(paramsWithPurgatory as never);

      await delayPromise(10);

      expect(onEnterPurgatory).toHaveBeenCalled();
    });

    it('должен вызвать onEnterConference без onEnterPurgatory', async () => {
      const onEnterConference = jest.fn();
      const paramsWithoutPurgatory = {
        mediaStream: mockMediaStream,
        setRemoteStreams: mockAnswerParams.setRemoteStreams,
        onBeforeProgressCall: mockAnswerParams.onBeforeProgressCall,
        onSuccessProgressCall: mockAnswerParams.onSuccessProgressCall,
        onEnterConference,
        onFailProgressCall: mockAnswerParams.onFailProgressCall,
        onFinishProgressCall: mockAnswerParams.onFinishProgressCall,
        onEndedCall: mockAnswerParams.onEndedCall,
      } as const;

      jest.spyOn(sipConnector, 'on').mockImplementation((event, handler) => {
        if (event === 'api:enterRoom') {
          setTimeout(() => {
            (handler as (args: { room: string }) => void)({ room: 'test-room' });
          }, 0);
        }

        return () => {};
      });

      await sipConnectorFacade.answerToIncomingCall(paramsWithoutPurgatory as never);

      await delayPromise(10);

      expect(onEnterConference).toHaveBeenCalledWith({ isSuccessProgressCall: true });
    });

    it('не должен вызывать onEnterConference при входе в purgatory без onEnterPurgatory', async () => {
      const onEnterConference = jest.fn();
      const paramsWithoutPurgatory = {
        mediaStream: mockMediaStream,
        setRemoteStreams: mockAnswerParams.setRemoteStreams,
        onBeforeProgressCall: mockAnswerParams.onBeforeProgressCall,
        onSuccessProgressCall: mockAnswerParams.onSuccessProgressCall,
        onEnterConference,
        onFailProgressCall: mockAnswerParams.onFailProgressCall,
        onFinishProgressCall: mockAnswerParams.onFinishProgressCall,
        onEndedCall: mockAnswerParams.onEndedCall,
      } as const;

      jest.spyOn(sipConnector, 'on').mockImplementation((event, handler) => {
        if (event === 'api:enterRoom') {
          setTimeout(() => {
            (handler as (args: { room: string }) => void)({ room: 'purgatory' });
          }, 0);
        }

        return () => {};
      });

      await sipConnectorFacade.answerToIncomingCall(paramsWithoutPurgatory as never);

      await delayPromise(10);

      expect(onEnterConference).not.toHaveBeenCalled();
    });

    it('должен дергать debounced обработчик при событии ontrack (answerToIncomingCall)', async () => {
      jest.useFakeTimers();

      const setRemoteStreams = jest.fn();
      const params = {
        mediaStream: mockMediaStream,
        setRemoteStreams,
      } as const;

      jest.spyOn(sipConnector, 'getRemoteStreams').mockReturnValue([mockMediaStream]);

      const answerSpy = jest.spyOn(sipConnector, 'answerToIncomingCall');

      answerSpy.mockImplementation((async (options: unknown) => {
        const answerOptions = options as { ontrack?: (event: { track: MediaStreamTrack }) => void };

        if (answerOptions.ontrack) {
          const videoTrack = { kind: 'video', readyState: 'live' } as MediaStreamTrack;

          answerOptions.ontrack({ track: videoTrack });
        }

        return {} as unknown as RTCPeerConnection;
      }) as unknown as typeof sipConnector.answerToIncomingCall);

      await sipConnectorFacade.answerToIncomingCall(params as never);

      jest.advanceTimersByTime(250);

      expect(setRemoteStreams).toHaveBeenCalledWith([mockMediaStream]);

      jest.useRealTimers();
    });
  });

  describe('disconnectFromServer', () => {
    it('должен успешно отключиться от сервера', async () => {
      jest.spyOn(sipConnector, 'disconnect').mockResolvedValue(undefined);

      const result = await sipConnectorFacade.disconnectFromServer();

      expect(result.isSuccessful).toBe(true);
    });

    it('должен обработать ошибку отключения', async () => {
      jest.spyOn(sipConnector, 'disconnect').mockRejectedValue(new Error('Disconnect failed'));

      const result = await sipConnectorFacade.disconnectFromServer();

      expect(result.isSuccessful).toBe(false);
    });
  });

  describe('Presentation methods', () => {
    const mockMediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    beforeEach(() => {
      jest.spyOn(sipConnector, 'startPresentation').mockResolvedValue(mockMediaStream);
      jest.spyOn(sipConnector, 'updatePresentation').mockResolvedValue(mockMediaStream);
      jest.spyOn(sipConnector, 'stopPresentation').mockResolvedValue(undefined);
    });

    it('должен запустить презентацию', async () => {
      const result = await sipConnectorFacade.startPresentation({
        mediaStream: mockMediaStream,
        isP2P: false,
        contentHint: 'detail',
        degradationPreference: 'maintain-framerate',
        sendEncodings: [],
        callLimit: 10,
      });

      expect(result).toBe(mockMediaStream);
      expect(sipConnector.startPresentation).toHaveBeenCalledWith(mockMediaStream, {
        isP2P: false,
        contentHint: 'detail',
        callLimit: 10,
        degradationPreference: 'maintain-framerate',
        sendEncodings: [],
        onAddedTransceiver: undefined,
      });
    });

    it('должен обновить презентацию', async () => {
      const result = await sipConnectorFacade.updatePresentation({
        mediaStream: mockMediaStream,
        isP2P: true,
        contentHint: 'motion',
        degradationPreference: 'maintain-resolution',
        sendEncodings: [],
      });

      expect(result).toBe(mockMediaStream);
      expect(sipConnector.updatePresentation).toHaveBeenCalledWith(mockMediaStream, {
        isP2P: true,
        contentHint: 'motion',
        degradationPreference: 'maintain-resolution',
        sendEncodings: [],
        onAddedTransceiver: undefined,
      });
    });

    it('должен остановить презентацию', async () => {
      await sipConnectorFacade.stopShareSipConnector({ isP2P: true });

      expect(sipConnector.stopPresentation).toHaveBeenCalledWith({ isP2P: true });
    });

    it('должен обработать ошибку остановки презентации', async () => {
      jest.spyOn(sipConnector, 'stopPresentation').mockRejectedValue(new Error('Stop failed'));

      await expect(
        sipConnectorFacade.stopShareSipConnector({ isP2P: false }),
      ).resolves.toBeUndefined();
    });

    it('должен остановить презентацию с параметрами по умолчанию', async () => {
      await sipConnectorFacade.stopShareSipConnector();

      expect(sipConnector.stopPresentation).toHaveBeenCalledWith({ isP2P: false });
    });
  });

  describe('Media control methods', () => {
    beforeEach(() => {
      jest.spyOn(sipConnector, 'sendRefusalToTurnOnMic').mockResolvedValue(undefined);
      jest.spyOn(sipConnector, 'sendRefusalToTurnOnCam').mockResolvedValue(undefined);
      jest.spyOn(sipConnector, 'sendMediaState').mockResolvedValue(undefined);
      jest.spyOn(sipConnector, 'askPermissionToEnableCam').mockResolvedValue(undefined);
    });

    it('должен отправить отказ на включение микрофона', async () => {
      await sipConnectorFacade.sendRefusalToTurnOnMic();

      expect(sipConnector.sendRefusalToTurnOnMic).toHaveBeenCalled();
    });

    it('должен отправить отказ на включение камеры', async () => {
      await sipConnectorFacade.sendRefusalToTurnOnCam();

      expect(sipConnector.sendRefusalToTurnOnCam).toHaveBeenCalled();
    });

    it('должен отправить состояние медиа', async () => {
      await sipConnectorFacade.sendMediaState({
        isEnabledCam: true,
        isEnabledMic: false,
      });

      expect(sipConnector.sendMediaState).toHaveBeenCalledWith({
        cam: true,
        mic: false,
      });
    });

    it('должен запросить разрешение на включение камеры', async () => {
      await sipConnectorFacade.askPermissionToEnableCam();

      expect(sipConnector.askPermissionToEnableCam).toHaveBeenCalled();
    });

    it('должен проглотить ошибку sendRefusalToTurnOnMic', async () => {
      (sipConnector.sendRefusalToTurnOnMic as unknown as jest.Mock).mockRejectedValueOnce(
        new Error('mic error'),
      );

      await expect(sipConnectorFacade.sendRefusalToTurnOnMic()).resolves.toBeUndefined();
    });

    it('должен проглотить ошибку sendRefusalToTurnOnCam', async () => {
      (sipConnector.sendRefusalToTurnOnCam as unknown as jest.Mock).mockRejectedValueOnce(
        new Error('cam error'),
      );

      await expect(sipConnectorFacade.sendRefusalToTurnOnCam()).resolves.toBeUndefined();
    });
  });

  describe('replaceMediaStream', () => {
    const mockMediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    beforeEach(() => {
      jest.spyOn(sipConnector, 'replaceMediaStream').mockResolvedValue(undefined);
    });

    it('должен заменить медиа поток', async () => {
      await sipConnectorFacade.replaceMediaStream(mockMediaStream, {
        deleteExisting: true,
        addMissing: false,
        forceRenegotiation: true,
        contentHint: 'detail',
        degradationPreference: 'maintain-framerate',
        sendEncodings: [],
      });

      expect(sipConnector.replaceMediaStream).toHaveBeenCalledWith(mockMediaStream, {
        deleteExisting: true,
        addMissing: false,
        forceRenegotiation: true,
        contentHint: 'detail',
        degradationPreference: 'maintain-framerate',
        sendEncodings: [],
        onAddedTransceiver: undefined,
      });
    });
  });

  describe('Event handlers', () => {
    beforeEach(() => {
      jest.spyOn(sipConnector, 'on').mockReturnValue(() => {});
    });

    it('должен подписаться на событие useLicense', () => {
      const handler = jest.fn();
      const unsubscribe = sipConnectorFacade.onUseLicense(handler);

      expect(sipConnector.on).toHaveBeenCalledWith('api:useLicense', handler);
      expect(typeof unsubscribe).toBe('function');
    });

    it('должен подписаться на событие mustStopPresentation', () => {
      const handler = jest.fn();
      const unsubscribe = sipConnectorFacade.onMustStopPresentation(handler);

      expect(sipConnector.on).toHaveBeenCalledWith('api:mustStopPresentation', handler);
      expect(typeof unsubscribe).toBe('function');
    });

    it('должен подписаться на событие moveToSpectators', () => {
      const handler = jest.fn();
      const unsubscribe = sipConnectorFacade.onMoveToSpectators(handler);

      expect(sipConnector.on).toHaveBeenCalledWith(
        'api:participant:move-request-to-spectators',
        handler,
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('должен подписаться на событие moveToParticipants', () => {
      const handler = jest.fn();
      const unsubscribe = sipConnectorFacade.onMoveToParticipants(handler);

      expect(sipConnector.on).toHaveBeenCalledWith(
        'api:participant:move-request-to-participants',
        handler,
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('должен подписаться на событие stats:collected', () => {
      const handler = jest.fn();
      const unsubscribe = sipConnectorFacade.onStats(handler);

      expect(sipConnector.on).toHaveBeenCalledWith('stats:collected', handler);
      expect(typeof unsubscribe).toBe('function');
    });

    it('должен отписаться от события stats:collected', () => {
      const handler = jest.fn();
      const offSpy = jest.spyOn(sipConnector, 'off');

      sipConnectorFacade.offStats(handler);

      expect(offSpy).toHaveBeenCalledWith('stats:collected', handler);
    });
  });

  describe('Utility methods', () => {
    const mockMediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    beforeEach(() => {
      jest.spyOn(sipConnector, 'getRemoteStreams').mockReturnValue([mockMediaStream]);
    });

    it('должен получить удаленные потоки', () => {
      const result = sipConnectorFacade.getRemoteStreams();

      expect(result).toEqual([mockMediaStream]);
      expect(sipConnector.getRemoteStreams).toHaveBeenCalled();
    });

    it('должен создать debounced обработчик готовых удаленных потоков', () => {
      const onReadyRemoteStreams = jest.fn();
      const debouncedHandler = sipConnectorFacade.resolveHandleReadyRemoteStreamsDebounced({
        onReadyRemoteStreams,
      });

      expect(typeof debouncedHandler).toBe('function');
    });

    it('debounced обработчик не должен вызывать onReady при отсутствии удаленных потоков', async () => {
      jest.useFakeTimers();

      const onReadyRemoteStreams = jest.fn();
      const debouncedHandler = sipConnectorFacade.resolveHandleReadyRemoteStreamsDebounced({
        onReadyRemoteStreams,
      });

      jest.spyOn(sipConnector, 'getRemoteStreams').mockReturnValue(undefined);

      // вызов
      debouncedHandler().catch(() => {
        return undefined;
      });

      // дебаунс 200мс
      jest.advanceTimersByTime(220);

      expect(onReadyRemoteStreams).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('должен создать обработчик готовых удаленных потоков', () => {
      const onReadyRemoteStreams = jest.fn();
      const handler = sipConnectorFacade.resolveHandleReadyRemoteStreams({
        onReadyRemoteStreams,
      });

      expect(typeof handler).toBe('function');
    });

    it('должен обработать готовый видео трек', () => {
      const onReadyRemoteStreams = jest.fn();
      const handler = sipConnectorFacade.resolveHandleReadyRemoteStreams({
        onReadyRemoteStreams,
      });

      const videoTrack = {
        kind: 'video',
        readyState: 'live',
      } as MediaStreamTrack;

      handler({ track: videoTrack });

      expect(onReadyRemoteStreams).toHaveBeenCalled();
    });

    it('не должен обрабатывать неготовый видео трек', () => {
      const onReadyRemoteStreams = jest.fn();
      const handler = sipConnectorFacade.resolveHandleReadyRemoteStreams({
        onReadyRemoteStreams,
      });

      const videoTrack = {
        kind: 'video',
        readyState: 'ended',
      } as MediaStreamTrack;

      handler({ track: videoTrack });

      expect(onReadyRemoteStreams).not.toHaveBeenCalled();
    });

    it('не должен обрабатывать аудио трек', () => {
      const onReadyRemoteStreams = jest.fn();
      const handler = sipConnectorFacade.resolveHandleReadyRemoteStreams({
        onReadyRemoteStreams,
      });

      const audioTrack = {
        kind: 'audio',
        readyState: 'live',
      } as MediaStreamTrack;

      handler({ track: audioTrack });

      expect(onReadyRemoteStreams).not.toHaveBeenCalled();
    });

    it('handleEnterRoomEvent: purgatory', () => {
      const onEnterPurgatory = jest.fn();
      const onEnterConference = jest.fn();

      TEST_HOOKS.handleEnterRoomEvent('purgatory', true, {
        onEnterPurgatory,
        onEnterConference,
      });

      expect(onEnterPurgatory).toHaveBeenCalled();
      expect(onEnterConference).not.toHaveBeenCalled();
    });

    it('handleEnterRoomEvent: conference (isSuccessProgressCall=false)', () => {
      const onEnterPurgatory = jest.fn();
      const onEnterConference = jest.fn();

      TEST_HOOKS.handleEnterRoomEvent('room-1', false, {
        onEnterPurgatory,
        onEnterConference,
      });

      expect(onEnterPurgatory).not.toHaveBeenCalled();
      expect(onEnterConference).toHaveBeenCalledWith({ isSuccessProgressCall: false });
    });

    it('handleEnterRoomEvent: conference without onEnterConference handler', () => {
      const onEnterPurgatory = jest.fn();

      TEST_HOOKS.handleEnterRoomEvent('room-2', true, {
        onEnterPurgatory,
      });

      expect(onEnterPurgatory).not.toHaveBeenCalled();
      // no error, no calls
    });

    it('handleOnceRaceEvent', () => {
      const unsubscribe = jest.fn();
      const onEndedCall = jest.fn();

      TEST_HOOKS.handleOnceRaceEvent(unsubscribe, onEndedCall);

      expect(unsubscribe).toHaveBeenCalled();
      expect(onEndedCall).toHaveBeenCalled();
    });

    it('handleFailProgressEvent', () => {
      const onFailProgressCall = jest.fn();
      const unsubscribe = jest.fn();
      const error = new Error('boom');

      expect(() => {
        TEST_HOOKS.handleFailProgressEvent(onFailProgressCall, unsubscribe, error);
      }).toThrow('boom');
      expect(onFailProgressCall).toHaveBeenCalled();
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('handleFailProgressEvent without onFailProgressCall (else branch)', () => {
      const unsubscribe = jest.fn();
      const error = new Error('boom-else');

      expect(() => {
        TEST_HOOKS.handleFailProgressEvent(undefined, unsubscribe, error);
      }).toThrow('boom-else');
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('не должен вызывать handleEnterRoomEvent при answerToIncomingCall без onEnterPurgatory/onEnterConference', async () => {
      let enterHandler: ((room: string) => void) | undefined;

      jest.spyOn(sipConnector, 'on').mockImplementation((event, handler) => {
        if (event === 'api:enterRoom') {
          enterHandler = handler as (room: string) => void;
        }

        return () => {};
      });

      await sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization);

      const promise = sipConnector.wait('incoming-call:incomingCall');

      JsSIP.triggerIncomingSession(
        // @ts-expect-error
        sipConnectorFacade.sipConnector.connectionManager.ua,
        remoteCallerData,
      );

      await promise;

      const handleEnterRoomEventSpy = jest.spyOn(TEST_HOOKS, 'handleEnterRoomEvent');

      await sipConnectorFacade.answerToIncomingCall({
        mediaStream: mockMediaStream,
        setRemoteStreams: jest.fn(),
      } as never);

      enterHandler?.('test-room');

      expect(handleEnterRoomEventSpy).not.toHaveBeenCalled();
    });
  });
});
