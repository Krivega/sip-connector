/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable unicorn/prefer-module */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/// <reference types="jest" />
import { ECallCause } from '@/CallManager';
import getTypeFromError, { EErrorTypes } from '../getTypeFromError';

import type { TCustomError } from '@/CallManager';

// Mock dependencies
jest.mock('@/logger');
jest.mock('../getLinkError');

describe('getTypeFromError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return CONNECT_SERVER_FAILED for unknown error', () => {
    const error = { cause: 'Unknown' };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.CONNECT_SERVER_FAILED);
  });

  it('should return WRONG_USER_OR_PASSWORD for Forbidden cause', () => {
    const error = { cause: 'Forbidden' };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.WRONG_USER_OR_PASSWORD);
  });

  it('should return BAD_MEDIA_ERROR for BAD_MEDIA_DESCRIPTION cause', () => {
    const error = { cause: ECallCause.BAD_MEDIA_DESCRIPTION };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.BAD_MEDIA_ERROR);
  });

  it('should return NOT_FOUND_ERROR for NOT_FOUND cause', () => {
    const error = { cause: ECallCause.NOT_FOUND };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.NOT_FOUND_ERROR);
  });

  it('should return WS_CONNECTION_FAILED when socket._ws.readyState is 3', () => {
    const error = {
      cause: 'SomeError',
      socket: {
        _ws: {
          readyState: 3,
        },
      },
    };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.WS_CONNECTION_FAILED);
  });

  it('should return CONNECT_SERVER_FAILED_BY_LINK when getLinkError returns non-empty string', () => {
    const mockGetLinkError = jest.mocked(require('../getLinkError').default);

    mockGetLinkError.mockReturnValue('some-link');

    const error = {
      cause: 'SomeError',
      socket: {
        _ws: {
          readyState: 1, // Not 3
        },
      },
    };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.CONNECT_SERVER_FAILED_BY_LINK);
    expect(mockGetLinkError).toHaveBeenCalledWith(error);
  });

  it('should return CONNECT_SERVER_FAILED when getLinkError returns empty string', () => {
    const mockGetLinkError = jest.mocked(require('../getLinkError').default);

    mockGetLinkError.mockReturnValue('');

    const error = {
      cause: 'SomeError',
      socket: {
        _ws: {
          readyState: 1, // Not 3
        },
      },
    };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.CONNECT_SERVER_FAILED);
  });

  it('should return CONNECT_SERVER_FAILED when getLinkError returns undefined', () => {
    const mockGetLinkError = jest.mocked(require('../getLinkError').default);

    mockGetLinkError.mockReturnValue(undefined);

    const error = {
      cause: 'SomeError',
      socket: {
        _ws: {
          readyState: 1, // Not 3
        },
      },
    };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.CONNECT_SERVER_FAILED);
  });

  it('should return CONNECT_SERVER_FAILED when socket is undefined', () => {
    const error = {
      cause: 'SomeError',
      socket: undefined,
    };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.CONNECT_SERVER_FAILED);
  });

  it('should return CONNECT_SERVER_FAILED when socket._ws is undefined', () => {
    const error = {
      cause: 'SomeError',
      socket: {
        _ws: undefined,
      },
    };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.CONNECT_SERVER_FAILED);
  });

  it('should return CONNECT_SERVER_FAILED when socket._ws.readyState is not 3', () => {
    const error = {
      cause: 'SomeError',
      socket: {
        _ws: {
          readyState: 1,
        },
      },
    };

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.CONNECT_SERVER_FAILED);
  });

  it('should use default error when no error is provided', () => {
    const result = getTypeFromError();

    expect(result).toBe(EErrorTypes.CONNECT_SERVER_FAILED);
  });

  it('should handle error without cause property', () => {
    const error = {};

    const result = getTypeFromError(error as unknown as TCustomError);

    expect(result).toBe(EErrorTypes.CONNECT_SERVER_FAILED);
  });
});
