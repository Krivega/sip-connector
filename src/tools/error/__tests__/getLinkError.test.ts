/// <reference types="jest" />
import { ECallCause } from '@/CallManager';
import getLinkError from '../getLinkError';

import type { TCustomError } from '@/CallManager';

describe('getLinkError', () => {
  it('should return url when cause is not BAD_MEDIA_DESCRIPTION or NOT_FOUND', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: 'SomeOtherCause',
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('sip:user@example.com');
  });

  it('should return url when cause is undefined', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: undefined,
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('sip:user@example.com');
  });

  it('should return constructed link for BAD_MEDIA_DESCRIPTION cause', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
      message: {
        to: {
          uri: {
            user: 'testuser',
            host: 'testhost.com',
          },
        },
      },
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('testuser@testhost.com');
  });

  it('should return constructed link for NOT_FOUND cause', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.NOT_FOUND,
      message: {
        to: {
          uri: {
            user: 'anotheruser',
            host: 'anotherhost.com',
          },
        },
      },
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('anotheruser@anotherhost.com');
  });

  it('should handle error without url property', () => {
    const error = {
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
      message: {
        to: {
          uri: {
            user: 'testuser',
            host: 'testhost.com',
          },
        },
      },
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('testuser@testhost.com');
  });

  it('should handle error without message property', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
    };

    expect(() => {
      return getLinkError(error as unknown as TCustomError);
    }).toThrow();
  });

  it('should handle error without message.to property', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
      message: {},
    };

    expect(() => {
      return getLinkError(error as unknown as TCustomError);
    }).toThrow();
  });

  it('should handle error without message.to.uri property', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
      message: {
        to: {},
      },
    };

    expect(() => {
      return getLinkError(error as unknown as TCustomError);
    }).toThrow();
  });

  it('should handle error without message.to.uri.user property', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
      message: {
        to: {
          uri: {
            host: 'testhost.com',
          },
        },
      },
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('undefined@testhost.com');
  });

  it('should handle error without message.to.uri.host property', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
      message: {
        to: {
          uri: {
            user: 'testuser',
          },
        },
      },
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('testuser@undefined');
  });

  it('should handle error with empty user and host', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
      message: {
        to: {
          uri: {
            user: '',
            host: '',
          },
        },
      },
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('@');
  });

  it('should handle error with null user and host', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
      message: {
        to: {
          uri: {
            user: undefined,
            host: undefined,
          },
        },
      },
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('undefined@undefined');
  });

  it('should handle error with undefined user and host', () => {
    const error = {
      url: 'sip:user@example.com',
      cause: ECallCause.BAD_MEDIA_DESCRIPTION,
      message: {
        to: {
          uri: {
            user: undefined,
            host: undefined,
          },
        },
      },
    };

    const result = getLinkError(error as unknown as TCustomError);

    expect(result).toBe('undefined@undefined');
  });
});
