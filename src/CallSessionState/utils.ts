import type {
  TCallRole,
  TCallRoleParticipant,
  TCallRoleSpectatorSynthetic,
  TCallRoleSpectator,
} from './types';

export const hasParticipant = (role: TCallRole): role is TCallRoleParticipant => {
  return role.type === 'participant';
};

export const hasSpectatorSynthetic = (role: TCallRole): role is TCallRoleSpectatorSynthetic => {
  return role.type === 'spectator_synthetic';
};

export const hasSpectator = (role: TCallRole): role is TCallRoleSpectator => {
  return role.type === 'spectator';
};

export const isExitingSpectatorRole = (prev: TCallRole, next: TCallRole): boolean => {
  return hasSpectator(prev) && !hasSpectator(next);
};

export const isEnteringSpectatorRole = (
  _prev: TCallRole,
  next: TCallRole,
): next is TCallRoleSpectator => {
  return hasSpectator(next);
};

export const isExitingAnySpectatorRole = (prev: TCallRole, next: TCallRole): boolean => {
  const prevAny = hasSpectator(prev) || hasSpectatorSynthetic(prev);
  const nextAny = hasSpectator(next) || hasSpectatorSynthetic(next);

  return prevAny && !nextAny;
};

export const isEnteringAnySpectatorRole = (prev: TCallRole, next: TCallRole): boolean => {
  const prevAny = hasSpectator(prev) || hasSpectatorSynthetic(prev);
  const nextAny = hasSpectator(next) || hasSpectatorSynthetic(next);

  return !prevAny && nextAny;
};
