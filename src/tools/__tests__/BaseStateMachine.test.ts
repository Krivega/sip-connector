import { setup } from 'xstate';

import { BaseStateMachine } from '@/tools/BaseStateMachine';

type TTestEvent = { type: 'GO' };

const testMachine = setup({
  types: {
    context: {} as Record<string, never>,
    events: {} as TTestEvent,
  },
}).createMachine({
  id: 'base-state-machine-test',
  initial: 'idle',
  context: {},
  states: {
    idle: {
      on: {
        GO: 'active',
      },
    },
    active: {
      on: {
        GO: 'active',
      },
    },
  },
});

class TestStateMachine extends BaseStateMachine<typeof testMachine, 'idle' | 'active'> {
  public constructor() {
    super(testMachine);
  }
}

describe('BaseStateMachine', () => {
  it('starts actor immediately and exposes snapshot', () => {
    const machine = new TestStateMachine();

    expect(machine.getSnapshot().value).toBe('idle');
  });

  it('sends events and notifies subscribers', () => {
    const machine = new TestStateMachine();
    const onChange = jest.fn();

    machine.subscribe(onChange);
    machine.send({ type: 'GO' });

    expect(machine.getSnapshot().value).toBe('active');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: 'active' }));
  });

  it('cleans up subscriptions on stop', () => {
    const machine = new TestStateMachine();
    const onChange = jest.fn();

    machine.subscribe(onChange);
    machine.stop();
    machine.send({ type: 'GO' });

    expect(onChange).not.toHaveBeenCalled();
  });

  describe('state getter', () => {
    it('should return initial state', () => {
      const machine = new TestStateMachine();

      expect(machine.state).toBe('idle');
      expect(machine.state).toBe(machine.getSnapshot().value);
    });

    it('should return updated state after sending event', () => {
      const machine = new TestStateMachine();

      expect(machine.state).toBe('idle');

      machine.send({ type: 'GO' });

      expect(machine.state).toBe('active');
      expect(machine.state).toBe(machine.getSnapshot().value);
    });

    it('should return current state that matches snapshot value', () => {
      const machine = new TestStateMachine();

      // Initial state
      expect(machine.state).toBe('idle');
      expect(machine.state).toBe(machine.getSnapshot().value);

      // After transition to active
      machine.send({ type: 'GO' });
      expect(machine.state).toBe('active');
      expect(machine.state).toBe(machine.getSnapshot().value);

      // After staying in active (self-transition)
      machine.send({ type: 'GO' });
      expect(machine.state).toBe('active');
      expect(machine.state).toBe(machine.getSnapshot().value);
    });

    it('should return state synchronously after state change', () => {
      const machine = new TestStateMachine();
      const stateChanges: string[] = [];

      machine.subscribe((snapshot) => {
        stateChanges.push(snapshot.value as string);
      });

      expect(machine.state).toBe('idle');
      machine.send({ type: 'GO' });
      expect(machine.state).toBe('active');

      // Verify that state getter returns the same value as the latest snapshot
      expect(machine.state).toBe(stateChanges.at(-1));
    });
  });
});
