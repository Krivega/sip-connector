import type { IncomingInfoEvent, IncomingRequest, OutgoingInfoEvent } from '@krivega/jssip';
import Events from 'events-constructor';
import type { TConnectionManagerEvents } from '../../ConnectionManager';
import { EConnectionManagerEvent } from '../../ConnectionManager';
import logger from '../../logger';
import { EEvent as ECallEvent, Originator } from '../eventNames';
import type { TEvents as TCallEvents } from '../types';
import type { TEvent } from './eventNames';
import { EEvent, EVENT_NAMES } from './eventNames';

export type TEvents = Events<typeof EVENT_NAMES>;

enum ECMDNotify {
  CHANNELS = 'channels',
  WEBCAST_STARTED = 'WebcastStarted',
  WEBCAST_STOPPED = 'WebcastStopped',
  ACCOUNT_CHANGED = 'accountChanged',
  ACCOUNT_DELETED = 'accountDeleted',
  ADDED_TO_LIST_MODERATORS = 'addedToListModerators',
  REMOVED_FROM_LIST_MODERATORS = 'removedFromListModerators',
  ACCEPTING_WORD_REQUEST = 'ParticipationRequestAccepted',
  CANCELLING_WORD_REQUEST = 'ParticipationRequestRejected',
  MOVE_REQUEST_TO_STREAM = 'ParticipantMovedToWebcast',
  CONFERENCE_PARTICIPANT_TOKEN_ISSUED = 'ConferenceParticipantTokenIssued',
}

type TChannels = {
  inputChannels: string;
  outputChannels: string;
};

type TParametersModeratorsList = {
  conference: string;
};

type TParametersWebcast = {
  conference: string;
  type: string;
};

type TParametersConferenceParticipantTokenIssued = {
  conference: string;
  participant: string;
  jwt: string;
};

type TAddedToListModeratorsInfoNotify = {
  cmd: `${ECMDNotify.ADDED_TO_LIST_MODERATORS}`;
  conference: string;
};

type TRemovedFromListModeratorsInfoNotify = {
  cmd: `${ECMDNotify.REMOVED_FROM_LIST_MODERATORS}`;
  conference: string;
};

type TAcceptingWordRequestInfoNotify = {
  cmd: `${ECMDNotify.ACCEPTING_WORD_REQUEST}`;
  body: { conference: string };
};

type TCancellingWordRequestInfoNotify = {
  cmd: `${ECMDNotify.CANCELLING_WORD_REQUEST}`;
  body: { conference: string };
};

type TMoveRequestToStreamInfoNotify = {
  cmd: `${ECMDNotify.MOVE_REQUEST_TO_STREAM}`;
  body: { conference: string };
};

type TConferenceParticipantTokenIssued = {
  cmd: `${ECMDNotify.CONFERENCE_PARTICIPANT_TOKEN_ISSUED}`;
  body: { conference: string; participant: string; jwt: string };
};

type TWebcastInfoNotify = {
  cmd: `${ECMDNotify.WEBCAST_STARTED}`;
  body: { conference: string; type: string };
};

type TWebcastStoppedInfoNotify = {
  cmd: `${ECMDNotify.WEBCAST_STOPPED}`;
  body: { conference: string; type: string };
};

type TChannelsInfoNotify = {
  cmd: `${ECMDNotify.CHANNELS}`;
  input: string;
  output: string;
};

type TAccountChangedInfoNotify = {
  cmd: `${ECMDNotify.ACCOUNT_CHANGED}`;
};

type TAccountDeletedInfoNotify = {
  cmd: `${ECMDNotify.ACCOUNT_DELETED}`;
};

type TInfoNotify =
  | TAddedToListModeratorsInfoNotify
  | TChannelsInfoNotify
  | TRemovedFromListModeratorsInfoNotify
  | TWebcastInfoNotify
  | TConferenceParticipantTokenIssued
  | TAcceptingWordRequestInfoNotify
  | TCancellingWordRequestInfoNotify
  | TMoveRequestToStreamInfoNotify
  | TAccountChangedInfoNotify
  | TAccountDeletedInfoNotify
  | TWebcastStoppedInfoNotify;

const HEADER_CONTENT_TYPE_NAME = 'content-type';
const HEADER_CONTENT_ENTER_ROOM = 'x-webrtc-enter-room';
const HEADER_CONTENT_USE_LICENSE = 'X-WEBRTC-USE-LICENSE';
const HEADER_PARTICIPANT_NAME = 'X-WEBRTC-PARTICIPANT-NAME';
const HEADER_INPUT_CHANNELS = 'X-WEBRTC-INPUT-CHANNELS';
const HEADER_OUTPUT_CHANNELS = 'X-WEBRTC-OUTPUT-CHANNELS';
const HEADER_MAIN_CAM = 'X-WEBRTC-MAINCAM';
const HEADER_MIC = 'X-WEBRTC-MIC';
const HEADER_MEDIA_SYNC = 'X-WEBRTC-SYNC';
const HEADER_MAIN_CAM_RESOLUTION = 'X-WEBRTC-MAINCAM-RESOLUTION';
const HEADER_NOTIFY = 'X-VINTEO-NOTIFY';
const HEADER_CONTENT_PARTICIPANT_STATE = 'X-WEBRTC-PARTSTATE';

const HEADER_CONTENT_SHARE_STATE = 'x-webrtc-share-state';

const AVAILABLE_SECOND_REMOTE_STREAM = 'YOUCANRECEIVECONTENT';
const NOT_AVAILABLE_SECOND_REMOTE_STREAM = 'CONTENTEND';
const MUST_STOP_PRESENTATION = 'YOUMUSTSTOPSENDCONTENT';

const SPECTATOR = 'SPECTATOR';
const PARTICIPANT = 'PARTICIPANT';

enum EContentType {
  ENTER_ROOM = 'application/vinteo.webrtc.roomname',
  SHARE_STATE = 'application/vinteo.webrtc.sharedesktop',
  CHANNELS = 'application/vinteo.webrtc.channels',
  MEDIA_STATE = 'application/vinteo.webrtc.mediastate',
  REFUSAL = 'application/vinteo.webrtc.refusal',
  MAIN_CAM = 'application/vinteo.webrtc.maincam',
  MIC = 'application/vinteo.webrtc.mic',
  USE_LICENSE = 'application/vinteo.webrtc.uselic',
  PARTICIPANT_STATE = 'application/vinteo.webrtc.partstate',
  NOTIFY = 'application/vinteo.webrtc.notify',
}

enum EEventsMainCAM {
  PAUSE_MAIN_CAM = 'PAUSEMAINCAM',
  RESUME_MAIN_CAM = 'RESUMEMAINCAM',
  MAX_MAIN_CAM_RESOLUTION = 'MAXMAINCAMRESOLUTION',
  ADMIN_STOP_MAIN_CAM = 'ADMINSTOPMAINCAM',
  ADMIN_START_MAIN_CAM = 'ADMINSTARTMAINCAM',
}

enum EEventsMic {
  ADMIN_STOP_MIC = 'ADMINSTOPMIC',
  ADMIN_START_MIC = 'ADMINSTARTMIC',
}

enum EEventsSyncMediaState {
  ADMIN_SYNC_FORCED = '1',
  ADMIN_SYNC_NOT_FORCED = '0',
}

enum EUseLicense {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  AUDIOPLUSPRESENTATION = 'AUDIOPLUSPRESENTATION',
}

export class ApiManager {
  private readonly events: TEvents;

  private readonly connectionEvents: TConnectionManagerEvents;

  private readonly callEvents: TCallEvents;

  public constructor({
    connectionEvents,
    callEvents,
  }: {
    connectionEvents: TConnectionManagerEvents;
    callEvents: TCallEvents;
  }) {
    this.connectionEvents = connectionEvents;
    this.callEvents = callEvents;
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);

    this.subscribe();
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
    this.connectionEvents.on(EConnectionManagerEvent.SIP_EVENT, this.handleSipEvent);
    this.callEvents.on(ECallEvent.NEW_INFO, this.handleNewInfo);
  }

  private readonly handleSipEvent = ({ request }: { request: IncomingRequest }) => {
    this.maybeHandleNotify(request);
  };

  private readonly maybeHandleNotify = (request: IncomingRequest) => {
    try {
      const headerNotify = request.getHeader(HEADER_NOTIFY);

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
      case 'channels': {
        throw new Error('Not implemented yet: "channels" case');
      }
      case 'addedToListModerators': {
        throw new Error('Not implemented yet: "addedToListModerators" case');
      }
      case 'removedFromListModerators': {
        throw new Error('Not implemented yet: "removedFromListModerators" case');
      }
      case 'WebcastStarted': {
        throw new Error('Not implemented yet: "WebcastStarted" case');
      }
      case 'ConferenceParticipantTokenIssued': {
        throw new Error('Not implemented yet: "ConferenceParticipantTokenIssued" case');
      }
      case 'ParticipationRequestAccepted': {
        throw new Error('Not implemented yet: "ParticipationRequestAccepted" case');
      }
      case 'ParticipationRequestRejected': {
        throw new Error('Not implemented yet: "ParticipationRequestRejected" case');
      }
      case 'ParticipantMovedToWebcast': {
        throw new Error('Not implemented yet: "ParticipantMovedToWebcast" case');
      }
      case 'accountChanged': {
        throw new Error('Not implemented yet: "accountChanged" case');
      }
      case 'accountDeleted': {
        throw new Error('Not implemented yet: "accountDeleted" case');
      }
      case 'WebcastStopped': {
        throw new Error('Not implemented yet: "WebcastStopped" case');
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
    const contentType = request.getHeader(HEADER_CONTENT_TYPE_NAME) as EContentType | undefined;

    if (contentType !== undefined) {
      switch (contentType) {
        case EContentType.ENTER_ROOM: {
          this.triggerEnterRoom(request);
          this.maybeTriggerChannels(request);
          break;
        }
        case EContentType.NOTIFY: {
          this.maybeHandleNotify(request);
          break;
        }
        case EContentType.SHARE_STATE: {
          this.triggerShareState(request);
          break;
        }
        case EContentType.MAIN_CAM: {
          this.triggerMainCamControl(request);
          break;
        }
        case EContentType.MIC: {
          this.triggerMicControl(request);
          break;
        }
        case EContentType.USE_LICENSE: {
          this.triggerUseLicense(request);
          break;
        }
        case EContentType.PARTICIPANT_STATE: {
          this.maybeTriggerParticipantMoveRequest(request);
          break;
        }

        case EContentType.CHANNELS: {
          throw new Error('Not implemented yet: EContentType.CHANNELS case');
        }
        case EContentType.MEDIA_STATE: {
          throw new Error('Not implemented yet: EContentType.MEDIA_STATE case');
        }
        case EContentType.REFUSAL: {
          throw new Error('Not implemented yet: EContentType.REFUSAL case');
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
    const inputChannels = request.getHeader(HEADER_INPUT_CHANNELS);
    const outputChannels = request.getHeader(HEADER_OUTPUT_CHANNELS);

    if (inputChannels && outputChannels) {
      const headersChannels: TChannels = {
        inputChannels,
        outputChannels,
      };

      this.events.trigger(EEvent.CHANNELS, headersChannels);
    }
  };

  private readonly triggerEnterRoom = (request: IncomingRequest) => {
    const room = request.getHeader(HEADER_CONTENT_ENTER_ROOM);
    const participantName = request.getHeader(HEADER_PARTICIPANT_NAME);

    this.events.trigger(EEvent.ENTER_ROOM, { room, participantName });
  };

  private readonly triggerShareState = (request: IncomingRequest) => {
    const eventName = request.getHeader(HEADER_CONTENT_SHARE_STATE);

    switch (eventName) {
      case AVAILABLE_SECOND_REMOTE_STREAM: {
        this.events.trigger(EEvent.AVAILABLE_SECOND_REMOTE_STREAM, undefined);
        break;
      }
      case NOT_AVAILABLE_SECOND_REMOTE_STREAM: {
        this.events.trigger(EEvent.NOT_AVAILABLE_SECOND_REMOTE_STREAM, undefined);
        break;
      }
      case MUST_STOP_PRESENTATION: {
        this.events.trigger(EEvent.MUST_STOP_PRESENTATION, undefined);
        break;
      }

      default: {
        break;
      }
    }
  };

  private readonly maybeTriggerParticipantMoveRequest = (request: IncomingRequest) => {
    const participantState = request.getHeader(HEADER_CONTENT_PARTICIPANT_STATE);

    if (participantState === SPECTATOR) {
      this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS, undefined);
    }

    if (participantState === PARTICIPANT) {
      this.events.trigger(EEvent.PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS, undefined);
    }
  };

  private readonly triggerMainCamControl = (request: IncomingRequest) => {
    const mainCam = request.getHeader(HEADER_MAIN_CAM) as EEventsMainCAM | undefined;
    const syncState = request.getHeader(HEADER_MEDIA_SYNC) as EEventsSyncMediaState | undefined;
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

    const resolutionMainCam = request.getHeader(HEADER_MAIN_CAM_RESOLUTION);

    this.events.trigger(EEvent.MAIN_CAM_CONTROL, {
      mainCam,
      resolutionMainCam,
    });
  };

  private readonly triggerMicControl = (request: IncomingRequest) => {
    const mic = request.getHeader(HEADER_MIC) as EEventsMic | undefined;
    const syncState = request.getHeader(HEADER_MEDIA_SYNC) as EEventsSyncMediaState | undefined;
    const isSyncForced = syncState === EEventsSyncMediaState.ADMIN_SYNC_FORCED;

    if (mic === EEventsMic.ADMIN_START_MIC) {
      this.events.trigger(EEvent.ADMIN_START_MIC, { isSyncForced });
    } else if (mic === EEventsMic.ADMIN_STOP_MIC) {
      this.events.trigger(EEvent.ADMIN_STOP_MIC, { isSyncForced });
    }
  };

  private readonly triggerUseLicense = (request: IncomingRequest) => {
    const license: EUseLicense = request.getHeader(HEADER_CONTENT_USE_LICENSE) as EUseLicense;

    this.events.trigger(EEvent.USE_LICENSE, license);
  };
}
