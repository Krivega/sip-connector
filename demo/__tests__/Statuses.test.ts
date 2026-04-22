import {
  createAutoConnectorStateMachine,
  createCallEvents,
  createCallReconnectStateMachine,
  createCallStateMachine,
  createIncomingEvents,
  createConnectionEvents,
  ConnectionStateMachine,
  IncomingCallStateMachine,
  EIncomingCallStateMachineEvents,
  ESystemStatus,
  PresentationStateMachine,
  SessionManager,
} from '@/index';
import Statuses from '../Statuses';

// eslint-disable-next-line no-var
var mockSessionManager: SessionManager;
// eslint-disable-next-line no-var
var mockCallSessionState = {
  getSnapshot: () => {
    return {
      role: { type: 'participant' as const },
      derived: {
        isSpectatorAny: false,
        isRecvSessionExpected: false,
        isAvailableSendingMedia: true,
      },
    };
  },
  subscribe: jest.fn(() => {
    return () => {};
  }),
};

jest.mock('../Session/sipConnectorFacade', () => {
  return {
    __esModule: true,
    default: {
      sipConnector: {
        get sessionManager() {
          return mockSessionManager;
        },
        get callSessionState() {
          return mockCallSessionState;
        },
      },
    },
  };
});

const createCallReconnectDeps = () => {
  return {
    isNetworkFailure: () => {
      return false;
    },
    canRetryOnError: () => {
      return true;
    },
    isSignalingReady: () => {
      return true;
    },
    hasLimitReached: () => {
      return false;
    },
    computeNextDelayMs: () => {
      return 0;
    },
    delayBeforeAttempt: jest.fn(async () => {}),
    waitSignalingReady: jest.fn(async () => {}),
    performAttempt: jest.fn(async () => {}),
    registerAttemptStart: jest.fn(),
    registerAttemptFinish: jest.fn(),
    resetAttemptsState: jest.fn(),
    emitArmed: jest.fn(),
    emitDisarmed: jest.fn(),
    emitFailureDetected: jest.fn(),
    emitAttemptScheduled: jest.fn(),
    emitAttemptStarted: jest.fn(),
    emitAttemptSucceeded: jest.fn(),
    emitAttemptFailed: jest.fn(),
    emitWaitingSignaling: jest.fn(),
    emitLimitReached: jest.fn(),
    emitCancelled: jest.fn(),
    cancelAll: jest.fn(),
    getWaitSignalingTimeoutMs: () => {
      return 1000;
    },
  };
};

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
  const callReconnectStateMachine = createCallReconnectStateMachine(createCallReconnectDeps());

  const session = new SessionManager({
    connectionManager: { stateMachine: connectionStateMachine },
    callManager: { stateMachine: callStateMachine },
    incomingCallManager: { stateMachine: incomingStateMachine },
    presentationManager: { stateMachine: presentationStateMachine },
    autoConnectorManager: { stateMachine: autoConnectorStateMachine },
    callReconnectManager: { stateMachine: callReconnectStateMachine },
  });

  const stopAll = () => {
    session.stop();
    connectionStateMachine.stop();
    callStateMachine.stop();
    incomingStateMachine.stop();
    presentationStateMachine.stop();
    autoConnectorStateMachine.stop();
    callReconnectStateMachine.stop();
  };

  return {
    session,
    incomingStateMachine,
    stopAll,
  };
};

describe('Statuses', () => {
  it('does not emit duplicated statuses when only snapshot context changes', () => {
    const { session, incomingStateMachine, stopAll } = startSession();

    mockSessionManager = session;

    const statuses = new Statuses();
    const onStatusesChange = jest.fn();

    statuses.subscribe();

    const unsubscribeOnStatusesChange = statuses.onChangeSystemState(onStatusesChange);

    expect(onStatusesChange).toHaveBeenCalledTimes(1);

    incomingStateMachine.send({
      type: EIncomingCallStateMachineEvents.RINGING,
      data: {
        incomingNumber: '100',
        displayName: 'Test caller',
        host: 'test.com',
      },
    });
    expect(onStatusesChange).toHaveBeenCalledTimes(2);
    expect(onStatusesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connection: 'connection:idle',
        autoConnector: 'idle',
        callReconnect: 'idle',
        call: 'call:idle',
        incoming: 'incoming:ringing',
        presentation: 'presentation:idle',
        system: ESystemStatus.DISCONNECTED,
      }),
    );

    incomingStateMachine.send({
      type: EIncomingCallStateMachineEvents.RINGING,
      data: {
        incomingNumber: '200',
        displayName: 'Another caller',
        host: 'test.com',
      },
    });

    expect(onStatusesChange).toHaveBeenCalledTimes(2);
    unsubscribeOnStatusesChange();
    stopAll();
  });
});
