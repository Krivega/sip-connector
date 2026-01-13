import flushPromises from '@/__fixtures__/flushPromises';
import MainStreamRecovery from '../@MainStreamRecovery';

import type { CallManager } from '@/CallManager';

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('@MainStreamRecovery', () => {
  let callManager: CallManager;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(0));

    callManager = {
      renegotiate: jest.fn().mockResolvedValue(true),
    } as unknown as CallManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('должен вызывать renegotiate когда вызван recover', () => {
    const recovery = new MainStreamRecovery(callManager);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(1);
  });

  it('должен пропускать повторный вызов recover если повторный вызов совершен раньше, чем истек переданный таймаут', () => {
    const recovery = new MainStreamRecovery(callManager, 200);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(1);
  });

  it('должен совершать повторный вызов recover если истек переданный таймаут', () => {
    const recovery = new MainStreamRecovery(callManager, 200);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(200);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(2);
  });

  it('должен отменять восстановление когда вызван cancel', () => {
    const recovery = new MainStreamRecovery(callManager);
    // @ts-expect-error - доступ к приватному свойству
    const cancelRequestSpy = jest.spyOn(recovery.renegotiateRequester, 'cancelRequest');
    // @ts-expect-error - доступ к приватному свойству
    const cancelThrottleSpy = jest.spyOn(recovery.renegotiateThrottled, 'cancel');

    recovery.cancel();

    expect(cancelRequestSpy).toHaveBeenCalledTimes(1);
    expect(cancelThrottleSpy).toHaveBeenCalledTimes(1);
  });

  it('должен логировать успех renegotiate после recover', async () => {
    const mockLogger = await import('@/logger');
    const recovery = new MainStreamRecovery(callManager, 200);

    jest.useRealTimers();

    recovery.recover();

    await flushPromises();

    expect(mockLogger).toHaveBeenLastCalledWith('renegotiate has successful');
  });

  it('должен логировать ошибку renegotiate после recover если renegotiate завершился ошибкой', async () => {
    const mockLogger = await import('@/logger');
    const error = new Error('renegotiate failed');

    callManager = {
      renegotiate: jest.fn().mockRejectedValue(error),
    } as unknown as CallManager;

    const recovery = new MainStreamRecovery(callManager);

    jest.useRealTimers();

    recovery.recover();

    await flushPromises();

    expect(mockLogger).toHaveBeenLastCalledWith('failed to renegotiate main media stream', error);
  });
});
