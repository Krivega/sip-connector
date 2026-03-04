/// <reference types="jest" />
import { setUaParser } from '@/__fixtures__/mockCreateUaParser';
import { EMimeTypesVideoCodecs } from '@/types';
import getPriorityCodecs from '../getPriorityCodecs';

describe('getPriorityCodecs', () => {
  it('должен вернуть массив с VP8 когда проверяемая версия браузера больше, чем текущая и это яндекс браузер', () => {
    setUaParser({
      isYandexBrowser: true,
      hasGreaterThanBrowserVersion: () => {
        return true;
      },
    });

    const result = getPriorityCodecs();

    expect(result).toEqual([EMimeTypesVideoCodecs.VP8]);
  });

  it('должен вернуть undefined когда проверяемая версия браузера меньше или равна, чем текущая и это яндекс браузер', () => {
    setUaParser({
      isYandexBrowser: true,
      hasGreaterThanBrowserVersion: () => {
        return false;
      },
    });

    const result = getPriorityCodecs();

    expect(result).toBeUndefined();
  });

  it('должен вернуть undefined когда проверяемая версия браузера больше, чем текущая и это не яндекс браузер', () => {
    setUaParser({
      isYandexBrowser: false,
      hasGreaterThanBrowserVersion: () => {
        return true;
      },
    });

    const result = getPriorityCodecs();

    expect(result).toBeUndefined();
  });
});
