import { doMockSipConnector } from '@/doMock';
import { sessionSelectors } from '@/SessionManager';

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

  sipConnector.callSessionState.setCallRoleSpectatorSynthetic();
};

const installMovedToParticipantNotificationReaction = (
  sipConnector: TSipConnector,
  showMovedToParticipantNotification: jest.Mock,
) => {
  let previousSnapshot = sipConnector.sessionManager.getSnapshot();

  sipConnector.sessionManager.subscribe((snapshot) => {
    console.log('snapshot call:', snapshot.call.value);
    console.log('snapshot callSession:', snapshot.callSession.role.type);

    if (sessionSelectors.hasSpectatorPromotedToParticipantDuringCall(previousSnapshot, snapshot)) {
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

  it.only('показывается, когда роль меняется со зрителя на участника во время активного звонка', () => {
    enterActiveRoomAsSpectator(sipConnector);

    installMovedToParticipantNotificationReaction(sipConnector, showMovedToParticipantNotification);

    sipConnector.callSessionState.setCallRoleParticipant();

    sipConnector.callSessionState.setCallRoleSpectatorSynthetic();

    sipConnector.callManager.events.trigger('ended', {
      originator: 'remote',
      // @ts-expect-error
      message: {},
      cause: 'bye',
    });

    expect(showMovedToParticipantNotification).toHaveBeenCalledTimes(1);
  });

  it('не показывается, когда роль сбрасывается в участника после завершения звонка', () => {
    console.log('start');

    enterActiveRoomAsSpectator(sipConnector);

    installMovedToParticipantNotificationReaction(sipConnector, showMovedToParticipantNotification);

    console.log('before ended');

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
