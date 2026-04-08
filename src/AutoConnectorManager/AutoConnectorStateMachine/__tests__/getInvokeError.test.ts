import { getInvokeError } from '../getInvokeError';

describe('getInvokeError', () => {
  it('возвращает error из объекта события', () => {
    const error = new Error('x');

    expect(getInvokeError({ error })).toBe(error);
  });

  it('возвращает undefined для не-объекта', () => {
    expect(getInvokeError(undefined)).toBeUndefined();
    expect(getInvokeError('x')).toBeUndefined();
  });
});
