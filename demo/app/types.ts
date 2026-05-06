import type { TStatusesByDomain } from '../StatusesRoot';

export type TDemoSystemState = {
  isDisconnected: boolean;
  isDisconnecting: boolean;
  isConnecting: boolean;
  isReadyToCall: boolean;
  isCallConnecting: boolean;
  isCallDisconnecting: boolean;
  isCallActive: boolean;
} & TStatusesByDomain;

export type TDemoParticipantRoleState = {
  isAvailableSendingMedia: boolean;
  isSpectatorRoleAny: boolean;
  isSpectator: boolean;
  isParticipant: boolean;
};
