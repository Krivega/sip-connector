import type { createUaParser } from '@/tools/createUaParser';

const initialUaParser: ReturnType<typeof createUaParser> = {
  isMobileDevice: false,
  isSafari: false,
  isYandexBrowser: false,
  isOpera: false,
  isWindows: false,
  isChrome: false,
  hasGreaterThanBrowserVersion: () => {
    return false;
  },
};

let mockUaParser: ReturnType<typeof createUaParser> = { ...initialUaParser };

jest.mock('@/tools/createUaParser', () => {
  return {
    __esModule: true,
    createUaParser: () => {
      return mockUaParser;
    },
  };
});

export const setUaParser = (uaParser: Partial<ReturnType<typeof createUaParser>>) => {
  mockUaParser = { ...initialUaParser, ...uaParser };
};
