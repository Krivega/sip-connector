const getVersionParsed = (version = '') => {
  const versionArray = version.split('.');

  if (versionArray.length <= 1) {
    return {
      major: undefined,
      minor: undefined,
      patch: undefined,
    };
  }

  const [major, minor, patch] = versionArray.map((part) => {
    return Number.parseInt(part, 10);
  });

  return { major, minor, patch };
};

export default getVersionParsed;
