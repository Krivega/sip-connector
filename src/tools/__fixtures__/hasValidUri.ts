/**
 * Determines if it has valid uri.
 *
 * @param      {string}   uri     The uri for check
 * @param      {string}   url     The  base url
 * @returns     {boolean}  True if has valid uri, False otherwise.
 */
const hasValidUri = (uri: string, url = 'SIP_SERVER_URL') => {
  return !!new RegExp(`^sip:[0-9]{6,8}@${url}`).test(uri);
};

export default hasValidUri;
