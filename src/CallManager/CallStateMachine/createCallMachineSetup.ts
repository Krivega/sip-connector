import { assign, setup } from 'xstate';

import hasPeerToPeer from '@/tools/hasPeerToPeer';
import hasPurgatory from '@/tools/hasPurgatory';
import { isValidBoolean, isValidString } from '@/utils/validators';
import { initialContext } from './constants';
import { hasDirectPeerToPeer } from './state';

import type { TContext } from './types';

type TCallEvent =
  | {
      type: 'CALL.CONNECTING';
      number: string;
      answer: boolean;
      extraHeaders?: string[];
    }
  | {
      type: 'CALL.ENTER_ROOM';
      room: string;
      participantName: string;
      token?: string;
      isDirectPeerToPeer?: boolean;
    }
  | {
      type: 'CALL.TOKEN_ISSUED';
      token: string;
      conferenceForToken: string;
      participantName: string;
    }
  | { type: 'CALL.PRESENTATION_CALL' }
  | { type: 'CALL.START_DISCONNECT' }
  | { type: 'CALL.RESET' };

const hasNoTokenRoom = (event: { room?: string; isDirectPeerToPeer?: boolean }): boolean => {
  return hasPurgatory(event.room) || hasPeerToPeer(event.room) || hasDirectPeerToPeer(event);
};

const clearRawContext = (): TContext => {
  return {};
};

export const createCallMachineSetup = () => {
  return setup({
    types: {
      context: initialContext,
      events: {} as TCallEvent,
    },
    actions: {
      setConnecting: assign(({ event, context }) => {
        if (event.type !== 'CALL.CONNECTING') {
          return context;
        }

        return {
          raw: {
            ...clearRawContext(),
            number: event.number,
            answer: event.answer,
            extraHeaders: event.extraHeaders,
          },
        };
      }),
      setRoomInfo: assign(({ event, context }) => {
        if (event.type !== 'CALL.ENTER_ROOM') {
          return context;
        }

        const nextRaw: {
          room: string;
          participantName: string;
          token?: string;
          conferenceForToken?: string;
          isDirectPeerToPeer?: boolean;
        } = {
          room: event.room,
          participantName: event.participantName,
        };

        if (isValidString(event.token)) {
          nextRaw.token = event.token;
          nextRaw.conferenceForToken = event.room;
        } else if (hasNoTokenRoom(event)) {
          nextRaw.token = undefined;
          nextRaw.conferenceForToken = undefined;
        }

        if (isValidBoolean(event.isDirectPeerToPeer)) {
          nextRaw.isDirectPeerToPeer = event.isDirectPeerToPeer;
        }

        return {
          raw: {
            ...context.raw,
            ...nextRaw,
          },
        };
      }),
      setTokenInfo: assign(({ event, context }) => {
        if (event.type !== 'CALL.TOKEN_ISSUED') {
          return context;
        }

        return {
          raw: {
            ...context.raw,
            token: event.token,
            conferenceForToken: event.conferenceForToken,
            participantName: event.participantName,
          },
        };
      }),
      setConfirmed: assign(({ event, context }) => {
        if (event.type !== 'CALL.PRESENTATION_CALL') {
          return context;
        }

        return {
          raw: {
            ...context.raw,
            isConfirmed: true as const,
          },
        };
      }),
      reset: assign(() => {
        return { raw: clearRawContext() };
      }),
      prepareDisconnect: assign(() => {
        return {
          raw: {
            ...clearRawContext(),
            pendingDisconnect: true as const,
          },
        };
      }),
    },
  });
};
