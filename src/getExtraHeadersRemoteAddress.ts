const getExtraHeadersRegistration = (remoteAddress?: string) => {
  const headers: string[] = [];

  if (remoteAddress) {
    headers.push(`X-Vinteo-Remote: ${remoteAddress}`);
  }

  return headers;
};

export default getExtraHeadersRegistration;
