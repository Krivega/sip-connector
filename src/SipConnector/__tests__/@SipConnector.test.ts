import { createMediaStreamMock } from 'webrtc-mock';

import JsSIP from '@/__fixtures__/jssip.mock';
import logger from '@/logger';
import SipConnector from '../@SipConnector';

import type { IncomingResponse, RegisteredEvent, UA, UnRegisteredEvent } from '@krivega/jssip';
import type { TJsSIP } from '@/types';

// Мокаем logger
jest.mock('../../logger', () => {
  return jest.fn();
});

describe('SipConnector facade', () => {
  const mockLogger = logger as jest.MockedFunction<typeof logger>;
  let sipConnector: SipConnector;

  beforeEach(() => {
    jest.clearAllMocks();
    sipConnector = new SipConnector({ JsSIP: JsSIP as unknown as TJsSIP });
  });

  it('должен форвардить события от менеджеров с префиксом', () => {
    const handler = jest.fn();

    sipConnector.on('connection:connected', handler);

    // Тригерим событие на уровне ConnectionManager
    sipConnector.connectionManager.events.trigger('connected', { ok: true });

    expect(handler).toHaveBeenCalledWith({ ok: true });
  });

  it('должен проксировать методы ConnectionManager', async () => {
    const cm = sipConnector.connectionManager;

    jest.spyOn(cm, 'connect').mockResolvedValue({} as unknown as UA);
    jest.spyOn(cm, 'set').mockResolvedValue(true);
    jest.spyOn(cm, 'disconnect').mockResolvedValue(undefined);
    jest
      .spyOn(cm, 'register')
      .mockResolvedValue({ response: {} as IncomingResponse } as RegisteredEvent);
    jest
      .spyOn(cm, 'unregister')
      .mockResolvedValue({ response: {} as IncomingResponse } as UnRegisteredEvent);
    jest
      .spyOn(cm, 'tryRegister')
      .mockResolvedValue({ response: {} as IncomingResponse } as RegisteredEvent);
    jest.spyOn(cm, 'sendOptions').mockResolvedValue(undefined);
    jest.spyOn(cm, 'ping').mockResolvedValue(undefined);
    jest.spyOn(cm, 'checkTelephony').mockResolvedValue(undefined);
    jest.spyOn(cm, 'isConfigured').mockReturnValue(true);
    jest
      .spyOn(cm, 'getConnectionConfiguration')
      .mockReturnValue({ displayName: 'X' } as unknown as { displayName: string });

    await sipConnector.connect({
      register: false,
      sipServerUrl: 'sip.example.com',
      sipWebSocketServerURL: 'wss://sip.example.com/ws',
    });
    await sipConnector.set({ displayName: 'Test' });
    await sipConnector.disconnect();
    await sipConnector.register();
    await sipConnector.unregister();
    await sipConnector.tryRegister();
    await sipConnector.sendOptions('sip:test@example.com', 'test', ['X-Test: value']);
    await sipConnector.ping('ping', ['X-Ping: value']);
    await sipConnector.checkTelephony({
      displayName: 'Test',
      sipServerUrl: 'sip.example.com',
      sipWebSocketServerURL: 'wss://sip.example.com/ws',
    });

    expect(sipConnector.isConfigured()).toBe(true);
    expect(sipConnector.getConnectionConfiguration()).toEqual({ displayName: 'X' });
    expect(sipConnector.getSipServerUrl('id')).toBe('id');

    expect(cm.connect).toHaveBeenCalled();
    expect(cm.set).toHaveBeenCalledWith({ displayName: 'Test' });
    expect(cm.disconnect).toHaveBeenCalled();
    expect(cm.register).toHaveBeenCalled();
    expect(cm.unregister).toHaveBeenCalled();
    expect(cm.tryRegister).toHaveBeenCalled();
    expect(cm.sendOptions).toHaveBeenCalled();
    expect(cm.ping).toHaveBeenCalled();
    expect(cm.checkTelephony).toHaveBeenCalled();
  });

  it('должен проксировать методы CallManager', async () => {
    const cm = sipConnector.callManager;

    jest.spyOn(sipConnector.connectionManager, 'getUaProtected').mockReturnValue({} as UA);
    jest.spyOn(sipConnector, 'getSipServerUrl').mockImplementation((id: string) => {
      return `sip:${id}@host`;
    });

    const startCall = jest
      .spyOn(cm, 'startCall')
      .mockResolvedValue({} as unknown as RTCPeerConnection);
    const endCall = jest.spyOn(cm, 'endCall').mockResolvedValue(undefined);
    const answer = jest
      .spyOn(cm, 'answerToIncomingCall')
      .mockResolvedValue({} as unknown as RTCPeerConnection);
    const getEstablished = jest.spyOn(cm, 'getEstablishedRTCSession').mockReturnValue(undefined);
    const getCallConfig = jest
      .spyOn(cm, 'getCallConfiguration')
      .mockReturnValue({} as unknown as { number?: string });
    const getRemote = jest
      .spyOn(cm, 'getRemoteStreams')
      .mockReturnValue([] as unknown as MediaStream[]);
    const replaceStream = jest.spyOn(cm, 'replaceMediaStream').mockResolvedValue(undefined);

    const testStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    await sipConnector.call(
      {} as unknown as { number: string; mediaStream: MediaStream; ontrack: () => void },
    );
    await sipConnector.hangUp();
    await sipConnector.answerToIncomingCall({ mediaStream: testStream });

    sipConnector.getEstablishedRTCSession();
    sipConnector.getCallConfiguration();
    sipConnector.getRemoteStreams();
    await sipConnector.replaceMediaStream(testStream);

    expect(startCall).toHaveBeenCalled();
    expect(endCall).toHaveBeenCalled();
    expect(answer).toHaveBeenCalled();
    expect(getEstablished).toHaveBeenCalled();
    expect(getCallConfig).toHaveBeenCalled();
    expect(getRemote).toHaveBeenCalled();
    expect(replaceStream).toHaveBeenCalled();
  });

  it('должен проксировать методы IncomingCallManager', async () => {
    const decline = jest
      .spyOn(sipConnector.incomingCallManager, 'declineToIncomingCall')
      .mockResolvedValue(undefined);

    await sipConnector.declineToIncomingCall({ statusCode: 603 });

    expect(decline).toHaveBeenCalled();
  });

  it('должен проксировать методы ApiManager', async () => {
    const api = sipConnector.apiManager;

    const waitChannels = jest.spyOn(api, 'waitChannels').mockResolvedValue({
      inputChannels: 'test',
      outputChannels: 'test',
    } as unknown as {
      inputChannels: string;
      outputChannels: string;
    });
    const waitSyncMedia = jest
      .spyOn(api, 'waitSyncMediaState')
      .mockResolvedValue({ isSyncForced: false });
    const sendDTMF = jest.spyOn(api, 'sendDTMF').mockResolvedValue(undefined);
    const sendChannels = jest.spyOn(api, 'sendChannels').mockResolvedValue(undefined);
    const sendMediaState = jest.spyOn(api, 'sendMediaState').mockResolvedValue(undefined);
    const sendRefusalToTurnOn = jest.spyOn(api, 'sendRefusalToTurnOn').mockResolvedValue(undefined);
    const sendRefusalToTurnOnMic = jest
      .spyOn(api, 'sendRefusalToTurnOnMic')
      .mockResolvedValue(undefined);
    const sendRefusalToTurnOnCam = jest
      .spyOn(api, 'sendRefusalToTurnOnCam')
      .mockResolvedValue(undefined);
    const sendMustStopPresentationP2P = jest
      .spyOn(api, 'sendMustStopPresentationP2P')
      .mockResolvedValue(undefined);
    const sendStoppedPresentationP2P = jest
      .spyOn(api, 'sendStoppedPresentationP2P')
      .mockResolvedValue(undefined);
    const sendStoppedPresentation = jest
      .spyOn(api, 'sendStoppedPresentation')
      .mockResolvedValue(undefined);
    const askPermissionToStartPresentationP2P = jest
      .spyOn(api, 'askPermissionToStartPresentationP2P')
      .mockResolvedValue(undefined);
    const askPermissionToStartPresentation = jest
      .spyOn(api, 'askPermissionToStartPresentation')
      .mockResolvedValue(undefined);
    const askPermissionToEnableCam = jest
      .spyOn(api, 'askPermissionToEnableCam')
      .mockResolvedValue(undefined);

    await sipConnector.waitChannels();
    await sipConnector.waitSyncMediaState();
    await sipConnector.sendDTMF('123');
    await sipConnector.sendChannels({ inputChannels: 'test', outputChannels: 'test' });
    await sipConnector.sendMediaState({ cam: true, mic: false });
    await sipConnector.sendRefusalToTurnOn('cam');
    await sipConnector.sendRefusalToTurnOnMic();
    await sipConnector.sendRefusalToTurnOnCam();
    await sipConnector.sendMustStopPresentationP2P();
    await sipConnector.sendStoppedPresentationP2P();
    await sipConnector.sendStoppedPresentation();
    await sipConnector.askPermissionToStartPresentationP2P();
    await sipConnector.askPermissionToStartPresentation();
    await sipConnector.askPermissionToEnableCam();

    expect(waitChannels).toHaveBeenCalled();
    expect(waitSyncMedia).toHaveBeenCalled();
    expect(sendDTMF).toHaveBeenCalled();
    expect(sendChannels).toHaveBeenCalled();
    expect(sendMediaState).toHaveBeenCalled();
    expect(sendRefusalToTurnOn).toHaveBeenCalled();
    expect(sendRefusalToTurnOnMic).toHaveBeenCalled();
    expect(sendRefusalToTurnOnCam).toHaveBeenCalled();
    expect(sendMustStopPresentationP2P).toHaveBeenCalled();
    expect(sendStoppedPresentationP2P).toHaveBeenCalled();
    expect(sendStoppedPresentation).toHaveBeenCalled();
    expect(askPermissionToStartPresentationP2P).toHaveBeenCalled();
    expect(askPermissionToStartPresentation).toHaveBeenCalled();
    expect(askPermissionToEnableCam).toHaveBeenCalled();
  });

  it('должен корректно обрабатывать start/stop/update презентацию с ветками isP2P', async () => {
    const stream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    const askPermissionToStartPresentation = jest
      .spyOn(sipConnector.apiManager, 'askPermissionToStartPresentation')
      .mockResolvedValue(undefined);
    const askPermissionToStartPresentationP2P = jest
      .spyOn(sipConnector.apiManager, 'askPermissionToStartPresentationP2P')
      .mockResolvedValue(undefined);
    const sendMustStopPresentationP2P = jest
      .spyOn(sipConnector.apiManager, 'sendMustStopPresentationP2P')
      .mockResolvedValue(undefined);
    const sendStoppedPresentation = jest
      .spyOn(sipConnector.apiManager, 'sendStoppedPresentation')
      .mockResolvedValue(undefined);

    jest
      .spyOn(sipConnector.presentationManager, 'startPresentation')
      // eslint-disable-next-line @typescript-eslint/max-params
      .mockImplementation(async (callback, s, _rest, _options) => {
        await callback();

        return s;
      });

    await sipConnector.startPresentation(stream, { isP2P: false });
    expect(askPermissionToStartPresentation).toHaveBeenCalled();
    expect(askPermissionToStartPresentationP2P).not.toHaveBeenCalled();

    await sipConnector.startPresentation(stream, { isP2P: true });
    expect(sendMustStopPresentationP2P).toHaveBeenCalled();
    expect(askPermissionToStartPresentationP2P).toHaveBeenCalled();

    jest
      .spyOn(sipConnector.presentationManager, 'stopPresentation')
      .mockImplementation(async (callback) => {
        await callback();

        return undefined;
      });

    await sipConnector.stopPresentation({ isP2P: false });
    expect(sendStoppedPresentation).toHaveBeenCalled();

    await sipConnector.stopPresentation({ isP2P: true });
    expect(sendMustStopPresentationP2P).toHaveBeenCalledTimes(2);

    jest
      .spyOn(sipConnector.presentationManager, 'updatePresentation')
      .mockImplementation(async (callback) => {
        await callback();

        return undefined;
      });

    await sipConnector.updatePresentation(stream, { isP2P: false });
    expect(askPermissionToStartPresentation).toHaveBeenCalledTimes(2);

    await sipConnector.updatePresentation(stream, { isP2P: true });
    expect(askPermissionToStartPresentationP2P).toHaveBeenCalledTimes(2);
  });

  it('должен иметь доступ к геттерам и не кидать ошибки', () => {
    // просто обращаемся к геттерам, чтобы покрыть строки
    // возвращаемые значения могут быть undefined в начальном состоянии
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.requestedConnection;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.isPendingConnect;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.isPendingInitUa;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.connectionState;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.isRegistered;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.isRegisterConfig;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.socket;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.requestedCall;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.connection;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.establishedRTCSession;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.isCallActive;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.remoteCallerData;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      sipConnector.isAvailableIncomingCall;
    }).not.toThrow();
  });

  describe('Обработка события restart', () => {
    it('должен вызвать callManager.restartIce при получении события restart', async () => {
      const restartIceSpy = jest
        .spyOn(sipConnector.callManager, 'restartIce')
        .mockResolvedValue(true);

      // Триггерим событие restart от ApiManager
      sipConnector.apiManager.events.trigger('restart', {
        tracksDirection: 'incoming',
        audioTrackCount: 2,
        videoTrackCount: 1,
      });

      // Ждем выполнения асинхронной операции
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(restartIceSpy).toHaveBeenCalledWith();
    });

    it('должен логировать ошибку если callManager.restartIce завершился с ошибкой', async () => {
      const mockError = new Error('RestartIce failed');
      const restartIceSpy = jest
        .spyOn(sipConnector.callManager, 'restartIce')
        .mockRejectedValue(mockError);

      // Триггерим событие restart от ApiManager
      sipConnector.apiManager.events.trigger('restart', {
        tracksDirection: 'outgoing',
        audioTrackCount: 1,
        videoTrackCount: 3,
      });

      // Ждем выполнения асинхронной операции
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(restartIceSpy).toHaveBeenCalledWith();
      expect(mockLogger).toHaveBeenCalledWith('Failed to restart ICE', mockError);
    });

    it('должен обрабатывать событие restart с различными параметрами', async () => {
      const restartIceSpy = jest
        .spyOn(sipConnector.callManager, 'restartIce')
        .mockResolvedValue(true);

      const testCases = [
        {
          tracksDirection: 'incoming',
          audioTrackCount: 0,
          videoTrackCount: 1,
        },
        {
          tracksDirection: 'outgoing',
          audioTrackCount: 2,
          videoTrackCount: 0,
        },
        {
          tracksDirection: 'bidirectional',
          audioTrackCount: 1,
          videoTrackCount: 1,
        },
      ];

      for (const testData of testCases) {
        restartIceSpy.mockClear();

        sipConnector.apiManager.events.trigger('restart', testData);

        // Ждем выполнения асинхронной операции
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(restartIceSpy).toHaveBeenCalledWith();
      }
    });

    describe('добавление презентационного transceiver при videoTrackCount === 2', () => {
      it('должен добавить презентационный transceiver если videoTrackCount === 2 и его нет', async () => {
        const addTransceiverSpy = jest
          .spyOn(sipConnector.callManager, 'addTransceiver')
          .mockResolvedValue({} as RTCRtpTransceiver);

        const getTransceiversSpy = jest
          .spyOn(sipConnector.callManager, 'getTransceivers')
          .mockReturnValue({
            mainAudio: {} as RTCRtpTransceiver,
            mainVideo: {} as RTCRtpTransceiver,
            presentationVideo: undefined, // Отсутствует презентационный transceiver
          });

        const restartIceSpy = jest
          .spyOn(sipConnector.callManager, 'restartIce')
          .mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount === 2
        sipConnector.apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 2,
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(getTransceiversSpy).toHaveBeenCalled();
        expect(addTransceiverSpy).toHaveBeenCalledWith('video', {
          direction: 'recvonly',
        });
        expect(restartIceSpy).toHaveBeenCalledWith();
      });

      it('не должен добавлять презентационный transceiver если он уже существует', async () => {
        const addTransceiverSpy = jest
          .spyOn(sipConnector.callManager, 'addTransceiver')
          .mockResolvedValue({} as RTCRtpTransceiver);

        const getTransceiversSpy = jest
          .spyOn(sipConnector.callManager, 'getTransceivers')
          .mockReturnValue({
            mainAudio: {} as RTCRtpTransceiver,
            mainVideo: {} as RTCRtpTransceiver,
            presentationVideo: {} as RTCRtpTransceiver, // Презентационный transceiver уже есть
          });

        const restartIceSpy = jest
          .spyOn(sipConnector.callManager, 'restartIce')
          .mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount === 2
        sipConnector.apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 2,
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(getTransceiversSpy).toHaveBeenCalled();
        expect(addTransceiverSpy).not.toHaveBeenCalled(); // Не должен вызываться
        expect(restartIceSpy).toHaveBeenCalledWith();
      });

      it('не должен добавлять презентационный transceiver если videoTrackCount !== 2', async () => {
        const addTransceiverSpy = jest
          .spyOn(sipConnector.callManager, 'addTransceiver')
          .mockResolvedValue({} as RTCRtpTransceiver);

        const getTransceiversSpy = jest
          .spyOn(sipConnector.callManager, 'getTransceivers')
          .mockReturnValue({
            mainAudio: {} as RTCRtpTransceiver,
            mainVideo: {} as RTCRtpTransceiver,
            presentationVideo: undefined,
          });

        const restartIceSpy = jest
          .spyOn(sipConnector.callManager, 'restartIce')
          .mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount !== 2
        sipConnector.apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 1, // Не равно 2
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(getTransceiversSpy).not.toHaveBeenCalled(); // Не должен проверять transceivers
        expect(addTransceiverSpy).not.toHaveBeenCalled(); // Не должен добавлять transceiver
        expect(restartIceSpy).toHaveBeenCalledWith();
      });

      it('должен логировать ошибку если addTransceiver завершился с ошибкой', async () => {
        const mockError = new Error('Failed to add transceiver');
        const addTransceiverSpy = jest
          .spyOn(sipConnector.callManager, 'addTransceiver')
          .mockRejectedValue(mockError);

        const getTransceiversSpy = jest
          .spyOn(sipConnector.callManager, 'getTransceivers')
          .mockReturnValue({
            mainAudio: {} as RTCRtpTransceiver,
            mainVideo: {} as RTCRtpTransceiver,
            presentationVideo: undefined,
          });

        const restartIceSpy = jest
          .spyOn(sipConnector.callManager, 'restartIce')
          .mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount === 2
        sipConnector.apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 2,
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });

        expect(getTransceiversSpy).toHaveBeenCalled();
        expect(addTransceiverSpy).toHaveBeenCalledWith('video', {
          direction: 'recvonly',
        });
        expect(mockLogger).toHaveBeenCalledWith(
          'Failed to add presentation video transceiver',
          mockError,
        );
        expect(restartIceSpy).toHaveBeenCalledWith();
      });

      it('должен логировать ошибку если getTransceivers завершился с ошибкой', async () => {
        const mockError = new Error('Failed to update transceivers');
        const getTransceiversSpy = jest
          .spyOn(sipConnector.callManager, 'getTransceivers')
          .mockImplementation(() => {
            throw mockError;
          });

        const addTransceiverSpy = jest
          .spyOn(sipConnector.callManager, 'addTransceiver')
          .mockResolvedValue({} as RTCRtpTransceiver);

        const restartIceSpy = jest
          .spyOn(sipConnector.callManager, 'restartIce')
          .mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount === 2
        sipConnector.apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 2,
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(getTransceiversSpy).toHaveBeenCalled();
        expect(addTransceiverSpy).not.toHaveBeenCalled(); // Не должен вызываться из-за ошибки
        expect(mockLogger).toHaveBeenCalledWith('Failed to update transceivers', mockError);
        expect(restartIceSpy).toHaveBeenCalledWith();
      });
    });
  });

  describe('Constructor with codec preferences', () => {
    it('должен создать SipConnector с предпочтительными кодекми', () => {
      const sipConnectorWithCodecs = new SipConnector(
        { JsSIP: JsSIP as unknown as TJsSIP },
        {
          preferredMimeTypesVideoCodecs: ['video/VP8', 'video/VP9'],
          excludeMimeTypesVideoCodecs: ['video/H264'],
        },
      );

      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithCodecs.preferredMimeTypesVideoCodecs).toEqual([
        'video/VP8',
        'video/VP9',
      ]);
      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithCodecs.excludeMimeTypesVideoCodecs).toEqual(['video/H264']);
    });

    it('должен создать SipConnector без предпочтений кодеков', () => {
      const sipConnectorWithoutCodecs = new SipConnector({ JsSIP: JsSIP as unknown as TJsSIP });

      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithoutCodecs.preferredMimeTypesVideoCodecs).toBeUndefined();
      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithoutCodecs.excludeMimeTypesVideoCodecs).toBeUndefined();
    });

    it('должен создать SipConnector с пустыми массивами кодеков', () => {
      const sipConnectorWithEmptyCodecs = new SipConnector(
        { JsSIP: JsSIP as unknown as TJsSIP },
        {
          preferredMimeTypesVideoCodecs: [],
          excludeMimeTypesVideoCodecs: [],
        },
      );

      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithEmptyCodecs.preferredMimeTypesVideoCodecs).toEqual([]);
      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithEmptyCodecs.excludeMimeTypesVideoCodecs).toEqual([]);
    });

    it('должен создать SipConnector только с preferredMimeTypesVideoCodecs', () => {
      const sipConnectorWithPreferredOnly = new SipConnector(
        { JsSIP: JsSIP as unknown as TJsSIP },
        {
          preferredMimeTypesVideoCodecs: ['video/VP8'],
        },
      );

      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithPreferredOnly.preferredMimeTypesVideoCodecs).toEqual(['video/VP8']);
      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithPreferredOnly.excludeMimeTypesVideoCodecs).toBeUndefined();
    });

    it('должен создать SipConnector только с excludeMimeTypesVideoCodecs', () => {
      const sipConnectorWithExcludeOnly = new SipConnector(
        { JsSIP: JsSIP as unknown as TJsSIP },
        {
          excludeMimeTypesVideoCodecs: ['video/H264'],
        },
      );

      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithExcludeOnly.preferredMimeTypesVideoCodecs).toBeUndefined();
      // @ts-expect-error: доступ к приватным полям для тестирования
      expect(sipConnectorWithExcludeOnly.excludeMimeTypesVideoCodecs).toEqual(['video/H264']);
    });
  });
});
