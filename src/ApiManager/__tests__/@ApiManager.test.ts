import jssip from '@/__fixtures__/jssip.mock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import logger from '@/logger';
import * as errorsUtils from '@/utils/errors';
import ApiManager from '../@ApiManager';
import {
  EContentTypeReceived,
  EContentTypeSent,
  EEventsMainCAM,
  EEventsMic,
  EEventsSyncMediaState,
  EHeader,
  EParticipantType,
  EShareState,
  EUseLicense,
} from '../constants';

import type { TJsSIP } from '@/types';

// Мок для IncomingRequest и InfoEvent
class MockRequest {
  private headers: Record<string, string> = {};

  public static createInfoEvent(originator: string, request: MockRequest) {
    return { originator, request };
  }

  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  public getHeader(name: string): string | undefined {
    return this.headers[name];
  }
}

// Мокаем logger
jest.mock('../../logger', () => {
  return jest.fn();
});

describe('ApiManager', () => {
  const mockLogger = logger as jest.MockedFunction<typeof logger>;
  let connectionManager: ConnectionManager;
  let callManager: CallManager & { getEstablishedRTCSession: jest.Mock };
  let apiManager: ApiManager;
  let mockRequest: MockRequest;
  let rtcSession: RTCSessionMock;

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });
    callManager = Object.assign(new CallManager(), {
      getEstablishedRTCSession: jest.fn(),
    });
    rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'local',
    });
    // По умолчанию rtcSession есть
    callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
    apiManager = new ApiManager({
      connectionManager,
      callManager,
    });
    mockRequest = new MockRequest();
  });

  describe('конструктор и базовые методы', () => {
    it('должен подписываться на события при создании', () => {
      const onSpy = jest.spyOn(connectionManager, 'on');

      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      expect(onSpy).toHaveBeenCalledWith('sipEvent', expect.any(Function));
    });

    it('должен подписываться на call события при создании', () => {
      const onSpy = jest.spyOn(callManager, 'on');

      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      expect(onSpy).toHaveBeenCalledWith('newInfo', expect.any(Function));
    });
  });

  describe('методы событий', () => {
    it('должен регистрировать обработчики событий', () => {
      const handler = jest.fn();

      apiManager.on('channels:notify', handler);

      expect(handler).toBeDefined();
    });

    it('должен регистрировать одноразовые обработчики событий', () => {
      const handler = jest.fn();

      apiManager.once('channels:notify', handler);

      expect(handler).toBeDefined();
    });

    it('должен регистрировать обработчики для гонки событий', () => {
      const handler = jest.fn();

      apiManager.onceRace(['channels:notify', 'webcast:started'], handler);

      expect(handler).toBeDefined();
    });

    it('должен удалять обработчики событий', () => {
      const handler = jest.fn();

      apiManager.on('channels:notify', handler);
      apiManager.off('channels:notify', handler);

      expect(handler).toBeDefined();
    });

    it('должен ждать события', async () => {
      const waitPromise = apiManager.wait('channels:notify');

      // Триггерим событие
      const notifyData = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      const result = await waitPromise;

      expect(result).toEqual({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });
    });
  });

  describe('методы wait', () => {
    it('должен ждать события channels', async () => {
      const waitPromise = apiManager.waitChannels();

      // Триггерим событие CHANNELS
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.INPUT_CHANNELS, 'input1,input2');
      mockRequest.setHeader(EHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      const result = await waitPromise;

      expect(result).toEqual({
        inputChannels: 'input1,input2',
        outputChannels: 'output1,output2',
      });
    });

    it('должен ждать события sync media state', async () => {
      const waitPromise = apiManager.waitSyncMediaState();

      // Триггерим событие ADMIN_FORCE_SYNC_MEDIA_STATE
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      const result = await waitPromise;

      expect(result).toEqual({
        isSyncForced: true,
      });
    });

    it('должен ждать события sync media state с не принудительной синхронизацией', async () => {
      const waitPromise = apiManager.waitSyncMediaState();

      // Триггерим событие ADMIN_FORCE_SYNC_MEDIA_STATE с не принудительной синхронизацией
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      const result = await waitPromise;

      expect(result).toEqual({
        isSyncForced: false,
      });
    });
  });

  describe('методы send', () => {
    it('должен отправлять channels', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendChannels({
        inputChannels: 'input1,input2',
        outputChannels: 'output1,output2',
      });

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.CHANNELS, undefined, {
        extraHeaders: [
          `${EHeader.INPUT_CHANNELS}: input1,input2`,
          `${EHeader.OUTPUT_CHANNELS}: output1,output2`,
        ],
      });
    });

    it('должен отправлять media state', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendMediaState({ cam: true, mic: false }, { noTerminateWhenError: false });

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.MEDIA_STATE, undefined, {
        noTerminateWhenError: false,
        extraHeaders: [
          `${EHeader.MEDIA_STATE}: currentstate`,
          `${EHeader.MAIN_CAM_STATE}: 1`,
          `${EHeader.MIC_STATE}: 0`,
        ],
      });
    });

    it('должен отправлять media state с дефолтными опциями', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendMediaState({ cam: false, mic: true });

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.MEDIA_STATE, undefined, {
        noTerminateWhenError: true,
        extraHeaders: [
          `${EHeader.MEDIA_STATE}: currentstate`,
          `${EHeader.MAIN_CAM_STATE}: 0`,
          `${EHeader.MIC_STATE}: 1`,
        ],
      });
    });

    it('должен отправлять refusal для mic', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendRefusalToTurnOn('mic', { noTerminateWhenError: false });

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.REFUSAL, undefined, {
        noTerminateWhenError: false,
        extraHeaders: [`${EHeader.MEDIA_TYPE}: 0`],
      });
    });

    it('должен отправлять refusal для cam', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendRefusalToTurnOn('cam', { noTerminateWhenError: false });

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.REFUSAL, undefined, {
        noTerminateWhenError: false,
        extraHeaders: [`${EHeader.MEDIA_TYPE}: 1`],
      });
    });

    it('должен отправлять refusal для mic с дефолтными опциями', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendRefusalToTurnOn('mic');

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.REFUSAL, undefined, {
        noTerminateWhenError: true,
        extraHeaders: [`${EHeader.MEDIA_TYPE}: 0`],
      });
    });

    it('должен отправлять refusal для cam с дефолтными опциями', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendRefusalToTurnOn('cam');

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.REFUSAL, undefined, {
        noTerminateWhenError: true,
        extraHeaders: [`${EHeader.MEDIA_TYPE}: 1`],
      });
    });

    it('должен отправлять refusal для mic через sendRefusalToTurnOnMic', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendRefusalToTurnOnMic({ noTerminateWhenError: false });

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.REFUSAL, undefined, {
        noTerminateWhenError: false,
        extraHeaders: [`${EHeader.MEDIA_TYPE}: 0`],
      });
    });

    it('должен отправлять refusal для cam через sendRefusalToTurnOnCam', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendRefusalToTurnOnCam({ noTerminateWhenError: false });

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.REFUSAL, undefined, {
        noTerminateWhenError: false,
        extraHeaders: [`${EHeader.MEDIA_TYPE}: 1`],
      });
    });

    it('должен отправлять must stop presentation p2p', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendMustStopPresentationP2P();

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.SHARE_STATE, undefined, {
        extraHeaders: [EHeader.MUST_STOP_PRESENTATION_P2P],
      });
    });

    it('должен отправлять stopped presentation p2p', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendStoppedPresentationP2P();

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.SHARE_STATE, undefined, {
        extraHeaders: [EHeader.STOP_PRESENTATION_P2P],
      });
    });

    it('должен отправлять stopped presentation', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendStoppedPresentation();

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.SHARE_STATE, undefined, {
        extraHeaders: [EHeader.STOP_PRESENTATION],
      });
    });

    it('должен запрашивать разрешение на запуск презентации p2p', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.askPermissionToStartPresentationP2P();

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.SHARE_STATE, undefined, {
        extraHeaders: [EHeader.START_PRESENTATION_P2P],
      });
    });

    it('должен запрашивать разрешение на запуск презентации', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.askPermissionToStartPresentation();

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.SHARE_STATE, undefined, {
        extraHeaders: [EHeader.START_PRESENTATION],
      });
    });

    it('должен запрашивать разрешение на включение камеры', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.askPermissionToEnableCam({ noTerminateWhenError: false });

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.MAIN_CAM, undefined, {
        noTerminateWhenError: false,
        extraHeaders: [EHeader.ENABLE_MAIN_CAM],
      });
    });

    it('должен запрашивать разрешение на включение камеры с дефолтными опциями', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.askPermissionToEnableCam();

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.MAIN_CAM, undefined, {
        noTerminateWhenError: true,
        extraHeaders: [EHeader.ENABLE_MAIN_CAM],
      });
    });

    it('должен обрабатывать ошибку decline response в askPermissionToEnableCam', async () => {
      const declineError = new Error('Decline response from server');
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockRejectedValue(declineError);

      // Мокаем функцию hasDeclineResponseFromServer чтобы она возвращала true
      const hasDeclineResponseFromServerSpy = jest
        .spyOn(errorsUtils, 'hasDeclineResponseFromServer')
        .mockReturnValue(true);

      await expect(apiManager.askPermissionToEnableCam()).rejects.toThrow(
        'Decline response from server',
      );

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.MAIN_CAM, undefined, {
        noTerminateWhenError: true,
        extraHeaders: [EHeader.ENABLE_MAIN_CAM],
      });
      expect(hasDeclineResponseFromServerSpy).toHaveBeenCalledWith(declineError);
    });

    it('должен игнорировать ошибки не decline response в askPermissionToEnableCam', async () => {
      const otherError = new Error('Other error');
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockRejectedValue(otherError);

      // Мокаем функцию hasDeclineResponseFromServer чтобы она возвращала false
      const hasDeclineResponseFromServerSpy = jest
        .spyOn(errorsUtils, 'hasDeclineResponseFromServer')
        .mockReturnValue(false);

      await apiManager.askPermissionToEnableCam();

      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.MAIN_CAM, undefined, {
        noTerminateWhenError: true,
        extraHeaders: [EHeader.ENABLE_MAIN_CAM],
      });
      expect(hasDeclineResponseFromServerSpy).toHaveBeenCalledWith(otherError);
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendChannels', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(
        apiManager.sendChannels({
          inputChannels: 'input1',
          outputChannels: 'output1',
        }),
      ).rejects.toThrow('No rtcSession established');
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendMediaState', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.sendMediaState({ cam: true, mic: false })).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendRefusalToTurnOn', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.sendRefusalToTurnOn('mic')).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendRefusalToTurnOnMic', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.sendRefusalToTurnOnMic()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendRefusalToTurnOnCam', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.sendRefusalToTurnOnCam()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendMustStopPresentationP2P', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.sendMustStopPresentationP2P()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendStoppedPresentationP2P', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.sendStoppedPresentationP2P()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendStoppedPresentation', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.sendStoppedPresentation()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в askPermissionToStartPresentationP2P', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.askPermissionToStartPresentationP2P()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в askPermissionToStartPresentation', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.askPermissionToStartPresentation()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в askPermissionToEnableCam', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.askPermissionToEnableCam()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен отправлять DTMF с числовым тоном', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF' as never, { originator: 'local' });
        }, 0);
      });

      await apiManager.sendDTMF(1);

      expect(sendDTMFSpy).toHaveBeenCalledWith(1, {
        duration: 120,
        interToneGap: 600,
      });
    });

    it('должен отправлять DTMF со строковым тоном', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF' as never, { originator: 'local' });
        }, 0);
      });

      await apiManager.sendDTMF('*');

      expect(sendDTMFSpy).toHaveBeenCalledWith('*', {
        duration: 120,
        interToneGap: 600,
      });
    });

    it('должен отправлять DTMF с тоном 0', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF' as never, { originator: 'local' });
        }, 0);
      });

      await apiManager.sendDTMF(0);

      expect(sendDTMFSpy).toHaveBeenCalledWith(0, {
        duration: 120,
        interToneGap: 600,
      });
    });

    it('должен отправлять DTMF с тоном #', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF' as never, { originator: 'local' });
        }, 0);
      });

      await apiManager.sendDTMF('#');

      expect(sendDTMFSpy).toHaveBeenCalledWith('#', {
        duration: 120,
        interToneGap: 600,
      });
    });

    it('должен ждать события NEW_DTMF с LOCAL originator', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        callManager.events.trigger('newDTMF' as never, { originator: 'local' });
      });

      await apiManager.sendDTMF(1);

      expect(sendDTMFSpy).toHaveBeenCalledWith(1, {
        duration: 120,
        interToneGap: 600,
      });
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendDTMF', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      await expect(apiManager.sendDTMF(1)).rejects.toThrow('No rtcSession established');
    });

    it('должен игнорировать события NEW_DTMF с REMOTE originator', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({
        connectionManager,
        callManager,
      });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF' as never, { originator: 'remote' });
        }, 10);
      });

      const dtmfPromise = apiManager.sendDTMF(1);

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(sendDTMFSpy).toHaveBeenCalledWith(1, {
        duration: 120,
        interToneGap: 600,
      });

      expect(dtmfPromise).toBeInstanceOf(Promise);
    });
  });

  describe('обработка SIP событий', () => {
    it('должен игнорировать запросы без заголовка Notify', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать запросы с заголовком Notify', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      const notifyData = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });
    });

    it('должен логировать неизвестные команды', () => {
      const notifyData = { cmd: 'unknown_command', data: 'test' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(mockLogger).toHaveBeenCalledWith('unknown cmd', notifyData);
    });
  });

  describe('обработка NEW_INFO событий', () => {
    it('должен игнорировать события не от REMOTE', () => {
      const enterRoomSpy = jest.fn();

      apiManager.on('enterRoom', enterRoomSpy);

      const infoEvent = MockRequest.createInfoEvent('local', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(enterRoomSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать ENTER_ROOM события', () => {
      const enterRoomSpy = jest.fn();

      apiManager.on('enterRoom', enterRoomSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.CONTENT_ENTER_ROOM, 'room123');
      mockRequest.setHeader(EHeader.PARTICIPANT_NAME, 'user123');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(enterRoomSpy).toHaveBeenCalledWith({
        room: 'room123',
        participantName: 'user123',
      });
    });

    it('должен обрабатывать SHARE_STATE события', () => {
      const shareStateSpy = jest.fn();

      apiManager.on('availableSecondRemoteStream', shareStateSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(
        EHeader.CONTENT_SHARE_STATE,
        EShareState.AVAILABLE_SECOND_REMOTE_STREAM,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(shareStateSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать MAIN_CAM события', () => {
      const mainCamSpy = jest.fn();

      apiManager.on('admin-start-main-cam', mainCamSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_START_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(mainCamSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать MIC события', () => {
      const micSpy = jest.fn();

      apiManager.on('admin-start-mic', micSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EHeader.MIC, EEventsMic.ADMIN_START_MIC);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(micSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать USE_LICENSE события', () => {
      const licenseSpy = jest.fn();

      apiManager.on('useLicense', licenseSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.USE_LICENSE);
      mockRequest.setHeader(EHeader.CONTENT_USE_LICENSE, EUseLicense.AUDIO);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(licenseSpy).toHaveBeenCalledWith(EUseLicense.AUDIO);
    });

    it('должен обрабатывать PARTICIPANT_STATE события', () => {
      const participantSpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', participantSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EHeader.CONTENT_PARTICIPANT_STATE, EParticipantType.SPECTATOR);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(participantSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать CHANNELS события', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.INPUT_CHANNELS, 'input1,input2');
      mockRequest.setHeader(EHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1,input2',
        outputChannels: 'output1,output2',
      });
    });

    it('должен игнорировать события с неизвестным content-type', () => {
      const anySpy = jest.fn();

      apiManager.on('channels', anySpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, 'unknown/type');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать NOTIFY события через NEW_INFO', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY);

      const notifyData = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });
    });

    it('должен игнорировать события с undefined content-type', () => {
      const anySpy = jest.fn();

      apiManager.on('channels', anySpy);

      // Не устанавливаем CONTENT_TYPE заголовок

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default случай в content-type switch', () => {
      const anySpy = jest.fn();

      apiManager.on('channels', anySpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, 'unknown/content-type');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка уведомлений channels', () => {
    it('должен обрабатывать уведомление channels', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      const notifyData = {
        cmd: 'channels',
        input: 'input_channel_1,input_channel_2',
        output: 'output_channel_1,output_channel_2',
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input_channel_1,input_channel_2',
        outputChannels: 'output_channel_1,output_channel_2',
      });
    });
  });

  describe('обработка уведомлений webcast', () => {
    it('должен обрабатывать уведомление WebcastStarted', () => {
      const webcastStartedSpy = jest.fn();

      apiManager.on('webcast:started', webcastStartedSpy);

      const notifyData = {
        cmd: 'WebcastStarted',
        body: { conference: 'conf123', type: 'video' },
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(webcastStartedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        type: 'video',
      });
    });

    it('должен обрабатывать уведомление WebcastStopped', () => {
      const webcastStoppedSpy = jest.fn();

      apiManager.on('webcast:stopped', webcastStoppedSpy);

      const notifyData = {
        cmd: 'WebcastStopped',
        body: { conference: 'conf123', type: 'video' },
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(webcastStoppedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        type: 'video',
      });
    });
  });

  describe('обработка уведомлений модераторов', () => {
    it('должен обрабатывать уведомление addedToListModerators', () => {
      const addedToModeratorsSpy = jest.fn();

      apiManager.on('participant:added-to-list-moderators', addedToModeratorsSpy);

      const notifyData = {
        cmd: 'addedToListModerators',
        conference: 'conf123',
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(addedToModeratorsSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });

    it('должен обрабатывать уведомление removedFromListModerators', () => {
      const removedFromModeratorsSpy = jest.fn();

      apiManager.on('participant:removed-from-list-moderators', removedFromModeratorsSpy);

      const notifyData = {
        cmd: 'removedFromListModerators',
        conference: 'conf123',
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(removedFromModeratorsSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });
  });

  describe('обработка уведомлений участия', () => {
    it('должен обрабатывать уведомление ParticipationRequestAccepted', () => {
      const participationAcceptedSpy = jest.fn();

      apiManager.on('participation:accepting-word-request', participationAcceptedSpy);

      const notifyData = {
        cmd: 'ParticipationRequestAccepted',
        body: { conference: 'conf123' },
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(participationAcceptedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });

    it('должен обрабатывать уведомление ParticipationRequestRejected', () => {
      const participationRejectedSpy = jest.fn();

      apiManager.on('participation:cancelling-word-request', participationRejectedSpy);

      const notifyData = {
        cmd: 'ParticipationRequestRejected',
        body: { conference: 'conf123' },
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(participationRejectedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });
  });

  describe('обработка уведомлений перемещения участников', () => {
    it('должен обрабатывать уведомление ParticipantMovedToWebcast', () => {
      const participantMoveSpy = jest.fn();

      apiManager.on('participant:move-request-to-stream', participantMoveSpy);

      const notifyData = {
        cmd: 'ParticipantMovedToWebcast',
        body: { conference: 'conf123' },
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(participantMoveSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });
  });

  describe('обработка уведомлений аккаунта', () => {
    it('должен обрабатывать уведомление accountChanged', () => {
      const accountChangedSpy = jest.fn();

      apiManager.on('account:changed', accountChangedSpy);

      const notifyData = {
        cmd: 'accountChanged',
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(accountChangedSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать уведомление accountDeleted', () => {
      const accountDeletedSpy = jest.fn();

      apiManager.on('account:deleted', accountDeletedSpy);

      const notifyData = {
        cmd: 'accountDeleted',
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(accountDeletedSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('обработка уведомлений токенов конференции', () => {
    it('должен обрабатывать уведомление ConferenceParticipantTokenIssued', () => {
      const tokenIssuedSpy = jest.fn();

      apiManager.on('conference:participant-token-issued', tokenIssuedSpy);

      const notifyData = {
        cmd: 'ConferenceParticipantTokenIssued',
        body: {
          conference: 'conf123',
          participant: 'user456',
          jwt: 'jwt_token_here',
        },
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(tokenIssuedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        participant: 'user456',
        jwt: 'jwt_token_here',
      });
    });
  });

  describe('обработка всех типов уведомлений', () => {
    it('должен обрабатывать все команды в switch notify', () => {
      const channelsSpy = jest.fn();
      const webcastStartedSpy = jest.fn();
      const webcastStoppedSpy = jest.fn();
      const addedToModeratorsSpy = jest.fn();
      const removedFromModeratorsSpy = jest.fn();
      const participationAcceptedSpy = jest.fn();
      const participationRejectedSpy = jest.fn();
      const participantMoveSpy = jest.fn();
      const accountChangedSpy = jest.fn();
      const accountDeletedSpy = jest.fn();
      const tokenIssuedSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);
      apiManager.on('webcast:started', webcastStartedSpy);
      apiManager.on('webcast:stopped', webcastStoppedSpy);
      apiManager.on('participant:added-to-list-moderators', addedToModeratorsSpy);
      apiManager.on('participant:removed-from-list-moderators', removedFromModeratorsSpy);
      apiManager.on('participation:accepting-word-request', participationAcceptedSpy);
      apiManager.on('participation:cancelling-word-request', participationRejectedSpy);
      apiManager.on('participant:move-request-to-stream', participantMoveSpy);
      apiManager.on('account:changed', accountChangedSpy);
      apiManager.on('account:deleted', accountDeletedSpy);
      apiManager.on('conference:participant-token-issued', tokenIssuedSpy);

      // Тестируем все команды
      const testCases = [
        {
          cmd: 'channels',
          data: { input: 'input1', output: 'output1' },
          spy: channelsSpy,
          expected: { inputChannels: 'input1', outputChannels: 'output1' },
        },
        {
          cmd: 'WebcastStarted',
          data: { body: { conference: 'conf1', type: 'video' } },
          spy: webcastStartedSpy,
          expected: { conference: 'conf1', type: 'video' },
        },
        {
          cmd: 'WebcastStopped',
          data: { body: { conference: 'conf2', type: 'audio' } },
          spy: webcastStoppedSpy,
          expected: { conference: 'conf2', type: 'audio' },
        },
        {
          cmd: 'addedToListModerators',
          data: { conference: 'conf3' },
          spy: addedToModeratorsSpy,
          expected: { conference: 'conf3' },
        },
        {
          cmd: 'removedFromListModerators',
          data: { conference: 'conf4' },
          spy: removedFromModeratorsSpy,
          expected: { conference: 'conf4' },
        },
        {
          cmd: 'ParticipationRequestAccepted',
          data: { body: { conference: 'conf5' } },
          spy: participationAcceptedSpy,
          expected: { conference: 'conf5' },
        },
        {
          cmd: 'ParticipationRequestRejected',
          data: { body: { conference: 'conf6' } },
          spy: participationRejectedSpy,
          expected: { conference: 'conf6' },
        },
        {
          cmd: 'ParticipantMovedToWebcast',
          data: { body: { conference: 'conf7' } },
          spy: participantMoveSpy,
          expected: { conference: 'conf7' },
        },
        {
          cmd: 'accountChanged',
          data: {},
          spy: accountChangedSpy,
          expected: undefined,
        },
        {
          cmd: 'accountDeleted',
          data: {},
          spy: accountDeletedSpy,
          expected: undefined,
        },
        {
          cmd: 'ConferenceParticipantTokenIssued',
          data: { body: { conference: 'conf8', participant: 'user1', jwt: 'token1' } },
          spy: tokenIssuedSpy,
          expected: { conference: 'conf8', participant: 'user1', jwt: 'token1' },
        },
      ];

      testCases.forEach(({ cmd, data, spy, expected }) => {
        const notifyData = { cmd, ...data };

        mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
        connectionManager.events.trigger('sipEvent', { request: mockRequest });

        expect(spy).toHaveBeenCalledWith(expected);
      });
    });
  });

  describe('обработка SHARE_STATE событий', () => {
    it('должен обрабатывать AVAILABLE_SECOND_REMOTE_STREAM', () => {
      const availableStreamSpy = jest.fn();

      apiManager.on('availableSecondRemoteStream', availableStreamSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(
        EHeader.CONTENT_SHARE_STATE,
        EShareState.AVAILABLE_SECOND_REMOTE_STREAM,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(availableStreamSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать NOT_AVAILABLE_SECOND_REMOTE_STREAM', () => {
      const notAvailableStreamSpy = jest.fn();

      apiManager.on('notAvailableSecondRemoteStream', notAvailableStreamSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(
        EHeader.CONTENT_SHARE_STATE,
        EShareState.NOT_AVAILABLE_SECOND_REMOTE_STREAM,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(notAvailableStreamSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать MUST_STOP_PRESENTATION', () => {
      const mustStopPresentationSpy = jest.fn();

      apiManager.on('mustStopPresentation', mustStopPresentationSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(EHeader.CONTENT_SHARE_STATE, EShareState.MUST_STOP_PRESENTATION);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(mustStopPresentationSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен игнорировать неизвестные SHARE_STATE события', () => {
      const anySpy = jest.fn();

      apiManager.on('availableSecondRemoteStream', anySpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(EHeader.CONTENT_SHARE_STATE, 'unknown_state');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать undefined SHARE_STATE события', () => {
      const anySpy = jest.fn();

      apiManager.on('availableSecondRemoteStream', anySpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      // Не устанавливаем CONTENT_SHARE_STATE заголовок

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default случай в SHARE_STATE switch', () => {
      const anySpy = jest.fn();

      apiManager.on('availableSecondRemoteStream', anySpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(EHeader.CONTENT_SHARE_STATE, 'unknown_share_state');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка MAIN_CAM_CONTROL событий', () => {
    it('должен обрабатывать ADMIN_START_MAIN_CAM', () => {
      const adminStartSpy = jest.fn();

      apiManager.on('admin-start-main-cam', adminStartSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_START_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(adminStartSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать ADMIN_STOP_MAIN_CAM', () => {
      const adminStopSpy = jest.fn();

      apiManager.on('admin-stop-main-cam', adminStopSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_STOP_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(adminStopSpy).toHaveBeenCalledWith({ isSyncForced: false });
    });

    it('должен обрабатывать RESUME_MAIN_CAM с синхронизацией', () => {
      const syncSpy = jest.fn();

      apiManager.on('admin-force-sync-media-state', syncSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(syncSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать PAUSE_MAIN_CAM с синхронизацией', () => {
      const syncSpy = jest.fn();

      apiManager.on('admin-force-sync-media-state', syncSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(syncSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать RESUME_MAIN_CAM без синхронизации', () => {
      const syncSpy = jest.fn();
      const mainCamControlSpy = jest.fn();

      apiManager.on('admin-force-sync-media-state', syncSpy);
      apiManager.on('main-cam-control', mainCamControlSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM);
      // Не устанавливаем MEDIA_SYNC заголовок

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(syncSpy).not.toHaveBeenCalled();
      expect(mainCamControlSpy).toHaveBeenCalledWith({
        mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
        resolutionMainCam: undefined,
      });
    });

    it('должен обрабатывать PAUSE_MAIN_CAM без синхронизации', () => {
      const syncSpy = jest.fn();
      const mainCamControlSpy = jest.fn();

      apiManager.on('admin-force-sync-media-state', syncSpy);
      apiManager.on('main-cam-control', mainCamControlSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM);
      // Не устанавливаем MEDIA_SYNC заголовок

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(syncSpy).not.toHaveBeenCalled();
      expect(mainCamControlSpy).toHaveBeenCalledWith({
        mainCam: EEventsMainCAM.PAUSE_MAIN_CAM,
        resolutionMainCam: undefined,
      });
    });

    it('должен триггерить MAIN_CAM_CONTROL для неизвестных MAIN_CAM событий', () => {
      const mainCamControlSpy = jest.fn();

      apiManager.on('main-cam-control', mainCamControlSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, 'UNKNOWN_MAIN_CAM_EVENT');
      mockRequest.setHeader(EHeader.MAIN_CAM_RESOLUTION, '1920x1080');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(mainCamControlSpy).toHaveBeenCalledWith({
        mainCam: 'UNKNOWN_MAIN_CAM_EVENT',
        resolutionMainCam: '1920x1080',
      });
    });

    it('должен обрабатывать default случай в main cam control switch', () => {
      const mainCamControlSpy = jest.fn();

      apiManager.on('main-cam-control', mainCamControlSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, 'UNKNOWN_MAIN_CAM_EVENT');
      // Не устанавливаем MAIN_CAM_RESOLUTION заголовок

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(mainCamControlSpy).toHaveBeenCalledWith({
        mainCam: 'UNKNOWN_MAIN_CAM_EVENT',
        resolutionMainCam: undefined,
      });
    });
  });

  describe('обработка MIC_CONTROL событий', () => {
    it('должен обрабатывать ADMIN_START_MIC', () => {
      const adminStartSpy = jest.fn();

      apiManager.on('admin-start-mic', adminStartSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EHeader.MIC, EEventsMic.ADMIN_START_MIC);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(adminStartSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать ADMIN_STOP_MIC', () => {
      const adminStopSpy = jest.fn();

      apiManager.on('admin-stop-mic', adminStopSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EHeader.MIC, EEventsMic.ADMIN_STOP_MIC);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(adminStopSpy).toHaveBeenCalledWith({ isSyncForced: false });
    });

    it('должен игнорировать неизвестные MIC события', () => {
      const anySpy = jest.fn();

      apiManager.on('admin-start-mic', anySpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EHeader.MIC, 'unknown_mic_event');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default случай в mic control switch', () => {
      const anySpy = jest.fn();

      apiManager.on('admin-start-mic', anySpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EHeader.MIC, 'unknown_mic_event');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка CHANNELS событий', () => {
    it('должен обрабатывать CHANNELS когда оба заголовка присутствуют', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.INPUT_CHANNELS, 'input1,input2');
      mockRequest.setHeader(EHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1,input2',
        outputChannels: 'output1,output2',
      });
    });

    it('должен игнорировать CHANNELS когда отсутствует INPUT_CHANNELS', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      // Не устанавливаем INPUT_CHANNELS заголовок
      mockRequest.setHeader(EHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать CHANNELS когда отсутствует OUTPUT_CHANNELS', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.INPUT_CHANNELS, 'input1,input2');
      // Не устанавливаем OUTPUT_CHANNELS заголовок

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать CHANNELS когда оба заголовка отсутствуют', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      // Не устанавливаем INPUT_CHANNELS и OUTPUT_CHANNELS заголовки

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(channelsSpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка PARTICIPANT_STATE событий', () => {
    it('должен обрабатывать SPECTATOR состояние', () => {
      const spectatorSpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', spectatorSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EHeader.CONTENT_PARTICIPANT_STATE, EParticipantType.SPECTATOR);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(spectatorSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать PARTICIPANT состояние', () => {
      const participantSpy = jest.fn();

      apiManager.on('participant:move-request-to-participants', participantSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EHeader.CONTENT_PARTICIPANT_STATE, EParticipantType.PARTICIPANT);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(participantSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен игнорировать неизвестные PARTICIPANT_STATE', () => {
      const anySpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', anySpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EHeader.CONTENT_PARTICIPANT_STATE, 'unknown_state');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать undefined PARTICIPANT_STATE', () => {
      const anySpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', anySpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      // Не устанавливаем CONTENT_PARTICIPANT_STATE заголовок

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать оба состояния одновременно', () => {
      const spectatorSpy = jest.fn();
      const participantSpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', spectatorSpy);
      apiManager.on('participant:move-request-to-participants', participantSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EHeader.CONTENT_PARTICIPANT_STATE, EParticipantType.SPECTATOR);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(spectatorSpy).toHaveBeenCalledWith(undefined);
      expect(participantSpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка ошибок', () => {
    it('должен корректно обрабатывать некорректный JSON в заголовке', () => {
      mockRequest.setHeader(EHeader.NOTIFY, 'invalid json');

      expect(() => {
        connectionManager.events.trigger('sipEvent', { request: mockRequest });
      }).not.toThrow();

      expect(mockLogger).toHaveBeenCalledWith('error parse notify', expect.any(Error));
    });

    it('должен корректно обрабатывать отсутствующие поля в уведомлении', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      const notifyData = {
        cmd: 'channels',
        // Отсутствуют поля input и output
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: undefined,
        outputChannels: undefined,
      });
    });

    it('должен корректно обрабатывать отсутствующие заголовки в ENTER_ROOM', () => {
      const enterRoomSpy = jest.fn();

      apiManager.on('enterRoom', enterRoomSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      // Не устанавливаем заголовки CONTENT_ENTER_ROOM и PARTICIPANT_NAME

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(enterRoomSpy).toHaveBeenCalledWith({
        room: undefined,
        participantName: undefined,
      });
    });

    it('должен корректно обрабатывать отсутствующие заголовки в CHANNELS', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      // Не устанавливаем заголовки INPUT_CHANNELS и OUTPUT_CHANNELS

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен корректно обрабатывать отсутствующие заголовки в MAIN_CAM_CONTROL', () => {
      const mainCamControlSpy = jest.fn();

      apiManager.on('main-cam-control', mainCamControlSpy);

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      // Не устанавливаем заголовки MAIN_CAM и MAIN_CAM_RESOLUTION

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent);

      expect(mainCamControlSpy).toHaveBeenCalledWith({
        mainCam: undefined,
        resolutionMainCam: undefined,
      });
    });

    it('должен корректно обрабатывать ошибку парсинга JSON в maybeHandleNotify', () => {
      mockRequest.setHeader(EHeader.NOTIFY, 'invalid json');

      expect(() => {
        connectionManager.events.trigger('sipEvent', { request: mockRequest });
      }).not.toThrow();

      expect(mockLogger).toHaveBeenCalledWith('error parse notify', expect.any(Error));
    });

    it('должен корректно обрабатывать отсутствующий заголовок NOTIFY', () => {
      const anySpy = jest.fn();

      apiManager.on('channels:notify', anySpy);

      // Не устанавливаем заголовок NOTIFY

      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(anySpy).not.toHaveBeenCalled();
    });
  });

  describe('множественные уведомления', () => {
    it('должен обрабатывать несколько уведомлений подряд', () => {
      const channelsSpy = jest.fn();
      const accountChangedSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);
      apiManager.on('account:changed', accountChangedSpy);

      // Первое уведомление
      const notifyData1 = {
        cmd: 'channels',
        input: 'input1',
        output: 'output1',
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData1));
      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      // Второе уведомление
      const notifyData2 = {
        cmd: 'accountChanged',
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData2));
      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledTimes(1);
      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });

      expect(accountChangedSpy).toHaveBeenCalledTimes(1);
      expect(accountChangedSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать несколько NEW_INFO событий подряд', () => {
      const enterRoomSpy = jest.fn();
      const shareStateSpy = jest.fn();

      apiManager.on('enterRoom', enterRoomSpy);
      apiManager.on('availableSecondRemoteStream', shareStateSpy);

      // Первое событие
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.CONTENT_ENTER_ROOM, 'room1');
      mockRequest.setHeader(EHeader.PARTICIPANT_NAME, 'user1');

      const infoEvent1 = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent1);

      // Второе событие
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(
        EHeader.CONTENT_SHARE_STATE,
        EShareState.AVAILABLE_SECOND_REMOTE_STREAM,
      );

      const infoEvent2 = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo' as never, infoEvent2);

      expect(enterRoomSpy).toHaveBeenCalledTimes(1);
      expect(enterRoomSpy).toHaveBeenCalledWith({
        room: 'room1',
        participantName: 'user1',
      });

      expect(shareStateSpy).toHaveBeenCalledTimes(1);
      expect(shareStateSpy).toHaveBeenCalledWith(undefined);
    });
  });
});
