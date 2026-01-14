import flushPromises from '@/__fixtures__/flushPromises';
import { createEvents as createCallEvents } from '@/CallManager';
import MainStreamRecovery from '../@MainStreamRecovery';

import type { EndEvent } from '@krivega/jssip';
import type { CallManager, TCallEvents } from '@/CallManager';

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('@MainStreamRecovery', () => {
  let callEvents: TCallEvents;
  let callManager: CallManager;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(0));

    callEvents = createCallEvents();
    callManager = {
      on: callEvents.on.bind(callEvents),
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

  it('должен отменить восстановление основного потока при завершении звонка', () => {
    const recovery = new MainStreamRecovery(callManager);

    // @ts-expect-error - доступ к приватному свойству
    const spyCancel = jest.spyOn(recovery, 'cancel');

    callEvents.trigger('ended', {} as EndEvent);

    expect(spyCancel).toHaveBeenCalledTimes(1);
  });

  it('должен пропускать повторный вызов recover если предыдущий запрос завершился и повторный вызов совершен раньше, чем истек переданный таймаут', async () => {
    const recovery = new MainStreamRecovery(callManager, 200);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(1);

    // @ts-expect-error - подмена значения в приватном свойстве
    recovery.renegotiateRequester.requested = false;
    jest.advanceTimersByTime(100);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(1);
  });

  it('должен пропускать повторный вызов recover если предыдущий запрос не завершился и истек переданный таймаут', async () => {
    const recovery = new MainStreamRecovery(callManager, 200);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(1);

    // @ts-expect-error - подмена значения в приватном свойстве
    recovery.renegotiateRequester.requested = true;
    jest.advanceTimersByTime(200);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(1);
  });

  it('должен совершать повторный вызов recover если предыдущий запрос завершился и истек переданный таймаут', async () => {
    const recovery = new MainStreamRecovery(callManager, 200);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(1);

    // @ts-expect-error - подмена значения в приватном свойстве
    recovery.renegotiateRequester.requested = false;
    jest.advanceTimersByTime(200);

    recovery.recover();

    expect(callManager.renegotiate).toHaveBeenCalledTimes(2);
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
      on: callEvents.on.bind(callEvents),
      renegotiate: jest.fn().mockRejectedValue(error),
    } as unknown as CallManager;

    const recovery = new MainStreamRecovery(callManager);

    jest.useRealTimers();

    recovery.recover();

    await flushPromises();

    expect(mockLogger).toHaveBeenLastCalledWith('failed to renegotiate main media stream', error);
  });
});
