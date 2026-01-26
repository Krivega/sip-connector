/// <reference types="jest" />
import configureMaxBitrate from '../configureMaxBitrate';

describe('configureMaxBitrate', () => {
  it('should update maxBitrate when target is provided and different from current', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {
      maxBitrate: 1_000_000,
    };
    const maxBitrateTarget = 2_000_000;

    const result = configureMaxBitrate(encodingCurrent, maxBitrateTarget);

    expect(result.maxBitrate).toBe(2_000_000);
  });

  it('should not update maxBitrate when target is the same as current', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {
      maxBitrate: 1_000_000,
    };
    const maxBitrateTarget = 1_000_000;

    const result = configureMaxBitrate(encodingCurrent, maxBitrateTarget);

    expect(result.maxBitrate).toBe(1_000_000);
  });

  it('should not update maxBitrate when target is undefined', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {
      maxBitrate: 1_000_000,
    };

    const result = configureMaxBitrate(encodingCurrent);

    expect(result.maxBitrate).toBe(1_000_000);
  });

  it('should be update maxBitrate when target is undefined and isResetAllowed is true', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {
      maxBitrate: 1_000_000,
    };

    const result = configureMaxBitrate(encodingCurrent, undefined, { isResetAllowed: true });

    expect(result.maxBitrate).toBe(undefined);
  });

  it('should add maxBitrate when it is not present in encodingCurrent and target is provided', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {};
    const maxBitrateTarget = 2_000_000;

    const result = configureMaxBitrate(encodingCurrent, maxBitrateTarget);

    expect(result.maxBitrate).toBe(2_000_000);
  });

  it('should return the original encodingCurrent if maxBitrateTarget is undefined and maxBitrate is not set', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {};

    const result = configureMaxBitrate(encodingCurrent);

    expect(result).toEqual(encodingCurrent);
  });

  it('should return the original encodingCurrent if maxBitrateTarget is undefined and maxBitrate is not set and isResetAllowed is true', () => {
    const encodingCurrent: RTCRtpEncodingParameters = {};

    const result = configureMaxBitrate(encodingCurrent, undefined, { isResetAllowed: true });

    expect(result).toEqual(encodingCurrent);
  });
});
