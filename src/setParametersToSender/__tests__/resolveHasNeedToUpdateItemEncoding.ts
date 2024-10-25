/// <reference types="jest" />
import resolveHasNeedToUpdateItemEncoding from '../resolveHasNeedToUpdateItemEncoding';

describe('resolveHasNeedToUpdateItemEncoding', () => {
  it('should return true when itemEncodingCurrent is undefined and itemEncodingTarget is not the default value', () => {
    const defaultValue = 1;
    const itemEncodingTarget = 2;

    const hasNeedToUpdate = resolveHasNeedToUpdateItemEncoding(defaultValue);
    const result = hasNeedToUpdate(itemEncodingTarget);

    expect(result).toBe(true);
  });

  it('should return false when itemEncodingCurrent is undefined and itemEncodingTarget is the default value', () => {
    const defaultValue = 1;
    const itemEncodingTarget = 1;

    const hasNeedToUpdate = resolveHasNeedToUpdateItemEncoding(defaultValue);
    const result = hasNeedToUpdate(itemEncodingTarget);

    expect(result).toBe(false);
  });

  it('should return true when itemEncodingCurrent is defined and itemEncodingTarget is different from itemEncodingCurrent', () => {
    const itemEncodingCurrent = 1;
    const itemEncodingTarget = 2;

    const hasNeedToUpdate = resolveHasNeedToUpdateItemEncoding();
    const result = hasNeedToUpdate(itemEncodingTarget, itemEncodingCurrent);

    expect(result).toBe(true);
  });

  it('should return false when itemEncodingCurrent is defined and itemEncodingTarget is the same as itemEncodingCurrent', () => {
    const itemEncodingCurrent = 1;
    const itemEncodingTarget = 1;

    const hasNeedToUpdate = resolveHasNeedToUpdateItemEncoding();
    const result = hasNeedToUpdate(itemEncodingTarget, itemEncodingCurrent);

    expect(result).toBe(false);
  });
});
