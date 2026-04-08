import { wrapReconnectError } from '../wrapReconnectError';

describe('wrapReconnectError', () => {
  it('возвращает тот же Error', () => {
    const error = new Error('x');

    expect(wrapReconnectError(error)).toBe(error);
  });

  it('оборачивает не-Error в Error', () => {
    const wrapped = wrapReconnectError('plain');

    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe('Failed to reconnect');
  });
});
