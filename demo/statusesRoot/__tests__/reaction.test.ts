import { reaction } from 'mobx';

import {
  createConnectionEvents,
  ConnectionStateMachine,
  createIncomingEvents,
  IncomingCallStateMachine,
  createCallEvents,
  createCallStateMachine,
  createAutoConnectorStateMachine,
  ECallStatus,
  PresentationStateMachine,
  SessionManager,
} from '@/index';
import { INITIAL_STATUSES_ROOT_SNAPSHOT, StatusesRootModel } from '../Model';

const createAutoConnectorMachineDeps = () => {
  return {
    canRetryOnError: () => {
      return true;
    },
    shouldDisconnectBeforeAttempt: () => {
      return false;
    },
    stopConnectionFlow: jest.fn(async () => {}),
    connect: jest.fn(async () => {}),
    delayBetweenAttempts: jest.fn(async () => {}),
    hasLimitReached: () => {
      return false;
    },
    beforeAttempt: jest.fn(),
    beforeConnectAttempt: jest.fn(),
    onLimitReached: jest.fn(),
    onConnectSucceeded: jest.fn(),
    emitTerminalOutcome: jest.fn(),
    onTelephonyStillConnected: jest.fn(),
  };
};

const startSession = () => {
  const connectionEvents = createConnectionEvents();
  const callEvents = createCallEvents();
  const incomingEvents = createIncomingEvents();

  const connectionStateMachine = new ConnectionStateMachine(connectionEvents);
  const callStateMachine = createCallStateMachine(callEvents);
  const incomingStateMachine = new IncomingCallStateMachine({
    incomingEvents,
    connectionEvents,
  });
  const presentationStateMachine = new PresentationStateMachine(callEvents);
  const autoConnectorStateMachine = createAutoConnectorStateMachine(
    createAutoConnectorMachineDeps(),
  );

  const session = new SessionManager({
    connectionManager: { stateMachine: connectionStateMachine },
    callManager: { stateMachine: callStateMachine },
    incomingCallManager: { stateMachine: incomingStateMachine },
    presentationManager: { stateMachine: presentationStateMachine },
    autoConnectorManager: { stateMachine: autoConnectorStateMachine },
  });

  const stopAll = () => {
    session.stop();
    connectionStateMachine.stop();
    callStateMachine.stop();
    incomingStateMachine.stop();
    presentationStateMachine.stop();
    autoConnectorStateMachine.stop();
  };

  return {
    session,
    callStateMachine,
    presentationStateMachine,
    stopAll,
  };
};

const withStartedSession = (testCase: (context: ReturnType<typeof startSession>) => void) => {
  const context = startSession();

  try {
    testCase(context);
  } finally {
    context.stopAll();
  }
};

describe('StatusesStore reactions', () => {
  it('updates statuses store on session sync and does not trigger room reaction for same room value', () => {
    withStartedSession(({ session, callStateMachine }) => {
      const store = StatusesRootModel.create(INITIAL_STATUSES_ROOT_SNAPSHOT);
      const roomReaction = jest.fn();
      const disposeRoomReaction = reaction(() => {
        return store.call.room;
      }, roomReaction);

      try {
        callStateMachine.send({ type: 'CALL.CONNECTING', number: '300', answer: false });
        callStateMachine.send({
          type: 'CALL.ENTER_ROOM',
          room: 'room-1',
          participantName: 'participantName',
        });

        store.syncFromSessionSnapshot(session.getSnapshot());

        expect(store.callSnapshot.state).toBe(ECallStatus.ROOM_PENDING_AUTH);
        expect(store.call.room).toBe('room-1');
        expect(roomReaction).toHaveBeenCalledTimes(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(roomReaction.mock.calls[0][0]).toBe('room-1');

        roomReaction.mockClear();

        callStateMachine.send({
          type: 'CALL.TOKEN_ISSUED',
          token: 'token',
          conferenceForToken: 'room-1',
          participantName: 'participantName2',
        });
        store.syncFromSessionSnapshot(session.getSnapshot());

        expect(store.callSnapshot.state).toBe(ECallStatus.IN_ROOM);
        expect(store.call.room).toBe('room-1');
        expect(store.call.token).toBe('token');
        expect(store.call.conferenceForToken).toBe('room-1');
        expect(roomReaction).not.toHaveBeenCalled();
      } finally {
        disposeRoomReaction();
      }
    });
  });
});
