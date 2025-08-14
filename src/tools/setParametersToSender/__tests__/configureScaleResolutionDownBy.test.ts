/// <reference types="jest" />
import configureScaleResolutionDownBy from '../configureScaleResolutionDownBy';

describe('configureScaleResolutionDownBy', () => {
  it('should update scaleResolutionDownBy when target is greater than current', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {
      scaleResolutionDownBy: 1,
      maxBitrate: 500_000,
    };
    const scaleResolutionDownBy = 2;

    const result = configureScaleResolutionDownBy(encodingCurrent, scaleResolutionDownBy);

    expect(result.scaleResolutionDownBy).toBe(2);
  });

  it('should update scaleResolutionDownBy when target is less than current but greater than minimum', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {
      scaleResolutionDownBy: 3,
      maxBitrate: 500_000,
    };
    const scaleResolutionDownBy = 1.5;

    const result = configureScaleResolutionDownBy(encodingCurrent, scaleResolutionDownBy);

    expect(result.scaleResolutionDownBy).toBe(1.5);
  });

  it('should not update scaleResolutionDownBy when target is equal to current', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {
      scaleResolutionDownBy: 2,
      maxBitrate: 500_000,
    };
    const scaleResolutionDownBy = 2;

    const result = configureScaleResolutionDownBy(encodingCurrent, scaleResolutionDownBy);

    expect(result.scaleResolutionDownBy).toBe(2);
  });

  it('should not update scaleResolutionDownBy when target is less than minimum', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {
      scaleResolutionDownBy: 2,
      maxBitrate: 500_000,
    };
    const scaleResolutionDownBy = 0.5;

    const result = configureScaleResolutionDownBy(encodingCurrent, scaleResolutionDownBy);

    expect(result.scaleResolutionDownBy).toBe(1);
  });

  it('should return the original encodingCurrent if scaleResolutionDownByTarget is undefined', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {
      scaleResolutionDownBy: 1,
      maxBitrate: 500_000,
    };

    const result = configureScaleResolutionDownBy(encodingCurrent);

    expect(result).toEqual(encodingCurrent);
  });
});
