import { doMockSipConnector } from '@/doMock';
import { ESystemStatus, sessionSelectors } from '@/SessionManager';

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

describe('Порядок сброса роли при завершении звонка', () => {
  let sipConnector: ReturnType<typeof doMockSipConnector>;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
  });

  it('системный статус должен обновиться раньше сброса роли в participant', () => {
    enterActiveRoomAsSpectator(sipConnector);

    expect(sipConnector.callManager.stateMachine.isInRoom).toBe(true);
    expect(sipConnector.callSessionState.getSnapshot().role.type).toBe('spectator_synthetic');

    const onSystemStatusChanged = jest.fn();
    const onRoleParticipant = jest.fn();

    sipConnector.sessionManager.subscribe(
      sessionSelectors.selectSystemStatus,
      onSystemStatusChanged,
    );
    sipConnector.callSessionState.subscribe((snapshot) => {
      if (snapshot.role.type === 'participant') {
        onRoleParticipant();
      }
    });

    sipConnector.callManager.events.trigger('ended', {
      originator: 'remote',
      // @ts-expect-error
      message: {},
      cause: 'bye',
    });

    expect(onSystemStatusChanged).toHaveBeenCalledWith(ESystemStatus.DISCONNECTED);
    expect(onRoleParticipant).toHaveBeenCalledTimes(1);
    expect(onSystemStatusChanged.mock.invocationCallOrder[0]).toBeLessThan(
      onRoleParticipant.mock.invocationCallOrder[0],
    );
  });
});
