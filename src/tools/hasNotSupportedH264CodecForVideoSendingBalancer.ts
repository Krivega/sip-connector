import { createUaParser } from '@/tools/createUaParser';

const hasNotSupportedH264CodecForVideoSendingBalancer = (): boolean => {
  const { isMobileDevice, isSafari, isOpera, isWindows } = createUaParser();

  const isOperaOnWindows = isOpera && isWindows;

  return isMobileDevice || isSafari || isOperaOnWindows;
};

export default hasNotSupportedH264CodecForVideoSendingBalancer;
