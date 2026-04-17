import { ECallReconnectStatus } from '@/index';
import { CallReconnectStatusModel, INITIAL_CALL_RECONNECT_STATUS_SNAPSHOT } from '../Model';

type TCallReconnectSnapshot = Parameters<typeof CallReconnectStatusModel.create>[0];

describe('CallReconnectStatusModel', () => {
  const createInstance = (
    snapshot: TCallReconnectSnapshot = INITIAL_CALL_RECONNECT_STATUS_SNAPSHOT,
  ) => {
    return CallReconnectStatusModel.create(snapshot);
  };

  it('maps initial snapshot', () => {
    const instance = createInstance();

    expect(instance.snapshot).toEqual({
      state: ECallReconnectStatus.IDLE,
      context: {},
    });
    expect(instance.isReconnecting).toBe(false);
  });

  it.each([
    ECallReconnectStatus.IDLE,
    ECallReconnectStatus.ARMED,
    ECallReconnectStatus.ERROR_TERMINAL,
  ])('%s -> isReconnecting=false', (state) => {
    const instance = createInstance({ state, context: {} } as TCallReconnectSnapshot);

    expect(instance.isReconnecting).toBe(false);
  });

  it.each([
    ECallReconnectStatus.EVALUATING,
    ECallReconnectStatus.BACKOFF,
    ECallReconnectStatus.WAITING_SIGNALING,
    ECallReconnectStatus.ATTEMPTING,
    ECallReconnectStatus.LIMIT_REACHED,
  ])('%s -> isReconnecting=true', (state) => {
    const instance = createInstance({ state, context: {} } as TCallReconnectSnapshot);

    expect(instance.isReconnecting).toBe(true);
  });
});
