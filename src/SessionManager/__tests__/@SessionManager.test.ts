import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { createAutoConnectorStateMachine } from '@/AutoConnectorManager/AutoConnectorStateMachine';
import {
  createEvents as createCallEvents,
  createCallStateMachine,
  ECallStatus,
} from '@/CallManager';
import { createCallReconnectStateMachine } from '@/CallReconnectManager';
import {
  createEvents as createConnectionEvents,
  ConnectionStateMachine,
  EConnectionStatus,
  EConnectionStateMachineEvents,
} from '@/ConnectionManager';
import {
  createEvents as createIncomingEvents,
  IncomingCallStateMachine,
  EIncomingStatus,
  EIncomingCallStateMachineEvents,
} from '@/IncomingCallManager';
import {
  PresentationStateMachine,
  EPresentationStatus,
  EPresentationStateMachineEvents,
} from '@/PresentationManager';
import SessionManager from '../@SessionManager';
import { sessionSelectors } from '../selectors';
import { ESystemStatus } from '../types';

import type { TSessionSnapshot } from '../types';

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
    connectionStateMachine,
    callStateMachine,
    incomingStateMachine,
    presentationStateMachine,
    autoConnectorStateMachine,
    callReconnectStateMachine,
    stopAll,
  };
};

describe('SessionManager', () => {
  const rtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });

  describe('session aggregation', () => {
    it('reads snapshots directly from manager actors', () => {
      const {
        session,
        connectionStateMachine,
        callStateMachine,
        incomingStateMachine,
        presentationStateMachine,
        stopAll,
      } = startSession();

      connectionStateMachine.send({ type: EConnectionStateMachineEvents.START_CONNECT });
      expect(sessionSelectors.selectConnectionStatus(session.getSnapshot())).toBe(
        EConnectionStatus.PREPARING,
      );

      connectionStateMachine.send({
        type: EConnectionStateMachineEvents.START_UA,
        configuration: {
          displayName: 'Test User',
          authorizationUser: 'testuser',
          register: false,
          sipServerIp: 'test.com',
          sipServerUrl: 'test.com',
        },
      });
      connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_CONNECTED });
      connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_REGISTERED });
      connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_CONNECTED });
      connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_REGISTERED });
      expect(sessionSelectors.selectConnectionStatus(session.getSnapshot())).toBe(
        EConnectionStatus.ESTABLISHED,
      );

      callStateMachine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });
      expect(sessionSelectors.selectCallStatus(session.getSnapshot())).toBe(ECallStatus.CONNECTING);

      callStateMachine.send({
        type: 'CALL.ENTER_ROOM',
        room: 'room',
        participantName: 'participantName',
      });
      expect(sessionSelectors.selectCallStatus(session.getSnapshot())).toBe(
        ECallStatus.ROOM_PENDING_AUTH,
      );
      callStateMachine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: 'token',
        conferenceForToken: 'room',
        participantName: 'participantName',
      });
      expect(sessionSelectors.selectCallStatus(session.getSnapshot())).toBe(ECallStatus.IN_ROOM);

      incomingStateMachine.send({
        type: EIncomingCallStateMachineEvents.RINGING,
        data: { incomingNumber: '101', displayName: 'Test Caller', host: 'test.com', rtcSession },
      });
      expect(sessionSelectors.selectIncomingStatus(session.getSnapshot())).toBe(
        EIncomingStatus.RINGING,
      );

      incomingStateMachine.send({ type: EIncomingCallStateMachineEvents.CONSUMED });
      expect(sessionSelectors.selectIncomingStatus(session.getSnapshot())).toBe(
        EIncomingStatus.CONSUMED,
      );

      presentationStateMachine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      presentationStateMachine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      expect(sessionSelectors.selectPresentationStatus(session.getSnapshot())).toBe(
        EPresentationStatus.ACTIVE,
      );

      presentationStateMachine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDED });
      expect(sessionSelectors.selectPresentationStatus(session.getSnapshot())).toBe(
        EPresentationStatus.IDLE,
      );

      stopAll();
    });

    it('notifies subscribers only when selected slice changes', () => {
      const { session, callStateMachine, stopAll } = startSession();
      const onCallStatus = jest.fn();

      const unsubscribe = session.subscribe(sessionSelectors.selectCallStatus, onCallStatus);

      callStateMachine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });
      callStateMachine.send({ type: 'CALL.CONNECTING', number: '200', answer: true }); // duplicate should be ignored by equals

      expect(onCallStatus).toHaveBeenCalledTimes(1);
      expect(onCallStatus).toHaveBeenLastCalledWith(ECallStatus.CONNECTING);

      unsubscribe();
      stopAll();
    });

    it('notifies subscribers with full snapshot when no selector provided', () => {
      const {
        session,
        connectionStateMachine,
        callStateMachine,
        incomingStateMachine,
        presentationStateMachine,
        stopAll,
      } = startSession();
      const callback = jest.fn();

      const unsubscribe = session.subscribe(callback);

      // Change connection state
      connectionStateMachine.send({ type: EConnectionStateMachineEvents.START_CONNECT });
      expect(callback).toHaveBeenCalledTimes(1);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const firstSnapshot = callback.mock.calls[0]?.[0] as TSessionSnapshot;

      expect(firstSnapshot).toBeDefined();
      expect(firstSnapshot).toHaveProperty('connection');
      expect(firstSnapshot).toHaveProperty('call');
      expect(firstSnapshot).toHaveProperty('incoming');
      expect(firstSnapshot).toHaveProperty('presentation');
      expect(sessionSelectors.selectConnectionStatus(firstSnapshot)).toBe(
        EConnectionStatus.PREPARING,
      );

      // Change call state
      callStateMachine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });
      expect(callback).toHaveBeenCalledTimes(2);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const secondSnapshot = callback.mock.calls[1]?.[0] as TSessionSnapshot;

      expect(secondSnapshot).toBeDefined();
      expect(sessionSelectors.selectCallStatus(secondSnapshot)).toBe(ECallStatus.CONNECTING);

      // Change incoming state
      incomingStateMachine.send({
        type: EIncomingCallStateMachineEvents.RINGING,
        data: { incomingNumber: '101', displayName: 'Test Caller', host: 'test.com', rtcSession },
      });
      expect(callback).toHaveBeenCalledTimes(3);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const thirdSnapshot = callback.mock.calls[2]?.[0] as TSessionSnapshot;

      expect(thirdSnapshot).toBeDefined();
      expect(sessionSelectors.selectIncomingStatus(thirdSnapshot)).toBe(EIncomingStatus.RINGING);

      // Change presentation state
      presentationStateMachine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      expect(callback).toHaveBeenCalledTimes(4);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const fourthSnapshot = callback.mock.calls[3]?.[0] as TSessionSnapshot;

      expect(fourthSnapshot).toBeDefined();
      expect(sessionSelectors.selectPresentationStatus(fourthSnapshot)).toBe(
        EPresentationStatus.STARTING,
      );

      // Unsubscribe and verify no more calls
      unsubscribe();
      callStateMachine.send({
        type: 'CALL.ENTER_ROOM',
        room: 'room',
        participantName: 'participantName',
      });
      callStateMachine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: 'token',
        conferenceForToken: 'room',
        participantName: 'participantName',
      });
      expect(callback).toHaveBeenCalledTimes(4);

      stopAll();
    });

    it('does not notify full-snapshot subscriber for identical snapshots with default equals', () => {
      const { session, incomingStateMachine, stopAll } = startSession();
      const callback = jest.fn();
      const remoteCallerData = {
        incomingNumber: '101',
        displayName: 'Test Caller',
        host: 'test.com',
        rtcSession,
      };

      const unsubscribe = session.subscribe(callback);

      incomingStateMachine.send({
        type: EIncomingCallStateMachineEvents.RINGING,
        data: remoteCallerData,
      });
      expect(callback).toHaveBeenCalledTimes(1);

      incomingStateMachine.send({
        type: EIncomingCallStateMachineEvents.RINGING,
        data: remoteCallerData,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      unsubscribe();
      stopAll();
    });

    it('keeps system status CALL_ACTIVE when connection becomes disconnected while in call', () => {
      const { session, connectionStateMachine, callStateMachine, stopAll } = startSession();

      connectionStateMachine.send({ type: EConnectionStateMachineEvents.START_CONNECT });
      connectionStateMachine.send({
        type: EConnectionStateMachineEvents.START_UA,
        configuration: {
          displayName: 'Test User',
          authorizationUser: 'testuser',
          register: false,
          sipServerIp: 'test.com',
          sipServerUrl: 'test.com',
        },
      });
      connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_CONNECTED });
      connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_REGISTERED });

      callStateMachine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });
      callStateMachine.send({
        type: 'CALL.ENTER_ROOM',
        room: 'room',
        participantName: 'participantName',
      });
      callStateMachine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: 'token',
        conferenceForToken: 'room',
        participantName: 'participantName',
      });

      expect(sessionSelectors.selectSystemStatus(session.getSnapshot())).toBe(
        ESystemStatus.CALL_ACTIVE,
      );
      expect(sessionSelectors.selectCallStatus(session.getSnapshot())).toBe(ECallStatus.IN_ROOM);

      connectionStateMachine.send({ type: EConnectionStateMachineEvents.UA_DISCONNECTED });

      expect(sessionSelectors.selectConnectionStatus(session.getSnapshot())).toBe(
        EConnectionStatus.DISCONNECTED,
      );
      expect(sessionSelectors.selectSystemStatus(session.getSnapshot())).toBe(
        ESystemStatus.CALL_ACTIVE,
      );

      stopAll();
    });

    it('does not notify subscriber when equals returns true (else path)', () => {
      const { session, callStateMachine, stopAll } = startSession();
      const onCallStatus = jest.fn();

      // Custom equals function that always returns true (values are considered equal)
      // This covers the else path on line 69 where equals returns true
      const alwaysEqual = jest.fn(() => {
        return true;
      });

      const unsubscribe = session.subscribe(
        sessionSelectors.selectCallStatus,
        onCallStatus,
        alwaysEqual,
      );

      // Initial state should be IDLE
      expect(sessionSelectors.selectCallStatus(session.getSnapshot())).toBe(ECallStatus.IDLE);

      // Change call state - equals will return true, so listener should NOT be called
      callStateMachine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });

      // equals should be called with previous (IDLE) and next (CONNECTING) values
      expect(alwaysEqual).toHaveBeenCalledWith(ECallStatus.IDLE, ECallStatus.CONNECTING);
      // But listener should NOT be called because equals returned true (else path)
      expect(onCallStatus).not.toHaveBeenCalled();

      // Change state again to verify equals is called but listener still not called
      callStateMachine.send({
        type: 'CALL.ENTER_ROOM',
        room: 'room',
        participantName: 'participantName',
      });
      callStateMachine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: 'token',
        conferenceForToken: 'room',
        participantName: 'participantName',
      });
      expect(alwaysEqual).toHaveBeenCalledTimes(3);
      expect(onCallStatus).not.toHaveBeenCalled();

      unsubscribe();
      stopAll();
    });
  });

  describe('events', () => {
    it('triggers snapshot-changed event when snapshot changes', () => {
      const { session, callStateMachine, stopAll } = startSession();

      const onCallStatus = jest.fn();

      // Custom equals function that always returns true (values are considered equal)
      // This covers the else path on line 69 where equals returns true
      const alwaysEqual = jest.fn(() => {
        return true;
      });

      const unsubscribe = session.subscribe(
        sessionSelectors.selectCallStatus,
        onCallStatus,
        alwaysEqual,
      );

      // Initial state should be IDLE
      expect(sessionSelectors.selectCallStatus(session.getSnapshot())).toBe(ECallStatus.IDLE);

      // Change call state - equals will return true, so listener should NOT be called
      callStateMachine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });

      // equals should be called with previous (IDLE) and next (CONNECTING) values
      expect(alwaysEqual).toHaveBeenCalledWith(ECallStatus.IDLE, ECallStatus.CONNECTING);
      // But listener should NOT be called because equals returned true (else path)
      expect(onCallStatus).not.toHaveBeenCalled();

      // Change state again to verify equals is called but listener still not called
      callStateMachine.send({
        type: 'CALL.ENTER_ROOM',
        room: 'room',
        participantName: 'participantName',
      });
      callStateMachine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: 'token',
        conferenceForToken: 'room',
        participantName: 'participantName',
      });
      expect(alwaysEqual).toHaveBeenCalledTimes(3);
      expect(onCallStatus).not.toHaveBeenCalled();
      unsubscribe();
      stopAll();
    });

    it('off removes event handler', () => {
      const { session, callStateMachine, stopAll } = startSession();
      const handler = jest.fn();

      session.on('snapshot-changed', handler);

      callStateMachine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });
      expect(handler).toHaveBeenCalledTimes(1);

      session.off('snapshot-changed', handler);

      callStateMachine.send({
        type: 'CALL.ENTER_ROOM',
        room: 'room',
        participantName: 'participantName',
      });
      callStateMachine.send({
        type: 'CALL.TOKEN_ISSUED',
        token: 'token',
        conferenceForToken: 'room',
        participantName: 'participantName',
      });
      expect(handler).toHaveBeenCalledTimes(1);
      stopAll();
    });

    it('does not trigger snapshot-changed when only snapshot context changes', () => {
      const { session, incomingStateMachine, stopAll } = startSession();
      const handler = jest.fn();

      session.on('snapshot-changed', handler);

      incomingStateMachine.send({
        type: EIncomingCallStateMachineEvents.RINGING,
        data: { incomingNumber: '101', displayName: 'Test Caller', host: 'test.com', rtcSession },
      });
      expect(handler).toHaveBeenCalledTimes(1);

      incomingStateMachine.send({
        type: EIncomingCallStateMachineEvents.RINGING,
        data: {
          incomingNumber: '202',
          displayName: 'Another Caller',
          host: 'test.com',
          rtcSession,
        },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      stopAll();
    });

    it('trigger snapshot-changed when snapshot context changes', () => {
      const { session, callStateMachine, stopAll } = startSession();

      callStateMachine.send({ type: 'CALL.CONNECTING', number: '100', answer: false });

      callStateMachine.send({
        type: 'CALL.ENTER_ROOM',
        room: 'room-1',
        participantName: 'participantName',
      });

      const handler = jest.fn();

      session.on('snapshot-changed', handler);

      expect(handler).toHaveBeenCalledTimes(0);

      callStateMachine.send({
        type: 'CALL.ENTER_ROOM',
        room: 'room-2',
        participantName: 'participantName',
      });

      expect(handler).toHaveBeenCalledTimes(1);

      stopAll();
    });

    it('provides access to actors', () => {
      const { session, stopAll } = startSession();

      expect(session.machines).toBeDefined();
      expect(session.machines.connection).toBeDefined();
      expect(session.machines.call).toBeDefined();
      expect(session.machines.incoming).toBeDefined();
      expect(session.machines.presentation).toBeDefined();
      expect(session.machines.autoConnector).toBeDefined();

      stopAll();
    });
  });
});
