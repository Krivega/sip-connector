import { getSnapshot } from 'mobx-state-tree';

import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import {
  createAutoConnectorStateMachine,
  EAutoConnectorState as ESessionAutoConnectorStatus,
} from '@/AutoConnectorManager/AutoConnectorStateMachine';
import { createEvents as createCallEvents } from '@/CallManager';
import { createCallStateMachine, EState as ECallStatus } from '@/CallManager/CallStateMachine';
import { createEvents as createConnectionEvents } from '@/ConnectionManager';
import {
  ConnectionStateMachine,
  EState as EConnectionStatus,
  EEvents as EConnectionEvents,
} from '@/ConnectionManager/ConnectionStateMachine';
import { createEvents as createIncomingEvents } from '@/IncomingCallManager';
import {
  IncomingCallStateMachine,
  EState as EIncomingStatus,
} from '@/IncomingCallManager/IncomingCallStateMachine';
import {
  ECallStatus as ESessionCallStatus,
  EConnectionStatus as ESessionConnectionStatus,
  EIncomingStatus as ESessionIncomingStatus,
  EPresentationStatus as ESessionPresentationStatus,
  ESystemStatus,
} from '@/index';
import {
  PresentationStateMachine,
  EState as EPresentationStatus,
} from '@/PresentationManager/PresentationStateMachine';
import SessionManager from '@/SessionManager/@SessionManager';
import { INITIAL_STATUSES_STORE_SNAPSHOT, StatusesStoreModel } from '..';

const mappedFromSession = (session: SessionManager) => {
  const store = StatusesStoreModel.create(INITIAL_STATUSES_STORE_SNAPSHOT);

  store.syncFromSessionSnapshot(session.getSnapshot());

  return {
    connection: store.connectionNode,
    autoConnector: store.autoConnectorNode,
    call: store.callNode,
    incoming: store.incomingNode,
    presentation: store.presentationNode,
    system: store.systemNode,
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
    connectionStateMachine,
    callStateMachine,
    incomingStateMachine,
    presentationStateMachine,
    stopAll,
  };
};

const transitionToEstablished = (connectionStateMachine: ConnectionStateMachine) => {
  connectionStateMachine.send({ type: EConnectionEvents.START_CONNECT });
  connectionStateMachine.send({
    type: EConnectionEvents.START_INIT_UA,
    registerRequired: false,
  });
  connectionStateMachine.send({ type: EConnectionEvents.UA_CONNECTED });
  connectionStateMachine.send({ type: EConnectionEvents.UA_REGISTERED });
  connectionStateMachine.send({ type: EConnectionEvents.UA_CONNECTED });
  connectionStateMachine.send({ type: EConnectionEvents.UA_REGISTERED });
};

describe('StatusesStore views', () => {
  it('node getters mirror INITIAL_STATUSES_STORE_SNAPSHOT', () => {
    const store = StatusesStoreModel.create(INITIAL_STATUSES_STORE_SNAPSHOT);

    expect(store.connectionNode).toEqual(INITIAL_STATUSES_STORE_SNAPSHOT.connection);
    expect(store.autoConnectorNode).toEqual(INITIAL_STATUSES_STORE_SNAPSHOT.autoConnector);
    expect(store.callNode).toEqual(INITIAL_STATUSES_STORE_SNAPSHOT.call);
    expect(store.incomingNode).toEqual(INITIAL_STATUSES_STORE_SNAPSHOT.incoming);
    expect(store.presentationNode).toEqual(INITIAL_STATUSES_STORE_SNAPSHOT.presentation);
    expect(store.systemNode).toEqual(INITIAL_STATUSES_STORE_SNAPSHOT.system);
  });

  it('statusesStoreSnapshot equals composing all node view getters', () => {
    const store = StatusesStoreModel.create(INITIAL_STATUSES_STORE_SNAPSHOT);

    expect({
      connection: store.connectionNode,
      autoConnector: store.autoConnectorNode,
      call: store.callNode,
      incoming: store.incomingNode,
      presentation: store.presentationNode,
      system: store.systemNode,
    }).toEqual({
      connection: store.connectionNode,
      autoConnector: store.autoConnectorNode,
      call: store.callNode,
      incoming: store.incomingNode,
      presentation: store.presentationNode,
      system: store.systemNode,
    });
  });

  it('publicStatuses lists state enum for each subtree', () => {
    const store = StatusesStoreModel.create(INITIAL_STATUSES_STORE_SNAPSHOT);

    expect({
      connection: store.connectionNode.state,
      autoConnector: store.autoConnectorNode.state,
      call: store.callNode.state,
      incoming: store.incomingNode.state,
      presentation: store.presentationNode.state,
      system: store.systemNode.state,
    }).toEqual({
      connection: ESessionConnectionStatus.IDLE,
      autoConnector: ESessionAutoConnectorStatus.IDLE,
      call: ESessionCallStatus.IDLE,
      incoming: ESessionIncomingStatus.IDLE,
      presentation: ESessionPresentationStatus.IDLE,
      system: ESystemStatus.DISCONNECTED,
    });
  });

  it('after syncFromSessionSnapshot, node getters stay aligned with statusesStoreSnapshot', () => {
    const rtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });
    const { session, incomingStateMachine, stopAll } = startSession();

    incomingStateMachine.send({
      type: 'INCOMING.RINGING',
      data: {
        incomingNumber: '77',
        displayName: 'View test',
        host: 'example.com',
        rtcSession,
      },
    });

    const store = StatusesStoreModel.create(INITIAL_STATUSES_STORE_SNAPSHOT);

    store.syncFromSessionSnapshot(session.getSnapshot());

    expect({
      connection: store.connectionNode,
      autoConnector: store.autoConnectorNode,
      call: store.callNode,
      incoming: store.incomingNode,
      presentation: store.presentationNode,
      system: store.systemNode,
    }).toEqual({
      connection: store.connectionNode,
      autoConnector: store.autoConnectorNode,
      call: store.callNode,
      incoming: store.incomingNode,
      presentation: store.presentationNode,
      system: store.systemNode,
    });

    expect({
      connection: store.connectionNode.state,
      autoConnector: store.autoConnectorNode.state,
      call: store.callNode.state,
      incoming: store.incomingNode.state,
      presentation: store.presentationNode.state,
      system: store.systemNode.state,
    }).toEqual({
      connection: store.connectionNode.state,
      autoConnector: store.autoConnectorNode.state,
      call: store.callNode.state,
      incoming: store.incomingNode.state,
      presentation: store.presentationNode.state,
      system: store.systemNode.state,
    });

    stopAll();
  });
});

describe('StatusesStore', () => {
  const rtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });

  it('maps INCOMING.RINGING with remoteCallerData on incoming node', () => {
    const { session, incomingStateMachine, stopAll } = startSession();

    incomingStateMachine.send({
      type: 'INCOMING.RINGING',
      data: {
        incomingNumber: '100',
        displayName: 'Test caller',
        host: 'test.com',
        rtcSession,
      },
    });

    const mapped = mappedFromSession(session);

    expect(mapped.incoming).toMatchObject({
      state: EIncomingStatus.RINGING,
      context: {
        remoteCallerData: {
          incomingNumber: '100',
          displayName: 'Test caller',
          host: 'test.com',
        },
      },
    });

    stopAll();
  });

  it('maps connection CONNECTING with registerRequired in context after START_INIT_UA', () => {
    const { session, connectionStateMachine, stopAll } = startSession();

    connectionStateMachine.send({ type: EConnectionEvents.START_CONNECT });
    connectionStateMachine.send({
      type: EConnectionEvents.START_INIT_UA,
      registerRequired: true,
    });

    const mapped = mappedFromSession(session);

    expect(mapped.connection).toMatchObject({
      state: EConnectionStatus.CONNECTING,
      context: { registerRequired: true },
    });

    stopAll();
  });

  it('maps ESTABLISHED connection and IDLE call to system READY_TO_CALL with narrowed context', () => {
    const { session, connectionStateMachine, stopAll } = startSession();

    transitionToEstablished(connectionStateMachine);

    const mapped = mappedFromSession(session);

    expect(mapped.system.state).toBe(ESystemStatus.READY_TO_CALL);

    stopAll();
  });

  it('maps ESTABLISHED + CALL.CONNECTING to system CALL_CONNECTING', () => {
    const { session, connectionStateMachine, callStateMachine, stopAll } = startSession();

    transitionToEstablished(connectionStateMachine);
    callStateMachine.send({ type: 'CALL.CONNECTING', number: '200', answer: false });

    const mapped = mappedFromSession(session);

    expect(mapped.system.state).toBe(ESystemStatus.CALL_CONNECTING);
    expect(mapped.call).toMatchObject({
      state: ECallStatus.CONNECTING,
      context: { number: '200', answer: false },
    });

    stopAll();
  });

  it('maps active call (IN_ROOM) to system CALL_ACTIVE and keeps room context on call node', () => {
    const { session, connectionStateMachine, callStateMachine, stopAll } = startSession();

    transitionToEstablished(connectionStateMachine);
    callStateMachine.send({ type: 'CALL.CONNECTING', number: '300', answer: false });
    callStateMachine.send({
      type: 'CALL.ENTER_ROOM',
      room: 'room-1',
      participantName: 'participantName',
    });
    callStateMachine.send({
      type: 'CALL.TOKEN_ISSUED',
      token: 'token',
      conferenceForToken: 'room-1',
      participantName: 'participantName',
    });

    const mapped = mappedFromSession(session);

    expect(mapped.system.state).toBe(ESystemStatus.CALL_ACTIVE);
    expect(mapped.call).toMatchObject({
      state: ECallStatus.IN_ROOM,
      context: {
        room: 'room-1',
        token: 'token',
      },
    });

    stopAll();
  });

  it('updates MST instance via syncFromSessionSnapshot', () => {
    const { session, incomingStateMachine, stopAll } = startSession();

    const store = StatusesStoreModel.create(INITIAL_STATUSES_STORE_SNAPSHOT);

    incomingStateMachine.send({
      type: 'INCOMING.RINGING',
      data: {
        incomingNumber: '42',
        displayName: 'Caller',
        host: 'host',
        rtcSession,
      },
    });

    store.syncFromSessionSnapshot(session.getSnapshot());

    const frozen = getSnapshot(store);

    expect(frozen.incoming.state).toBe(EIncomingStatus.RINGING);

    stopAll();
  });

  it('maps presentation ACTIVE after SCREEN.STARTED', () => {
    const { session, presentationStateMachine, stopAll } = startSession();

    presentationStateMachine.send({ type: 'SCREEN.STARTING' });
    presentationStateMachine.send({ type: 'SCREEN.STARTED' });

    const mapped = mappedFromSession(session);

    expect(mapped.presentation.state).toBe(EPresentationStatus.ACTIVE);

    stopAll();
  });
});
