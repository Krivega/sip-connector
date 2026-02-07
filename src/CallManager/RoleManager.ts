import type {
  TCallRole,
  TCallRoleParticipant,
  TCallRoleSpectatorSynthetic,
  TCallRoleSpectator,
} from './types';

type TOnRoleChanged = (params: { previous: TCallRole; next: TCallRole }) => void;

const roleParticipant: TCallRoleParticipant = {
  type: 'participant',
};
const roleSpectatorSynthetic: TCallRoleSpectatorSynthetic = {
  type: 'spectator_synthetic',
};

const createRoleSpectator = (recvParams: TCallRoleSpectator['recvParams']): TCallRoleSpectator => {
  return {
    type: 'spectator',
    recvParams,
  };
};

export class RoleManager {
  private role: TCallRole = roleParticipant;

  private readonly onRoleChanged?: TOnRoleChanged;

  public constructor(onRoleChanged?: TOnRoleChanged) {
    this.onRoleChanged = onRoleChanged;
  }

  public static hasParticipant(role: TCallRole): role is TCallRoleParticipant {
    return role.type === 'participant';
  }

  public static hasSpectatorSynthetic(role: TCallRole): role is TCallRoleSpectatorSynthetic {
    return role.type === 'spectator_synthetic';
  }

  public static hasSpectator(role: TCallRole): role is TCallRoleSpectator {
    return role.type === 'spectator';
  }

  public static isExitingSpectatorRole(prev: TCallRole, next: TCallRole): boolean {
    return RoleManager.hasSpectator(prev) && !RoleManager.hasSpectator(next);
  }

  public static isEnteringSpectatorRole(
    _prev: TCallRole,
    next: TCallRole,
  ): next is TCallRoleSpectator {
    return RoleManager.hasSpectator(next);
  }

  public static isExitingAnySpectatorRole(prev: TCallRole, next: TCallRole): boolean {
    const prevAny = RoleManager.hasSpectator(prev) || RoleManager.hasSpectatorSynthetic(prev);
    const nextAny = RoleManager.hasSpectator(next) || RoleManager.hasSpectatorSynthetic(next);

    return prevAny && !nextAny;
  }

  public static isEnteringAnySpectatorRole(prev: TCallRole, next: TCallRole): boolean {
    const prevAny = RoleManager.hasSpectator(prev) || RoleManager.hasSpectatorSynthetic(prev);
    const nextAny = RoleManager.hasSpectator(next) || RoleManager.hasSpectatorSynthetic(next);

    return !prevAny && nextAny;
  }

  public getRole(): TCallRole {
    return this.role;
  }

  public setCallRoleParticipant() {
    this.changeRole(roleParticipant);
  }

  public setCallRoleSpectatorSynthetic() {
    this.changeRole(roleSpectatorSynthetic);
  }

  public setCallRoleSpectator(recvParams: TCallRoleSpectator['recvParams']) {
    this.changeRole(createRoleSpectator(recvParams));
  }

  public changeRole(next: TCallRole) {
    const currentRole = this.role;

    // Если тип роли изменился, обновляем роль
    if (currentRole.type !== next.type) {
      this.setRole(next);

      return;
    }

    // Если тип роли тот же, проверяем нужно ли обновить роль
    // Для spectator_new проверяем изменился ли audioId
    const shouldUpdate =
      RoleManager.hasSpectator(next) &&
      RoleManager.hasSpectator(currentRole) &&
      currentRole.recvParams.audioId !== next.recvParams.audioId;

    if (shouldUpdate) {
      this.setRole(next);
    }
  }

  public reset() {
    this.role = roleParticipant;
  }

  public hasParticipant() {
    return RoleManager.hasParticipant(this.role);
  }

  public hasSpectatorSynthetic() {
    return RoleManager.hasSpectatorSynthetic(this.role);
  }

  public hasSpectator() {
    return RoleManager.hasSpectator(this.role);
  }

  private setRole(next: TCallRole) {
    const previous = this.role;

    this.role = next;

    this.onRoleChanged?.({ previous, next });
  }
}
