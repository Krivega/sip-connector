import type { URI } from '@krivega/jssip';

const hasValidUri = ({ scheme, user, host }: URI, url = 'SIP_SERVER_URL') => {
  return !!new RegExp(`^sip:[0-9]{6,8}@${url}`).test(`${scheme}:${user}@${host}`);
};

export default hasValidUri;
