import * as causes from '../../causes';
import type { TCustomError } from '../../types';

const getLinkError = (error: TCustomError): string | undefined => {
  const { url, cause } = error;

  let link = url;

  if (cause === causes.BAD_MEDIA_DESCRIPTION || cause === causes.NOT_FOUND) {
    // @ts-expect-error
    link = `${error.message.to.uri.user}@${error.message.to.uri.host}`;
  }

  return link;
};

export default getLinkError;
