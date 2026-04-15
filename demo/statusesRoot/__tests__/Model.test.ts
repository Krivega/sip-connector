import { getSnapshot } from 'mobx-state-tree';

import {
  ConnectionStateMachine,
  createConnectionEvents,
  EConnectionStatus,
  IncomingCallStateMachine,
  PresentationStateMachine,
  createAutoConnectorStateMachine,
  createCallEvents,
  createCallStateMachine,
  createIncomingEvents,
  EAutoConnectorStatus,
  ECallStatus,
  EConnectionStateMachineEvents,
  EIncomingCallStateMachineEvents,
  EIncomingStatus,
  EPresentationStateMachineEvents,
  EPresentationStatus,
  ESystemStatus,
  RTCSessionMock,
  SessionManager,
} from '@/index';
import { INITIAL_STATUSES_ROOT_SNAPSHOT, StatusesRootModel } from '../Model';

import type { Instance } from 'mobx-state-tree';

type TStatusesRootInstance = Instance<typeof StatusesRootModel>;

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

const createStore = () => {
  return StatusesRootModel.create(INITIAL_STATUSES_ROOT_SNAPSHOT);
};

const getStoreSnapshots = (store: TStatusesRootInstance) => {
  return {
    connection: store.connectionSnapshot,
    autoConnector: store.autoConnectorSnapshot,
    call: store.callSnapshot,
    incoming: store.incomingSnapshot,
    presentation: store.presentationSnapshot,
    system: store.systemSnapshot,
  };
};

const getPublicStatuses = (store: TStatusesRootInstance) => {
  return {
    connection: store.connectionSnapshot.state,
    autoConnector: store.autoConnectorSnapshot.state,
    call: store.callSnapshot.state,
    incoming: store.incomingSnapshot.state,
    presentation: store.presentationSnapshot.state,
    system: store.systemSnapshot.state,
  };
};

const syncStoreFromSession = (session: SessionManager) => {
  const store = createStore();

  store.syncFromSessionSnapshot(session.getSnapshot());

  return store;
};

const mappedFromSession = (session: SessionManager) => {
  return getStoreSnapshots(syncStoreFromSession(session));
};

const withStartedSession = (testCase: (context: ReturnType<typeof startSession>) => void) => {
  const context = startSession();

  try {
    testCase(context);
  } finally {
    context.stopAll();
  }
};

const createRtcSession = () => {
  return new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });
};

const transitionToEstablished = (connectionStateMachine: ConnectionStateMachine) => {
  connectionStateMachine.send({ type: EConnectionStateMachineEvents.START_CONNECT });
  connectionStateMachine.send({
    type: EConnectionStateMachineEvents.START_UA,
    configuration: {
      sipServerIp: '127.0.0.1',
      sipServerUrl: 'wss://sip.example.com',
      displayName: 'Test User',
      authorizationUser: '100',
      register: false,
    },
  });
  connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_CONNECTED });
  connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_REGISTERED });
  connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_CONNECTED });
  connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_REGISTERED });
};

const transitionCallToInRoom = (
  callStateMachine: ReturnType<typeof startSession>['callStateMachine'],
) => {
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
};

type TSystemStatusCase = {
  title: string;
  setup: (context: ReturnType<typeof startSession>) => void;
  expectedSystemStatus: ESystemStatus;
  assertMapped?: (mapped: ReturnType<typeof mappedFromSession>) => void;
};

const systemStatusCases: TSystemStatusCase[] = [
  {
    title: 'maps ESTABLISHED connection and IDLE call to READY_TO_CALL',
    setup: ({ connectionStateMachine }: ReturnType<typeof startSession>) => {
      transitionToEstablished(connectionStateMachine);
    },
    expectedSystemStatus: ESystemStatus.READY_TO_CALL,
  },
  {
    title: 'maps ESTABLISHED + CALL.CONNECTING to CALL_CONNECTING',
    setup: ({ connectionStateMachine, callStateMachine }: ReturnType<typeof startSession>) => {
      transitionToEstablished(connectionStateMachine);
      callStateMachine.send({ type: 'CALL.CONNECTING', number: '200', answer: false });
    },
    expectedSystemStatus: ESystemStatus.CALL_CONNECTING,
    assertMapped: (mapped: ReturnType<typeof mappedFromSession>) => {
      expect(mapped.call).toMatchObject({
        state: ECallStatus.CONNECTING,
        context: { number: '200', answer: false },
      });
    },
  },
  {
    title: 'maps active call (IN_ROOM) to CALL_ACTIVE',
    setup: ({ connectionStateMachine, callStateMachine }: ReturnType<typeof startSession>) => {
      transitionToEstablished(connectionStateMachine);
      transitionCallToInRoom(callStateMachine);
    },
    expectedSystemStatus: ESystemStatus.CALL_ACTIVE,
    assertMapped: (mapped: ReturnType<typeof mappedFromSession>) => {
      expect(mapped.call).toMatchObject({
        state: ECallStatus.IN_ROOM,
        context: {
          room: 'room-1',
          token: 'token',
        },
      });
    },
  },
];

type TViewsCase = {
  title: string;
  assert: (store: TStatusesRootInstance) => void;
};

const viewsCases: TViewsCase[] = [
  {
    title: 'snapshot getters mirror INITIAL_STATUSES_STORE_SNAPSHOT',
    assert: (store: TStatusesRootInstance) => {
      expect(getStoreSnapshots(store)).toEqual(INITIAL_STATUSES_ROOT_SNAPSHOT);
    },
  },
  {
    title: 'snapshot equals INITIAL_STATUSES_STORE_SNAPSHOT',
    assert: (store: TStatusesRootInstance) => {
      expect(getSnapshot(store)).toEqual(INITIAL_STATUSES_ROOT_SNAPSHOT);
    },
  },
  {
    title: 'publicStatuses lists state enum for each subtree',
    assert: (store: TStatusesRootInstance) => {
      expect(getPublicStatuses(store)).toEqual({
        connection: EConnectionStatus.IDLE,
        autoConnector: EAutoConnectorStatus.IDLE,
        call: ECallStatus.IDLE,
        incoming: EIncomingStatus.IDLE,
        presentation: EPresentationStatus.IDLE,
        system: ESystemStatus.DISCONNECTED,
      });
    },
  },
];

describe('StatusesStore views', () => {
  it.each(viewsCases)('$title', ({ assert }) => {
    expect.hasAssertions();

    const store = createStore();

    assert(store);
  });

  it('after syncFromSessionSnapshot, snapshot getters are aligned with snapshot', () => {
    withStartedSession(({ session, incomingStateMachine }) => {
      incomingStateMachine.send({
        type: EIncomingCallStateMachineEvents.RINGING,
        data: {
          incomingNumber: '77',
          displayName: 'View test',
          host: 'example.com',
          rtcSession: createRtcSession(),
        },
      });

      const store = syncStoreFromSession(session);

      expect(getStoreSnapshots(store)).toEqual(getSnapshot(store));
      expect(getPublicStatuses(store)).toEqual({
        connection: EConnectionStatus.IDLE,
        autoConnector: EAutoConnectorStatus.IDLE,
        call: ECallStatus.IDLE,
        incoming: EIncomingStatus.RINGING,
        presentation: EPresentationStatus.IDLE,
        system: ESystemStatus.DISCONNECTED,
      });
    });
  });
});

describe('StatusesStore', () => {
  it('maps INCOMING.RINGING with remoteCallerData on incoming snapshot', () => {
    withStartedSession(({ session, incomingStateMachine }) => {
      incomingStateMachine.send({
        type: EIncomingCallStateMachineEvents.RINGING,
        data: {
          incomingNumber: '100',
          displayName: 'Test caller',
          host: 'test.com',
          rtcSession: createRtcSession(),
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
    });
  });

  it('maps connection CONNECTING with configuration in context after START_UA', () => {
    withStartedSession(({ session, connectionStateMachine }) => {
      connectionStateMachine.send({ type: EConnectionStateMachineEvents.START_CONNECT });
      connectionStateMachine.send({
        type: EConnectionStateMachineEvents.START_UA,
        configuration: {
          sipServerIp: '127.0.0.1',
          sipServerUrl: 'wss://sip.example.com',
          displayName: 'Test User',
          authorizationUser: '100',
          register: true,
        },
      });

      const mapped = mappedFromSession(session);

      expect(mapped.connection).toMatchObject({
        state: EConnectionStatus.CONNECTING,
        context: {
          connectionConfiguration: {
            sipServerIp: '127.0.0.1',
            sipServerUrl: 'wss://sip.example.com',
            displayName: 'Test User',
            authorizationUser: '100',
            register: true,
          },
        },
      });
    });
  });

  it.each(systemStatusCases)('$title', ({ setup, expectedSystemStatus, assertMapped }) => {
    withStartedSession((context) => {
      setup(context);

      const mapped = mappedFromSession(context.session);

      expect(mapped.system.state).toBe(expectedSystemStatus);
      assertMapped?.(mapped);
    });
  });

  it('updates MST instance via syncFromSessionSnapshot', () => {
    withStartedSession(({ session, incomingStateMachine }) => {
      const store = createStore();

      incomingStateMachine.send({
        type: EIncomingCallStateMachineEvents.RINGING,
        data: {
          incomingNumber: '42',
          displayName: 'Caller',
          host: 'host',
          rtcSession: createRtcSession(),
        },
      });

      store.syncFromSessionSnapshot(session.getSnapshot());

      const frozen = getSnapshot(store);

      expect(frozen.incoming.state).toBe(EIncomingStatus.RINGING);
    });
  });

  it('maps presentation ACTIVE after SCREEN.STARTED', () => {
    withStartedSession(({ session, presentationStateMachine }) => {
      presentationStateMachine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      presentationStateMachine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });

      const mapped = mappedFromSession(session);

      expect(mapped.presentation.state).toBe(EPresentationStatus.ACTIVE);
    });
  });
});
