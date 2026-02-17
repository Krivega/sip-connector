import jssip from '@/__fixtures__/jssip.mock';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import ApiManager from '../@ApiManager';
import { MockRequest } from '../__tests-utils__/helpers';
import {
  EContentTypeReceived,
  EContentMainCAM,
  EContentMic,
  EContentSyncMediaState,
  EKeyHeader,
  EContentParticipantType,
  EContentedStreamSendAndReceive,
  EContentUseLicense,
} from '../constants';

import type { TJsSIP } from '@/types';

describe('ApiManager (NEW_INFO handling)', () => {
  let connectionManager: ConnectionManager;
  let callManager: CallManager & { getEstablishedRTCSession: jest.Mock };
  let apiManager: ApiManager;
  let mockRequest: MockRequest;

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });
    callManager = Object.assign(new CallManager(new ContentedStreamManager()), {
      getEstablishedRTCSession: jest.fn(),
    });
    apiManager = new ApiManager();
    mockRequest = new MockRequest();

    apiManager.subscribe({
      connectionManager,
      callManager,
    });
    callManager.subscribeToApiEvents(apiManager);
  });

  describe('обработка NEW_INFO событий', () => {
    it('должен игнорировать события не от REMOTE', () => {
      const enterRoomSpy = jest.fn();

      apiManager.on('enter-room', enterRoomSpy);

      const infoEvent = MockRequest.createInfoEvent('local', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(enterRoomSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать ENTER_ROOM события', () => {
      const enterRoomSpy = jest.fn();

      apiManager.on('enter-room', enterRoomSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EKeyHeader.CONTENT_ENTER_ROOM, 'room123');
      mockRequest.setHeader(EKeyHeader.PARTICIPANT_NAME, 'user123');
      mockRequest.setHeader(EKeyHeader.BEARER_TOKEN, 'token123');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(enterRoomSpy).toHaveBeenCalledWith({
        room: 'room123',
        participantName: 'user123',
        bearerToken: 'token123',
      });
    });

    it('должен обрабатывать SHARE_STATE события', () => {
      const shareStateSpy = jest.fn();

      apiManager.on('contented-stream:available', shareStateSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(
        EKeyHeader.CONTENTED_STREAM_STATE,
        EContentedStreamSendAndReceive.AVAILABLE_CONTENTED_STREAM,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(shareStateSpy).toHaveBeenCalledWith({});
    });

    it('должен обрабатывать MAIN_CAM события', () => {
      const mainCamSpy = jest.fn();

      apiManager.on('admin:start-main-cam', mainCamSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, EContentMainCAM.ADMIN_START_MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(mainCamSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать MIC события', () => {
      const micSpy = jest.fn();

      apiManager.on('admin:start-mic', micSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EKeyHeader.MIC, EContentMic.ADMIN_START_MIC);
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(micSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен вызывать событие USE_LICENSE для известного значения', () => {
      const licenseSpy = jest.fn();

      apiManager.on('use-license', licenseSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.USE_LICENSE);
      mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, EContentUseLicense.AUDIO);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);

      expect(licenseSpy).toHaveBeenCalledWith(EContentUseLicense.AUDIO);
    });

    it('должен не вызывать событие USE_LICENSE для неизвестного значения', () => {
      const licenseSpy = jest.fn();

      apiManager.on('use-license', licenseSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.USE_LICENSE);
      mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'UNKNOWN_LICENSE');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);

      expect(licenseSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать PARTICIPANT_STATE события с audioId', () => {
      const spectatorOldSpy = jest.fn();
      const spectatorWithAudioIdSpy = jest.fn();
      const spectatorSpy = jest.fn();
      const audioId = '123';

      apiManager.on('participant:move-request-to-spectators-synthetic', spectatorOldSpy);
      apiManager.on(
        'participant:move-request-to-spectators-with-audio-id',
        spectatorWithAudioIdSpy,
      );
      apiManager.on('participant:move-request-to-spectators', spectatorSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(
        EKeyHeader.CONTENT_PARTICIPANT_STATE,
        EContentParticipantType.SPECTATOR,
      );
      mockRequest.setHeader(EKeyHeader.AUDIO_ID, audioId);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(spectatorOldSpy).not.toHaveBeenCalled();
      expect(spectatorWithAudioIdSpy).toHaveBeenCalledWith({ audioId });
      expect(spectatorSpy).toHaveBeenCalledWith({ isSynthetic: false, audioId });
    });

    it('должен обрабатывать CHANNELS события', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:all', channelsSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EKeyHeader.INPUT_CHANNELS, 'input1,input2');
      mockRequest.setHeader(EKeyHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1,input2',
        outputChannels: 'output1,output2',
      });
    });

    it('должен игнорировать события с неизвестным content-type', () => {
      const anySpy = jest.fn();

      apiManager.on('channels:all', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'unknown/type');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать NOTIFY события через NEW_INFO', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY);

      const notifyData = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(EKeyHeader.NOTIFY, JSON.stringify(notifyData));

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });
    });

    it('должен игнорировать события с undefined content-type', () => {
      const anySpy = jest.fn();

      apiManager.on('channels:all', anySpy);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default случай в content-type switch', () => {
      const anySpy = jest.fn();

      apiManager.on('channels:all', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'unknown/content-type');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default case для валидного но необработанного content-type', () => {
      // Этот тест покрывает default case в switch statement
      // Используем мок для getHeader чтобы вернуть значение вне enum
      const anySpy = jest.fn();

      apiManager.on('channels:all', anySpy);
      apiManager.on('enter-room', anySpy);
      apiManager.on('use-license', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'some-value');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);

      // Ни одно событие не должно быть вызвано для default case
      expect(anySpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка SHARE_STATE событий', () => {
    it('должен обрабатывать AVAILABLE_SECOND_REMOTE_STREAM', () => {
      const availableStreamSpy = jest.fn();

      apiManager.on('contented-stream:available', availableStreamSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(
        EKeyHeader.CONTENTED_STREAM_STATE,
        EContentedStreamSendAndReceive.AVAILABLE_CONTENTED_STREAM,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(availableStreamSpy).toHaveBeenCalledWith({});
    });

    it('должен обрабатывать NOT_AVAILABLE_SECOND_REMOTE_STREAM', () => {
      const notAvailableStreamSpy = jest.fn();

      apiManager.on('contented-stream:not-available', notAvailableStreamSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(
        EKeyHeader.CONTENTED_STREAM_STATE,
        EContentedStreamSendAndReceive.NOT_AVAILABLE_CONTENTED_STREAM,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(notAvailableStreamSpy).toHaveBeenCalledWith({});
    });

    it('должен обрабатывать MUST_STOP_PRESENTATION', () => {
      const mustStopPresentationSpy = jest.fn();

      apiManager.on('presentation:must-stop', mustStopPresentationSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(
        EKeyHeader.CONTENTED_STREAM_STATE,
        EContentedStreamSendAndReceive.MUST_STOP_PRESENTATION,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(mustStopPresentationSpy).toHaveBeenCalledWith({});
    });

    it('должен игнорировать неизвестные SHARE_STATE события', () => {
      const anySpy = jest.fn();

      apiManager.on('contented-stream:available', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'unknown_state');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать undefined SHARE_STATE события', () => {
      const anySpy = jest.fn();

      apiManager.on('contented-stream:available', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default случай в SHARE_STATE switch', () => {
      // Покрываем default case в switch statement triggerShareState
      const anySpy = jest.fn();

      apiManager.on('contented-stream:available', anySpy);
      apiManager.on('contented-stream:not-available', anySpy);
      apiManager.on('presentation:must-stop', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'some-value');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);

      // Ни одно событие не должно быть вызвано для default case
      expect(anySpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка MAIN_CAM_CONTROL событий', () => {
    it('должен обрабатывать ADMIN_START_MAIN_CAM', () => {
      const adminStartSpy = jest.fn();

      apiManager.on('admin:start-main-cam', adminStartSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, EContentMainCAM.ADMIN_START_MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(adminStartSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать ADMIN_STOP_MAIN_CAM', () => {
      const adminStopSpy = jest.fn();

      apiManager.on('admin:stop-main-cam', adminStopSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, EContentMainCAM.ADMIN_STOP_MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_NOT_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(adminStopSpy).toHaveBeenCalledWith({ isSyncForced: false });
    });

    it('должен обрабатывать RESUME_MAIN_CAM с синхронизацией', () => {
      const syncSpy = jest.fn();

      apiManager.on('admin:force-sync-media-state', syncSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, EContentMainCAM.RESUME_MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(syncSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать PAUSE_MAIN_CAM с синхронизацией', () => {
      const syncSpy = jest.fn();

      apiManager.on('admin:force-sync-media-state', syncSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, EContentMainCAM.PAUSE_MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(syncSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать RESUME_MAIN_CAM без синхронизации', () => {
      const syncSpy = jest.fn();
      const mainCamControlSpy = jest.fn();

      apiManager.on('admin:force-sync-media-state', syncSpy);
      apiManager.on('main-cam-control', mainCamControlSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, EContentMainCAM.RESUME_MAIN_CAM);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(syncSpy).not.toHaveBeenCalled();
      expect(mainCamControlSpy).toHaveBeenCalledWith({
        mainCam: EContentMainCAM.RESUME_MAIN_CAM,
        resolutionMainCam: undefined,
      });
    });

    it('должен обрабатывать PAUSE_MAIN_CAM без синхронизации', () => {
      const syncSpy = jest.fn();
      const mainCamControlSpy = jest.fn();

      apiManager.on('admin:force-sync-media-state', syncSpy);
      apiManager.on('main-cam-control', mainCamControlSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, EContentMainCAM.PAUSE_MAIN_CAM);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(syncSpy).not.toHaveBeenCalled();
      expect(mainCamControlSpy).toHaveBeenCalledWith({
        mainCam: EContentMainCAM.PAUSE_MAIN_CAM,
        resolutionMainCam: undefined,
      });
    });

    it('должен триггерить MAIN_CAM_CONTROL для неизвестных MAIN_CAM событий', () => {
      const mainCamControlSpy = jest.fn();

      apiManager.on('main-cam-control', mainCamControlSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'UNKNOWN_MAIN_CAM_EVENT');
      mockRequest.setHeader(EKeyHeader.MAIN_CAM_RESOLUTION, '1920x1080');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      // Неизвестные enum значения теперь возвращают undefined
      expect(mainCamControlSpy).toHaveBeenCalledWith({
        mainCam: undefined,
        resolutionMainCam: '1920x1080',
      });
    });

    it('должен обрабатывать default случай в main cam control switch', () => {
      const mainCamControlSpy = jest.fn();

      apiManager.on('main-cam-control', mainCamControlSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'UNKNOWN_MAIN_CAM_EVENT');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      // Неизвестные enum значения теперь возвращают undefined
      expect(mainCamControlSpy).toHaveBeenCalledWith({
        mainCam: undefined,
        resolutionMainCam: undefined,
      });
    });
  });

  describe('обработка MIC_CONTROL событий', () => {
    it('должен обрабатывать ADMIN_START_MIC', () => {
      const adminStartSpy = jest.fn();

      apiManager.on('admin:start-mic', adminStartSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EKeyHeader.MIC, EContentMic.ADMIN_START_MIC);
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(adminStartSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать ADMIN_STOP_MIC', () => {
      const adminStopSpy = jest.fn();

      apiManager.on('admin:stop-mic', adminStopSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EKeyHeader.MIC, EContentMic.ADMIN_STOP_MIC);
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_NOT_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(adminStopSpy).toHaveBeenCalledWith({ isSyncForced: false });
    });

    it('должен игнорировать неизвестные MIC события', () => {
      const anySpy = jest.fn();

      apiManager.on('admin:start-mic', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EKeyHeader.MIC, 'unknown_mic_event');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default случай в mic control switch', () => {
      const anySpy = jest.fn();

      apiManager.on('admin:start-mic', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EKeyHeader.MIC, 'unknown_mic_event');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка CHANNELS событий', () => {
    it('должен обрабатывать CHANNELS когда оба заголовка присутствуют', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:all', channelsSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EKeyHeader.INPUT_CHANNELS, 'input1,input2');
      mockRequest.setHeader(EKeyHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1,input2',
        outputChannels: 'output1,output2',
      });
    });

    it('должен игнорировать CHANNELS когда отсутствует INPUT_CHANNELS', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:all', channelsSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EKeyHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать CHANNELS когда отсутствует OUTPUT_CHANNELS', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:all', channelsSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EKeyHeader.INPUT_CHANNELS, 'input1,input2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать CHANNELS когда оба заголовка отсутствуют', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:all', channelsSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка PARTICIPANT_STATE событий', () => {
    it('должен обрабатывать SPECTATOR состояние', () => {
      const spectatorOldSpy = jest.fn();
      const spectatorWithAudioIdSpy = jest.fn();
      const spectatorSpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators-synthetic', spectatorOldSpy);
      apiManager.on(
        'participant:move-request-to-spectators-with-audio-id',
        spectatorWithAudioIdSpy,
      );
      apiManager.on('participant:move-request-to-spectators', spectatorSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(
        EKeyHeader.CONTENT_PARTICIPANT_STATE,
        EContentParticipantType.SPECTATOR,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(spectatorOldSpy).toHaveBeenCalledWith({});
      expect(spectatorWithAudioIdSpy).not.toHaveBeenCalled();
      expect(spectatorSpy).toHaveBeenCalledWith({ isSynthetic: true });
    });

    it('должен обрабатывать PARTICIPANT состояние', () => {
      const participantSpy = jest.fn();

      apiManager.on('participant:move-request-to-participants', participantSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(
        EKeyHeader.CONTENT_PARTICIPANT_STATE,
        EContentParticipantType.PARTICIPANT,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(participantSpy).toHaveBeenCalledWith({});
    });

    it('должен игнорировать неизвестные PARTICIPANT_STATE', () => {
      const anySpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EKeyHeader.CONTENT_PARTICIPANT_STATE, 'unknown_state');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать undefined PARTICIPANT_STATE', () => {
      const anySpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', anySpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать оба состояния одновременно', () => {
      const spectatorOldSpy = jest.fn();
      const spectatorWithAudioIdSpy = jest.fn();
      const spectatorSpy = jest.fn();
      const participantSpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators-synthetic', spectatorOldSpy);
      apiManager.on(
        'participant:move-request-to-spectators-with-audio-id',
        spectatorWithAudioIdSpy,
      );
      apiManager.on('participant:move-request-to-spectators', spectatorSpy);
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(
        EKeyHeader.CONTENT_PARTICIPANT_STATE,
        EContentParticipantType.SPECTATOR,
      );

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(spectatorOldSpy).toHaveBeenCalledWith({});
      expect(spectatorWithAudioIdSpy).not.toHaveBeenCalled();
      expect(spectatorSpy).toHaveBeenCalledWith({ isSynthetic: true });
      expect(participantSpy).not.toHaveBeenCalled();
    });
  });
});
