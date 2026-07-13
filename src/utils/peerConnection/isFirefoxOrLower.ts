import { createUaParser } from '@/tools/createUaParser';

let cachedUaParser: ReturnType<typeof createUaParser> | undefined;

const getUaParser = () => {
  cachedUaParser ??= createUaParser();

  return cachedUaParser;
};

export const isFirefoxOrLower = (version: number): boolean => {
  const { isFirefox, hasLessOrEqualBrowserVersion } = getUaParser();

  return (
    isFirefox &&
    hasLessOrEqualBrowserVersion({
      major: version,
      minor: 0,
      patch: 0,
    })
  );
};

export const resetUaParserCacheForTests = (): void => {
  cachedUaParser = undefined;
};
