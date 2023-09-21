import * as causes from '../../causes';
import type { ICustomError } from '../../SipConnector';

const getLinkError = (error: ICustomError): string | undefined => {
  const { url, cause } = error;

  let link = url;

  if (cause === causes.BAD_MEDIA_DESCRIPTION || cause === causes.NOT_FOUND) {
    link = `${error.message.to.uri.user}@${error.message.to.uri.host}`;
  }

  return link;
};

export default getLinkError;
