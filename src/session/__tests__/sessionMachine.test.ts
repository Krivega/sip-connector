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
import { sipSessionMachine } from '../rootMachine';
import {
  selectCallStatus,
  selectConnectionStatus,
  selectIncomingStatus,
  selectScreenShareStatus,
} from '../selectors';
import { ECallStatus, EConnectionStatus, EIncomingStatus, EScreenShareStatus } from '../types';

describe('sipSessionMachine', () => {
  it('handles direct domain events', () => {
    const actor = createActor(sipSessionMachine);

    actor.start();

    actor.send({ type: 'CONNECTION.START' });
    expect(selectConnectionStatus(actor.getSnapshot())).toBe(EConnectionStatus.CONNECTING);

    actor.send({ type: 'CONNECTION.INIT' });
    expect(selectConnectionStatus(actor.getSnapshot())).toBe(EConnectionStatus.INITIALIZING);

    actor.send({ type: 'CONNECTION.CONNECTED' });
    expect(selectConnectionStatus(actor.getSnapshot())).toBe(EConnectionStatus.CONNECTED);

    actor.send({ type: 'CONNECTION.REGISTERED' });
    expect(selectConnectionStatus(actor.getSnapshot())).toBe(EConnectionStatus.REGISTERED);

    actor.send({ type: 'CALL.CONNECTING' });
    expect(selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.CONNECTING);

    actor.send({ type: 'CALL.RINGING' });
    expect(selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.RINGING);

    actor.send({ type: 'CALL.ACCEPTED' });
    actor.send({ type: 'CALL.CONFIRMED' });
    expect(selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.IN_CALL);

    actor.send({ type: 'INCOMING.RINGING', data: {} as TIncomingEventMap['incomingCall'] });
    expect(selectIncomingStatus(actor.getSnapshot())).toBe(EIncomingStatus.RINGING);

    actor.send({ type: 'INCOMING.CONSUMED' });
    expect(selectIncomingStatus(actor.getSnapshot())).toBe(EIncomingStatus.CONSUMED);

    actor.send({ type: 'SCREEN.STARTING' });
    expect(selectScreenShareStatus(actor.getSnapshot())).toBe(EScreenShareStatus.STARTING);
    actor.send({ type: 'SCREEN.STARTED' });
    expect(selectScreenShareStatus(actor.getSnapshot())).toBe(EScreenShareStatus.ACTIVE);
    actor.send({ type: 'SCREEN.ENDING' });
    actor.send({ type: 'SCREEN.ENDED' });
    expect(selectScreenShareStatus(actor.getSnapshot())).toBe(EScreenShareStatus.IDLE);

    actor.stop();
  });

  it('adapts manager events to session state', () => {
    const connectionEvents = new TypedEvents<TConnectionEventMap>(CONNECTION_EVENT_NAMES);
    const callEvents = new TypedEvents<TCallEventMap>(CALL_EVENT_NAMES);
    const incomingEvents = new TypedEvents<TIncomingEventMap>(INCOMING_EVENT_NAMES);
    const actor = createActor(sipSessionMachine);

    const detach = attachSessionEventAdapter(actor, {
      connectionEvents,
      callEvents,
      incomingCallEvents: incomingEvents,
    });

    actor.start();

    connectionEvents.trigger('connect-started', {});
    expect(selectConnectionStatus(actor.getSnapshot())).toBe(EConnectionStatus.CONNECTING);

    connectionEvents.trigger('connected', {} as TConnectionEventMap['connected']);
    expect(selectConnectionStatus(actor.getSnapshot())).toBe(EConnectionStatus.CONNECTED);

    incomingEvents.trigger('incomingCall', {} as TIncomingEventMap['incomingCall']);
    expect(selectIncomingStatus(actor.getSnapshot())).toBe(EIncomingStatus.RINGING);

    callEvents.trigger('accepted', {} as TCallEventMap['accepted']);
    expect(selectIncomingStatus(actor.getSnapshot())).toBe(EIncomingStatus.CONSUMED);
    expect(selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.ACCEPTED);

    callEvents.trigger('confirmed', {} as TCallEventMap['confirmed']);
    expect(selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.IN_CALL);

    callEvents.trigger('presentation:start', {} as TCallEventMap['presentation:start']);
    expect(selectScreenShareStatus(actor.getSnapshot())).toBe(EScreenShareStatus.STARTING);
    callEvents.trigger('presentation:started', {} as TCallEventMap['presentation:started']);
    expect(selectScreenShareStatus(actor.getSnapshot())).toBe(EScreenShareStatus.ACTIVE);

    callEvents.trigger('ended', {} as TCallEventMap['ended']);
    expect(selectCallStatus(actor.getSnapshot())).toBe(ECallStatus.ENDED);
    expect(selectIncomingStatus(actor.getSnapshot())).toBe(EIncomingStatus.IDLE);
    expect(selectScreenShareStatus(actor.getSnapshot())).toBe(EScreenShareStatus.IDLE);

    detach();
    actor.stop();
  });
});
