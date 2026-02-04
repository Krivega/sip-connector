/// <reference types="jest" />

import { DeferredCommandRunner } from '../DeferredCommandRunner';

type TTestState = { status: 'pending' | 'ready' | 'cancelled' };

describe('DeferredCommandRunner', () => {
  let listener: (state: TTestState) => void = () => {};

  const createRunner = (overrides?: {
    subscribe?: (listener: (state: TTestState) => void) => () => void;
    isReady?: (state: TTestState) => boolean;
    isCancelled?: (state: TTestState) => boolean;
    onExecute?: (command: string) => void;
  }) => {
    const subscribe = overrides?.subscribe ?? jest.fn();
    const isReady =
      overrides?.isReady ??
      jest.fn((s: TTestState) => {
        return s.status === 'ready';
      });
    const isCancelled =
      overrides?.isCancelled ??
      jest.fn((s: TTestState) => {
        return s.status === 'cancelled';
      });
    const onExecute = overrides?.onExecute ?? jest.fn();

    return {
      runner: new DeferredCommandRunner<string, TTestState>({
        subscribe,
        isReady,
        isCancelled,
        onExecute,
      }),
      subscribe,
      isReady,
      isCancelled,
      onExecute,
    };
  };

  it('executes command when state becomes ready', () => {
    const unsubscribe = jest.fn();
    const subscribe = jest.fn((function_: (state: TTestState) => void) => {
      listener = function_;

      return unsubscribe;
    });
    const onExecute = jest.fn();

    const { runner } = createRunner({ subscribe, onExecute });

    runner.set('doSomething');
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(onExecute).not.toHaveBeenCalled();

    listener({ status: 'pending' });
    expect(onExecute).not.toHaveBeenCalled();

    listener({ status: 'ready' });
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith('doSomething');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not execute and cleans up when state becomes cancelled', () => {
    const unsubscribe = jest.fn();
    const subscribe = jest.fn((function_: (state: TTestState) => void) => {
      listener = function_;

      return unsubscribe;
    });
    const onExecute = jest.fn();

    const { runner } = createRunner({ subscribe, onExecute });

    runner.set('doSomething');
    listener({ status: 'cancelled' });

    expect(onExecute).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('cancel() unsubscribes and clears command', () => {
    const unsubscribe = jest.fn();
    const subscribe = jest.fn(() => {
      return unsubscribe;
    });
    const onExecute = jest.fn();

    const { runner } = createRunner({ subscribe, onExecute });

    runner.set('doSomething');
    expect(unsubscribe).not.toHaveBeenCalled();

    runner.cancel();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    runner.cancel();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('second set() cancels the first subscription before subscribing again', () => {
    const unsubscribe1 = jest.fn();
    const unsubscribe2 = jest.fn();
    let subscribeCallCount = 0;
    const subscribe = jest.fn((function_: (state: TTestState) => void) => {
      listener = function_;
      subscribeCallCount += 1;

      return subscribeCallCount === 1 ? unsubscribe1 : unsubscribe2;
    });
    const onExecute = jest.fn();

    const { runner } = createRunner({ subscribe, onExecute });

    runner.set('first');
    expect(unsubscribe1).not.toHaveBeenCalled();

    runner.set('second');
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(2);

    listener({ status: 'ready' });
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith('second');
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
  });

  it('executes only once when state becomes ready then listener is not called again', () => {
    const unsubscribe = jest.fn();
    const subscribe = jest.fn((function_: (state: TTestState) => void) => {
      listener = function_;

      return unsubscribe;
    });
    const onExecute = jest.fn();

    const { runner } = createRunner({ subscribe, onExecute });

    runner.set('doSomething');
    listener({ status: 'ready' });
    listener({ status: 'ready' });

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('after cancel() no execution happens even if listener is invoked later', () => {
    const subscribe = jest.fn((function_: (state: TTestState) => void) => {
      listener = function_;

      return jest.fn();
    });
    const onExecute = jest.fn();

    const { runner } = createRunner({ subscribe, onExecute });

    runner.set('doSomething');
    runner.cancel();
    listener({ status: 'ready' });

    expect(onExecute).not.toHaveBeenCalled();
  });

  it('uses custom isReady and isCancelled from options', () => {
    const unsubscribe = jest.fn();
    const subscribe = jest.fn((function_: (state: TTestState) => void) => {
      listener = function_;

      return unsubscribe;
    });
    const onExecute = jest.fn();
    const isReady = jest.fn((s: TTestState) => {
      return s.status === 'ready';
    });
    const isCancelled = jest.fn((s: TTestState) => {
      return s.status === 'cancelled';
    });

    const { runner } = createRunner({ subscribe, onExecute, isReady, isCancelled });

    runner.set('cmd');
    listener({ status: 'pending' });
    expect(isReady).toHaveBeenCalledWith({ status: 'pending' });
    expect(isCancelled).toHaveBeenCalledWith({ status: 'pending' });

    listener({ status: 'ready' });
    expect(isReady).toHaveBeenCalledWith({ status: 'ready' });
    expect(onExecute).toHaveBeenCalledWith('cmd');
  });
});
