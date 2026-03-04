/// <reference types="jest" />
import { setUaParser } from '@/__fixtures__/mockCreateUaParser';
import hasNotSupportedH264CodecForVideoSendingBalancer from '../hasNotSupportedH264CodecForVideoSendingBalancer';

describe('hasNotSupportedH264CodecForVideoSendingBalancer', () => {
  it('should return true when is mobile device', () => {
    setUaParser({ isMobileDevice: true });

    expect(hasNotSupportedH264CodecForVideoSendingBalancer()).toBe(true);
  });

  it('should return true when is Safari', () => {
    setUaParser({ isSafari: true });

    expect(hasNotSupportedH264CodecForVideoSendingBalancer()).toBe(true);
  });

  it('should return true when is Opera on Windows', () => {
    setUaParser({ isOpera: true, isWindows: true });

    expect(hasNotSupportedH264CodecForVideoSendingBalancer()).toBe(true);
  });

  it('should return false when is Yandex Browser on Windows', () => {
    setUaParser({ isYandexBrowser: true, isWindows: true });

    expect(hasNotSupportedH264CodecForVideoSendingBalancer()).toBe(false);
  });

  it('should return false when not on any of the above', () => {
    setUaParser({
      isMobileDevice: false,
      isSafari: false,
      isOpera: false,
      isYandexBrowser: false,
      isWindows: false,
    });

    expect(hasNotSupportedH264CodecForVideoSendingBalancer()).toBe(false);
  });
});
