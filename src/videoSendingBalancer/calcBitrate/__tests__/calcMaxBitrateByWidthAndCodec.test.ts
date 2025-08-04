/// <reference types="jest" />
import calcMaxBitrateByWidthAndCodec from '../calcMaxBitrateByWidthAndCodec';

describe('calcMaxBitrateByWidthAndCodec', () => {
  it('should scale resolution down and calculate max bitrate correctly', () => {
    const width = 1280;
    const codec = 'vp8';

    const result = calcMaxBitrateByWidthAndCodec(width, codec);

    expect(result).toEqual(1_000_000);
  });

  it('should use SCALE_MIN when scaling factor is less than 1', () => {
    const width = 1280;
    const codec = 'vp9';

    const result = calcMaxBitrateByWidthAndCodec(width, codec);

    expect(result).toEqual(1_000_000);
  });

  it('should handle odd target width correctly', () => {
    const width = 640;
    const codec = 'vp8';

    const result = calcMaxBitrateByWidthAndCodec(width, codec);

    expect(result).toEqual(500_000);
  });

  it('should handle small odd target values correctly', () => {
    const width = 320;
    const codec = 'vp8';

    const result = calcMaxBitrateByWidthAndCodec(width, codec);

    expect(result).toEqual(320_000);
  });
});
