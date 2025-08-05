/// <reference types="jest" />
import scaleBitrateByCodec from '../scaleBitrateByCodec';

describe('scaleBitrateByCodec', () => {
  it('возвращает bitrate без изменений для undefined codec', () => {
    expect(scaleBitrateByCodec(1_000_000)).toBe(1_000_000);
    expect(scaleBitrateByCodec(500_000, undefined)).toBe(500_000);
  });

  it('возвращает bitrate без изменений для пустой строки', () => {
    expect(scaleBitrateByCodec(1_000_000, '')).toBe(1_000_000);
  });

  it('возвращает bitrate без изменений для vp8/vp9/h264', () => {
    expect(scaleBitrateByCodec(1_000_000, 'vp8')).toBe(1_000_000);
    expect(scaleBitrateByCodec(1_000_000, 'vp9')).toBe(1_000_000);
    expect(scaleBitrateByCodec(1_000_000, 'h264')).toBe(1_000_000);
    expect(scaleBitrateByCodec(1_000_000, 'VP8')).toBe(1_000_000);
  });

  it('умножает на 0.6 для av1 (без учета регистра)', () => {
    expect(scaleBitrateByCodec(1_000_000, 'av1')).toBeCloseTo(600_000);
    expect(scaleBitrateByCodec(1_000_000, 'av1x')).toBeCloseTo(600_000);
    expect(scaleBitrateByCodec(1_000_000, 'AV1')).toBeCloseTo(600_000);
    expect(scaleBitrateByCodec(1_000_000, 'some-av1-codec')).toBeCloseTo(600_000);
    expect(scaleBitrateByCodec(1_000_000, 'codec_av1')).toBeCloseTo(600_000);
  });

  it('возвращает bitrate без изменений если av1 не подстрока', () => {
    expect(scaleBitrateByCodec(1_000_000, 'avi')).toBe(1_000_000);
    expect(scaleBitrateByCodec(1_000_000, 'a_v1')).toBe(1_000_000);
  });

  it('работает с пробелами и сложными строками', () => {
    expect(scaleBitrateByCodec(1_000_000, '  av1  ')).toBeCloseTo(600_000);
    expect(scaleBitrateByCodec(1_000_000, 'codec:av1;profile=main')).toBeCloseTo(600_000);
    expect(scaleBitrateByCodec(1_000_000, 'codec:vp8;profile=main')).toBe(1_000_000);
  });

  it('корректно работает с нулевым битрейтом', () => {
    expect(scaleBitrateByCodec(0, 'av1')).toBe(0);
    expect(scaleBitrateByCodec(0, 'vp8')).toBe(0);
  });

  it('корректно работает с отрицательным битрейтом', () => {
    expect(scaleBitrateByCodec(-1000, 'av1')).toBeCloseTo(-600);
    expect(scaleBitrateByCodec(-1000, 'vp8')).toBe(-1000);
  });
});
