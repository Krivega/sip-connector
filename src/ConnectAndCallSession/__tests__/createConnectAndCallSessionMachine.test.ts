import { createActor } from 'xstate';

import { createConnectAndCallSessionMachine } from '../createConnectAndCallSessionMachine';
import { EConnectAndCallSessionPhase } from '../types';

describe('createConnectAndCallSessionMachine', () => {
  it('проходит основные переходы lifecycle', () => {
    const actor = createActor(createConnectAndCallSessionMachine());

    actor.start();
    actor.send({ type: 'START' });
    actor.send({ type: 'AUTO_CONNECTED' });
    actor.send({ type: 'CALL_STARTED' });
    actor.send({ type: 'REDIAL_STARTED' });
    actor.send({ type: 'REDIAL_SUCCEEDED' });
    actor.send({ type: 'MANUAL_CLOSE' });
    actor.send({ type: 'CLEANUP_COMPLETE' });

    expect(actor.getSnapshot().value).toBe(EConnectAndCallSessionPhase.CLOSED);
    expect(actor.getSnapshot().context.closeReason).toBe('manual');
  });

  it('сохраняет closeReason для REJECT и FINALIZE', () => {
    const actor = createActor(createConnectAndCallSessionMachine());

    actor.start();
    actor.send({ type: 'START' });
    actor.send({ type: 'REJECT', reason: 'auto-connector-active' });

    expect(actor.getSnapshot().context.closeReason).toBe('auto-connector-active');

    actor.stop();

    const finalizedActor = createActor(createConnectAndCallSessionMachine());

    finalizedActor.start();
    finalizedActor.send({ type: 'START' });
    finalizedActor.send({ type: 'FINALIZE', reason: 'completed' });
    finalizedActor.send({ type: 'CLEANUP_COMPLETE' });

    expect(finalizedActor.getSnapshot().context.closeReason).toBe('completed');
  });
});
