import { hasParticipant, hasSpectatorSynthetic, hasSpectator } from './utils';

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

  private isAvailableSendingMedia = true;

  private readonly onRoleChanged?: TOnRoleChanged;

  private readonly listeners = new Set<TOnRoleChanged>();

  public constructor(onRoleChanged?: TOnRoleChanged) {
    this.onRoleChanged = onRoleChanged;
  }

  public getRole(): TCallRole {
    return this.role;
  }

  public getIsAvailableSendingMedia(): boolean {
    return this.isAvailableSendingMedia;
  }

  public setCallRoleParticipant() {
    this.isAvailableSendingMedia = true;
    this.changeRole(roleParticipant);
  }

  public setCallRoleSpectatorSynthetic(isAvailableSendingMedia = true) {
    this.isAvailableSendingMedia = isAvailableSendingMedia;
    this.changeRole(roleSpectatorSynthetic);
  }

  public setCallRoleSpectator(
    recvParams: TCallRoleSpectator['recvParams'],
    isAvailableSendingMedia = true,
  ) {
    this.isAvailableSendingMedia = isAvailableSendingMedia;
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
      hasSpectator(next) &&
      hasSpectator(currentRole) &&
      currentRole.recvParams.audioId !== next.recvParams.audioId;

    if (shouldUpdate) {
      this.setRole(next);
    }
  }

  public reset() {
    this.role = roleParticipant;
    this.isAvailableSendingMedia = true;
  }

  public hasParticipant() {
    return hasParticipant(this.role);
  }

  public hasSpectatorSynthetic() {
    return hasSpectatorSynthetic(this.role);
  }

  public hasSpectator() {
    return hasSpectator(this.role);
  }

  public subscribe(listener: TOnRoleChanged): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private setRole(next: TCallRole) {
    const previous = this.role;

    this.role = next;

    this.onRoleChanged?.({ previous, next });
    this.listeners.forEach((listener) => {
      listener({ previous, next });
    });
  }
}
