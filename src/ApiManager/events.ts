/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type { EContentedStreamCodec, EContentUseLicense, EContentMainCAM } from './constants';
import type {
  TChannels,
  TParametersModeratorsList,
  TParametersWebcast,
  TParametersConferenceParticipantTokenIssued,
} from './types';

export enum EEvent {
  ENTER_ROOM = 'enter-room',
  MAIN_CAM_CONTROL = 'main-cam-control',
  USE_LICENSE = 'use-license',
  NEW_DTMF = 'new-dtmf',
  CONFERENCE_PARTICIPANT_TOKEN_ISSUED = 'conference:participant-token-issued',
  CONTENTED_STREAM_AVAILABLE = 'contented-stream:available',
  CONTENTED_STREAM_NOT_AVAILABLE = 'contented-stream:not-available',
  PRESENTATION_MUST_STOP = 'presentation:must-stop',
  CHANNELS_ALL = 'channels:all',
  CHANNELS_NOTIFY = 'channels:notify',
  PARTICIPANT_ADDED_TO_LIST_MODERATORS = 'participant:added-to-list-moderators',
  PARTICIPANT_REMOVED_FROM_LIST_MODERATORS = 'participant:removed-from-list-moderators',
  PARTICIPANT_MOVE_REQUEST_TO_STREAM = 'participant:move-request-to-stream',
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS = 'participant:move-request-to-spectators',
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS_SYNTHETIC = 'participant:move-request-to-spectators-synthetic',
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS_WITH_AUDIO_ID = 'participant:move-request-to-spectators-with-audio-id',
  PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS = 'participant:move-request-to-participants',
  PARTICIPATION_ACCEPTING_WORD_REQUEST = 'participation:accepting-word-request',
  PARTICIPATION_CANCELLING_WORD_REQUEST = 'participation:cancelling-word-request',
  WEBCAST_STARTED = 'webcast:started',
  WEBCAST_STOPPED = 'webcast:stopped',
  ACCOUNT_CHANGED = 'account:changed',
  ACCOUNT_DELETED = 'account:deleted',
  ADMIN_START_MAIN_CAM = 'admin:start-main-cam',
  ADMIN_STOP_MAIN_CAM = 'admin:stop-main-cam',
  ADMIN_START_MIC = 'admin:start-mic',
  ADMIN_STOP_MIC = 'admin:stop-mic',
  ADMIN_FORCE_SYNC_MEDIA_STATE = 'admin:force-sync-media-state',
  FAILED_SEND_ROOM_DIRECT_P2P = 'failed-send-room-direct-p2p',
}

export const EVENT_NAMES = [
  `${EEvent.ENTER_ROOM}`,
  `${EEvent.MAIN_CAM_CONTROL}`,
  `${EEvent.USE_LICENSE}`,
  `${EEvent.NEW_DTMF}`,
  `${EEvent.CONFERENCE_PARTICIPANT_TOKEN_ISSUED}`,
  `${EEvent.CONTENTED_STREAM_AVAILABLE}`,
  `${EEvent.CONTENTED_STREAM_NOT_AVAILABLE}`,
  `${EEvent.PRESENTATION_MUST_STOP}`,
  `${EEvent.CHANNELS_ALL}`,
  `${EEvent.CHANNELS_NOTIFY}`,
  `${EEvent.PARTICIPANT_ADDED_TO_LIST_MODERATORS}`,
  `${EEvent.PARTICIPANT_REMOVED_FROM_LIST_MODERATORS}`,
  `${EEvent.PARTICIPANT_MOVE_REQUEST_TO_STREAM}`,
  `${EEvent.PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS}`,
  `${EEvent.PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS_SYNTHETIC}`,
  `${EEvent.PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS_WITH_AUDIO_ID}`,
  `${EEvent.PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS}`,
  `${EEvent.PARTICIPATION_ACCEPTING_WORD_REQUEST}`,
  `${EEvent.PARTICIPATION_CANCELLING_WORD_REQUEST}`,
  `${EEvent.WEBCAST_STARTED}`,
  `${EEvent.WEBCAST_STOPPED}`,
  `${EEvent.ACCOUNT_CHANGED}`,
  `${EEvent.ACCOUNT_DELETED}`,
  `${EEvent.ADMIN_START_MAIN_CAM}`,
  `${EEvent.ADMIN_STOP_MAIN_CAM}`,
  `${EEvent.ADMIN_START_MIC}`,
  `${EEvent.ADMIN_STOP_MIC}`,
  `${EEvent.ADMIN_FORCE_SYNC_MEDIA_STATE}`,
  `${EEvent.FAILED_SEND_ROOM_DIRECT_P2P}`,
] as const;

export type TEventMap = {
  'enter-room': {
    room: string;
    participantName: string;
    bearerToken?: string;
    isDirectPeerToPeer?: boolean;
  };
  'main-cam-control': { mainCam?: EContentMainCAM; resolutionMainCam?: string };
  'use-license': EContentUseLicense;
  'new-dtmf': { originator: string };
  'conference:participant-token-issued': TParametersConferenceParticipantTokenIssued;
  'contented-stream:available': { codec?: EContentedStreamCodec };
  'contented-stream:not-available': Record<string, never>;
  'presentation:must-stop': Record<string, never>;
  'channels:all': TChannels;
  'channels:notify': TChannels;
  'participant:added-to-list-moderators': TParametersModeratorsList;
  'participant:removed-from-list-moderators': TParametersModeratorsList;
  'participant:move-request-to-stream': TParametersModeratorsList;
  'participant:move-request-to-participants': Record<string, never>;
  'participant:move-request-to-spectators':
    | {
        isSynthetic: true;
      }
    | {
        isSynthetic: false;
        audioId: string;
      };
  'participant:move-request-to-spectators-synthetic': Record<string, never>;
  'participant:move-request-to-spectators-with-audio-id': {
    audioId: string;
  };
  'participation:accepting-word-request': TParametersModeratorsList;
  'participation:cancelling-word-request': TParametersModeratorsList;
  'webcast:started': TParametersWebcast;
  'webcast:stopped': TParametersWebcast;
  'account:changed': Record<string, never>;
  'account:deleted': Record<string, never>;
  'admin:start-main-cam': { isSyncForced: boolean };
  'admin:stop-main-cam': { isSyncForced: boolean };
  'admin:start-mic': { isSyncForced: boolean };
  'admin:stop-mic': { isSyncForced: boolean };
  'admin:force-sync-media-state': { isSyncForced: boolean };
  'failed-send-room-direct-p2p': { error: unknown };
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
