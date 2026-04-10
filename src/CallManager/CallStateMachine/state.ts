import hasPeerToPeer from '@/tools/hasPeerToPeer';
import hasPurgatory from '@/tools/hasPurgatory';
import { hasValidExtraHeaders, isValidBoolean, isValidString } from '@/utils/validators';
import { EState } from './types';

import type { TBaseContext, TContextMap, TAnyRoomState } from './types';

const hasConnectingContext = (context: TBaseContext): context is TContextMap[EState.CONNECTING] => {
  return (
    'number' in context &&
    isValidString(context.number) &&
    isValidBoolean(context.answer) &&
    (!('extraHeaders' in context) ||
      context.extraHeaders === undefined ||
      hasValidExtraHeaders(context.extraHeaders))
  );
};

const hasRoomContext = (
  context: TBaseContext,
): context is TBaseContext & Pick<TAnyRoomState, 'room' | 'participantName'> => {
  return 'room' in context && isValidString(context.room) && isValidString(context.participantName);
};

const hasTokenContext = (context: TBaseContext): context is TBaseContext & { token: string } => {
  return 'token' in context && isValidString(context.token);
};

const hasConferenceTokenContext = (
  context: TBaseContext,
): context is TBaseContext & { token: string; conferenceForToken: string } => {
  return (
    hasTokenContext(context) &&
    'conferenceForToken' in context &&
    isValidString(context.conferenceForToken)
  );
};

const hasAnyRoomContext = (context: TBaseContext): context is TAnyRoomState => {
  return hasConnectingContext(context) && hasRoomContext(context);
};

const hasMatchingConferenceTokenContext = (context: TBaseContext) => {
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

const hasDirectPeerToPeerContext = (context: TBaseContext): boolean => {
  return 'isDirectPeerToPeer' in context && hasDirectPeerToPeer(context);
};

const PRESENTATION_CALL_HEADER = 'x-vinteo-presentation-call: yes';

const hasPresentationCall = (extraHeaders?: string[]): boolean => {
  return (
    Array.isArray(extraHeaders) &&
    extraHeaders.some((header) => {
      return header.trim().toLowerCase() === PRESENTATION_CALL_HEADER;
    })
  );
};

const hasPresentationCallContext = (
  context: TBaseContext,
): context is TContextMap[EState.PRESENTATION_CALL] => {
  return 'extraHeaders' in context && hasPresentationCall(context.extraHeaders);
};

const hasInRoomContext = (raw: TBaseContext): boolean => {
  return (
    hasAnyRoomContext(raw) &&
    !hasPurgatory(raw.room) &&
    hasConferenceTokenContext(raw) &&
    hasMatchingConferenceTokenContext(raw)
  );
};

const buildAnyRoomStateContext = (raw: TBaseContext): TAnyRoomState => {
  const roomContext = raw as TAnyRoomState; // buildContext is called for states guarded by hasAnyRoomContext

  return {
    number: roomContext.number,
    answer: roomContext.answer,
    room: roomContext.room,
    participantName: roomContext.participantName,
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
    buildContext: (raw: TBaseContext) => {
      const { number, answer, extraHeaders } = raw as TContextMap[EState.CONNECTING];

      return { number, answer, extraHeaders };
    },
  },
  [EState.PRESENTATION_CALL]: {
    guard: hasPresentationCallContext,
    buildContext: (raw: TBaseContext) => {
      const { number, answer } = raw as TContextMap[EState.PRESENTATION_CALL];

      return { number, answer };
    },
  },
  [EState.ROOM_PENDING_AUTH]: {
    guard: (raw: TBaseContext) => {
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
    guard: (raw: TBaseContext) => {
      return hasAnyRoomContext(raw) && hasPurgatory(raw.room) && !hasInRoomContext(raw);
    },
    buildContext: buildAnyRoomStateContext,
  },
  [EState.P2P_ROOM]: {
    guard: (raw: TBaseContext) => {
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
    guard: (raw: TBaseContext) => {
      return hasAnyRoomContext(raw) && hasDirectPeerToPeerContext(raw) && !hasInRoomContext(raw);
    },
    buildContext: (raw: TBaseContext) => {
      return { ...buildAnyRoomStateContext(raw), isDirectPeerToPeer: true };
    },
  },
  /** IN_ROOM только если `conferenceForToken === room` (в т.ч. после enter-room с bearer, где conference задаётся как room). */
  [EState.IN_ROOM]: {
    guard: hasInRoomContext,
    buildContext: (raw: TBaseContext) => {
      const { token, conferenceForToken } = raw as TContextMap[EState.IN_ROOM];

      return { ...buildAnyRoomStateContext(raw), token, conferenceForToken };
    },
  },
  [EState.DISCONNECTING]: {
    guard: (raw: TBaseContext) => {
      return (raw as TContextMap[EState.IDLE]).pendingDisconnect === true;
    },
    buildContext: () => {
      return {};
    },
  },
};
