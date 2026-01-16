import logger from '@/logger';
import { hasDeclineResponseFromServer } from '@/utils/errors';
import {
  EContentTypeReceived,
  EContentTypeSent,
  EEventsMainCAM,
  EEventsMic,
  EEventsSyncMediaState,
  EHeader,
  EParticipantType,
  EShareState,
} from './constants';
import { createEvents, EEvent } from './events';
import { ECMDNotify } from './types';

import type {
  IncomingInfoEvent,
  IncomingRequest,
  OutgoingInfoEvent,
  RTCSession,
} from '@krivega/jssip';
import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { EUseLicense } from './constants';
import type { TEventMap, TEvents } from './events';
import type {
  TAcceptingWordRequestInfoNotify,
  TAddedToListModeratorsInfoNotify,
  TCancellingWordRequestInfoNotify,
  TChannels,
  TChannelsInfoNotify,
  TConferenceParticipantTokenIssued,
  TInfoNotify,
  TMediaState,
  TMoveRequestToStreamInfoNotify,
  TOptionsExtraHeaders,
  TOptionsInfoMediaState,
  TParametersConferenceParticipantTokenIssued,
  TParametersModeratorsList,
  TParametersWebcast,
  TRemovedFromListModeratorsInfoNotify,
  TWebcastInfoNotify,
  TWebcastStoppedInfoNotify,
} from './types';

class ApiManager {
  public readonly events: TEvents;

  private readonly connectionManager: ConnectionManager;

  private readonly callManager: CallManager;

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.connectionManager = connectionManager;
    this.callManager = callManager;
    this.events = createEvents();

    this.subscribe();
  }

  public async waitChannels(): Promise<TChannels> {
    return this.wait(EEvent.CHANNELS_ALL);
  }

  public async waitSyncMediaState(): Promise<{ isSyncForced: boolean }> {
    return this.wait(EEvent.ADMIN_FORCE_SYNC_MEDIA_STATE);
  }

  public async sendDTMF(tone: number | string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let rtcSession: RTCSession | undefined;

      try {
        rtcSession = this.getEstablishedRTCSessionProtected();
      } catch (error) {
        reject(error as Error);
      }

      if (!rtcSession) {
        return;
      }

      this.callManager.once('newDTMF', ({ originator }) => {
        if (originator === 'local') {
          resolve();
        }
      });

      rtcSession.sendDTMF(tone, {
        duration: 120,
        interToneGap: 600,
      });
    });
  }

  public async sendChannels({ inputChannels, outputChannels }: TChannels): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    const headerInputChannels = `${EHeader.INPUT_CHANNELS}: ${inputChannels}`;
    const headerOutputChannels = `${EHeader.OUTPUT_CHANNELS}: ${outputChannels}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [
      headerInputChannels,
      headerOutputChannels,
    ];

    return rtcSession.sendInfo(EContentTypeSent.CHANNELS, undefined, { extraHeaders });
  }

  public async sendMediaState(
    { cam, mic }: TMediaState,
    options: TOptionsInfoMediaState = {},
  ): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    const headerMediaState = `${EHeader.MEDIA_STATE}: currentstate`;
    const headerCam = `${EHeader.MAIN_CAM_STATE}: ${Number(cam)}`;
    const headerMic = `${EHeader.MIC_STATE}: ${Number(mic)}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [
      headerMediaState,
      headerCam,
      headerMic,
    ];

    return rtcSession.sendInfo(EContentTypeSent.MEDIA_STATE, undefined, {
      noTerminateWhenError: true,
      ...options,
      extraHeaders,
    });
  }

  public async sendStats({
    availableIncomingBitrate,
  }: {
    availableIncomingBitrate: number;
  }): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    const headerAvailableIncomingBitrate = `${EHeader.AVAILABLE_INCOMING_BITRATE}: ${availableIncomingBitrate}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [headerAvailableIncomingBitrate];

    return rtcSession.sendInfo(EContentTypeSent.STATS, undefined, {
      noTerminateWhenError: true,
      extraHeaders,
    });
  }

  public async sendRefusalToTurnOn(
    type: 'cam' | 'mic',
    options: TOptionsInfoMediaState = {},
  ): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    const typeMicOnServer = 0;
    const typeCamOnServer = 1;
    const typeToSend = type === 'mic' ? typeMicOnServer : typeCamOnServer;

    const headerMediaType = `${EHeader.MEDIA_TYPE}: ${typeToSend}`;
    const extraHeaders: TOptionsExtraHeaders['extraHeaders'] = [headerMediaType];

    return rtcSession.sendInfo(EContentTypeSent.REFUSAL, undefined, {
      noTerminateWhenError: true,
      ...options,
      extraHeaders,
    });
  }

  public async sendRefusalToTurnOnMic(options: TOptionsInfoMediaState = {}): Promise<void> {
    return this.sendRefusalToTurnOn('mic', { noTerminateWhenError: true, ...options });
  }

  public async sendRefusalToTurnOnCam(options: TOptionsInfoMediaState = {}): Promise<void> {
    return this.sendRefusalToTurnOn('cam', { noTerminateWhenError: true, ...options });
  }

  public async sendMustStopPresentationP2P(): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.MUST_STOP_PRESENTATION_P2P],
    });
  }

  public async sendStoppedPresentationP2P(): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.STOP_PRESENTATION_P2P],
    });
  }

  public async sendStoppedPresentation(): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.STOP_PRESENTATION],
    });
  }

  public async askPermissionToStartPresentationP2P(): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.START_PRESENTATION_P2P],
    });
  }

  public async askPermissionToStartPresentation(): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.START_PRESENTATION],
    });
  }

  public async askPermissionToEnableCam(options: TOptionsInfoMediaState = {}): Promise<void> {
    const rtcSession = this.getEstablishedRTCSessionProtected();

    const extraHeaders = [EHeader.ENABLE_MAIN_CAM];

    return rtcSession
      .sendInfo(EContentTypeSent.MAIN_CAM, undefined, {
        noTerminateWhenError: true,
        ...options,
        extraHeaders,
      })
      .catch((error: unknown) => {
        if (hasDeclineResponseFromServer(error as Error)) {
          throw error;
        }
      });
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.once(eventName, handler);
  }

  public onceRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TEventMap>(eventName: T): Promise<TEventMap[T]> {
    return this.events.wait(eventName);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.events.off(eventName, handler);
  }

  private readonly getEstablishedRTCSessionProtected = () => {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    return rtcSession;
  };

  private subscribe(): void {
    this.connectionManager.on('sipEvent', this.handleSipEvent);
    this.callManager.on('newInfo', this.handleNewInfo);
    this.callManager.on('newDTMF', (event) => {
      this.events.trigger(EEvent.NEW_DTMF, event);
    });
  }

  private readonly handleSipEvent = ({ request }: { request: IncomingRequest }) => {
    this.maybeHandleNotify(request);
  };

  private readonly maybeHandleNotify = (request: IncomingRequest) => {
    try {
      const headerNotify = request.getHeader(EHeader.NOTIFY);

      if (headerNotify) {
        const headerNotifyParsed = JSON.parse(headerNotify) as TInfoNotify;

        this.handleNotify(headerNotifyParsed);
      }
    } catch (error) {
      logger('error parse notify', error);
    }
  };

  private readonly handleNotify = (header: TInfoNotify) => {
    switch (header.cmd) {
      case ECMDNotify.CHANNELS: {
        const channelsInfo = header as TChannelsInfoNotify;

        this.triggerChannelsNotify(channelsInfo);

        break;
      }
      case ECMDNotify.WEBCAST_STARTED: {
        const webcastInfo = header as TWebcastInfoNotify;

        this.triggerWebcastStartedNotify(webcastInfo);

        break;
      }
      case ECMDNotify.WEBCAST_STOPPED: {
        const webcastInfo = header as TWebcastStoppedInfoNotify;

        this.triggerWebcastStoppedNotify(webcastInfo);

        break;
      }
      case ECMDNotify.ADDED_TO_LIST_MODERATORS: {
        const data = header as TAddedToListModeratorsInfoNotify;

        this.triggerAddedToListModeratorsNotify(data);

        break;
      }
      case ECMDNotify.REMOVED_FROM_LIST_MODERATORS: {
        const data = header as TRemovedFromListModeratorsInfoNotify;

        this.triggerRemovedFromListModeratorsNotify(data);

        break;
      }
      case ECMDNotify.ACCEPTING_WORD_REQUEST: {
        const data = header as TAcceptingWordRequestInfoNotify;

        this.triggerParticipationAcceptingWordRequest(data);

        break;
      }
      case ECMDNotify.CANCELLING_WORD_REQUEST: {
        const data = header as TCancellingWordRequestInfoNotify;

        this.triggerParticipationCancellingWordRequest(data);

        break;
      }
      case ECMDNotify.MOVE_REQUEST_TO_STREAM: {
        const data = header as TMoveRequestToStreamInfoNotify;

        this.triggerParticipantMoveRequestToStream(data);

        break;
      }
      case ECMDNotify.ACCOUNT_CHANGED: {
        this.triggerAccountChangedNotify();

        break;
      }
      case ECMDNotify.ACCOUNT_DELETED: {
        this.triggerAccountDeletedNotify();

        break;
      }
      case ECMDNotify.CONFERENCE_PARTICIPANT_TOKEN_ISSUED: {
        const data = header as TConferenceParticipantTokenIssued;

        this.triggerConferenceParticipantTokenIssued(data);

        break;
      }
      default: {
        logger('unknown cmd', header);
      }
      // No default
    }
  };

  private readonly handleNewInfo = (info: IncomingInfoEvent | OutgoingInfoEvent) => {
    const { originator } = info;

    if (originator !== 'remote') {
      return;
    }

    const { request } = info;

    const typedRequest = request as IncomingRequest;
    const contentType = typedRequest.getHeader(EHeader.CONTENT_TYPE) as
      | EContentTypeReceived
      | undefined;

    if (contentType !== undefined) {
      switch (contentType) {
        case EContentTypeReceived.ENTER_ROOM: {
          this.triggerEnterRoom(typedRequest);
          this.maybeTriggerChannels(typedRequest);
          break;
        }
        case EContentTypeReceived.NOTIFY: {
          this.maybeHandleNotify(typedRequest);
          break;
        }
        case EContentTypeReceived.SHARE_STATE: {
          this.triggerShareState(typedRequest);
          break;
        }
        case EContentTypeReceived.MAIN_CAM: {
          this.triggerMainCamControl(typedRequest);
          break;
        }
        case EContentTypeReceived.MIC: {
          this.triggerMicControl(typedRequest);
          break;
        }
        case EContentTypeReceived.USE_LICENSE: {
          this.triggerUseLicense(typedRequest);
          break;
        }
        case EContentTypeReceived.PARTICIPANT_STATE: {
          this.maybeTriggerParticipantMoveRequest(typedRequest);
          break;
        }

        default: {
          break;
        }
      }
    }
  };

  private readonly triggerChannelsNotify = (channelsInfo: TChannelsInfoNotify) => {
    const inputChannels = channelsInfo.input;
    const outputChannels = channelsInfo.output;

    const data: TChannels = {
      inputChannels,
      outputChannels,
    };

    this.events.trigger(EEvent.CHANNELS_NOTIFY, data);
  };

  private readonly triggerWebcastStartedNotify = ({
    body: { conference, type },
  }: TWebcastInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this.events.trigger(EEvent.WEBCAST_STARTED, headersParametersWebcast);
  };

  private readonly triggerWebcastStoppedNotify = ({
    body: { conference, type },
  }: TWebcastStoppedInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this.events.trigger(EEvent.WEBCAST_STOPPED, headersParametersWebcast);
  };

  private readonly triggerAddedToListModeratorsNotify = ({
    conference,
  }: TAddedToListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this.events.trigger(
      EEvent.PARTICIPANT_ADDED_TO_LIST_MODERATORS,
      headersParametersModeratorsList,
    );
  };

  private readonly triggerRemovedFromListModeratorsNotify = ({
    conference,
  }: TRemovedFromListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this.events.trigger(
      EEvent.PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
      headersParametersModeratorsList,
    );
  };

  private readonly triggerParticipationAcceptingWordRequest = ({
    body: { conference },
  }: TAcceptingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.events.trigger(EEvent.PARTICIPATION_ACCEPTING_WORD_REQUEST, data);
  };

  private readonly triggerParticipationCancellingWordRequest = ({
    body: { conference },
  }: TCancellingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.events.trigger(EEvent.PARTICIPATION_CANCELLING_WORD_REQUEST, data);
  };

  private readonly triggerParticipantMoveRequestToStream = ({
    body: { conference },
  }: TMoveRequestToStreamInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_STREAM, data);
  };

  private readonly triggerAccountChangedNotify = () => {
    this.events.trigger(EEvent.ACCOUNT_CHANGED, {});
  };

  private readonly triggerAccountDeletedNotify = () => {
    this.events.trigger(EEvent.ACCOUNT_DELETED, {});
  };

  private readonly triggerConferenceParticipantTokenIssued = ({
    body: { conference, participant, jwt },
  }: TConferenceParticipantTokenIssued) => {
    const headersConferenceParticipantTokenIssued: TParametersConferenceParticipantTokenIssued = {
      conference,
      participant,
      jwt,
    };

    this.events.trigger(
      EEvent.CONFERENCE_PARTICIPANT_TOKEN_ISSUED,
      headersConferenceParticipantTokenIssued,
    );
  };

  private readonly maybeTriggerChannels = (request: IncomingRequest) => {
    const inputChannels = request.getHeader(EHeader.INPUT_CHANNELS);
    const outputChannels = request.getHeader(EHeader.OUTPUT_CHANNELS);

    if (inputChannels && outputChannels) {
      const headersChannels: TChannels = {
        inputChannels,
        outputChannels,
      };

      this.events.trigger(EEvent.CHANNELS_ALL, headersChannels);
    }
  };

  private readonly triggerEnterRoom = (request: IncomingRequest) => {
    const room = request.getHeader(EHeader.CONTENT_ENTER_ROOM);
    const participantName = request.getHeader(EHeader.PARTICIPANT_NAME);

    this.events.trigger(EEvent.ENTER_ROOM, { room, participantName });
  };

  private readonly triggerShareState = (request: IncomingRequest) => {
    const eventName = request.getHeader(EHeader.CONTENT_SHARE_STATE) as EShareState | undefined;

    if (eventName === undefined) {
      return;
    }

    switch (eventName) {
      case EShareState.AVAILABLE_SECOND_REMOTE_STREAM: {
        this.events.trigger(EEvent.CONTENTED_STREAM_AVAILABLE, {});
        break;
      }
      case EShareState.NOT_AVAILABLE_SECOND_REMOTE_STREAM: {
        this.events.trigger(EEvent.CONTENTED_STREAM_NOT_AVAILABLE, {});
        break;
      }
      case EShareState.MUST_STOP_PRESENTATION: {
        this.events.trigger(EEvent.PRESENTATION_MUST_STOP, {});
        break;
      }

      default: {
        break;
      }
    }
  };

  private readonly maybeTriggerParticipantMoveRequest = (request: IncomingRequest) => {
    const participantState = request.getHeader(EHeader.CONTENT_PARTICIPANT_STATE) as
      | EParticipantType
      | undefined;
    const audioId = request.getHeader(EHeader.AUDIO_ID);

    if (participantState === EParticipantType.SPECTATOR) {
      if (audioId) {
        this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS_WITH_AUDIO_ID, {
          audioId,
        });
        this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS, {
          isSynthetic: false,
          audioId,
        });
      } else {
        this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS_SYNTHETIC, {});
        this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS, { isSynthetic: true });
      }
    }

    if (participantState === EParticipantType.PARTICIPANT) {
      this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS, {});
    }
  };

  private readonly triggerMainCamControl = (request: IncomingRequest) => {
    const mainCam = request.getHeader(EHeader.MAIN_CAM) as EEventsMainCAM | undefined;
    const syncState = request.getHeader(EHeader.MEDIA_SYNC) as EEventsSyncMediaState | undefined;
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED;

    if (mainCam === EEventsMainCAM.ADMIN_START_MAIN_CAM) {
      this.events.trigger(EEvent.ADMIN_START_MAIN_CAM, { isSyncForced });

      return;
    }

    if (mainCam === EEventsMainCAM.ADMIN_STOP_MAIN_CAM) {
      this.events.trigger(EEvent.ADMIN_STOP_MAIN_CAM, { isSyncForced });

      return;
    }

    if (
      (mainCam === EEventsMainCAM.RESUME_MAIN_CAM || mainCam === EEventsMainCAM.PAUSE_MAIN_CAM) &&
      syncState !== undefined
    ) {
      this.events.trigger(EEvent.ADMIN_FORCE_SYNC_MEDIA_STATE, { isSyncForced });
    }

    const resolutionMainCam = request.getHeader(EHeader.MAIN_CAM_RESOLUTION);

    this.events.trigger(EEvent.MAIN_CAM_CONTROL, {
      mainCam,
      resolutionMainCam,
    });
  };

  private readonly triggerMicControl = (request: IncomingRequest) => {
    const mic = request.getHeader(EHeader.MIC) as EEventsMic | undefined;
    const syncState = request.getHeader(EHeader.MEDIA_SYNC) as EEventsSyncMediaState | undefined;
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED;

    if (mic === EEventsMic.ADMIN_START_MIC) {
      this.events.trigger(EEvent.ADMIN_START_MIC, { isSyncForced });
    } else if (mic === EEventsMic.ADMIN_STOP_MIC) {
      this.events.trigger(EEvent.ADMIN_STOP_MIC, { isSyncForced });
    }
  };

  private readonly triggerUseLicense = (request: IncomingRequest) => {
    const license: EUseLicense = request.getHeader(EHeader.CONTENT_USE_LICENSE) as EUseLicense;

    this.events.trigger(EEvent.USE_LICENSE, license);
  };
}

export default ApiManager;
