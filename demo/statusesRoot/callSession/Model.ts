import { types } from 'mobx-state-tree';

import { EContentUseLicense } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TCallSessionSnapshot } from '@/index';

export type TCallSessionStatusSnapshot = {
  license?: TCallSessionSnapshot['license'];
  isDuplexSendingMediaMode: boolean;
  roleType: TCallSessionSnapshot['role']['type'];
  roleAudioId?: string;
  isSpectatorAny: boolean;
  isRecvSessionExpected: boolean;
  isAvailableSendingMedia: boolean;
};

export const createCallSessionStatusSnapshot = (
  snapshot: TCallSessionSnapshot,
): TCallSessionStatusSnapshot => {
  const isDuplexSendingMediaMode =
    'isDuplexSendingMediaMode' in snapshot ? Boolean(snapshot.isDuplexSendingMediaMode) : false;

  return {
    license: snapshot.license,
    isDuplexSendingMediaMode,
    roleType: snapshot.role.type,
    roleAudioId: snapshot.role.type === 'spectator' ? snapshot.role.recvParams.audioId : undefined,
    isAvailableSendingMedia: snapshot.derived.isAvailableSendingMedia,
    isSpectatorAny: snapshot.derived.isSpectatorAny,
    isRecvSessionExpected: snapshot.derived.isRecvSessionExpected,
  };
};

export const CallSessionStatusModel = types
  .model({
    license: types.maybe(
      types.enumeration('CallSessionUseLicense', [
        EContentUseLicense.AUDIO,
        EContentUseLicense.VIDEO,
        EContentUseLicense.AUDIOPLUSPRESENTATION,
      ]),
    ),
    isDuplexSendingMediaMode: types.boolean,
    roleType: types.enumeration('CallSessionRoleType', [
      'participant',
      'spectator',
      'spectator_synthetic',
    ]),
    roleAudioId: types.maybe(types.string),
    isSpectatorAny: types.boolean,
    isRecvSessionExpected: types.boolean,
    isAvailableSendingMedia: types.boolean,
  })
  .views((self) => {
    return {
      get snapshot(): TCallSessionStatusSnapshot {
        return {
          license: self.license,
          isDuplexSendingMediaMode: self.isDuplexSendingMediaMode,
          roleType: self.roleType,
          roleAudioId: self.roleAudioId,
          isSpectatorAny: self.isSpectatorAny,
          isRecvSessionExpected: self.isRecvSessionExpected,
          isAvailableSendingMedia: self.isAvailableSendingMedia,
        };
      },
    };
  })
  .views((self) => {
    return {
      isAudioPlusVideoType(): boolean {
        return self.license === EContentUseLicense.VIDEO;
      },

      isAudioPlusContentType(): boolean {
        return self.license === EContentUseLicense.AUDIOPLUSPRESENTATION;
      },

      isAudioOnlyType(): boolean {
        return self.license === EContentUseLicense.AUDIO;
      },

      isParticipant(): boolean {
        return self.roleType === 'participant';
      },

      isSpectatorSynthetic(): boolean {
        return self.roleType === 'spectator_synthetic';
      },

      isSpectator(): boolean {
        return self.roleType === 'spectator';
      },
    };
  })
  .views((self) => {
    return {
      isSpectatorRoleAny(): boolean {
        return self.isSpectatorSynthetic() || self.isSpectator();
      },
    };
  })
  .views((self) => {
    return {
      isSpectatorAnyWithAvailableSendingMedia(): boolean {
        return self.isSpectatorRoleAny() && self.isAvailableSendingMedia;
      },

      isSpectatorAnyWithNotAvailableSendingMedia(): boolean {
        return self.isSpectatorRoleAny() && !self.isAvailableSendingMedia;
      },
    };
  });

export type TCallSessionStatusInstance = Instance<typeof CallSessionStatusModel>;

export const INITIAL_CALL_SESSION_STATUS_SNAPSHOT = {
  isDuplexSendingMediaMode: false,
  roleType: 'participant',
  isSpectatorAny: false,
  isRecvSessionExpected: false,
  isAvailableSendingMedia: true,
} as SnapshotIn<typeof CallSessionStatusModel>;
