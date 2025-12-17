import jssip from '@/__fixtures__/jssip.mock';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import ApiManager from '../@ApiManager';
import { MockRequest } from '../__tests-utils__/helpers';
import {
  EContentTypeReceived,
  EEventsMainCAM,
  EEventsMic,
  EEventsSyncMediaState,
  EHeader,
  EParticipantType,
  EShareState,
  EUseLicense,
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
    callManager = Object.assign(new CallManager(), {
      getEstablishedRTCSession: jest.fn(),
    });
    apiManager = new ApiManager({
      connectionManager,
      callManager,
    });
    mockRequest = new MockRequest();
  });

  describe('обработка NEW_INFO событий', () => {
    it('должен игнорировать события не от REMOTE', () => {
      const enterRoomSpy = jest.fn();

      apiManager.on('enterRoom', enterRoomSpy);

      const infoEvent = MockRequest.createInfoEvent('local', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(enterRoomSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать ENTER_ROOM события', () => {
      const enterRoomSpy = jest.fn();

      apiManager.on('enterRoom', enterRoomSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.CONTENT_ENTER_ROOM, 'room123');
      mockRequest.setHeader(EHeader.PARTICIPANT_NAME, 'user123');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(enterRoomSpy).toHaveBeenCalledWith({ room: 'room123', participantName: 'user123' });
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

      callManager.events.trigger('newInfo', infoEvent);
      expect(shareStateSpy).toHaveBeenCalledWith({});
    });

    it('должен обрабатывать MAIN_CAM события', () => {
      const mainCamSpy = jest.fn();

      apiManager.on('admin-start-main-cam', mainCamSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_START_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(mainCamSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать MIC события', () => {
      const micSpy = jest.fn();

      apiManager.on('admin-start-mic', micSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EHeader.MIC, EEventsMic.ADMIN_START_MIC);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(micSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать USE_LICENSE события', () => {
      const licenseSpy = jest.fn();

      apiManager.on('useLicense', licenseSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.USE_LICENSE);
      mockRequest.setHeader(EHeader.CONTENT_USE_LICENSE, EUseLicense.AUDIO);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(licenseSpy).toHaveBeenCalledWith(EUseLicense.AUDIO);
    });

    it('должен обрабатывать PARTICIPANT_STATE события с audioId', () => {
      const spectatorSpy = jest.fn();
      const spectatorWithAudioIdSpy = jest.fn();
      const audioId = '123';

      apiManager.on('participant:move-request-to-spectators', spectatorSpy);
      apiManager.on(
        'participant:move-request-to-spectators-with-audio-id',
        spectatorWithAudioIdSpy,
      );
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EHeader.CONTENT_PARTICIPANT_STATE, EParticipantType.SPECTATOR);
      mockRequest.setHeader(EHeader.AUDIO_ID, audioId);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(spectatorSpy).not.toHaveBeenCalled();
      expect(spectatorWithAudioIdSpy).toHaveBeenCalledWith({ audioId });
    });

    it('должен обрабатывать CHANNELS события', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.INPUT_CHANNELS, 'input1,input2');
      mockRequest.setHeader(EHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
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

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать NOTIFY события через NEW_INFO', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY);

      const notifyData = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });
    });

    it('должен игнорировать события с undefined content-type', () => {
      const anySpy = jest.fn();

      apiManager.on('channels', anySpy);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default случай в content-type switch', () => {
      const anySpy = jest.fn();

      apiManager.on('channels', anySpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, 'unknown/content-type');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
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

      callManager.events.trigger('newInfo', infoEvent);
      expect(availableStreamSpy).toHaveBeenCalledWith({});
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

      callManager.events.trigger('newInfo', infoEvent);
      expect(notAvailableStreamSpy).toHaveBeenCalledWith({});
    });

    it('должен обрабатывать MUST_STOP_PRESENTATION', () => {
      const mustStopPresentationSpy = jest.fn();

      apiManager.on('mustStopPresentation', mustStopPresentationSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(EHeader.CONTENT_SHARE_STATE, EShareState.MUST_STOP_PRESENTATION);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(mustStopPresentationSpy).toHaveBeenCalledWith({});
    });

    it('должен игнорировать неизвестные SHARE_STATE события', () => {
      const anySpy = jest.fn();

      apiManager.on('availableSecondRemoteStream', anySpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(EHeader.CONTENT_SHARE_STATE, 'unknown_state');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать undefined SHARE_STATE события', () => {
      const anySpy = jest.fn();

      apiManager.on('availableSecondRemoteStream', anySpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default случай в SHARE_STATE switch', () => {
      const anySpy = jest.fn();

      apiManager.on('availableSecondRemoteStream', anySpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE);
      mockRequest.setHeader(EHeader.CONTENT_SHARE_STATE, 'unknown_share_state');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
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

      callManager.events.trigger('newInfo', infoEvent);
      expect(adminStartSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать ADMIN_STOP_MAIN_CAM', () => {
      const adminStopSpy = jest.fn();

      apiManager.on('admin-stop-main-cam', adminStopSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_STOP_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(adminStopSpy).toHaveBeenCalledWith({ isSyncForced: false });
    });

    it('должен обрабатывать RESUME_MAIN_CAM с синхронизацией', () => {
      const syncSpy = jest.fn();

      apiManager.on('admin-force-sync-media-state', syncSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(syncSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать PAUSE_MAIN_CAM с синхронизацией', () => {
      const syncSpy = jest.fn();

      apiManager.on('admin-force-sync-media-state', syncSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(syncSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать RESUME_MAIN_CAM без синхронизации', () => {
      const syncSpy = jest.fn();
      const mainCamControlSpy = jest.fn();

      apiManager.on('admin-force-sync-media-state', syncSpy);
      apiManager.on('main-cam-control', mainCamControlSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM);
      mockRequest.setHeader(EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
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

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
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

      callManager.events.trigger('newInfo', infoEvent);
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

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
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

      callManager.events.trigger('newInfo', infoEvent);
      expect(adminStartSpy).toHaveBeenCalledWith({ isSyncForced: true });
    });

    it('должен обрабатывать ADMIN_STOP_MIC', () => {
      const adminStopSpy = jest.fn();

      apiManager.on('admin-stop-mic', adminStopSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EHeader.MIC, EEventsMic.ADMIN_STOP_MIC);
      mockRequest.setHeader(EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(adminStopSpy).toHaveBeenCalledWith({ isSyncForced: false });
    });

    it('должен игнорировать неизвестные MIC события', () => {
      const anySpy = jest.fn();

      apiManager.on('admin-start-mic', anySpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EHeader.MIC, 'unknown_mic_event');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать default случай в mic control switch', () => {
      const anySpy = jest.fn();

      apiManager.on('admin-start-mic', anySpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.MIC);
      mockRequest.setHeader(EHeader.MIC, 'unknown_mic_event');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
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

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1,input2',
        outputChannels: 'output1,output2',
      });
    });

    it('должен игнорировать CHANNELS когда отсутствует INPUT_CHANNELS', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.OUTPUT_CHANNELS, 'output1,output2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать CHANNELS когда отсутствует OUTPUT_CHANNELS', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);
      mockRequest.setHeader(EHeader.INPUT_CHANNELS, 'input1,input2');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать CHANNELS когда оба заголовка отсутствуют', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels', channelsSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(channelsSpy).not.toHaveBeenCalled();
    });
  });

  describe('обработка PARTICIPANT_STATE событий', () => {
    it('должен обрабатывать SPECTATOR состояние', () => {
      const spectatorSpy = jest.fn();
      const spectatorWithAudioIdSpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', spectatorSpy);
      apiManager.on(
        'participant:move-request-to-spectators-with-audio-id',
        spectatorWithAudioIdSpy,
      );
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EHeader.CONTENT_PARTICIPANT_STATE, EParticipantType.SPECTATOR);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(spectatorSpy).toHaveBeenCalledWith({});
      expect(spectatorWithAudioIdSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать PARTICIPANT состояние', () => {
      const participantSpy = jest.fn();

      apiManager.on('participant:move-request-to-participants', participantSpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EHeader.CONTENT_PARTICIPANT_STATE, EParticipantType.PARTICIPANT);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(participantSpy).toHaveBeenCalledWith({});
    });

    it('должен игнорировать неизвестные PARTICIPANT_STATE', () => {
      const anySpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', anySpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);
      mockRequest.setHeader(EHeader.CONTENT_PARTICIPANT_STATE, 'unknown_state');

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
      expect(anySpy).not.toHaveBeenCalled();
    });

    it('должен игнорировать undefined PARTICIPANT_STATE', () => {
      const anySpy = jest.fn();

      apiManager.on('participant:move-request-to-spectators', anySpy);
      mockRequest.setHeader(EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE);

      const infoEvent = MockRequest.createInfoEvent('remote', mockRequest);

      callManager.events.trigger('newInfo', infoEvent);
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

      callManager.events.trigger('newInfo', infoEvent);
      expect(spectatorSpy).toHaveBeenCalledWith({});
      expect(participantSpy).not.toHaveBeenCalled();
    });
  });
});
