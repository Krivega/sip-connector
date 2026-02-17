import { createMediaStreamMock } from 'webrtc-mock';

import flushPromises from '@/__fixtures__/flushPromises';
import JsSIP from '@/__fixtures__/jssip.mock';
import * as tools from '@/tools';
import SipConnector from '../@SipConnector';

import type {
  ConnectedEvent,
  IncomingResponse,
  RegisteredEvent,
  Socket,
  UA,
  UnRegisteredEvent,
} from '@krivega/jssip';
import type { TConnectionConfiguration } from '@/ConnectionManager';
import type { TInboundStats, TOutboundStats } from '@/StatsPeerConnection';
import type { TJsSIP } from '@/types';

describe('SipConnector', () => {
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

  it('должен вызывать renegotiate когда основной входящий видеотрек muted и inbound не получает и не декодирует кадры', async () => {
    const track = createMediaStreamMock({
      video: { deviceId: { exact: 'videoDeviceId' } },
    }).getVideoTracks()[0] as MediaStreamTrack;
    const stream = new MediaStream();

    stream.addTrack(track);

    Object.defineProperty(track, 'muted', { value: true, configurable: true });

    jest.spyOn(sipConnector.callManager, 'getMainRemoteStream').mockReturnValue(stream);

    // @ts-expect-error - доступ к приватному свойству
    const spyRecover = jest.spyOn(sipConnector.mainStreamRecovery, 'recover');

    sipConnector.statsManager.events.trigger('collected', {
      outbound: { additional: {} },
      inbound: {
        video: { inboundRtp: { framesReceived: 0, framesDecoded: 0, packetsReceived: 500 } },
        additional: {},
      },
    } as unknown as {
      outbound: TOutboundStats;
      inbound: TInboundStats;
    });

    await flushPromises();

    expect(spyRecover).toHaveBeenCalledTimes(1);
  });

  it('не должен проксировать событие connection:disconnected как disconnected-from-out-of-call если активен звонок', async () => {
    const handler = jest.fn();

    jest.spyOn(sipConnector.connectionManager, 'getUaProtected').mockReturnValue({} as UA);
    jest
      .spyOn(sipConnector.callManager, 'startCall')
      .mockResolvedValue({} as unknown as RTCPeerConnection);
    jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);

    const testStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    await sipConnector.call({
      number: '123',
      mediaStream: testStream,
    } as unknown as { number: string; mediaStream: MediaStream });

    sipConnector.on('disconnected-from-out-of-call', handler);

    sipConnector.connectionManager.events.trigger('disconnected', {
      socket: {} as Socket,
      error: false,
    });

    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('должен проксировать событие connection:disconnected как disconnected-from-out-of-call если не активен звонок', async () => {
    const handler = jest.fn();

    jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

    sipConnector.on('disconnected-from-out-of-call', handler);

    sipConnector.connectionManager.events.trigger('disconnected', {
      socket: {} as Socket,
      error: false,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('должен проксировать событие connection:disconnected если звонок не активен', () => {
    const handler = jest.fn();

    sipConnector.on('connection:disconnected', handler);

    sipConnector.connectionManager.events.trigger('disconnected', {
      socket: {} as Socket,
      error: false,
    });

    expect(handler).toHaveBeenCalledWith({ socket: {} as Socket, error: false });
  });

  it('не должен проксировать событие connection:connected-with-configuration как connected-with-configuration-from-out-of-call если активен звонок', async () => {
    const handler = jest.fn();

    jest.spyOn(sipConnector.connectionManager, 'getUaProtected').mockReturnValue({} as UA);
    jest
      .spyOn(sipConnector.callManager, 'startCall')
      .mockResolvedValue({} as unknown as RTCPeerConnection);
    jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);

    const testStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    await sipConnector.call({
      number: '123',
      mediaStream: testStream,
    } as unknown as { number: string; mediaStream: MediaStream });

    sipConnector.on('connected-with-configuration-from-out-of-call', handler);

    const testConfiguration: TConnectionConfiguration = {
      displayName: 'Test User',
      sipServerIp: 'sip.example.com',
      sipServerUrl: 'wss://sip.example.com/ws',
      authorizationUser: 'test-user',
    };

    sipConnector.connectionManager.events.trigger(
      'connected-with-configuration',
      testConfiguration,
    );

    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('должен проксировать событие connection:connected-with-configuration как connected-with-configuration-from-out-of-call если не активен звонок', async () => {
    const handler = jest.fn();

    jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

    sipConnector.on('connected-with-configuration-from-out-of-call', handler);

    const testConfiguration: TConnectionConfiguration = {
      displayName: 'Test User',
      sipServerIp: 'sip.example.com',
      sipServerUrl: 'wss://sip.example.com/ws',
      authorizationUser: 'test-user',
    };

    sipConnector.connectionManager.events.trigger(
      'connected-with-configuration',
      testConfiguration,
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(testConfiguration);
  });

  it('должен сохранять типы событий в bridgeEvents', () => {
    // Этот тест проверяет, что типы сохраняются при использовании bridgeEvents
    // Если типы не сохраняются, TypeScript не сможет вывести правильный тип для event
    let receivedEvent: ConnectedEvent | undefined;

    sipConnector.on('connection:connected', (event) => {
      // Проверяем, что TypeScript может вывести правильный тип ConnectedEvent
      // Если типы не сохраняются, event будет unknown, и эта проверка не сработает
      // eslint-disable-next-line no-void
      void (event satisfies ConnectedEvent);

      // Сохраняем event для проверки
      receivedEvent = event;

      // Проверяем, что у event есть свойство socket (из ConnectedEvent)
      expect(event).toHaveProperty('socket');
    });

    const testSocket = {} as Socket;
    const testEvent: ConnectedEvent = { socket: testSocket };

    // Тригерим событие
    sipConnector.connectionManager.events.trigger('connected', testEvent);

    // Проверяем, что обработчик был вызван с правильным типом
    expect(receivedEvent).toBeDefined();
    expect(receivedEvent).toEqual(testEvent);
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
      .mockResolvedValue({} as unknown as TConnectionConfiguration);
    jest.spyOn(connectionQueueManager, 'disconnect').mockResolvedValue(undefined);

    await sipConnector.connect({
      displayName: 'Any Name',
      register: false,
      sipServerIp: 'sip.example.com',
      sipServerUrl: 'wss://sip.example.com/ws',
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

    const testConfiguration: TConnectionConfiguration = {
      displayName: 'X',
      sipServerIp: 'sip.example.com',
      sipServerUrl: 'wss://sip.example.com/ws',
      authorizationUser: 'test-user',
    };

    jest.spyOn(cm, 'getConnectionConfiguration').mockReturnValue(testConfiguration);

    await sipConnector.set({ displayName: 'Test' });
    await sipConnector.sendOptions('sip:test@example.com', 'test', ['X-Test: value']);
    await sipConnector.ping('ping', ['X-Ping: value']);
    await sipConnector.register();
    await sipConnector.unregister();
    await sipConnector.tryRegister();
    await sipConnector.checkTelephony({
      displayName: 'Test',
      sipServerIp: 'sip.example.com',
      sipServerUrl: 'wss://sip.example.com/ws',
    });

    expect(sipConnector.isConfigured()).toBe(true);
    expect(sipConnector.getConnectionConfiguration()).toEqual({
      displayName: 'X',
      authorizationUser: 'test-user',
      sipServerIp: 'sip.example.com',
      sipServerUrl: 'wss://sip.example.com/ws',
    });
    expect(sipConnector.getUri('id')).toBe('id');

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
    jest.spyOn(sipConnector, 'getUri').mockImplementation((id: string) => {
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
    const getRemote = jest.spyOn(cm, 'getRemoteStreams').mockReturnValue({});
    const getRecvQuality = jest
      .spyOn(cm, 'getRecvQuality')
      .mockReturnValue({ quality: 'high', effectiveQuality: 'high' });
    const setRecvQuality = jest.spyOn(cm, 'setRecvQuality').mockResolvedValue(true);
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
    sipConnector.getRemoteStreams();
    sipConnector.getRecvQuality();
    await sipConnector.setRecvQuality('low');
    await sipConnector.replaceMediaStream(testStream);

    expect(startCall).toHaveBeenCalled();
    expect(endCall).toHaveBeenCalled();
    expect(answer).toHaveBeenCalled();
    expect(getEstablished).toHaveBeenCalled();
    expect(getRemote).toHaveBeenCalled();
    expect(getRecvQuality).toHaveBeenCalled();
    expect(setRecvQuality).toHaveBeenCalledWith('low');
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
    await sipConnector.askPermissionToEnableCam();

    expect(waitChannels).toHaveBeenCalled();
    expect(waitSyncMedia).toHaveBeenCalled();
    expect(sendDTMF).toHaveBeenCalled();
    expect(sendChannels).toHaveBeenCalled();
    expect(sendMediaState).toHaveBeenCalled();
    expect(sendRefusalToTurnOn).toHaveBeenCalled();
    expect(sendRefusalToTurnOnMic).toHaveBeenCalled();
    expect(sendRefusalToTurnOnCam).toHaveBeenCalled();
    expect(askPermissionToEnableCam).toHaveBeenCalled();
  });

  it('должен корректно обрабатывать startPresentation isP2P=false', async () => {
    const stream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    const askPermissionToStartPresentation = jest
      .spyOn(sipConnector.apiManager, 'askPermissionToStartPresentation')
      .mockResolvedValue(undefined);
    const sendAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendNotAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendNotAvailableContentedStream')
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
    expect(sendAvailableContentedStream).not.toHaveBeenCalled();
    expect(sendNotAvailableContentedStream).not.toHaveBeenCalled();
    expect(sendStoppedPresentation).not.toHaveBeenCalled();
  });

  it('должен корректно обрабатывать startPresentation isP2P=true', async () => {
    const stream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    const askPermissionToStartPresentation = jest
      .spyOn(sipConnector.apiManager, 'askPermissionToStartPresentation')
      .mockResolvedValue(undefined);
    const sendAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendNotAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendNotAvailableContentedStream')
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

    await sipConnector.startPresentation(stream, { isP2P: true });

    expect(askPermissionToStartPresentation).not.toHaveBeenCalled();
    expect(sendAvailableContentedStream).toHaveBeenCalled();
    expect(sendNotAvailableContentedStream).not.toHaveBeenCalled();
    expect(sendStoppedPresentation).not.toHaveBeenCalled();
  });

  it('должен корректно обрабатывать stopPresentation isP2P=false', async () => {
    const askPermissionToStartPresentation = jest
      .spyOn(sipConnector.apiManager, 'askPermissionToStartPresentation')
      .mockResolvedValue(undefined);
    const sendAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendNotAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendNotAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendStoppedPresentation = jest
      .spyOn(sipConnector.apiManager, 'sendStoppedPresentation')
      .mockResolvedValue(undefined);

    jest
      .spyOn(sipConnector.presentationManager, 'stopPresentation')
      .mockImplementation(async (callback) => {
        await callback();

        return undefined;
      });

    await sipConnector.stopPresentation({ isP2P: false });

    expect(askPermissionToStartPresentation).not.toHaveBeenCalled();
    expect(sendAvailableContentedStream).not.toHaveBeenCalled();
    expect(sendNotAvailableContentedStream).not.toHaveBeenCalled();
    expect(sendStoppedPresentation).toHaveBeenCalled();
  });

  it('должен корректно обрабатывать stopPresentation isP2P=true', async () => {
    const askPermissionToStartPresentation = jest
      .spyOn(sipConnector.apiManager, 'askPermissionToStartPresentation')
      .mockResolvedValue(undefined);
    const sendAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendNotAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendNotAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendStoppedPresentation = jest
      .spyOn(sipConnector.apiManager, 'sendStoppedPresentation')
      .mockResolvedValue(undefined);

    jest
      .spyOn(sipConnector.presentationManager, 'stopPresentation')
      .mockImplementation(async (callback) => {
        await callback();

        return undefined;
      });

    await sipConnector.stopPresentation({ isP2P: true });

    expect(askPermissionToStartPresentation).not.toHaveBeenCalled();
    expect(sendAvailableContentedStream).not.toHaveBeenCalled();
    expect(sendNotAvailableContentedStream).toHaveBeenCalled();
    expect(sendStoppedPresentation).not.toHaveBeenCalled();
  });

  it('должен корректно обрабатывать updatePresentation isP2P=false', async () => {
    const stream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    const askPermissionToStartPresentation = jest
      .spyOn(sipConnector.apiManager, 'askPermissionToStartPresentation')
      .mockResolvedValue(undefined);
    const sendAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendNotAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendNotAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendStoppedPresentation = jest
      .spyOn(sipConnector.apiManager, 'sendStoppedPresentation')
      .mockResolvedValue(undefined);

    jest
      .spyOn(sipConnector.presentationManager, 'updatePresentation')
      .mockImplementation(async (callback) => {
        await callback();

        return undefined;
      });

    await sipConnector.updatePresentation(stream, { isP2P: false });

    expect(askPermissionToStartPresentation).toHaveBeenCalled();
    expect(sendAvailableContentedStream).not.toHaveBeenCalled();
    expect(sendNotAvailableContentedStream).not.toHaveBeenCalled();
    expect(sendStoppedPresentation).not.toHaveBeenCalled();
  });

  it('должен корректно обрабатывать updatePresentation isP2P=true', async () => {
    const stream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    const askPermissionToStartPresentation = jest
      .spyOn(sipConnector.apiManager, 'askPermissionToStartPresentation')
      .mockResolvedValue(undefined);
    const sendAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendNotAvailableContentedStream = jest
      .spyOn(sipConnector.apiManager, 'sendNotAvailableContentedStream')
      .mockResolvedValue(undefined);
    const sendStoppedPresentation = jest
      .spyOn(sipConnector.apiManager, 'sendStoppedPresentation')
      .mockResolvedValue(undefined);

    jest
      .spyOn(sipConnector.presentationManager, 'updatePresentation')
      .mockImplementation(async (callback) => {
        await callback();

        return undefined;
      });

    await sipConnector.updatePresentation(stream, { isP2P: true });

    expect(askPermissionToStartPresentation).not.toHaveBeenCalled();
    expect(sendAvailableContentedStream).toHaveBeenCalled();
    expect(sendNotAvailableContentedStream).not.toHaveBeenCalled();
    expect(sendStoppedPresentation).not.toHaveBeenCalled();
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

      sipConnector.getEstablishedRTCSession();
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

  describe('subscribeChangeRole', () => {
    it('должен вызывать setCallRoleParticipant при событии participant:move-request-to-participants', () => {
      const setCallRoleParticipantSpy = jest.spyOn(
        sipConnector.callManager,
        'setCallRoleParticipant',
      );

      // Тригерим событие на уровне ApiManager
      sipConnector.apiManager.events.trigger('participant:move-request-to-participants', {});

      expect(setCallRoleParticipantSpy).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать setCallRoleSpectatorSynthetic при событии participant:move-request-to-spectators', () => {
      const setCallRoleSpectatorSpy = jest.spyOn(
        sipConnector.callManager,
        'setCallRoleSpectatorSynthetic',
      );

      // Тригерим событие на уровне ApiManager
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-synthetic',
        {},
      );

      expect(setCallRoleSpectatorSpy).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать stopPresentation при событии participant:move-request-to-spectators-synthetic для активной презентации', async () => {
      const stopPresentationSpy = jest
        .spyOn(sipConnector, 'stopPresentation')
        .mockResolvedValue(undefined);

      jest
        .spyOn(sipConnector.presentationManager, 'isPresentationInProcess', 'get')
        .mockReturnValue(true);

      // Тригерим событие на уровне ApiManager
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-synthetic',
        {},
      );

      // Ждем выполнения асинхронного вызова
      await Promise.resolve();

      expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
      expect(stopPresentationSpy).toHaveBeenCalledWith();
    });

    it('должен вызывать setCallRoleSpectator с audioId и sendOffer при событии participant:move-request-to-spectators-with-audio-id', () => {
      const setCallRoleSpectatorSpy = jest.spyOn(sipConnector.callManager, 'setCallRoleSpectator');
      const audioId = 'test-audio-id';

      // Тригерим событие на уровне ApiManager
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-with-audio-id',
        {
          audioId,
        },
      );

      expect(setCallRoleSpectatorSpy).toHaveBeenCalledTimes(1);
      expect(setCallRoleSpectatorSpy).toHaveBeenCalledWith({
        audioId,
        sendOffer: expect.any(Function) as () => void,
      });
    });

    it('должен вызывать stopPresentation при событии participant:move-request-to-spectators-with-audio-id для активной презентации', async () => {
      const stopPresentationSpy = jest
        .spyOn(sipConnector, 'stopPresentation')
        .mockResolvedValue(undefined);
      const audioId = 'test-audio-id';

      jest
        .spyOn(sipConnector.presentationManager, 'isPresentationInProcess', 'get')
        .mockReturnValue(true);

      // Тригерим событие на уровне ApiManager
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-with-audio-id',
        {
          audioId,
        },
      );

      // Ждем выполнения асинхронного вызова
      await Promise.resolve();

      expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
      expect(stopPresentationSpy).toHaveBeenCalledWith();
    });

    it('должен передавать функцию sendOffer в setCallRoleSpectator, которая вызывает sendOffer с правильными параметрами', async () => {
      const testToken = 'test-token';

      jest.spyOn(sipConnector.connectionManager, 'getConnectionConfiguration').mockReturnValue({
        sipServerUrl: 'wss://test.example.com/ws',
      } as unknown as TConnectionConfiguration);

      const sendOfferSpy = jest.spyOn(tools, 'sendOffer').mockResolvedValue({
        type: 'answer',
        sdp: 'test-sdp',
      } as RTCSessionDescription);

      const setCallRoleSpectatorSpy = jest.spyOn(sipConnector.callManager, 'setCallRoleSpectator');
      const audioId = 'test-audio-id';

      // Тригерим событие
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-with-audio-id',
        {
          audioId,
        },
      );

      // Получаем переданную функцию sendOffer
      const callArgs = setCallRoleSpectatorSpy.mock.calls[0];
      const recvParams = callArgs[0];
      const sendOfferFunction = recvParams.sendOffer;

      // Вызываем функцию sendOffer
      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'test-offer-sdp',
      };

      await sendOfferFunction(
        {
          conferenceNumber: 'conf-123',
          quality: 'high',
          token: testToken,
          audioChannel: audioId,
        },
        offer,
      );

      expect(sendOfferSpy).toHaveBeenCalledWith({
        serverUrl: 'wss://test.example.com/ws',
        offer,
        token: testToken,
        conferenceNumber: 'conf-123',
        quality: 'high',
        audio: audioId,
      });
    });

    it('должен выбрасывать ошибку в sendOffer, если sipServerUrl не определен', async () => {
      jest.spyOn(sipConnector.connectionManager, 'getConnectionConfiguration').mockReturnValue({
        sipServerUrl: undefined,
      } as unknown as TConnectionConfiguration);

      const setCallRoleSpectatorSpy = jest.spyOn(sipConnector.callManager, 'setCallRoleSpectator');
      const audioId = 'test-audio-id';

      // Тригерим событие
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-with-audio-id',
        {
          audioId,
        },
      );

      // Получаем переданную функцию sendOffer
      const callArgs = setCallRoleSpectatorSpy.mock.calls[0];
      const recvParams = callArgs[0];
      const sendOfferFunction = recvParams.sendOffer;

      // Вызываем функцию sendOffer и ожидаем ошибку
      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'test-offer-sdp',
      };

      await expect(
        sendOfferFunction(
          {
            conferenceNumber: 'conf-123',
            token: 'testToken',
            quality: 'high',
            audioChannel: audioId,
          },
          offer,
        ),
      ).rejects.toThrow('No sipServerUrl for sendOffer');
    });

    it('должен корректно обрабатывать множественные вызовы события participant:move-request-to-spectators-with-audio-id с разными audioId', () => {
      const setCallRoleSpectatorSpy = jest.spyOn(sipConnector.callManager, 'setCallRoleSpectator');
      const firstAudioId = 'test-audio-id-1';
      const secondAudioId = 'test-audio-id-2';
      const thirdAudioId = 'test-audio-id-3';

      // Первый вызов события
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-with-audio-id',
        {
          audioId: firstAudioId,
        },
      );

      expect(setCallRoleSpectatorSpy).toHaveBeenCalledTimes(1);
      expect(setCallRoleSpectatorSpy).toHaveBeenNthCalledWith(1, {
        audioId: firstAudioId,
        sendOffer: expect.any(Function) as () => void,
      });

      // Второй вызов события с другим audioId
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-with-audio-id',
        {
          audioId: secondAudioId,
        },
      );

      expect(setCallRoleSpectatorSpy).toHaveBeenCalledTimes(2);
      expect(setCallRoleSpectatorSpy).toHaveBeenNthCalledWith(2, {
        audioId: secondAudioId,
        sendOffer: expect.any(Function) as () => void,
      });

      // Третий вызов события с еще одним другим audioId
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-with-audio-id',
        {
          audioId: thirdAudioId,
        },
      );

      expect(setCallRoleSpectatorSpy).toHaveBeenCalledTimes(3);
      expect(setCallRoleSpectatorSpy).toHaveBeenNthCalledWith(3, {
        audioId: thirdAudioId,
        sendOffer: expect.any(Function) as () => void,
      });

      // Проверяем, что все вызовы были с разными audioId
      const allCalls = setCallRoleSpectatorSpy.mock.calls;

      expect(allCalls[0][0].audioId).toBe(firstAudioId);
      expect(allCalls[1][0].audioId).toBe(secondAudioId);
      expect(allCalls[2][0].audioId).toBe(thirdAudioId);
    });

    it('должен безопасно обрабатывать stopPresentation, если презентация не запущена', async () => {
      const stopPresentationSpy = jest
        .spyOn(sipConnector, 'stopPresentation')
        .mockResolvedValue(undefined);

      jest
        .spyOn(sipConnector.presentationManager, 'isPresentationInProcess', 'get')
        .mockReturnValue(true);

      // Тригерим событие без запущенной презентации
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-synthetic',
        {},
      );

      // Ждем выполнения асинхронного вызова
      await Promise.resolve();

      expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать stopPresentation даже если произошла ошибка', async () => {
      const stopPresentationSpy = jest
        .spyOn(sipConnector, 'stopPresentation')
        .mockRejectedValue(new Error('Test error'));

      jest
        .spyOn(sipConnector.presentationManager, 'isPresentationInProcess', 'get')
        .mockReturnValue(true);

      // Тригерим событие
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-synthetic',
        {},
      );

      // Ждем выполнения асинхронного вызова
      await Promise.resolve();

      expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
      // Проверяем, что ошибка была обработана и не проброшена дальше
      expect(stopPresentationSpy).toHaveBeenCalledWith();
    });

    it('должен вызывать stopPresentation даже если произошла ошибка для participant:move-request-to-spectators-with-audio-id', async () => {
      const stopPresentationSpy = jest
        .spyOn(sipConnector, 'stopPresentation')
        .mockRejectedValue(new Error('Test error'));

      jest
        .spyOn(sipConnector.presentationManager, 'isPresentationInProcess', 'get')
        .mockReturnValue(true);

      const audioId = 'test-audio-id';

      // Тригерим событие
      sipConnector.apiManager.events.trigger(
        'participant:move-request-to-spectators-with-audio-id',
        {
          audioId,
        },
      );

      // Ждем выполнения асинхронного вызова и обработки ошибки в catch (строка 435)
      await Promise.resolve();
      await Promise.resolve();

      expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
      // Проверяем, что ошибка была обработана и не проброшена дальше
      expect(stopPresentationSpy).toHaveBeenCalledWith();
    });
  });

  describe('stopped-presentation-by-server-command event', () => {
    let handler: jest.Mock;
    let stopPresentationSpy: jest.SpyInstance;
    let hasPresentationInProcessSpy: jest.SpyInstance;

    beforeEach(() => {
      handler = jest.fn();
      stopPresentationSpy = jest
        .spyOn(sipConnector, 'stopPresentation')
        .mockResolvedValue(undefined);
      hasPresentationInProcessSpy = jest
        .spyOn(sipConnector.presentationManager, 'isPresentationInProcess', 'get')
        .mockReturnValue(true);
    });

    describe('при событии participant:move-request-to-spectators-synthetic', () => {
      it('должен триггерить событие stopped-presentation-by-server-command', async () => {
        sipConnector.on('stopped-presentation-by-server-command', handler);

        sipConnector.apiManager.events.trigger(
          'participant:move-request-to-spectators-synthetic',
          {},
        );

        await Promise.resolve();

        expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({});
      });

      it('не должен триггерить событие stopped-presentation-by-server-command и останавливать презентацию, если презентация не активна', async () => {
        hasPresentationInProcessSpy.mockReturnValue(false);

        sipConnector.on('stopped-presentation-by-server-command', handler);

        sipConnector.apiManager.events.trigger(
          'participant:move-request-to-spectators-synthetic',
          {},
        );

        await Promise.resolve();

        expect(stopPresentationSpy).toHaveBeenCalledTimes(0);
        expect(handler).toHaveBeenCalledTimes(0);
      });

      it('должен триггерить событие stopped-presentation-by-server-command даже если stopPresentation выбрасывает ошибку', async () => {
        stopPresentationSpy.mockRejectedValue(new Error('Test error'));

        sipConnector.on('stopped-presentation-by-server-command', handler);

        sipConnector.apiManager.events.trigger(
          'participant:move-request-to-spectators-synthetic',
          {},
        );

        await Promise.resolve();

        expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({});
      });
    });

    describe('при событии participant:move-request-to-spectators-with-audio-id', () => {
      it('должен триггерить событие stopped-presentation-by-server-command', async () => {
        const audioId = 'test-audio-id';

        sipConnector.on('stopped-presentation-by-server-command', handler);

        sipConnector.apiManager.events.trigger(
          'participant:move-request-to-spectators-with-audio-id',
          {
            audioId,
          },
        );

        await Promise.resolve();

        expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({});
      });

      it('не должен триггерить событие stopped-presentation-by-server-command и останавливать презентацию, если презентация не активна', async () => {
        const audioId = 'test-audio-id';

        hasPresentationInProcessSpy.mockReturnValue(false);

        sipConnector.on('stopped-presentation-by-server-command', handler);

        sipConnector.apiManager.events.trigger(
          'participant:move-request-to-spectators-with-audio-id',
          {
            audioId,
          },
        );

        await Promise.resolve();

        expect(stopPresentationSpy).toHaveBeenCalledTimes(0);
        expect(handler).toHaveBeenCalledTimes(0);
      });

      it('должен триггерить событие stopped-presentation-by-server-command даже если stopPresentation выбрасывает ошибку', async () => {
        const audioId = 'test-audio-id';

        stopPresentationSpy.mockRejectedValue(new Error('Test error'));

        sipConnector.on('stopped-presentation-by-server-command', handler);

        sipConnector.apiManager.events.trigger(
          'participant:move-request-to-spectators-with-audio-id',
          {
            audioId,
          },
        );

        await Promise.resolve();

        expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({});
      });
    });

    describe('при событии mustStopPresentation', () => {
      it('должен триггерить событие stopped-presentation-by-server-command', async () => {
        sipConnector.on('stopped-presentation-by-server-command', handler);

        sipConnector.apiManager.events.trigger('presentation:must-stop', {});

        await Promise.resolve();

        expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({});
      });

      it('не должен триггерить событие stopped-presentation-by-server-command и останавливать презентацию, если презентация не активна', async () => {
        hasPresentationInProcessSpy.mockReturnValue(false);

        sipConnector.on('stopped-presentation-by-server-command', handler);

        sipConnector.apiManager.events.trigger('presentation:must-stop', {});

        await Promise.resolve();

        expect(stopPresentationSpy).toHaveBeenCalledTimes(0);
        expect(handler).toHaveBeenCalledTimes(0);
      });

      it('должен триггерить событие stopped-presentation-by-server-command даже если stopPresentation выбрасывает ошибку', async () => {
        stopPresentationSpy.mockRejectedValue(new Error('Test error'));

        sipConnector.on('stopped-presentation-by-server-command', handler);

        sipConnector.apiManager.events.trigger('presentation:must-stop', {});

        await Promise.resolve();

        expect(stopPresentationSpy).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({});
      });
    });

    it('должен поддерживать once для события stopped-presentation-by-server-command', async () => {
      sipConnector.once('stopped-presentation-by-server-command', handler);

      sipConnector.apiManager.events.trigger('presentation:must-stop', {});
      await Promise.resolve();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({});

      sipConnector.apiManager.events.trigger('presentation:must-stop', {});
      await Promise.resolve();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('должен поддерживать wait для события stopped-presentation-by-server-command', async () => {
      const waitPromise = sipConnector.wait('stopped-presentation-by-server-command');

      sipConnector.apiManager.events.trigger('presentation:must-stop', {});
      await Promise.resolve();

      const result = await waitPromise;

      expect(result).toEqual({});
    });
  });

  describe('sendOffer', () => {
    it('должен успешно вызывать sendOffer из tools с правильными параметрами', async () => {
      const serverUrl = 'wss://test.example.com/ws';
      const conferenceNumber = 'conf-123';
      const quality = 'high' as const;
      const audioChannel = 'audio-1';
      const testToken = 'test-token';
      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'test-offer-sdp',
      };
      const expectedAnswer: RTCSessionDescription = {
        type: 'answer',
        sdp: 'test-answer-sdp',
        toJSON() {
          return { type: 'answer', sdp: 'test-answer-sdp' };
        },
      };

      jest.spyOn(sipConnector.connectionManager, 'getConnectionConfiguration').mockReturnValue({
        sipServerUrl: serverUrl,
      } as unknown as TConnectionConfiguration);

      const sendOfferSpy = jest.spyOn(tools, 'sendOffer').mockResolvedValue(expectedAnswer);

      // @ts-expect-error: доступ к приватному методу для тестирования
      const result = await sipConnector.sendOffer(
        {
          conferenceNumber,
          token: testToken,
          quality,
          audioChannel,
        },
        offer,
      );

      expect(sendOfferSpy).toHaveBeenCalledTimes(1);
      expect(sendOfferSpy).toHaveBeenCalledWith({
        serverUrl,
        offer,
        conferenceNumber,
        quality,
        token: testToken,
        audio: audioChannel,
      });
      expect(result).toEqual(expectedAnswer);
    });

    it('должен выбрасывать ошибку, если sipServerUrl не определен', async () => {
      jest.spyOn(sipConnector.connectionManager, 'getConnectionConfiguration').mockReturnValue({
        sipServerUrl: undefined,
      } as unknown as TConnectionConfiguration);

      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'test-offer-sdp',
      };

      await expect(
        // @ts-expect-error: доступ к приватному методу для тестирования
        sipConnector.sendOffer(
          {
            conferenceNumber: 'conf-123',
            token: 'testToken',
            quality: 'high',
            audioChannel: 'audio-1',
          },
          offer,
        ),
      ).rejects.toThrow('No sipServerUrl for sendOffer');
    });

    it('должен корректно передавать все параметры качества (low, medium, high)', async () => {
      const serverUrl = 'wss://test.example.com/ws';
      const testToken = 'test-token';
      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'test-offer-sdp',
      };

      jest.spyOn(sipConnector.connectionManager, 'getConnectionConfiguration').mockReturnValue({
        sipServerUrl: serverUrl,
      } as unknown as TConnectionConfiguration);

      jest.spyOn(sipConnector.callManager, 'getToken').mockReturnValue(testToken);

      const sendOfferSpy = jest.spyOn(tools, 'sendOffer').mockResolvedValue({
        type: 'answer',
        sdp: 'test-answer-sdp',
      } as RTCSessionDescription);

      const qualities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];

      for (const quality of qualities) {
        // @ts-expect-error: доступ к приватному методу для тестирования
        // eslint-disable-next-line no-await-in-loop
        await sipConnector.sendOffer(
          {
            conferenceNumber: 'conf-123',
            token: testToken,
            quality,
            audioChannel: 'audio-1',
          },
          offer,
        );

        expect(sendOfferSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            quality,
          }),
        );
      }

      expect(sendOfferSpy).toHaveBeenCalledTimes(3);
    });

    it('должен корректно передавать conferenceNumber и audioChannel', async () => {
      const serverUrl = 'wss://test.example.com/ws';
      const conferenceNumber = 'test-conference-456';
      const audioChannel = 'test-audio-channel-789';
      const testToken = 'test-token';
      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'test-offer-sdp',
      };

      jest.spyOn(sipConnector.connectionManager, 'getConnectionConfiguration').mockReturnValue({
        sipServerUrl: serverUrl,
      } as unknown as TConnectionConfiguration);

      jest.spyOn(sipConnector.callManager, 'getToken').mockReturnValue(testToken);

      const sendOfferSpy = jest.spyOn(tools, 'sendOffer').mockResolvedValue({
        type: 'answer',
        sdp: 'test-answer-sdp',
      } as RTCSessionDescription);

      // @ts-expect-error: доступ к приватному методу для тестирования
      await sipConnector.sendOffer(
        {
          conferenceNumber,
          token: testToken,
          quality: 'medium',
          audioChannel,
        },
        offer,
      );

      expect(sendOfferSpy).toHaveBeenCalledWith({
        serverUrl,
        offer,
        token: testToken,
        conferenceNumber,
        quality: 'medium',
        audio: audioChannel,
      });
    });

    it('должен корректно передавать offer в sendOffer из tools', async () => {
      const serverUrl = 'wss://test.example.com/ws';
      const testToken = 'test-token';
      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'custom-offer-sdp-content',
      };

      jest.spyOn(sipConnector.connectionManager, 'getConnectionConfiguration').mockReturnValue({
        sipServerUrl: serverUrl,
      } as unknown as TConnectionConfiguration);

      const sendOfferSpy = jest.spyOn(tools, 'sendOffer').mockResolvedValue({
        type: 'answer',
        sdp: 'test-answer-sdp',
      } as RTCSessionDescription);

      // @ts-expect-error: доступ к приватному методу для тестирования
      await sipConnector.sendOffer(
        {
          conferenceNumber: 'conf-123',
          token: testToken,
          quality: 'high',
          audioChannel: 'audio-1',
        },
        offer,
      );

      expect(sendOfferSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          offer,
        }),
      );
      expect(sendOfferSpy.mock.calls[0][0].offer).toEqual(offer);
    });
  });

  describe('RecvSession integration', () => {
    it('должен вызывать startRecvSession в CallManager при событии spectator-with-audio-id', async () => {
      const sipConnectorWithMocks = new SipConnector({ JsSIP: JsSIP as unknown as TJsSIP });
      const audioId = 'audio-1';
      const testToken = 'test-token';

      jest
        .spyOn(sipConnectorWithMocks.callManager.stateMachine, 'token', 'get')
        .mockReturnValue(testToken);
      jest
        .spyOn(sipConnectorWithMocks.callManager.stateMachine, 'number', 'get')
        .mockReturnValue('123');

      const startRecvSessionMock = jest.spyOn(
        sipConnectorWithMocks.callManager,
        // @ts-expect-error
        'startRecvSession',
      );

      // Тригерим api-событие напрямую на уровне ApiManager
      sipConnectorWithMocks.apiManager.events.trigger(
        'participant:move-request-to-spectators-with-audio-id',
        { audioId },
      );

      await Promise.resolve();

      expect(startRecvSessionMock).toHaveBeenCalledWith(
        audioId,
        expect.objectContaining({
          sendOffer: expect.any(Function) as () => void,
          token: testToken,
        }),
      );
    });
  });
});
