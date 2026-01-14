import { createEvents as createCallEvents } from '@/CallManager';
import { CallStateMachine, EState as ECallStatus } from '@/CallManager/CallStateMachine';
import { createEvents as createConnectionEvents } from '@/ConnectionManager';
import ConnectionStateMachine, {
  EState as EConnectionStatus,
  EEvents as EConnectionEvents,
} from '@/ConnectionManager/ConnectionStateMachine';
import { createEvents as createIncomingEvents } from '@/IncomingCallManager';
import {
  IncomingCallStateMachine,
  EState as EIncomingStatus,
} from '@/IncomingCallManager/IncomingCallStateMachine';
import {
  PresentationStateMachine,
  EState as EPresentationStatus,
} from '@/PresentationManager/PresentationStateMachine';
import SessionManager from '../@SessionManager';
import { sessionSelectors } from '../selectors';

import type { TSessionSnapshot } from '../types';

const startSession = () => {
  const connectionEvents = createConnectionEvents();
  const callEvents = createCallEvents();
  const incomingEvents = createIncomingEvents();

  const connectionStateMachine = new ConnectionStateMachine(connectionEvents);
  const callStateMachine = new CallStateMachine(callEvents);
  const incomingStateMachine = new IncomingCallStateMachine({
    incomingEvents,
    connectionEvents,
  });
  const presentationStateMachine = new PresentationStateMachine(callEvents);

  const session = new SessionManager({
    connectionManager: { connectionActor: connectionStateMachine.actorRef },
    callManager: { callActor: callStateMachine.actorRef },
    incomingCallManager: { incomingActor: incomingStateMachine.actorRef },
    presentationManager: { presentationActor: presentationStateMachine.actorRef },
  });

  const stopAll = () => {
    session.stop();
    connectionStateMachine.stop();
    callStateMachine.stop();
    incomingStateMachine.stop();
    presentationStateMachine.stop();
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

describe('SessionManager', () => {
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

      connectionStateMachine.send({ type: EConnectionEvents.START_CONNECT });
      expect(sessionSelectors.selectConnectionStatus(session.getSnapshot())).toBe(
        EConnectionStatus.PREPARING,
      );

      connectionStateMachine.send({ type: EConnectionEvents.START_INIT_UA });
      connectionStateMachine.send({ type: EConnectionEvents.UA_CONNECTED });
      connectionStateMachine.send({ type: EConnectionEvents.UA_REGISTERED });
      connectionStateMachine.send({ type: EConnectionEvents.UA_CONNECTED });
      connectionStateMachine.send({ type: EConnectionEvents.UA_REGISTERED });
      expect(sessionSelectors.selectConnectionStatus(session.getSnapshot())).toBe(
        EConnectionStatus.REGISTERED,
      );

      callStateMachine.send({ type: 'CALL.CONNECTING' });
      expect(sessionSelectors.selectCallStatus(session.getSnapshot())).toBe(ECallStatus.CONNECTING);

      callStateMachine.send({ type: 'CALL.ACCEPTED' });
      callStateMachine.send({ type: 'CALL.CONFIRMED' });
      expect(sessionSelectors.selectCallStatus(session.getSnapshot())).toBe(ECallStatus.IN_CALL);

      incomingStateMachine.send({
        type: 'INCOMING.RINGING',
        data: { incomingNumber: '101' },
      });
      expect(sessionSelectors.selectIncomingStatus(session.getSnapshot())).toBe(
        EIncomingStatus.RINGING,
      );
      expect(sessionSelectors.selectIncomingRemoteCaller(session.getSnapshot())).toEqual(
        expect.objectContaining({ incomingNumber: '101' }),
      );

      incomingStateMachine.send({ type: 'INCOMING.CONSUMED' });
      expect(sessionSelectors.selectIncomingStatus(session.getSnapshot())).toBe(
        EIncomingStatus.CONSUMED,
      );

      presentationStateMachine.send({ type: 'SCREEN.STARTING' });
      presentationStateMachine.send({ type: 'SCREEN.STARTED' });
      expect(sessionSelectors.selectPresentationStatus(session.getSnapshot())).toBe(
        EPresentationStatus.ACTIVE,
      );

      presentationStateMachine.send({ type: 'SCREEN.ENDED' });
      expect(sessionSelectors.selectPresentationStatus(session.getSnapshot())).toBe(
        EPresentationStatus.IDLE,
      );

      stopAll();
    });

    it('notifies subscribers only when selected slice changes', () => {
      const { session, callStateMachine, stopAll } = startSession();
      const onCallStatus = jest.fn();

      const unsubscribe = session.subscribe(sessionSelectors.selectCallStatus, onCallStatus);

      callStateMachine.send({ type: 'CALL.CONNECTING' });
      callStateMachine.send({ type: 'CALL.CONNECTING' }); // duplicate should be ignored by equals

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
      connectionStateMachine.send({ type: EConnectionEvents.START_CONNECT });
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
      callStateMachine.send({ type: 'CALL.CONNECTING' });
      expect(callback).toHaveBeenCalledTimes(2);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const secondSnapshot = callback.mock.calls[1]?.[0] as TSessionSnapshot;

      expect(secondSnapshot).toBeDefined();
      expect(sessionSelectors.selectCallStatus(secondSnapshot)).toBe(ECallStatus.CONNECTING);

      // Change incoming state
      incomingStateMachine.send({
        type: 'INCOMING.RINGING',
        data: { incomingNumber: '101' },
      });
      expect(callback).toHaveBeenCalledTimes(3);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const thirdSnapshot = callback.mock.calls[2]?.[0] as TSessionSnapshot;

      expect(thirdSnapshot).toBeDefined();
      expect(sessionSelectors.selectIncomingStatus(thirdSnapshot)).toBe(EIncomingStatus.RINGING);

      // Change presentation state
      presentationStateMachine.send({ type: 'SCREEN.STARTING' });
      expect(callback).toHaveBeenCalledTimes(4);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const fourthSnapshot = callback.mock.calls[3]?.[0] as TSessionSnapshot;

      expect(fourthSnapshot).toBeDefined();
      expect(sessionSelectors.selectPresentationStatus(fourthSnapshot)).toBe(
        EPresentationStatus.STARTING,
      );

      // Unsubscribe and verify no more calls
      unsubscribe();
      callStateMachine.send({ type: 'CALL.ACCEPTED' });
      expect(callback).toHaveBeenCalledTimes(4);

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
      callStateMachine.send({ type: 'CALL.CONNECTING' });

      // equals should be called with previous (IDLE) and next (CONNECTING) values
      expect(alwaysEqual).toHaveBeenCalledWith(ECallStatus.IDLE, ECallStatus.CONNECTING);
      // But listener should NOT be called because equals returned true (else path)
      expect(onCallStatus).not.toHaveBeenCalled();

      // Change state again to verify equals is called but listener still not called
      callStateMachine.send({ type: 'CALL.ACCEPTED' });
      expect(alwaysEqual).toHaveBeenCalledTimes(2);
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
      callStateMachine.send({ type: 'CALL.CONNECTING' });

      // equals should be called with previous (IDLE) and next (CONNECTING) values
      expect(alwaysEqual).toHaveBeenCalledWith(ECallStatus.IDLE, ECallStatus.CONNECTING);
      // But listener should NOT be called because equals returned true (else path)
      expect(onCallStatus).not.toHaveBeenCalled();

      // Change state again to verify equals is called but listener still not called
      callStateMachine.send({ type: 'CALL.ACCEPTED' });
      expect(alwaysEqual).toHaveBeenCalledTimes(2);
      expect(onCallStatus).not.toHaveBeenCalled();
      unsubscribe();
      stopAll();
    });

    it('off removes event handler', () => {
      const { session, callStateMachine, stopAll } = startSession();
      const handler = jest.fn();

      session.on('snapshot-changed', handler);

      callStateMachine.send({ type: 'CALL.CONNECTING' });
      expect(handler).toHaveBeenCalledTimes(1);

      session.off('snapshot-changed', handler);

      callStateMachine.send({ type: 'CALL.ACCEPTED' });
      expect(handler).toHaveBeenCalledTimes(1);
      stopAll();
    });

    it('provides access to actors', () => {
      const { session, stopAll } = startSession();

      expect(session.actors).toBeDefined();
      expect(session.actors.connection).toBeDefined();
      expect(session.actors.call).toBeDefined();
      expect(session.actors.incoming).toBeDefined();
      expect(session.actors.presentation).toBeDefined();

      stopAll();
    });
  });
});
