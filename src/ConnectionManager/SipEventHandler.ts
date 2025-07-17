import type { IncomingRequest } from '@krivega/jssip';
import type Events from 'events-constructor';
import {
  ACCOUNT_CHANGED,
  ACCOUNT_DELETED,
  CHANNELS_NOTIFY,
  CONFERENCE_PARTICIPANT_TOKEN_ISSUED,
  PARTICIPANT_ADDED_TO_LIST_MODERATORS,
  PARTICIPANT_MOVE_REQUEST_TO_STREAM,
  PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
  PARTICIPATION_ACCEPTING_WORD_REQUEST,
  PARTICIPATION_CANCELLING_WORD_REQUEST,
  SIP_EVENT,
  WEBCAST_STARTED,
  WEBCAST_STOPPED,
} from '../constants';
import type { UA_EVENT_NAMES } from '../eventNames';
import { HEADER_NOTIFY } from '../headers';
import logger from '../logger';

const CMD_CHANNELS = 'channels';
const CMD_WEBCAST_STARTED = 'WebcastStarted';
const CMD_WEBCAST_STOPPED = 'WebcastStopped';
const CMD_ACCOUNT_CHANGED = 'accountChanged';
const CMD_ACCOUNT_DELETED = 'accountDeleted';
const CMD_ADDED_TO_LIST_MODERATORS = 'addedToListModerators';
const CMD_REMOVED_FROM_LIST_MODERATORS = 'removedFromListModerators';
const CMD_ACCEPTING_WORD_REQUEST = 'ParticipationRequestAccepted';
const CMD_CANCELLING_WORD_REQUEST = 'ParticipationRequestRejected';
const CMD_MOVE_REQUEST_TO_STREAM = 'ParticipantMovedToWebcast';
const CMD_CONFERENCE_PARTICIPANT_TOKEN_ISSUED = 'ConferenceParticipantTokenIssued';

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
  cmd: typeof CMD_ADDED_TO_LIST_MODERATORS;
  conference: string;
};

type TRemovedFromListModeratorsInfoNotify = {
  cmd: typeof CMD_REMOVED_FROM_LIST_MODERATORS;
  conference: string;
};

type TAcceptingWordRequestInfoNotify = {
  cmd: typeof CMD_ACCEPTING_WORD_REQUEST;
  body: { conference: string };
};

type TCancellingWordRequestInfoNotify = {
  cmd: typeof CMD_CANCELLING_WORD_REQUEST;
  body: { conference: string };
};

type TMoveRequestToStreamInfoNotify = {
  cmd: typeof CMD_MOVE_REQUEST_TO_STREAM;
  body: { conference: string };
};

type TConferenceParticipantTokenIssued = {
  cmd: typeof CMD_CONFERENCE_PARTICIPANT_TOKEN_ISSUED;
  body: { conference: string; participant: string; jwt: string };
};

type TWebcastInfoNotify = {
  cmd: typeof CMD_WEBCAST_STARTED;
  body: { conference: string; type: string };
};

type TChannelsInfoNotify = {
  cmd: typeof CMD_CHANNELS;
  input: string;
  output: string;
};

type TInfoNotify = Omit<
  TAddedToListModeratorsInfoNotify | TChannelsInfoNotify | TRemovedFromListModeratorsInfoNotify,
  'cmd'
> & { cmd: string };

export default class SipEventHandler {
  private readonly uaEvents: Events<typeof UA_EVENT_NAMES>;

  public constructor(uaEvents: Events<typeof UA_EVENT_NAMES>) {
    this.uaEvents = uaEvents;
  }

  public start(): void {
    this.subscribe();
  }

  public stop(): void {
    this.unsubscribe();
  }

  private subscribe(): void {
    this.uaEvents.on(SIP_EVENT, this.handleSipEvent);
  }

  private unsubscribe(): void {
    this.uaEvents.off(SIP_EVENT, this.handleSipEvent);
  }

  private readonly handleSipEvent = ({ request }: { request: IncomingRequest }) => {
    this.maybeHandleNotify(request);
  };

  private readonly maybeHandleNotify = (request: IncomingRequest) => {
    const headerNotify = request.getHeader(HEADER_NOTIFY);

    if (headerNotify) {
      const headerNotifyParsed = JSON.parse(headerNotify) as TInfoNotify;

      this.handleNotify(headerNotifyParsed);
    }
  };

  private readonly handleNotify = (header: TInfoNotify) => {
    switch (header.cmd) {
      case CMD_CHANNELS: {
        const channelsInfo = header as TChannelsInfoNotify;

        this.triggerChannelsNotify(channelsInfo);

        break;
      }
      case CMD_WEBCAST_STARTED: {
        const webcastInfo = header as TWebcastInfoNotify;

        this.triggerWebcastStartedNotify(webcastInfo);

        break;
      }
      case CMD_WEBCAST_STOPPED: {
        const webcastInfo = header as TWebcastInfoNotify;

        this.triggerWebcastStoppedNotify(webcastInfo);

        break;
      }
      case CMD_ADDED_TO_LIST_MODERATORS: {
        const data = header as TAddedToListModeratorsInfoNotify;

        this.triggerAddedToListModeratorsNotify(data);

        break;
      }
      case CMD_REMOVED_FROM_LIST_MODERATORS: {
        const data = header as TRemovedFromListModeratorsInfoNotify;

        this.triggerRemovedFromListModeratorsNotify(data);

        break;
      }
      case CMD_ACCEPTING_WORD_REQUEST: {
        const data = header as TAcceptingWordRequestInfoNotify;

        this.triggerParticipationAcceptingWordRequest(data);

        break;
      }
      case CMD_CANCELLING_WORD_REQUEST: {
        const data = header as TCancellingWordRequestInfoNotify;

        this.triggerParticipationCancellingWordRequest(data);

        break;
      }
      case CMD_MOVE_REQUEST_TO_STREAM: {
        const data = header as TMoveRequestToStreamInfoNotify;

        this.triggerParticipantMoveRequestToStream(data);

        break;
      }
      case CMD_ACCOUNT_CHANGED: {
        this.triggerAccountChangedNotify();

        break;
      }
      case CMD_ACCOUNT_DELETED: {
        this.triggerAccountDeletedNotify();

        break;
      }
      case CMD_CONFERENCE_PARTICIPANT_TOKEN_ISSUED: {
        const data = header as TConferenceParticipantTokenIssued;

        this.triggerConferenceParticipantTokenIssued(data);

        break;
      }
      default: {
        logger('unknown cmd', header.cmd);
      }
      // No default
    }
  };

  private readonly triggerChannelsNotify = (channelsInfo: TChannelsInfoNotify) => {
    const inputChannels = channelsInfo.input;
    const outputChannels = channelsInfo.output;

    const data: TChannels = {
      inputChannels,
      outputChannels,
    };

    this.uaEvents.trigger(CHANNELS_NOTIFY, data);
  };

  private readonly triggerWebcastStartedNotify = ({
    body: { conference, type },
  }: TWebcastInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this.uaEvents.trigger(WEBCAST_STARTED, headersParametersWebcast);
  };

  private readonly triggerWebcastStoppedNotify = ({
    body: { conference, type },
  }: TWebcastInfoNotify) => {
    const headersParametersWebcast: TParametersWebcast = {
      conference,
      type,
    };

    this.uaEvents.trigger(WEBCAST_STOPPED, headersParametersWebcast);
  };

  private readonly triggerAddedToListModeratorsNotify = ({
    conference,
  }: TAddedToListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPANT_ADDED_TO_LIST_MODERATORS, headersParametersModeratorsList);
  };

  private readonly triggerRemovedFromListModeratorsNotify = ({
    conference,
  }: TRemovedFromListModeratorsInfoNotify) => {
    const headersParametersModeratorsList: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(
      PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
      headersParametersModeratorsList,
    );
  };

  private readonly triggerParticipationAcceptingWordRequest = ({
    body: { conference },
  }: TAcceptingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPATION_ACCEPTING_WORD_REQUEST, data);
  };

  private readonly triggerParticipationCancellingWordRequest = ({
    body: { conference },
  }: TCancellingWordRequestInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPATION_CANCELLING_WORD_REQUEST, data);
  };

  private readonly triggerParticipantMoveRequestToStream = ({
    body: { conference },
  }: TMoveRequestToStreamInfoNotify) => {
    const data: TParametersModeratorsList = {
      conference,
    };

    this.uaEvents.trigger(PARTICIPANT_MOVE_REQUEST_TO_STREAM, data);
  };

  private readonly triggerAccountChangedNotify = () => {
    this.uaEvents.trigger(ACCOUNT_CHANGED, undefined);
  };

  private readonly triggerAccountDeletedNotify = () => {
    this.uaEvents.trigger(ACCOUNT_DELETED, undefined);
  };

  private readonly triggerConferenceParticipantTokenIssued = ({
    body: { conference, participant, jwt },
  }: TConferenceParticipantTokenIssued) => {
    const headersConferenceParticipantTokenIssued: TParametersConferenceParticipantTokenIssued = {
      conference,
      participant,
      jwt,
    };

    this.uaEvents.trigger(
      CONFERENCE_PARTICIPANT_TOKEN_ISSUED,
      headersConferenceParticipantTokenIssued,
    );
  };
}
