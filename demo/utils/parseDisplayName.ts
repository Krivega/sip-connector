const parseDisplayName = (displayName: string) => {
  return displayName.trim().replaceAll(' ', '_');
};

export default parseDisplayName;
