import createUaParser from '../createUaParser';
import isElectronEnvironment from '../isElectronEnvironment';

jest.mock('ua-parser-js', () => {
  return {
    UAParser: jest.fn(),
  };
});

jest.mock('../isElectronEnvironment', () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

describe('createUaParser', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('isChrome = true, когда браузер Chrome и не Electron', () => {
    const { UAParser } = jest.requireMock('ua-parser-js') as {
      UAParser: jest.Mock;
    };

    UAParser.mockImplementation(() => {
      return {
        getBrowser: () => {
          return { name: 'Chrome' };
        },
      };
    });

    (isElectronEnvironment as jest.Mock).mockReturnValue(false);

    const api = createUaParser();

    expect(api.isChrome).toBe(true);
  });

  test('isChrome = true, когда не Chrome, но Electron', () => {
    const { UAParser } = jest.requireMock('ua-parser-js') as {
      UAParser: jest.Mock;
    };

    UAParser.mockImplementation(() => {
      return {
        getBrowser: () => {
          return { name: 'Firefox' };
        },
      };
    });

    (isElectronEnvironment as jest.Mock).mockReturnValue(true);

    const api = createUaParser();

    expect(api.isChrome).toBe(true);
  });

  test('isChrome = false, когда не Chrome и не Electron', () => {
    const { UAParser } = jest.requireMock('ua-parser-js') as {
      UAParser: jest.Mock;
    };

    UAParser.mockImplementation(() => {
      return {
        getBrowser: () => {
          return { name: 'Safari' };
        },
      };
    });

    (isElectronEnvironment as jest.Mock).mockReturnValue(false);

    const api = createUaParser();

    expect(api.isChrome).toBe(false);
  });
});
