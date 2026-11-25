export const PART_NAME_HEADER = 'X-VINTEO-PARTNAME';

export const createPartNameExtraHeader = (partName?: string): string[] => {
  return partName === undefined || partName === '' ? [] : [`${PART_NAME_HEADER}: ${partName}`];
};
