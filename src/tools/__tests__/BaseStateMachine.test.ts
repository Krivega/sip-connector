import { setup } from 'xstate';

import { BaseStateMachine } from '@/tools/BaseStateMachine';

type TTestEvent = { type: 'GO' };
enum EState {
  idle = 'idle',
  active = 'active',
}

type TContext = Record<string, never>;

const testMachine = setup({
  types: {
    context: {} as TContext,
    events: {} as TTestEvent,
  },
}).createMachine({
  id: 'base-state-machine-test',
  initial: EState.idle,
  context: {},
  states: {
    [EState.idle]: {
      on: {
        GO: EState.active,
      },
    },
    [EState.active]: {
      on: {
        GO: EState.active,
      },
    },
  },
});

class TestStateMachine extends BaseStateMachine<typeof testMachine, EState, TContext> {
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

  it('should return context', () => {
    const machine = new TestStateMachine();

    expect(machine.context).toEqual({});
    expect(machine.context).toEqual(machine.getSnapshot().context);
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

  describe('onStateChange', () => {
    it('should call listener when state changes', () => {
      const machine = new TestStateMachine();
      const listener = jest.fn();

      machine.onStateChange(listener);
      machine.send({ type: 'GO' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('active');
    });

    it('should not call listener for initial state', () => {
      const machine = new TestStateMachine();
      const listener = jest.fn();

      machine.onStateChange(listener);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should call listener with correct state on multiple transitions', () => {
      const machine = new TestStateMachine();
      const listener = jest.fn();
      const states: ('idle' | 'active')[] = [];

      machine.onStateChange((state) => {
        states.push(state);
        listener(state);
      });

      machine.send({ type: 'GO' }); // idle -> active
      machine.send({ type: 'GO' }); // active -> active (self-transition)

      expect(listener).toHaveBeenCalledTimes(2);
      expect(states).toEqual(['active', 'active']);
    });

    it('should support multiple listeners', () => {
      const machine = new TestStateMachine();
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      machine.onStateChange(listener1);
      machine.onStateChange(listener2);
      machine.onStateChange(listener3);

      machine.send({ type: 'GO' });

      expect(listener1).toHaveBeenCalledWith('active');
      expect(listener2).toHaveBeenCalledWith('active');
      expect(listener3).toHaveBeenCalledWith('active');
    });

    it('should return unsubscribe function', () => {
      const machine = new TestStateMachine();
      const listener = jest.fn();

      const unsubscribe = machine.onStateChange(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should stop calling listener after unsubscribe', () => {
      const machine = new TestStateMachine();
      const listener = jest.fn();

      const unsubscribe = machine.onStateChange(listener);

      machine.send({ type: 'GO' }); // Should call listener
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe(); // Unsubscribe

      machine.send({ type: 'GO' }); // Should NOT call listener
      expect(listener).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should allow selective unsubscribe with multiple listeners', () => {
      const machine = new TestStateMachine();
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      const unsubscribe1 = machine.onStateChange(listener1);
      const unsubscribe2 = machine.onStateChange(listener2);

      machine.onStateChange(listener3);

      machine.send({ type: 'GO' });
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      unsubscribe1();

      machine.send({ type: 'GO' });
      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(2); // Called
      expect(listener3).toHaveBeenCalledTimes(2); // Called

      unsubscribe2();

      machine.send({ type: 'GO' });
      expect(listener1).toHaveBeenCalledTimes(1); // Still not called
      expect(listener2).toHaveBeenCalledTimes(2); // Not called again
      expect(listener3).toHaveBeenCalledTimes(3); // Called
    });

    it('should clear all listeners on stop', () => {
      const machine = new TestStateMachine();
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      machine.onStateChange(listener1);
      machine.onStateChange(listener2);

      machine.send({ type: 'GO' });
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      machine.stop();

      machine.send({ type: 'GO' });
      expect(listener1).toHaveBeenCalledTimes(1); // Not called after stop
      expect(listener2).toHaveBeenCalledTimes(1); // Not called after stop
    });

    it('should handle unsubscribe being called multiple times', () => {
      const machine = new TestStateMachine();
      const listener = jest.fn();

      const unsubscribe = machine.onStateChange(listener);

      unsubscribe();
      unsubscribe(); // Should not throw

      machine.send({ type: 'GO' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should work independently from subscribe method', () => {
      const machine = new TestStateMachine();
      const subscribeListener = jest.fn();
      const stateChangeListener = jest.fn();

      machine.subscribe(subscribeListener);
      machine.onStateChange(stateChangeListener);

      machine.send({ type: 'GO' });

      // subscribe listener receives snapshot
      expect(subscribeListener).toHaveBeenCalledWith(expect.objectContaining({ value: 'active' }));

      // onStateChange listener receives just the state string
      expect(stateChangeListener).toHaveBeenCalledWith('active');
    });
  });
});
