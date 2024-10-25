const resolveHasNeedToUpdateItemEncoding = (defaultValue?: number) => {
  return (itemEncodingTarget: typeof defaultValue, itemEncodingCurrent?: number): boolean => {
    const isChangedDefaultScale =
      itemEncodingCurrent === undefined && itemEncodingTarget !== defaultValue;
    const isChangedPreviousScale =
      itemEncodingCurrent !== undefined && itemEncodingTarget !== itemEncodingCurrent;

    const isNeedToChange = isChangedPreviousScale || isChangedDefaultScale;

    return isNeedToChange;
  };
};

export default resolveHasNeedToUpdateItemEncoding;
