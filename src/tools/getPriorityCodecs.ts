import { createUaParser } from '@/tools/createUaParser';
import { EMimeTypesVideoCodecs } from '../types';

const YANDEX_BROWSER_VERSION_WITH_FIXED_H264_CODEC = {
  major: 25,
  minor: 8,
  patch: 0,
};

const hasYandexBrowserWithBrokenH264Codec = ({
  isYandexBrowser,
  hasGreaterThanBrowserVersion,
}: {
  isYandexBrowser: boolean;
  hasGreaterThanBrowserVersion: (version: {
    major: number;
    minor: number;
    patch: number;
  }) => boolean;
}): boolean => {
  const isGreaterThanBrowserVersion = hasGreaterThanBrowserVersion(
    YANDEX_BROWSER_VERSION_WITH_FIXED_H264_CODEC,
  );

  return isYandexBrowser && isGreaterThanBrowserVersion;
};

const getPriorityCodecs = (): string[] | undefined => {
  const uaParser = createUaParser();

  if (hasYandexBrowserWithBrokenH264Codec(uaParser)) {
    return [EMimeTypesVideoCodecs.VP8];
  }

  return undefined;
};

export default getPriorityCodecs;
