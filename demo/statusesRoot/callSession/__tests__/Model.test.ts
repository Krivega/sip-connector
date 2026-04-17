import { EContentUseLicense } from '@/index';
import {
  CallSessionStatusModel,
  createCallSessionStatusSnapshot,
  INITIAL_CALL_SESSION_STATUS_SNAPSHOT,
} from '../Model';

describe('CallSessionStatusModel', () => {
  it('maps initial snapshot to snapshot', () => {
    const instance = CallSessionStatusModel.create(INITIAL_CALL_SESSION_STATUS_SNAPSHOT);

    expect(instance.snapshot).toEqual(INITIAL_CALL_SESSION_STATUS_SNAPSHOT);
  });

  it('createCallSessionStatusSnapshot maps spectator role fields', () => {
    const snapshot = createCallSessionStatusSnapshot({
      role: {
        type: 'spectator',
        recvParams: {
          audioId: 'audio-1',
        },
      },
      license: EContentUseLicense.VIDEO,
      derived: {
        isSpectatorAny: true,
        isRecvSessionExpected: true,
        isAvailableSendingMedia: false,
      },
    });

    expect(snapshot).toEqual({
      license: EContentUseLicense.VIDEO,
      roleType: 'spectator',
      roleAudioId: 'audio-1',
      isAvailableSendingMedia: false,
      isSpectatorAny: true,
      isRecvSessionExpected: true,
    });
  });

  it('createCallSessionStatusSnapshot maps participant role without audio id', () => {
    const snapshot = createCallSessionStatusSnapshot({
      role: {
        type: 'participant',
      },
      derived: {
        isSpectatorAny: false,
        isRecvSessionExpected: false,
        isAvailableSendingMedia: true,
      },
    });

    expect(snapshot).toEqual({
      roleType: 'participant',
      roleAudioId: undefined,
      isAvailableSendingMedia: true,
      isSpectatorAny: false,
      isRecvSessionExpected: false,
    });
  });

  it.each([
    {
      license: EContentUseLicense.AUDIO,
      expected: {
        isAudioOnlyType: true,
        isAudioPlusVideoType: false,
        isAudioPlusContentType: false,
      },
    },
    {
      license: EContentUseLicense.VIDEO,
      expected: {
        isAudioOnlyType: false,
        isAudioPlusVideoType: true,
        isAudioPlusContentType: false,
      },
    },
    {
      license: EContentUseLicense.AUDIOPLUSPRESENTATION,
      expected: {
        isAudioOnlyType: false,
        isAudioPlusVideoType: false,
        isAudioPlusContentType: true,
      },
    },
  ])('views: resolves license helpers for $license', ({ license, expected }) => {
    const instance = CallSessionStatusModel.create({
      ...INITIAL_CALL_SESSION_STATUS_SNAPSHOT,
      license,
      isAvailableSendingMedia: true,
    });

    expect(instance.isAudioOnlyType()).toBe(expected.isAudioOnlyType);
    expect(instance.isAudioPlusVideoType()).toBe(expected.isAudioPlusVideoType);
    expect(instance.isAudioPlusContentType()).toBe(expected.isAudioPlusContentType);
  });

  it('views: resolves participant role helpers', () => {
    const instance = CallSessionStatusModel.create({
      ...INITIAL_CALL_SESSION_STATUS_SNAPSHOT,
      roleType: 'participant',
      isAvailableSendingMedia: true,
    });

    expect(instance.isParticipant()).toBe(true);
    expect(instance.isSpectatorSynthetic()).toBe(false);
    expect(instance.isSpectator()).toBe(false);
    expect(instance.isSpectatorRoleAny()).toBe(false);
    expect(instance.isSpectatorAnyWithAvailableSendingMedia()).toBe(false);
    expect(instance.isSpectatorAnyWithNotAvailableSendingMedia()).toBe(false);
  });

  it('views: resolves spectator_synthetic helpers with available sending media', () => {
    const instance = CallSessionStatusModel.create({
      ...INITIAL_CALL_SESSION_STATUS_SNAPSHOT,
      roleType: 'spectator_synthetic',
      isSpectatorAny: true,
      isAvailableSendingMedia: true,
    });

    expect(instance.isParticipant()).toBe(false);
    expect(instance.isSpectatorSynthetic()).toBe(true);
    expect(instance.isSpectator()).toBe(false);
    expect(instance.isSpectatorRoleAny()).toBe(true);
    expect(instance.isSpectatorAnyWithAvailableSendingMedia()).toBe(true);
    expect(instance.isSpectatorAnyWithNotAvailableSendingMedia()).toBe(false);
  });

  it('views: resolves spectator helpers with not available sending media', () => {
    const instance = CallSessionStatusModel.create({
      ...INITIAL_CALL_SESSION_STATUS_SNAPSHOT,
      roleType: 'spectator',
      roleAudioId: 'audio-1',
      isSpectatorAny: true,
      isRecvSessionExpected: true,
      isAvailableSendingMedia: false,
    });

    expect(instance.isParticipant()).toBe(false);
    expect(instance.isSpectatorSynthetic()).toBe(false);
    expect(instance.isSpectator()).toBe(true);
    expect(instance.isSpectatorRoleAny()).toBe(true);
    expect(instance.isSpectatorAnyWithAvailableSendingMedia()).toBe(false);
    expect(instance.isSpectatorAnyWithNotAvailableSendingMedia()).toBe(true);
  });
});
