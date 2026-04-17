export { CallSessionState } from './@CallSessionState';
export { RoleManager } from './RoleManager';
export {
  hasParticipant,
  hasSpectatorSynthetic,
  hasSpectator,
  isExitingSpectatorRole,
  isEnteringSpectatorRole,
  isExitingAnySpectatorRole,
  isEnteringAnySpectatorRole,
} from './utils';
export type {
  TCallSessionDiagnostics,
  TCallSessionSnapshot,
  TCallSessionDerived,
  TCallRole,
  TCallRoleParticipant,
  TCallRoleSpectatorSynthetic,
  TCallRoleSpectator,
} from './types';
