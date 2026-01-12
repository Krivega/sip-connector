import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { IncomingCallManager, TRemoteCallerData } from '@/IncomingCallManager';
import type { TSessionActor } from './rootMachine';

export type TSessionEventAdapterDeps = {
  connectionManager: ConnectionManager;
  callManager: CallManager;
  incomingCallManager: IncomingCallManager;
};

export const attachSessionEventAdapter = (
  actor: TSessionActor,
  deps: TSessionEventAdapterDeps,
): (() => void) => {
  const { callManager, connectionManager, incomingCallManager } = deps;
  const subscriptions: (() => void)[] = [];

  const consumeIncoming = () => {
    if (incomingCallManager.isAvailableIncomingCall) {
      actor.send({ type: 'INCOMING.CONSUMED' });
    }
  };

  const clearIncoming = () => {
    actor.send({ type: 'INCOMING.CLEAR' });
  };

  subscriptions.push(
    connectionManager.on('connect-started', () => {
      actor.send({ type: 'CONNECTION.START' });
    }),
  );
  subscriptions.push(
    connectionManager.on('connecting', () => {
      actor.send({ type: 'CONNECTION.START' });
    }),
  );
  subscriptions.push(
    connectionManager.on('connect-parameters-resolve-success', () => {
      actor.send({ type: 'CONNECTION.INIT' });
    }),
  );
  subscriptions.push(
    connectionManager.on('connected', () => {
      actor.send({ type: 'CONNECTION.CONNECTED' });
    }),
  );
  subscriptions.push(
    connectionManager.on('registered', () => {
      actor.send({ type: 'CONNECTION.REGISTERED' });
    }),
  );
  subscriptions.push(
    connectionManager.on('unregistered', () => {
      actor.send({ type: 'CONNECTION.UNREGISTERED' });
    }),
  );
  subscriptions.push(
    connectionManager.on('disconnected', () => {
      actor.send({ type: 'CONNECTION.DISCONNECTED' });
      actor.send({ type: 'CALL.ENDED' });
      actor.send({ type: 'SCREEN.ENDED' });
      actor.send({ type: 'INCOMING.CLEAR' });
    }),
  );
  subscriptions.push(
    connectionManager.on('registrationFailed', (error) => {
      actor.send({ type: 'CONNECTION.FAILED', error });
      actor.send({ type: 'CALL.ENDED' });
      actor.send({ type: 'SCREEN.ENDED' });
      actor.send({ type: 'INCOMING.CLEAR' });
    }),
  );
  subscriptions.push(
    connectionManager.on('connect-failed', (error) => {
      actor.send({ type: 'CONNECTION.FAILED', error });
      actor.send({ type: 'CALL.ENDED' });
      actor.send({ type: 'SCREEN.ENDED' });
      actor.send({ type: 'INCOMING.CLEAR' });
    }),
  );

  // Call events
  subscriptions.push(
    callManager.on('connecting', () => {
      actor.send({ type: 'CALL.CONNECTING' });
    }),
  );
  subscriptions.push(
    callManager.on('progress', () => {
      actor.send({ type: 'CALL.RINGING' });
    }),
  );
  subscriptions.push(
    callManager.on('accepted', () => {
      actor.send({ type: 'CALL.ACCEPTED' });
      consumeIncoming();
    }),
  );
  subscriptions.push(
    callManager.on('confirmed', () => {
      actor.send({ type: 'CALL.CONFIRMED' });
      consumeIncoming();
    }),
  );
  subscriptions.push(
    callManager.on('ended', () => {
      actor.send({ type: 'CALL.ENDED' });
      clearIncoming();
      actor.send({ type: 'SCREEN.ENDED' });
    }),
  );
  subscriptions.push(
    callManager.on('failed', (error) => {
      actor.send({ type: 'CALL.FAILED', error });
      clearIncoming();
      actor.send({ type: 'SCREEN.FAILED', error });
    }),
  );

  // Screen share (presentation) events
  subscriptions.push(
    callManager.on('presentation:start', () => {
      actor.send({ type: 'SCREEN.STARTING' });
    }),
  );
  subscriptions.push(
    callManager.on('presentation:started', () => {
      actor.send({ type: 'SCREEN.STARTED' });
    }),
  );
  subscriptions.push(
    callManager.on('presentation:end', () => {
      actor.send({ type: 'SCREEN.ENDING' });
    }),
  );
  subscriptions.push(
    callManager.on('presentation:ended', () => {
      actor.send({ type: 'SCREEN.ENDED' });
    }),
  );
  subscriptions.push(
    callManager.on('presentation:failed', (error) => {
      actor.send({ type: 'SCREEN.FAILED', error });
    }),
  );

  // Incoming call events
  subscriptions.push(
    incomingCallManager.on('incomingCall', (data: TRemoteCallerData) => {
      actor.send({ type: 'INCOMING.RINGING', data });
    }),
  );
  subscriptions.push(
    incomingCallManager.on('declinedIncomingCall', (data: TRemoteCallerData) => {
      actor.send({ type: 'INCOMING.DECLINED', data });
    }),
  );
  subscriptions.push(
    incomingCallManager.on('terminatedIncomingCall', (data: TRemoteCallerData) => {
      actor.send({ type: 'INCOMING.TERMINATED', data });
    }),
  );
  subscriptions.push(
    incomingCallManager.on('failedIncomingCall', (data: TRemoteCallerData) => {
      actor.send({ type: 'INCOMING.FAILED', data });
    }),
  );

  return () => {
    subscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
  };
};
