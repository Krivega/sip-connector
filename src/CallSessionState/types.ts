import type { EContentUseLicense } from '@/ApiManager';

export type TCallRoleParticipant = { type: 'participant' };
export type TCallRoleSpectatorSynthetic = { type: 'spectator_synthetic' };
export type TCallRoleSpectator = {
  type: 'spectator';
  recvParams: { audioId: string };
};
export type TCallRole = TCallRoleParticipant | TCallRoleSpectatorSynthetic | TCallRoleSpectator;

export type TCallSessionDerived = {
  isSpectatorAny: boolean;
  isRecvSessionExpected: boolean;
  isAvailableSendingMedia: boolean;
};

export type TCallSessionSnapshot = {
  license?: EContentUseLicense;
  role: TCallRole;
  derived: TCallSessionDerived;
};

export type TCallSessionDiagnostics = {
  emitsTotal: number;
  dedupedTotal: number;
  subscribersCount: number;
};
