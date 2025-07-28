const getExtraHeadersRegistration = (remoteAddress?: string) => {
  const headers: string[] = [];

  if (remoteAddress !== undefined && remoteAddress !== '') {
    headers.push(`X-Vinteo-Remote: ${remoteAddress}`);
  }

  return headers;
};

export default getExtraHeadersRegistration;
