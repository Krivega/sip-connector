/// <reference types="jest" />
import { getValuesFromError } from '..';
import type { TCustomError } from '../../../types';

describe('getValuesFromError', () => {
  it('should return default values when error is not provided', () => {
    const values = getValuesFromError();

    expect(values).toEqual({
      code: '',
      cause: '',
      message: '',
      link: undefined,
    });
  });

  it('should return values from error object', () => {
    const error = {
      code: 'code',
      cause: 'cause',
      message: 'message',
    } as TCustomError;
    const values = getValuesFromError(error);

    expect(values).toEqual({
      link: undefined,
      code: 'code',
      cause: 'cause',
      message: 'message',
    });
  });

  it('should return message as string when message is number', () => {
    const error = {
      code: 'code',
      cause: 'cause',
      message: 1000,
    } as TCustomError;
    const values = getValuesFromError(error);

    expect(values).toEqual({
      link: undefined,
      code: 'code',
      cause: 'cause',
      message: '1000',
    });
  });

  it('should return link in values from error with url', () => {
    const error = {
      code: 'code',
      cause: 'cause',
      message: 'message',
      url: 'http://example.com',
    } as TCustomError;

    const values = getValuesFromError(error);

    expect(values).toEqual({
      code: 'code',
      cause: 'cause',
      message: 'message',
      link: 'http://example.com',
    });
  });

  it('should return message as stringified object when message is object', () => {
    const error = {
      code: 'code',
      cause: 'cause',
      message: { property1: 'property1', property2: 222 },
    } as TCustomError;

    const values = getValuesFromError(error);

    expect(values).toEqual({
      code: 'code',
      cause: 'cause',
      message: '{"property1":"property1","property2":222}',
      link: undefined,
    });
  });

  it('should return empty error message when message is self-linked object', () => {
    const error = {
      code: 'code',
      cause: 'cause',
    } as TCustomError;

    // @ts-expect-error
    error.message = { property: error } as TCustomError;

    const values = getValuesFromError(error);

    expect(values).toEqual({
      code: 'code',
      cause: 'cause',
      message: '',
      link: undefined,
    });
  });

  it('should return values from "Bad Media Description" error with link from message', () => {
    const error = {
      code: 'code',
      cause: 'Bad Media Description',
      message: {
        to: {
          uri: {
            user: 'user',
            host: 'example.com',
          },
        },
      },
    } as TCustomError;

    const values = getValuesFromError(error);

    expect(values).toEqual({
      code: 'code',
      cause: 'Bad Media Description',
      message: '{"to":{"uri":{"user":"user","host":"example.com"}}}',
      link: 'user@example.com',
    });
  });

  it('should return values from "Not Found" error with link from message', () => {
    const error = {
      code: 'code',
      cause: 'Not Found',
      message: {
        to: {
          uri: {
            user: 'user',
            host: 'example.com',
          },
        },
      },
    } as TCustomError;

    const values = getValuesFromError(error);

    expect(values).toEqual({
      code: 'code',
      cause: 'Not Found',
      message: '{"to":{"uri":{"user":"user","host":"example.com"}}}',
      link: 'user@example.com',
    });
  });
});
