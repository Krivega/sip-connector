import { TypedEvents } from 'events-constructor';
import { createActor } from 'xstate';

import {
  EVENT_NAMES as CALL_EVENT_NAMES,
  type TEventMap as TCallEventMap,
} from '@/CallManager/eventNames';
import {
  EVENT_NAMES as CONNECTION_EVENT_NAMES,
  type TEventMap as TConnectionEventMap,
} from '@/ConnectionManager/eventNames';
import {
  EVENT_NAMES as INCOMING_EVENT_NAMES,
  type TEventMap as TIncomingEventMap,
} from '@/IncomingCallManager/eventNames';
import { attachSessionEventAdapter } from '../eventAdapter';
import { ECallStatus, EConnectionStatus, EIncomingStatus, EScreenShareStatus } from '../machines';
import { sessionMachine } from '../rootMachine';
import { sessionSelectors } from '../selectors';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { IncomingCallManager } from '@/IncomingCallManager';

describe('sessionMachine', () => {
  it('handles direct domain events', () => {
    const actor = createActor(sessionMachine);

    actor.start();

    actor.send({ type: 'CONNECTION.START' });
    expect(sessionSelectors.selectConnectionStatus(actor.getSnapshot())).toBe(
      EConnectionStatus.CONNECTING,
    );

    actor.send({ type: 'CONNECTION.INIT' });
    expect(sessionSelectors.selectConnectionStatus(actor.getSnapshot())).toBe(
      EConnectionStatus.INITIALIZING,
    );

    actor.send({ type: 'CONNECTION.CONNECTED' });
    expect(sessionSelectors.selectConnectionStatus(actor.getSnapshot())).toBe(
      EConnectionStatus.CONNECTED,
    );

    actor.send({ type: 'CONNECTION.REGISTERED' });
    expect(sessionSelectors.selectConnectionStatus(actor.getSnapshot())).toBe(
      EConnectionStatus.REGISTERED,
    );

    actor.send({ type: 'CALL.CONNECTING' });
    expect(sessionSelectors.selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.CONNECTING);

    actor.send({ type: 'CALL.RINGING' });
    expect(sessionSelectors.selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.RINGING);

    actor.send({ type: 'CALL.ACCEPTED' });
    actor.send({ type: 'CALL.CONFIRMED' });
    expect(sessionSelectors.selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.IN_CALL);

    actor.send({ type: 'INCOMING.RINGING', data: {} as TIncomingEventMap['incomingCall'] });
    expect(sessionSelectors.selectIncomingStatus(actor.getSnapshot())).toBe(
      EIncomingStatus.RINGING,
    );

    actor.send({ type: 'INCOMING.CONSUMED' });
    expect(sessionSelectors.selectIncomingStatus(actor.getSnapshot())).toBe(
      EIncomingStatus.CONSUMED,
    );

    actor.send({ type: 'SCREEN.STARTING' });
    expect(sessionSelectors.selectScreenShareStatus(actor.getSnapshot())).toBe(
      EScreenShareStatus.STARTING,
    );
    actor.send({ type: 'SCREEN.STARTED' });
    expect(sessionSelectors.selectScreenShareStatus(actor.getSnapshot())).toBe(
      EScreenShareStatus.ACTIVE,
    );
    actor.send({ type: 'SCREEN.ENDING' });
    actor.send({ type: 'SCREEN.ENDED' });
    expect(sessionSelectors.selectScreenShareStatus(actor.getSnapshot())).toBe(
      EScreenShareStatus.IDLE,
    );

    actor.stop();
  });

  it('adapts manager events to session state', () => {
    const connectionEvents = new TypedEvents<TConnectionEventMap>(CONNECTION_EVENT_NAMES);
    const callEvents = new TypedEvents<TCallEventMap>(CALL_EVENT_NAMES);
    const incomingEvents = new TypedEvents<TIncomingEventMap>(INCOMING_EVENT_NAMES);
    const actor = createActor(sessionMachine);

    const detach = attachSessionEventAdapter(actor, {
      connectionManager: connectionEvents as unknown as ConnectionManager,
      callManager: callEvents as unknown as CallManager,
      incomingCallManager: incomingEvents as unknown as IncomingCallManager,
    });

    actor.start();

    connectionEvents.trigger('connect-started', {});
    expect(sessionSelectors.selectConnectionStatus(actor.getSnapshot())).toBe(
      EConnectionStatus.CONNECTING,
    );

    connectionEvents.trigger('connected', {} as TConnectionEventMap['connected']);
    expect(sessionSelectors.selectConnectionStatus(actor.getSnapshot())).toBe(
      EConnectionStatus.CONNECTED,
    );

    // @ts-expect-error - isAvailableIncomingCall is not a property of TypedEvents
    incomingEvents.isAvailableIncomingCall = true;
    incomingEvents.trigger('incomingCall', {} as TIncomingEventMap['incomingCall']);
    expect(sessionSelectors.selectIncomingStatus(actor.getSnapshot())).toBe(
      EIncomingStatus.RINGING,
    );

    callEvents.trigger('accepted', {} as TCallEventMap['accepted']);
    expect(sessionSelectors.selectIncomingStatus(actor.getSnapshot())).toBe(
      EIncomingStatus.CONSUMED,
    );
    expect(sessionSelectors.selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.ACCEPTED);

    callEvents.trigger('confirmed', {} as TCallEventMap['confirmed']);
    expect(sessionSelectors.selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.IN_CALL);

    callEvents.trigger('presentation:start', {} as TCallEventMap['presentation:start']);
    expect(sessionSelectors.selectScreenShareStatus(actor.getSnapshot())).toBe(
      EScreenShareStatus.STARTING,
    );
    callEvents.trigger('presentation:started', {} as TCallEventMap['presentation:started']);
    expect(sessionSelectors.selectScreenShareStatus(actor.getSnapshot())).toBe(
      EScreenShareStatus.ACTIVE,
    );

    callEvents.trigger('ended', {} as TCallEventMap['ended']);
    expect(sessionSelectors.selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.ENDED);
    expect(sessionSelectors.selectIncomingStatus(actor.getSnapshot())).toBe(EIncomingStatus.IDLE);
    expect(sessionSelectors.selectScreenShareStatus(actor.getSnapshot())).toBe(
      EScreenShareStatus.IDLE,
    );

    detach();
    actor.stop();
  });
});
