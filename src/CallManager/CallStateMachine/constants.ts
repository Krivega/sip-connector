import type { TContext } from './types';

/** Внутреннее состояние XState между переходами (`evaluate`). Не входит в `EState`. */
export const CALL_MACHINE_EVALUATE_STATE = 'evaluate' as const;

export enum EState {
  IDLE = 'call:idle',
  CONNECTING = 'call:connecting',
  PRESENTATION_CALL = 'call:presentationCall',
  ROOM_PENDING_AUTH = 'call:roomPendingAuth',
  PURGATORY = 'call:purgatory',
  P2P_ROOM = 'call:p2pRoom',
  DIRECT_P2P_ROOM = 'call:directP2pRoom',
  IN_ROOM = 'call:inRoom',
  DISCONNECTING = 'call:disconnecting',
}

export const initialContext: TContext = {
  raw: {},
  state: {},
};
