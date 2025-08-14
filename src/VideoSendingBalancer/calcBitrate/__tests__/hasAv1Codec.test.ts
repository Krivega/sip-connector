/// <reference types="jest" />
import hasAv1Codec from '../hasAv1Codec';

describe('hasAv1Codec', () => {
  it('возвращает false для undefined codec', () => {
    expect(hasAv1Codec()).toBe(false);
    expect(hasAv1Codec(undefined)).toBe(false);
  });

  it('возвращает false для пустой строки', () => {
    expect(hasAv1Codec('')).toBe(false);
  });

  it('возвращает true для av1 (без учета регистра)', () => {
    expect(hasAv1Codec('av1')).toBe(true);
    expect(hasAv1Codec('AV1')).toBe(true);
    expect(hasAv1Codec('Av1')).toBe(true);
    expect(hasAv1Codec('aV1')).toBe(true);
  });

  it('возвращает true если av1 является подстрокой', () => {
    expect(hasAv1Codec('some-av1-codec')).toBe(true);
    expect(hasAv1Codec('codec_av1')).toBe(true);
    expect(hasAv1Codec('av1x')).toBe(true);
    expect(hasAv1Codec('xav1')).toBe(true);
    expect(hasAv1Codec('codec:av1;profile=main')).toBe(true);
  });

  it('возвращает false если av1 не является подстрокой', () => {
    expect(hasAv1Codec('avi')).toBe(false);
    expect(hasAv1Codec('a_v1')).toBe(false);
    expect(hasAv1Codec('vp8')).toBe(false);
    expect(hasAv1Codec('vp9')).toBe(false);
    expect(hasAv1Codec('h264')).toBe(false);
  });

  it('возвращает true для строк, содержащих av1 как подстроку', () => {
    expect(hasAv1Codec('av11')).toBe(true);
    expect(hasAv1Codec('av1x')).toBe(true);
    expect(hasAv1Codec('xav1')).toBe(true);
  });

  it('работает с пробелами', () => {
    expect(hasAv1Codec('  av1  ')).toBe(true);
    expect(hasAv1Codec(' av1')).toBe(true);
    expect(hasAv1Codec('av1 ')).toBe(true);
  });

  it('работает с сложными строками', () => {
    expect(hasAv1Codec('codec:av1;profile=main;level=3.1')).toBe(true);
    expect(hasAv1Codec('video/av1')).toBe(true);
    expect(hasAv1Codec('av1.0')).toBe(true);
  });
});
