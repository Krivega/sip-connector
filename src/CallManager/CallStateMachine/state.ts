import hasPeerToPeer from '@/tools/hasPeerToPeer';
import hasPurgatory from '@/tools/hasPurgatory';
import {
  hasValidExtraHeaders,
  isValidBoolean,
  isValidString,
  isValidNumber,
} from '@/utils/validators';
import { EState } from './constants';

import type { TContext, TContextMap, TAnyRoomState } from './types';

const hasConnectingContext = (context: TContext): context is TContextMap[EState.CONNECTING] => {
  return 'number' in context && isValidString(context.number) && isValidBoolean(context.answer);
};

const hasRoomContext = (
  context: TContext,
): context is TContext & Pick<TAnyRoomState, 'room' | 'participantName' | 'startedTimestamp'> => {
  return (
    'room' in context &&
    isValidString(context.room) &&
    isValidString(context.participantName) &&
    isValidNumber(context.startedTimestamp)
  );
};

const hasTokenContext = (context: TContext): context is TContext & { token: string } => {
  return 'token' in context && isValidString(context.token);
};

const hasConferenceTokenContext = (
  context: TContext,
): context is TContext & { token: string; conferenceForToken: string } => {
  return (
    hasTokenContext(context) &&
    'conferenceForToken' in context &&
    isValidString(context.conferenceForToken)
  );
};

const hasAnyRoomContext = (context: TContext): context is TAnyRoomState => {
  return hasConnectingContext(context) && hasRoomContext(context);
};

const hasMatchingConferenceTokenContext = (context: TContext) => {
  if (!hasConferenceTokenContext(context) || !hasRoomContext(context)) {
    return false;
  }

  return context.conferenceForToken === context.room;
};

export const hasDirectPeerToPeer = ({
  isDirectPeerToPeer,
}: {
  isDirectPeerToPeer?: boolean;
}): boolean => {
  return isDirectPeerToPeer === true;
};

const hasDirectPeerToPeerContext = (context: TContext): boolean => {
  return 'isDirectPeerToPeer' in context && hasDirectPeerToPeer(context);
};

const PRESENTATION_CALL_HEADER = 'x-vinteo-presentation-call: yes';

const hasPresentationCall = (extraHeaders?: string[]): boolean => {
  return (
    hasValidExtraHeaders(extraHeaders) &&
    extraHeaders.some((header) => {
      return header.trim().toLowerCase() === PRESENTATION_CALL_HEADER;
    })
  );
};

const hasPresentationCallContext = (
  context: TContext,
): context is TContextMap[EState.PRESENTATION_CALL] => {
  return (
    'extraHeaders' in context &&
    hasPresentationCall(context.extraHeaders) &&
    'isConfirmed' in context &&
    context.isConfirmed === true
  );
};

const hasInRoomContext = (raw: TContext): boolean => {
  return (
    hasAnyRoomContext(raw) &&
    !hasPurgatory(raw.room) &&
    hasConferenceTokenContext(raw) &&
    hasMatchingConferenceTokenContext(raw)
  );
};

const buildAnyRoomStateContext = (raw: TContext): TAnyRoomState => {
  const roomContext = raw as TAnyRoomState; // buildContext is called for states guarded by hasAnyRoomContext

  return {
    number: roomContext.number,
    answer: roomContext.answer,
    room: roomContext.room,
    participantName: roomContext.participantName,
    startedTimestamp: roomContext.startedTimestamp,
  };
};

export const STATE_DESCRIPTORS = {
  [EState.IDLE]: {
    guard: () => {
      return true;
    },
    buildContext: () => {
      return {};
    },
  },
  [EState.CONNECTING]: {
    guard: hasConnectingContext,
    buildContext: (raw: TContext) => {
      const { number, answer, extraHeaders } = raw as TContextMap[EState.CONNECTING];

      return { number, answer, extraHeaders };
    },
  },
  [EState.PRESENTATION_CALL]: {
    guard: hasPresentationCallContext,
    buildContext: (raw: TContext) => {
      const { number, answer, startedTimestamp } = raw as TContextMap[EState.PRESENTATION_CALL];

      return { number, answer, startedTimestamp };
    },
  },
  [EState.ROOM_PENDING_AUTH]: {
    guard: (raw: TContext) => {
      return (
        hasAnyRoomContext(raw) &&
        !hasPurgatory(raw.room) &&
        !hasPeerToPeer(raw.room) &&
        !hasDirectPeerToPeerContext(raw) &&
        !hasMatchingConferenceTokenContext(raw)
      );
    },
    buildContext: buildAnyRoomStateContext,
  },
  /** Токен из TOKEN_ISSUED может уже лежать в context — это не переводит в IN_ROOM. */
  [EState.PURGATORY]: {
    guard: (raw: TContext) => {
      return hasAnyRoomContext(raw) && hasPurgatory(raw.room) && !hasInRoomContext(raw);
    },
    buildContext: buildAnyRoomStateContext,
  },
  [EState.P2P_ROOM]: {
    guard: (raw: TContext) => {
      return (
        hasAnyRoomContext(raw) &&
        hasPeerToPeer(raw.room) &&
        !hasDirectPeerToPeerContext(raw) &&
        !hasInRoomContext(raw)
      );
    },
    buildContext: buildAnyRoomStateContext,
  },
  [EState.DIRECT_P2P_ROOM]: {
    guard: (raw: TContext) => {
      return hasAnyRoomContext(raw) && hasDirectPeerToPeerContext(raw) && !hasInRoomContext(raw);
    },
    buildContext: (raw: TContext) => {
      return { ...buildAnyRoomStateContext(raw), isDirectPeerToPeer: true };
    },
  },
  /** IN_ROOM только если `conferenceForToken === room` (в т.ч. после enter-room с bearer, где conference задаётся как room). */
  [EState.IN_ROOM]: {
    guard: hasInRoomContext,
    buildContext: (raw: TContext) => {
      const { token, conferenceForToken } = raw as TContextMap[EState.IN_ROOM];

      return { ...buildAnyRoomStateContext(raw), token, conferenceForToken };
    },
  },
  [EState.DISCONNECTING]: {
    guard: (raw: TContext) => {
      return (raw as TContextMap[EState.IDLE]).pendingDisconnect === true;
    },
    buildContext: () => {
      return {};
    },
  },
};
