import delayPromise from '@/__fixtures__/delayPromise';
import jssip from '@/__fixtures__/jssip.mock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import logger from '@/logger';
import * as errorsUtils from '@/utils/errors';
import ApiManager from '../@ApiManager';
import { MockRequest } from '../__tests-utils__/helpers';
import {
  EContentTypeReceived,
  EContentTypeSent,
  EEventsMainCAM,
  EEventsSyncMediaState,
  EHeader,
} from '../constants';

import type { TJsSIP } from '@/types';

// Мокаем logger
jest.mock('../../logger', () => {
  return jest.fn();
});

describe('ApiManager (core)', () => {
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

      const notifyData = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', { request: mockRequest });

      const result = await waitPromise;

      expect(result).toEqual({ inputChannels: 'input1', outputChannels: 'output1' });
    });
  });

  describe('методы wait', () => {
    it('должен ждать события channels', async () => {
      const waitPromise = apiManager.waitChannels();

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.INPUT_CHANNELS, 'input1,input2');
      mockRequest.setHeader(EHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);

      const result = await waitPromise;

      expect(result).toEqual({ inputChannels: 'input1,input2', outputChannels: 'output1,output2' });
    });

    it('должен ждать события sync media state', async () => {
      const waitPromise = apiManager.waitSyncMediaState();

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);

      const result = await waitPromise;

      expect(result).toEqual({ isSyncForced: true });
    });

    it('должен ждать события sync media state с не принудительной синхронизацией', async () => {
      const waitPromise = apiManager.waitSyncMediaState();

      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);

      const result = await waitPromise;

      expect(result).toEqual({ isSyncForced: false });
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

    it('должен отправлять stats', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      await apiManager.sendStats({ availableIncomingBitrate: 12_345 });
      expect(sendInfoSpy).toHaveBeenCalledWith(EContentTypeSent.STATS, undefined, {
        noTerminateWhenError: true,
        extraHeaders: [`${EHeader.AVAILABLE_INCOMING_BITRATE}: 12345`],
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
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(
        apiManager.sendChannels({ inputChannels: 'input1', outputChannels: 'output1' }),
      ).rejects.toThrow('No rtcSession established');
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendMediaState', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.sendMediaState({ cam: true, mic: false })).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendStats', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.sendStats({ availableIncomingBitrate: 1 })).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendRefusalToTurnOn', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.sendRefusalToTurnOn('mic')).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendRefusalToTurnOnMic', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.sendRefusalToTurnOnMic()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendRefusalToTurnOnCam', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.sendRefusalToTurnOnCam()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendMustStopPresentationP2P', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.sendMustStopPresentationP2P()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendStoppedPresentationP2P', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.sendStoppedPresentationP2P()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendStoppedPresentation', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.sendStoppedPresentation()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в askPermissionToStartPresentationP2P', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.askPermissionToStartPresentationP2P()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в askPermissionToStartPresentation', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.askPermissionToStartPresentation()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в askPermissionToEnableCam', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.askPermissionToEnableCam()).rejects.toThrow(
        'No rtcSession established',
      );
    });

    it('должен отправлять DTMF с числовым тоном', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({ connectionManager, callManager });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF', { originator: 'local' });
        }, 0);
      });

      await apiManager.sendDTMF(1);
      expect(sendDTMFSpy).toHaveBeenCalledWith(1, { duration: 120, interToneGap: 600 });
    });

    it('должен отправлять DTMF со строковым тоном', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({ connectionManager, callManager });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF', { originator: 'local' });
        }, 0);
      });

      await apiManager.sendDTMF('*');
      expect(sendDTMFSpy).toHaveBeenCalledWith('*', { duration: 120, interToneGap: 600 });
    });

    it('должен отправлять DTMF с тоном 0', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({ connectionManager, callManager });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF', { originator: 'local' });
        }, 0);
      });

      await apiManager.sendDTMF(0);
      expect(sendDTMFSpy).toHaveBeenCalledWith(0, { duration: 120, interToneGap: 600 });
    });

    it('должен отправлять DTMF с тоном #', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({ connectionManager, callManager });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF', { originator: 'local' });
        }, 0);
      });

      await apiManager.sendDTMF('#');
      expect(sendDTMFSpy).toHaveBeenCalledWith('#', { duration: 120, interToneGap: 600 });
    });

    it('должен ждать события NEW_DTMF с LOCAL originator', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({ connectionManager, callManager });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        callManager.events.trigger('newDTMF', { originator: 'local' });
      });

      await apiManager.sendDTMF(1);
      expect(sendDTMFSpy).toHaveBeenCalledWith(1, { duration: 120, interToneGap: 600 });
    });

    it('должен выбрасывать ошибку при отсутствии rtcSession в sendDTMF', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      apiManager = new ApiManager({ connectionManager, callManager });
      await expect(apiManager.sendDTMF(1)).rejects.toThrow('No rtcSession established');
    });

    it('должен игнорировать события NEW_DTMF с REMOTE originator', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
      apiManager = new ApiManager({ connectionManager, callManager });

      const sendDTMFSpy = jest.spyOn(rtcSession, 'sendDTMF').mockImplementation(() => {
        setTimeout(() => {
          callManager.events.trigger('newDTMF', { originator: 'remote' });
        }, 10);
      });
      const dtmfPromise = apiManager.sendDTMF(1);

      await delayPromise(50);
      expect(sendDTMFSpy).toHaveBeenCalledWith(1, { duration: 120, interToneGap: 600 });
      expect(dtmfPromise).toBeInstanceOf(Promise);
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

      const notifyData = { cmd: 'channels' } as const;

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

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(enterRoomSpy).toHaveBeenCalledWith({ room: undefined, participantName: undefined });
    });

    it('должен корректно обрабатывать отсутствующие заголовки в CHANNELS', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен корректно обрабатывать отсутствующие заголовки в MAIN_CAM_CONTROL', () => {
      const mainCamControlSpy = jest.fn();

      apiManager.on('main-cam-control', mainCamControlSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
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
      connectionManager.events.trigger('sipEvent', { request: mockRequest });
      expect(anySpy).not.toHaveBeenCalled();
    });
  });
});
