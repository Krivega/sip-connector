/* eslint-disable unicorn/prefer-module */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/// <reference types="jest" />
import stringifyMessage from '../stringifyMessage';

// Mock dependencies
jest.mock('@/logger');

describe('stringifyMessage', () => {
  let mockLogger: jest.Mock;

  beforeEach(() => {
    mockLogger = jest.mocked(require('@/logger').default);
    jest.clearAllMocks();
  });

  it('should stringify simple object', () => {
    const message = { key: 'value', number: 123 };

    const result = stringifyMessage(message);

    expect(result).toBe('{"key":"value","number":123}');
  });

  it('should stringify string', () => {
    const message = 'test message';

    const result = stringifyMessage(message);

    expect(result).toBe('"test message"');
  });

  it('should stringify number', () => {
    const message = 42;

    const result = stringifyMessage(message);

    expect(result).toBe('42');
  });

  it('should stringify boolean', () => {
    const message = true;

    const result = stringifyMessage(message);

    expect(result).toBe('true');
  });

  it('should stringify null', () => {
    const message = undefined;

    const result = stringifyMessage(message);

    expect(result).toBe('undefined');
  });

  it('should stringify array', () => {
    const message = [1, 2, 3, 'test'];

    const result = stringifyMessage(message);

    expect(result).toBe('[1,2,3,"test"]');
  });

  it('should stringify nested object', () => {
    const message = {
      user: {
        name: 'John',
        age: 30,
        address: {
          city: 'New York',
          country: 'USA',
        },
      },
    };

    const result = stringifyMessage(message);

    expect(result).toBe(
      '{"user":{"name":"John","age":30,"address":{"city":"New York","country":"USA"}}}',
    );
  });

  it('should handle circular reference and log error', () => {
    const circularObject: Record<string, unknown> = { name: 'test' };

    circularObject.self = circularObject;

    const result = stringifyMessage(circularObject);

    expect(result).toBe('');
    expect(mockLogger).toHaveBeenCalledWith('failed to stringify message', expect.any(Error));
  });

  it('should handle object with function and log error', () => {
    const message = {
      name: 'test',
      func: () => {
        return 'test';
      },
    };

    const result = stringifyMessage(message);

    expect(result).toBe('{"name":"test"}');
  });

  it('should handle object with undefined values', () => {
    const message = {
      name: 'test',
      value: undefined,
      nested: {
        prop: undefined,
      },
    };

    const result = stringifyMessage(message);

    expect(result).toBe('{"name":"test","nested":{}}');
  });

  it('should handle empty object', () => {
    const message = {};

    const result = stringifyMessage(message);

    expect(result).toBe('{}');
  });

  it('should handle empty array', () => {
    const message: unknown[] = [];

    const result = stringifyMessage(message);

    expect(result).toBe('[]');
  });

  it('should handle object with special characters', () => {
    const message = {
      name: 'test "quotes"',
      special: 'line\nbreak',
      unicode: 'привет',
    };

    const result = stringifyMessage(message);

    expect(result).toBe(
      String.raw`{"name":"test \"quotes\"","special":"line\nbreak","unicode":"привет"}`,
    );
  });
});
