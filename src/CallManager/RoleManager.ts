import type { RemoteStreamsManager } from './RemoteStreamsManager';
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

  private readonly mainManager: RemoteStreamsManager;

  private readonly recvManager: RemoteStreamsManager;

  private readonly onRoleChanged?: TOnRoleChanged;

  public constructor(
    {
      mainManager,
      recvManager,
    }: { mainManager: RemoteStreamsManager; recvManager: RemoteStreamsManager },
    onRoleChanged?: TOnRoleChanged,
  ) {
    this.mainManager = mainManager;
    this.recvManager = recvManager;
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
    this.recvManager.reset();
  }

  public getActiveManager(): RemoteStreamsManager {
    if (this.hasSpectator()) {
      return this.recvManager;
    }

    return this.mainManager;
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
