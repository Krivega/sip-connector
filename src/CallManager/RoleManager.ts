import type { RemoteStreamsManager } from './RemoteStreamsManager';
import type {
  TCallRole,
  TCallRoleParticipant,
  TCallRoleViewerSynthetic,
  TCallRoleViewer,
} from './types';

type TOnRoleChanged = (params: { previous: TCallRole; next: TCallRole }) => void;

const roleParticipant: TCallRoleParticipant = {
  type: 'participant',
};
const roleViewerSynthetic: TCallRoleViewerSynthetic = {
  type: 'viewer_synthetic',
};

const createRoleViewer = (recvParams: TCallRoleViewer['recvParams']): TCallRoleViewer => {
  return {
    type: 'viewer',
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

  public static hasViewerSynthetic(role: TCallRole): role is TCallRoleViewerSynthetic {
    return role.type === 'viewer_synthetic';
  }

  public static hasViewer(role: TCallRole): role is TCallRoleViewer {
    return role.type === 'viewer';
  }

  public getRole(): TCallRole {
    return this.role;
  }

  public setCallRoleParticipant() {
    this.changeRole(roleParticipant);
  }

  public setCallRoleViewerSynthetic() {
    this.changeRole(roleViewerSynthetic);
  }

  public setCallRoleViewer(recvParams: TCallRoleViewer['recvParams']) {
    this.changeRole(createRoleViewer(recvParams));
  }

  public changeRole(next: TCallRole) {
    const currentRole = this.role;

    // Если тип роли изменился, обновляем роль
    if (currentRole.type !== next.type) {
      this.setRole(next);

      return;
    }

    // Если тип роли тот же, проверяем нужно ли обновить роль
    // Для viewer_new проверяем изменился ли audioId
    const shouldUpdate =
      RoleManager.hasViewer(next) &&
      RoleManager.hasViewer(currentRole) &&
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
    if (this.hasViewer()) {
      return this.recvManager;
    }

    return this.mainManager;
  }

  public hasParticipant() {
    return RoleManager.hasParticipant(this.role);
  }

  public hasViewerSynthetic() {
    return RoleManager.hasViewerSynthetic(this.role);
  }

  public hasViewer() {
    return RoleManager.hasViewer(this.role);
  }

  private setRole(next: TCallRole) {
    const previous = this.role;

    this.role = next;

    this.onRoleChanged?.({ previous, next });
  }
}
