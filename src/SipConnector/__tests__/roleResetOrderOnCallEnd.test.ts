import { doMockSipConnector } from '@/doMock';
import { ESystemStatus, sessionSelectors } from '@/SessionManager';

type TSipConnector = ReturnType<typeof doMockSipConnector>;

const enterActiveRoomAsSpectator = (sipConnector: ReturnType<typeof doMockSipConnector>) => {
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

  sipConnector.callSessionState.setCallRoleSpectatorSynthetic();
};

const hasSpectatorRole = (roleType: string) => {
  return roleType === 'spectator' || roleType === 'spectator_synthetic';
};

const installMovedToParticipantNotificationReaction = (
  sipConnector: TSipConnector,
  showMovedToParticipantNotification: jest.Mock,
) => {
  let isCallActive =
    sessionSelectors.selectSystemStatus(sipConnector.sessionManager.getSnapshot()) ===
    ESystemStatus.CALL_ACTIVE;
  let previousRoleType = sipConnector.callSessionState.getSnapshot().role.type;

  sipConnector.sessionManager.subscribe(sessionSelectors.selectSystemStatus, (systemStatus) => {
    isCallActive = systemStatus === ESystemStatus.CALL_ACTIVE;
  });

  sipConnector.callSessionState.subscribe((snapshot) => {
    const nextRoleType = snapshot.role.type;

    if (isCallActive && hasSpectatorRole(previousRoleType) && nextRoleType === 'participant') {
      showMovedToParticipantNotification();
    }

    previousRoleType = nextRoleType;
  });
};

describe('Уведомление о переводе зрителя в участники', () => {
  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let showMovedToParticipantNotification: jest.Mock;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    showMovedToParticipantNotification = jest.fn();
  });

  it('показывается, когда роль меняется со зрителя на участника во время активного звонка', () => {
    enterActiveRoomAsSpectator(sipConnector);

    installMovedToParticipantNotificationReaction(sipConnector, showMovedToParticipantNotification);

    sipConnector.callSessionState.setCallRoleParticipant();

    expect(showMovedToParticipantNotification).toHaveBeenCalledTimes(1);
  });

  it('не показывается, когда роль сбрасывается в участника после завершения звонка', () => {
    enterActiveRoomAsSpectator(sipConnector);

    installMovedToParticipantNotificationReaction(sipConnector, showMovedToParticipantNotification);

    sipConnector.callManager.events.trigger('ended', {
      originator: 'remote',
      // @ts-expect-error
      message: {},
      cause: 'bye',
    });

    expect(sipConnector.callSessionState.getSnapshot().role.type).toBe('participant');
    expect(showMovedToParticipantNotification).not.toHaveBeenCalled();
  });
});
