import { getInvokeError } from '../getInvokeError';

describe('getInvokeError', () => {
  it('extracts error from xstate invoke event', () => {
    const error = new Error('boom');

    expect(getInvokeError({ type: 'xstate.error.actor.foo', error })).toBe(error);
  });

  it('returns undefined for plain/primitive events', () => {
    expect(getInvokeError({ type: 'smth' })).toBeUndefined();
    expect(getInvokeError(undefined)).toBeUndefined();
    // eslint-disable-next-line unicorn/no-null
    expect(getInvokeError(null)).toBeUndefined();
    expect(getInvokeError(42)).toBeUndefined();
    expect(getInvokeError('plain')).toBeUndefined();
  });
});
