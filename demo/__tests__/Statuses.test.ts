import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { createAutoConnectorStateMachine } from '@/AutoConnectorManager/AutoConnectorStateMachine';
import { createEvents as createCallEvents } from '@/CallManager';
import { createCallStateMachine } from '@/CallManager/CallStateMachine';
import { createEvents as createConnectionEvents } from '@/ConnectionManager';
import { ConnectionStateMachine } from '@/ConnectionManager/ConnectionStateMachine';
import { createEvents as createIncomingEvents } from '@/IncomingCallManager';
import {
  IncomingCallStateMachine,
  EEvents as EIncomingEvents,
} from '@/IncomingCallManager/IncomingCallStateMachine';
import { ESystemStatus } from '@/index';
import { PresentationStateMachine } from '@/PresentationManager/PresentationStateMachine';
import SessionManager from '@/SessionManager/@SessionManager';
import Statuses from '../Statuses';

// eslint-disable-next-line no-var
var mockSessionManager: SessionManager;

jest.mock('../Session/sipConnectorFacade', () => {
  return {
    __esModule: true,
    default: {
      sipConnector: {
        get sessionManager() {
          return mockSessionManager;
        },
      },
    },
  };
});

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
    incomingStateMachine,
    stopAll,
  };
};

describe('Statuses', () => {
  const rtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });

  it('does not emit duplicated statuses when only snapshot context changes', () => {
    const { session, incomingStateMachine, stopAll } = startSession();

    mockSessionManager = session;

    const statuses = new Statuses();
    const onStatusesChange = jest.fn();

    statuses.subscribe(onStatusesChange);
    expect(onStatusesChange).toHaveBeenCalledTimes(1);

    incomingStateMachine.send({
      type: EIncomingEvents.RINGING,
      data: {
        incomingNumber: '100',
        displayName: 'Test caller',
        host: 'test.com',
        rtcSession,
      },
    });
    expect(onStatusesChange).toHaveBeenCalledTimes(2);
    expect(onStatusesChange).toHaveBeenLastCalledWith({
      connection: 'connection:idle',
      autoConnector: 'idle',
      call: 'call:idle',
      incoming: 'incoming:ringing',
      presentation: 'presentation:idle',
      system: ESystemStatus.DISCONNECTED,
    });

    incomingStateMachine.send({
      type: EIncomingEvents.RINGING,
      data: {
        incomingNumber: '200',
        displayName: 'Another caller',
        host: 'test.com',
        rtcSession,
      },
    });

    expect(onStatusesChange).toHaveBeenCalledTimes(2);
    stopAll();
  });
});
