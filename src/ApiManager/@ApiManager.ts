import type { IncomingInfoEvent, IncomingRequest, OutgoingInfoEvent } from '@krivega/jssip';
import Events from 'events-constructor';
import type { CallManager } from '../CallManager';
import { Originator } from '../CallManager';
import type { ConnectionManager } from '../ConnectionManager';
import logger from '../logger';
import { hasDeclineResponseFromServer } from '../utils/errors';
import type { EUseLicense } from './constants';
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
import type { TEvent, TEvents } from './eventNames';
import { EEvent, EVENT_NAMES } from './eventNames';
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
import { ECMDNotify } from './types';

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
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);

    this.subscribe();
  }

  public async waitChannels(): Promise<TChannels> {
    return this.wait(EEvent.CHANNELS);
  }

  public async waitSyncMediaState(): Promise<{ isSyncForced: boolean }> {
    return this.wait(EEvent.ADMIN_FORCE_SYNC_MEDIA_STATE);
  }

  public async sendDTMF(tone: number | string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const rtcSession = this.callManager.getEstablishedRTCSession();

      if (!rtcSession) {
        reject(new Error('No rtcSession established'));

        return;
      }

      this.callManager.once('newDTMF', ({ originator }: { originator: Originator }) => {
        if (originator === Originator.LOCAL) {
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
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

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
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

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

  public async sendRefusalToTurnOn(
    type: 'cam' | 'mic',
    options: TOptionsInfoMediaState = {},
  ): Promise<void> {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

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
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    return this.sendRefusalToTurnOn('mic', { noTerminateWhenError: true, ...options });
  }

  public async sendRefusalToTurnOnCam(options: TOptionsInfoMediaState = {}): Promise<void> {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    return this.sendRefusalToTurnOn('cam', { noTerminateWhenError: true, ...options });
  }

  public async sendMustStopPresentationP2P(): Promise<void> {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.MUST_STOP_PRESENTATION_P2P],
    });
  }

  public async sendStoppedPresentationP2P(): Promise<void> {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.STOP_PRESENTATION_P2P],
    });
  }

  public async sendStoppedPresentation(): Promise<void> {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.STOP_PRESENTATION],
    });
  }

  public async askPermissionToStartPresentationP2P(): Promise<void> {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.START_PRESENTATION_P2P],
    });
  }

  public async askPermissionToStartPresentation(): Promise<void> {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

    await rtcSession.sendInfo(EContentTypeSent.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.START_PRESENTATION],
    });
  }

  public async askPermissionToEnableCam(options: TOptionsInfoMediaState = {}): Promise<void> {
    const rtcSession = this.callManager.getEstablishedRTCSession();

    if (!rtcSession) {
      throw new Error('No rtcSession established');
    }

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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public on<T>(eventName: TEvent, handler: (data: T) => void) {
    return this.events.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public once<T>(eventName: TEvent, handler: (data: T) => void) {
    return this.events.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRace<T>(eventNames: TEvent[], handler: (data: T, eventName: string) => void) {
    return this.events.onceRace<T>(eventNames, handler);
  }

  public async wait<T>(eventName: TEvent): Promise<T> {
    return this.events.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public off<T>(eventName: TEvent, handler: (data: T) => void) {
    this.events.off<T>(eventName, handler);
  }

  private subscribe(): void {
    this.connectionManager.on('sipEvent', this.handleSipEvent);
    this.callManager.on('newInfo', this.handleNewInfo);
    this.callManager.on('newDTMF', (event) => {
      this.events.trigger('newDTMF', event);
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (originator !== Originator.REMOTE) {
      return;
    }

    const { request } = info;
    const contentType = request.getHeader(EHeader.CONTENT_TYPE_NAME) as
      | EContentTypeReceived
      | undefined;

    if (contentType !== undefined) {
      switch (contentType) {
        case EContentTypeReceived.ENTER_ROOM: {
          this.triggerEnterRoom(request);
          this.maybeTriggerChannels(request);
          break;
        }
        case EContentTypeReceived.NOTIFY: {
          this.maybeHandleNotify(request);
          break;
        }
        case EContentTypeReceived.SHARE_STATE: {
          this.triggerShareState(request);
          break;
        }
        case EContentTypeReceived.MAIN_CAM: {
          this.triggerMainCamControl(request);
          break;
        }
        case EContentTypeReceived.MIC: {
          this.triggerMicControl(request);
          break;
        }
        case EContentTypeReceived.USE_LICENSE: {
          this.triggerUseLicense(request);
          break;
        }
        case EContentTypeReceived.PARTICIPANT_STATE: {
          this.maybeTriggerParticipantMoveRequest(request);
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
    this.events.trigger(EEvent.ACCOUNT_CHANGED, undefined);
  };

  private readonly triggerAccountDeletedNotify = () => {
    this.events.trigger(EEvent.ACCOUNT_DELETED, undefined);
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

      this.events.trigger(EEvent.CHANNELS, headersChannels);
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
        this.events.trigger(EEvent.AVAILABLE_SECOND_REMOTE_STREAM, undefined);
        break;
      }
      case EShareState.NOT_AVAILABLE_SECOND_REMOTE_STREAM: {
        this.events.trigger(EEvent.NOT_AVAILABLE_SECOND_REMOTE_STREAM, undefined);
        break;
      }
      case EShareState.MUST_STOP_PRESENTATION: {
        this.events.trigger(EEvent.MUST_STOP_PRESENTATION, undefined);
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

    if (participantState === EParticipantType.SPECTATOR) {
      this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS, undefined);
    }

    if (participantState === EParticipantType.PARTICIPANT) {
      this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS, undefined);
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
