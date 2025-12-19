import type { RemoteStreamsManager } from './RemoteStreamsManager';
import type { TCallRole, TCallRoleParticipant, TCallRoleViewer, TCallRoleViewerNew } from './types';

type TOnRoleChanged = (params: { previous: TCallRole; next: TCallRole }) => void;

const roleParticipant: TCallRoleParticipant = {
  type: 'participant',
};
const roleViewer: TCallRoleViewer = {
  type: 'viewer',
};

const createRoleViewerNew = (recvParams: TCallRoleViewerNew['recvParams']): TCallRoleViewerNew => {
  return {
    type: 'viewer_new',
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

  public static hasViewer(role: TCallRole): role is TCallRoleViewer {
    return role.type === 'viewer';
  }

  public static hasViewerNew(role: TCallRole): role is TCallRoleViewerNew {
    return role.type === 'viewer_new';
  }

  public getRole(): TCallRole {
    return this.role;
  }

  public setCallRoleParticipant() {
    this.setRole(roleParticipant);
  }

  public setCallRoleViewer() {
    this.setRole(roleViewer);
  }

  public setCallRoleViewerNew(recvParams: TCallRoleViewerNew['recvParams']) {
    this.setRole(createRoleViewerNew(recvParams));
  }

  public setRole(role: TCallRole) {
    if (this.role.type === role.type) {
      return;
    }

    const previous = this.role;

    this.role = role;

    this.onRoleChanged?.({ previous, next: role });
  }

  public reset() {
    this.role = roleParticipant;
    this.recvManager.reset();
  }

  public getActiveManager(): RemoteStreamsManager {
    if (this.hasViewerNew()) {
      return this.recvManager;
    }

    return this.mainManager;
  }

  public hasParticipant() {
    return RoleManager.hasParticipant(this.role);
  }

  public hasViewer() {
    return RoleManager.hasViewer(this.role);
  }

  public hasViewerNew() {
    return RoleManager.hasViewerNew(this.role);
  }
}
