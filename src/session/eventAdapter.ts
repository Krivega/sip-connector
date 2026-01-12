// import type { TypedEvents } from 'events-constructor';
import type { TEvents as TCallEvents } from '@/CallManager/eventNames';
import type { TEvents as TConnectionEvents } from '@/ConnectionManager/eventNames';
import type {
  TEvents as TIncomingEvents,
  TRemoteCallerData,
} from '@/IncomingCallManager/eventNames';
import type { TSessionActor } from './rootMachine';

export type TSessionEventAdapterDeps = {
  connectionEvents: TConnectionEvents;
  callEvents: TCallEvents;
  incomingCallEvents: TIncomingEvents;
};

export const attachSessionEventAdapter = (
  actor: TSessionActor,
  deps: TSessionEventAdapterDeps,
): (() => void) => {
  const subscriptions: (() => void)[] = [];
  let hasIncomingCall = false;

  const consumeIncoming = () => {
    if (hasIncomingCall) {
      actor.send({ type: 'INCOMING.CONSUMED' });
      hasIncomingCall = false;
    }
  };

  const clearIncoming = () => {
    actor.send({ type: 'INCOMING.CLEAR' });
    hasIncomingCall = false;
  };

  // Connection events
  const connectionEmitter = deps.connectionEvents;
  const callEmitter = deps.callEvents;
  const incomingEmitter = deps.incomingCallEvents;

  subscriptions.push(
    connectionEmitter.on('connect-started', () => {
      actor.send({ type: 'CONNECTION.START' });
    }),
  );
  subscriptions.push(
    connectionEmitter.on('connecting', () => {
      actor.send({ type: 'CONNECTION.START' });
    }),
  );
  subscriptions.push(
    connectionEmitter.on('connect-parameters-resolve-success', () => {
      actor.send({ type: 'CONNECTION.INIT' });
    }),
  );
  subscriptions.push(
    connectionEmitter.on('connected', () => {
      actor.send({ type: 'CONNECTION.CONNECTED' });
    }),
  );
  subscriptions.push(
    connectionEmitter.on('registered', () => {
      actor.send({ type: 'CONNECTION.REGISTERED' });
    }),
  );
  subscriptions.push(
    connectionEmitter.on('unregistered', () => {
      actor.send({ type: 'CONNECTION.UNREGISTERED' });
    }),
  );
  subscriptions.push(
    connectionEmitter.on('disconnected', () => {
      actor.send({ type: 'CONNECTION.DISCONNECTED' });
      actor.send({ type: 'CALL.ENDED' });
      actor.send({ type: 'SCREEN.ENDED' });
      actor.send({ type: 'INCOMING.CLEAR' });
      hasIncomingCall = false;
    }),
  );
  subscriptions.push(
    connectionEmitter.on('registrationFailed', (error) => {
      actor.send({ type: 'CONNECTION.FAILED', error });
      actor.send({ type: 'CALL.ENDED' });
      actor.send({ type: 'SCREEN.ENDED' });
      actor.send({ type: 'INCOMING.CLEAR' });
      hasIncomingCall = false;
    }),
  );
  subscriptions.push(
    connectionEmitter.on('connect-failed', (error) => {
      actor.send({ type: 'CONNECTION.FAILED', error });
      actor.send({ type: 'CALL.ENDED' });
      actor.send({ type: 'SCREEN.ENDED' });
      actor.send({ type: 'INCOMING.CLEAR' });
      hasIncomingCall = false;
    }),
  );

  // Call events
  subscriptions.push(
    callEmitter.on('connecting', () => {
      actor.send({ type: 'CALL.CONNECTING' });
    }),
  );
  subscriptions.push(
    callEmitter.on('progress', () => {
      actor.send({ type: 'CALL.RINGING' });
    }),
  );
  subscriptions.push(
    callEmitter.on('accepted', () => {
      actor.send({ type: 'CALL.ACCEPTED' });
      consumeIncoming();
    }),
  );
  subscriptions.push(
    callEmitter.on('confirmed', () => {
      actor.send({ type: 'CALL.CONFIRMED' });
      consumeIncoming();
    }),
  );
  subscriptions.push(
    callEmitter.on('ended', () => {
      actor.send({ type: 'CALL.ENDED' });
      clearIncoming();
      actor.send({ type: 'SCREEN.ENDED' });
    }),
  );
  subscriptions.push(
    callEmitter.on('failed', (error) => {
      actor.send({ type: 'CALL.FAILED', error });
      clearIncoming();
      actor.send({ type: 'SCREEN.FAILED', error });
    }),
  );

  // Screen share (presentation) events
  subscriptions.push(
    callEmitter.on('presentation:start', () => {
      actor.send({ type: 'SCREEN.STARTING' });
    }),
  );
  subscriptions.push(
    callEmitter.on('presentation:started', () => {
      actor.send({ type: 'SCREEN.STARTED' });
    }),
  );
  subscriptions.push(
    callEmitter.on('presentation:end', () => {
      actor.send({ type: 'SCREEN.ENDING' });
    }),
  );
  subscriptions.push(
    callEmitter.on('presentation:ended', () => {
      actor.send({ type: 'SCREEN.ENDED' });
    }),
  );
  subscriptions.push(
    callEmitter.on('presentation:failed', (error) => {
      actor.send({ type: 'SCREEN.FAILED', error });
    }),
  );

  // Incoming call events
  subscriptions.push(
    incomingEmitter.on('incomingCall', (data: TRemoteCallerData) => {
      hasIncomingCall = true;
      actor.send({ type: 'INCOMING.RINGING', data });
    }),
  );
  subscriptions.push(
    incomingEmitter.on('declinedIncomingCall', (data: TRemoteCallerData) => {
      hasIncomingCall = false;
      actor.send({ type: 'INCOMING.DECLINED', data });
    }),
  );
  subscriptions.push(
    incomingEmitter.on('terminatedIncomingCall', (data: TRemoteCallerData) => {
      hasIncomingCall = false;
      actor.send({ type: 'INCOMING.TERMINATED', data });
    }),
  );
  subscriptions.push(
    incomingEmitter.on('failedIncomingCall', (data: TRemoteCallerData) => {
      hasIncomingCall = false;
      actor.send({ type: 'INCOMING.FAILED', data });
    }),
  );

  return () => {
    subscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
  };
};
