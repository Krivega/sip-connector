import { doMockSipConnector } from '@/doMock';
import { sessionSelectors } from '@/SessionManager';

import type { TSessionSnapshot } from '@/SessionManager';

type TSipConnector = ReturnType<typeof doMockSipConnector>;

const enterActiveRoomAsSpectator = (sipConnector: TSipConnector) => {
  sipConnector.callManager.events.trigger('start-call', { number: '100', answer: false });
  sipConnector.apiManager.events.trigger('enter-room', {
    room: 'room-1',
    participantName: 'participant-1',
  });
  sipConnector.apiManager.events.trigger('conference:participant-token-issued', {
    jwt: 'token-1',
    conference: 'room-1',
    participant: 'participant-1',
  });
  sipConnector.apiManager.events.trigger('participant:move-request-to-spectators-synthetic', {
    isAvailableSendingMedia: true,
  });
};

type TCallSessionStateRole = TSessionSnapshot['callSessionState']['role'];

const hasSpectatorRole = (role: TCallSessionStateRole): boolean => {
  return role.type === 'spectator' || role.type === 'spectator_synthetic';
};

const hasParticipantRole = (role: TCallSessionStateRole): boolean => {
  return role.type === 'participant';
};

const installMovedToParticipantNotificationReaction = (
  sipConnector: TSipConnector,
  showMovedToParticipantNotification: jest.Mock,
) => {
  let previousSnapshot = sipConnector.sessionManager.getSnapshot();

  sipConnector.sessionManager.subscribe((snapshot) => {
    const wasSpectator = hasSpectatorRole(previousSnapshot.callSessionState.role);
    const isBecameParticipant = hasParticipantRole(snapshot.callSessionState.role);

    if (sessionSelectors.selectIsInCall(snapshot) && wasSpectator && isBecameParticipant) {
      showMovedToParticipantNotification();
    }

    previousSnapshot = snapshot;
  });
};

describe('Уведомление о переводе зрителя в участники', () => {
  let sipConnector: TSipConnector;
  let showMovedToParticipantNotification: jest.Mock;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    showMovedToParticipantNotification = jest.fn();
  });

  it('показывается при повышении зрителя во время звонка, но не при сбросе роли после завершения', () => {
    enterActiveRoomAsSpectator(sipConnector);

    installMovedToParticipantNotificationReaction(sipConnector, showMovedToParticipantNotification);

    sipConnector.apiManager.events.trigger('participant:move-request-to-participants');
    expect(showMovedToParticipantNotification).toHaveBeenCalledTimes(1);

    sipConnector.apiManager.events.trigger('participant:move-request-to-spectators-synthetic', {
      isAvailableSendingMedia: true,
    });

    sipConnector.callManager.events.trigger('ended', {
      originator: 'remote',
      // @ts-expect-error
      message: {},
      cause: 'bye',
    });

    expect(sipConnector.sessionManager.getSnapshot().callSessionState.role.type).toBe(
      'participant',
    );
    expect(showMovedToParticipantNotification).toHaveBeenCalledTimes(1);
  });
});
