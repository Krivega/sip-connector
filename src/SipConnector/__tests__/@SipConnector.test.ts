import { createMediaStreamMock } from 'webrtc-mock';

import JsSIP from '@/__fixtures__/jssip.mock';
import SipConnector from '../@SipConnector';

import type {
  IncomingResponse,
  RegisteredEvent,
  Socket,
  UA,
  UnRegisteredEvent,
} from '@krivega/jssip';
import type { TConnectionConfigurationWithUa } from '@/ConnectionManager';
import type { TJsSIP } from '@/types';

describe('SipConnector facade', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    jest.clearAllMocks();
    sipConnector = new SipConnector({ JsSIP: JsSIP as unknown as TJsSIP });
  });

  it('должен форвардить события от менеджеров с префиксом', () => {
    const handler = jest.fn();

    sipConnector.on('connection:connected', handler);

    // Тригерим событие на уровне ConnectionManager
    sipConnector.connectionManager.events.trigger('connected', { socket: {} as Socket });

    expect(handler).toHaveBeenCalledWith({ socket: {} as Socket });
  });

  it('должен проксировать методы AutoConnectorManager', async () => {
    const { autoConnectorManager } = sipConnector;

    jest.spyOn(autoConnectorManager, 'start');
    jest.spyOn(autoConnectorManager, 'stop');

    sipConnector.startAutoConnect(
      {} as unknown as Parameters<(typeof autoConnectorManager)['start']>[0],
    );
    sipConnector.stopAutoConnect();

    expect(autoConnectorManager.start).toHaveBeenCalled();
    expect(autoConnectorManager.stop).toHaveBeenCalled();
  });

  it('должен проксировать методы ConnectionQueueManager', async () => {
    const { connectionQueueManager } = sipConnector;

    jest
      .spyOn(connectionQueueManager, 'connect')
      .mockResolvedValue({} as unknown as TConnectionConfigurationWithUa);
    jest.spyOn(connectionQueueManager, 'disconnect').mockResolvedValue(undefined);

    await sipConnector.connect({
      displayName: 'Any Name',
      register: false,
      sipServerUrl: 'sip.example.com',
      sipWebSocketServerURL: 'wss://sip.example.com/ws',
    });
    await sipConnector.disconnect();

    expect(connectionQueueManager.connect).toHaveBeenCalled();
    expect(connectionQueueManager.disconnect).toHaveBeenCalled();
  });

  it('должен проксировать методы ConnectionManager', async () => {
    const cm = sipConnector.connectionManager;

    jest.spyOn(cm, 'set').mockResolvedValue(true);
    jest.spyOn(cm, 'sendOptions').mockResolvedValue(undefined);
    jest.spyOn(cm, 'ping').mockResolvedValue(undefined);
    jest.spyOn(cm, 'checkTelephony').mockResolvedValue(undefined);
    jest.spyOn(cm, 'isConfigured').mockReturnValue(true);
    jest
      .spyOn(cm, 'register')
      .mockResolvedValue({ response: {} as IncomingResponse } as RegisteredEvent);
    jest
      .spyOn(cm, 'unregister')
      .mockResolvedValue({ response: {} as IncomingResponse } as UnRegisteredEvent);
    jest
      .spyOn(cm, 'tryRegister')
      .mockResolvedValue({ response: {} as IncomingResponse } as RegisteredEvent);

    jest.spyOn(cm, 'getConnectionConfiguration').mockReturnValue({
      displayName: 'X',
      sipServerUrl: 'sip.example.com',
    } as unknown as {
      displayName: string;
      sipServerUrl: string;
    });

    await sipConnector.set({ displayName: 'Test' });
    await sipConnector.sendOptions('sip:test@example.com', 'test', ['X-Test: value']);
    await sipConnector.ping('ping', ['X-Ping: value']);
    await sipConnector.register();
    await sipConnector.unregister();
    await sipConnector.tryRegister();
    await sipConnector.checkTelephony({
      displayName: 'Test',
      sipServerUrl: 'sip.example.com',
      sipWebSocketServerURL: 'wss://sip.example.com/ws',
    });

    expect(sipConnector.isConfigured()).toBe(true);
    expect(sipConnector.getConnectionConfiguration()).toEqual({
      displayName: 'X',
      sipServerUrl: 'sip.example.com',
    });
    expect(sipConnector.getSipServerUrl('id')).toBe('id');

    expect(cm.register).toHaveBeenCalled();
    expect(cm.unregister).toHaveBeenCalled();
    expect(cm.tryRegister).toHaveBeenCalled();
    expect(cm.set).toHaveBeenCalledWith({ displayName: 'Test' });
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
