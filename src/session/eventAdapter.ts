import type { TEvents as TCallEvents, TEventMap as TCallEventMap } from '@/CallManager/eventNames';
import type {
  TEvents as TConnectionEvents,
  TEventMap as TConnectionEventMap,
} from '@/ConnectionManager/eventNames';
import type {
  TEvents as TIncomingEvents,
  TEventMap as TIncomingEventMap,
  TRemoteCallerData,
} from '@/IncomingCallManager/eventNames';
import type { TSipSessionActor } from './rootMachine';

export type TSessionEventAdapterDeps = {
  connectionEvents: TConnectionEvents;
  callEvents: TCallEvents;
  incomingCallEvents: TIncomingEvents;
};

type Unsubscribe = () => void;

type EventEmitter<TEventMap> = {
  on: <K extends keyof TEventMap>(eventName: K, handler: (data: TEventMap[K]) => void) => void;
  off: <K extends keyof TEventMap>(eventName: K, handler: (data: TEventMap[K]) => void) => void;
};

const subscribe = <TEventMap, K extends keyof TEventMap>(
  emitter: EventEmitter<TEventMap>,
  eventName: K,
  handler: (data: TEventMap[K]) => void,
  subscriptions: Unsubscribe[],
  // eslint-disable-next-line @typescript-eslint/max-params
) => {
  emitter.on(eventName, handler);
  subscriptions.push(() => {
    emitter.off(eventName, handler);
  });
};

export const attachSessionEventAdapter = (
  actor: TSipSessionActor,
  deps: TSessionEventAdapterDeps,
): (() => void) => {
  const subscriptions: Unsubscribe[] = [];
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
  const connectionEmitter = deps.connectionEvents as unknown as EventEmitter<TConnectionEventMap>;
  const callEmitter = deps.callEvents as unknown as EventEmitter<TCallEventMap>;
  const incomingEmitter = deps.incomingCallEvents as unknown as EventEmitter<TIncomingEventMap>;

  subscribe(
    connectionEmitter,
    'connect-started',
    () => {
      actor.send({ type: 'CONNECTION.START' });
    },
    subscriptions,
  );
  subscribe(
    connectionEmitter,
    'connecting',
    () => {
      actor.send({ type: 'CONNECTION.START' });
    },
    subscriptions,
  );
  subscribe(
    connectionEmitter,
    'connect-parameters-resolve-success',
    () => {
      actor.send({ type: 'CONNECTION.INIT' });
    },
    subscriptions,
  );
  subscribe(
    connectionEmitter,
    'connected',
    () => {
      actor.send({ type: 'CONNECTION.CONNECTED' });
    },
    subscriptions,
  );
  subscribe(
    connectionEmitter,
    'registered',
    () => {
      actor.send({ type: 'CONNECTION.REGISTERED' });
    },
    subscriptions,
  );
  subscribe(
    connectionEmitter,
    'unregistered',
    () => {
      actor.send({ type: 'CONNECTION.UNREGISTERED' });
    },
    subscriptions,
  );
  subscribe(
    connectionEmitter,
    'disconnected',
    () => {
      actor.send({ type: 'CONNECTION.DISCONNECTED' });
      actor.send({ type: 'CALL.ENDED' });
      actor.send({ type: 'SCREEN.ENDED' });
      actor.send({ type: 'INCOMING.CLEAR' });
      hasIncomingCall = false;
    },
    subscriptions,
  );
  subscribe(
    connectionEmitter,
    'registrationFailed',
    (error) => {
      actor.send({ type: 'CONNECTION.FAILED', error });
      actor.send({ type: 'CALL.ENDED' });
      actor.send({ type: 'SCREEN.ENDED' });
      actor.send({ type: 'INCOMING.CLEAR' });
      hasIncomingCall = false;
    },
    subscriptions,
  );
  subscribe(
    connectionEmitter,
    'connect-failed',
    (error) => {
      actor.send({ type: 'CONNECTION.FAILED', error });
      actor.send({ type: 'CALL.ENDED' });
      actor.send({ type: 'SCREEN.ENDED' });
      actor.send({ type: 'INCOMING.CLEAR' });
      hasIncomingCall = false;
    },
    subscriptions,
  );

  // Call events
  subscribe(
    callEmitter,
    'connecting',
    () => {
      actor.send({ type: 'CALL.CONNECTING' });
    },
    subscriptions,
  );
  subscribe(
    callEmitter,
    'progress',
    () => {
      actor.send({ type: 'CALL.RINGING' });
    },
    subscriptions,
  );
  subscribe(
    callEmitter,
    'accepted',
    () => {
      actor.send({ type: 'CALL.ACCEPTED' });
      consumeIncoming();
    },
    subscriptions,
  );
  subscribe(
    callEmitter,
    'confirmed',
    () => {
      actor.send({ type: 'CALL.CONFIRMED' });
      consumeIncoming();
    },
    subscriptions,
  );
  subscribe(
    callEmitter,
    'ended',
    () => {
      actor.send({ type: 'CALL.ENDED' });
      clearIncoming();
      actor.send({ type: 'SCREEN.ENDED' });
    },
    subscriptions,
  );
  subscribe(
    callEmitter,
    'failed',
    (error) => {
      actor.send({ type: 'CALL.FAILED', error });
      clearIncoming();
      actor.send({ type: 'SCREEN.FAILED', error });
    },
    subscriptions,
  );

  // Screen share (presentation) events
  subscribe(
    callEmitter,
    'presentation:start',
    () => {
      actor.send({ type: 'SCREEN.STARTING' });
    },
    subscriptions,
  );
  subscribe(
    callEmitter,
    'presentation:started',
    () => {
      actor.send({ type: 'SCREEN.STARTED' });
    },
    subscriptions,
  );
  subscribe(
    callEmitter,
    'presentation:end',
    () => {
      actor.send({ type: 'SCREEN.ENDING' });
    },
    subscriptions,
  );
  subscribe(
    callEmitter,
    'presentation:ended',
    () => {
      actor.send({ type: 'SCREEN.ENDED' });
    },
    subscriptions,
  );
  subscribe(
    callEmitter,
    'presentation:failed',
    (error) => {
      actor.send({ type: 'SCREEN.FAILED', error });
    },
    subscriptions,
  );

  // Incoming call events
  subscribe(
    incomingEmitter,
    'incomingCall',
    (data: TRemoteCallerData) => {
      hasIncomingCall = true;
      actor.send({ type: 'INCOMING.RINGING', data });
    },
    subscriptions,
  );
  subscribe(
    incomingEmitter,
    'declinedIncomingCall',
    (data: TRemoteCallerData) => {
      hasIncomingCall = false;
      actor.send({ type: 'INCOMING.DECLINED', data });
    },
    subscriptions,
  );
  subscribe(
    incomingEmitter,
    'terminatedIncomingCall',
    (data: TRemoteCallerData) => {
      hasIncomingCall = false;
      actor.send({ type: 'INCOMING.TERMINATED', data });
    },
    subscriptions,
  );
  subscribe(
    incomingEmitter,
    'failedIncomingCall',
    (data: TRemoteCallerData) => {
      hasIncomingCall = false;
      actor.send({ type: 'INCOMING.FAILED', data });
    },
    subscriptions,
  );

  return () => {
    subscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
  };
};
