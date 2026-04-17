import { EventEmitterProxy } from 'events-constructor';

import { createEvents } from './events';
import { RoleManager } from './RoleManager';

import type { EContentUseLicense, TApiManagerEvents } from '@/ApiManager';
import type { TEventMap } from './events';
import type {
  TCallRole,
  TCallRoleSpectator,
  TCallSessionDiagnostics,
  TCallSessionSnapshot,
} from './types';

const isRoleEqual = (
  previous: TCallSessionSnapshot['role'],
  next: TCallSessionSnapshot['role'],
) => {
  // Смена ветки union всегда означает значимое изменение роли.
  if (previous.type !== next.type) {
    return false;
  }

  // Для participant/spectator_synthetic достаточно совпадения type:
  // у этих веток нет дополнительных параметров, влияющих на поведение.
  if (previous.type !== 'spectator') {
    return true;
  }

  // Для spectator важен audioId — от него зависит receive-only поведение.
  return next.type === 'spectator' && previous.recvParams.audioId === next.recvParams.audioId;
};

const defaultSnapshotEquals = (previous: TCallSessionSnapshot, next: TCallSessionSnapshot) => {
  return (
    previous.license === next.license &&
    isRoleEqual(previous.role, next.role) &&
    previous.derived.isAvailableSendingMedia === next.derived.isAvailableSendingMedia
  );
};

const collectCallSessionSnapshot = (
  roleManager: Pick<RoleManager, 'getRole' | 'getIsAvailableSendingMedia'>,
  license?: EContentUseLicense,
): TCallSessionSnapshot => {
  const role = roleManager.getRole();
  const isSpectatorAny = role.type === 'spectator' || role.type === 'spectator_synthetic';

  return {
    license,
    role,
    derived: {
      isSpectatorAny,
      isRecvSessionExpected: role.type === 'spectator',
      isAvailableSendingMedia: roleManager.getIsAvailableSendingMedia(),
    },
  };
};

export class CallSessionState extends EventEmitterProxy<TEventMap> {
  private readonly roleManager = new RoleManager();

  private license?: EContentUseLicense;

  private currentSnapshot: TCallSessionSnapshot;

  private readonly subscriptions: { unsubscribe: () => void }[] = [];

  private dedupedTotal = 0;

  public constructor() {
    super(createEvents());

    this.currentSnapshot = collectCallSessionSnapshot(this.roleManager, this.license);

    const unsubscribeRoleManager = this.roleManager.subscribe(this.notifySubscribers);

    this.subscriptions.push({
      unsubscribe: unsubscribeRoleManager,
    });
  }

  public getSnapshot(): TCallSessionSnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: (snapshot: TCallSessionSnapshot) => void): () => void {
    return this.on('snapshot-changed', ({ current }) => {
      listener(current);
    });
  }

  public subscribeRoleChanges(
    listener: (params: { previous: TCallRole; next: TCallRole }) => void,
  ) {
    return this.roleManager.subscribe(listener);
  }

  public hasSpectator(): boolean {
    return this.roleManager.hasSpectator();
  }

  public setCallRoleParticipant(): void {
    this.roleManager.setCallRoleParticipant();
  }

  public setCallRoleSpectatorSynthetic(isAvailableSendingMedia = true): void {
    this.roleManager.setCallRoleSpectatorSynthetic(isAvailableSendingMedia);
  }

  public setCallRoleSpectator(
    recvParams: TCallRoleSpectator['recvParams'],
    isAvailableSendingMedia = true,
  ): void {
    this.roleManager.setCallRoleSpectator(recvParams, isAvailableSendingMedia);
  }

  public reset(): void {
    this.roleManager.reset();
    this.license = undefined;
    this.notifySubscribers();
  }

  public subscribeToApiEvents(apiManager: TApiManagerEvents): void {
    const unsubscribeUseLicense = apiManager.on('use-license', this.handleUseLicense);

    this.subscriptions.push({
      unsubscribe: unsubscribeUseLicense,
    });
  }

  public stop(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.events.offAll('snapshot-changed');
  }

  public getDiagnostics(): TCallSessionDiagnostics {
    return {
      emitsTotal: this.events.getEmitsTotal('snapshot-changed'),
      dedupedTotal: this.dedupedTotal,
      subscribersCount: this.events.getSubscribersCount('snapshot-changed'),
    };
  }

  private readonly notifySubscribers = () => {
    const { previousSnapshot, currentSnapshot } = this.updateCurrentSnapshot();

    // Не эмитим событие, если агрегированный snapshot семантически не изменился.
    if (defaultSnapshotEquals(previousSnapshot, currentSnapshot)) {
      this.dedupedTotal += 1;

      return;
    }

    this.events.trigger('snapshot-changed', {
      previous: previousSnapshot,
      current: currentSnapshot,
    });
  };

  private updateCurrentSnapshot(): {
    previousSnapshot: TCallSessionSnapshot;
    currentSnapshot: TCallSessionSnapshot;
  } {
    // Отделяем обновление snapshot от логики нотификации:
    // так проще тестировать и поддерживать оркестрацию в notifySubscribers.
    const previousSnapshot = this.currentSnapshot;

    this.currentSnapshot = collectCallSessionSnapshot(this.roleManager, this.license);

    return {
      previousSnapshot,
      currentSnapshot: this.currentSnapshot,
    };
  }

  private readonly handleUseLicense = (license: EContentUseLicense): void => {
    this.license = license;
    this.notifySubscribers();
  };
}
