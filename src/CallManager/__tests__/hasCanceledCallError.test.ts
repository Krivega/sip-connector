import { isCanceledError } from '@krivega/cancelable-promise';
import { ECallCause } from '../causes';
import hasCanceledCallError from '../hasCanceledCallError';

// Мокаем isCanceledError
jest.mock('@krivega/cancelable-promise', () => {
  return {
    isCanceledError: jest.fn(),
  };
});

const mockIsCanceledError = isCanceledError as jest.MockedFunction<typeof isCanceledError>;

describe('hasCanceledCallError', () => {
  beforeEach(() => {
    mockIsCanceledError.mockReset();
  });

  it('возвращает true если isCanceledError возвращает true', () => {
    mockIsCanceledError.mockReturnValue(true);

    const error = new Error('test');

    expect(hasCanceledCallError(error)).toBe(true);
  });

  it('возвращает false если hasCustomError возвращает false', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = new Error('test'); // обычная ошибка без originator/cause

    expect(hasCanceledCallError(error)).toBe(false);
  });

  it('возвращает false если cause не является строкой', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { originator: 'local', cause: 123 };

    expect(hasCanceledCallError(error)).toBe(false);
  });

  it('возвращает true если cause равен REQUEST_TIMEOUT', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { originator: 'local', cause: ECallCause.REQUEST_TIMEOUT };

    expect(hasCanceledCallError(error)).toBe(true);
  });

  it('возвращает true если cause равен REJECTED', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { originator: 'local', cause: ECallCause.REJECTED };

    expect(hasCanceledCallError(error)).toBe(true);
  });

  it('возвращает true если cause равен CANCELED и originator LOCAL', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { originator: 'local', cause: ECallCause.CANCELED };

    expect(hasCanceledCallError(error)).toBe(true);
  });

  it('возвращает true если cause равен BYE и originator LOCAL', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { originator: 'local', cause: ECallCause.BYE };

    expect(hasCanceledCallError(error)).toBe(true);
  });

  it('возвращает false если cause равен CANCELED но originator REMOTE', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { originator: 'remote', cause: ECallCause.CANCELED };

    expect(hasCanceledCallError(error)).toBe(false);
  });

  it('возвращает false если cause равен BYE но originator REMOTE', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { originator: 'remote', cause: ECallCause.BYE };

    expect(hasCanceledCallError(error)).toBe(false);
  });

  it('возвращает false для неизвестного cause', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { originator: 'local', cause: 'UNKNOWN_CAUSE' };

    expect(hasCanceledCallError(error)).toBe(false);
  });

  it('возвращает false для объекта только с originator', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { originator: 'local' };

    expect(hasCanceledCallError(error)).toBe(false);
  });

  it('возвращает false для объекта только с cause', () => {
    mockIsCanceledError.mockReturnValue(false);

    const error = { cause: ECallCause.CANCELED };

    expect(hasCanceledCallError(error)).toBe(false);
  });
});
