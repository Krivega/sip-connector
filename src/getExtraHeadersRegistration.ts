const getExtraHeadersRegistration = (remoteAddress) => {
  const headers: string[] = [];

  headers.push(`X-Vinteo-Remote: ${remoteAddress}`);

  return headers;
};

export default getExtraHeadersRegistration;
