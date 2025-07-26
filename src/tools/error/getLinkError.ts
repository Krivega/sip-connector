import { ECallCause } from '../../CallManager/causes';
import type { TCustomError } from '../../types';

const getLinkError = (error: TCustomError): string | undefined => {
  const { url, cause } = error;

  let link = url;

  if (cause === ECallCause.BAD_MEDIA_DESCRIPTION || cause === ECallCause.NOT_FOUND) {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    link = `${error.message.to.uri.user}@${error.message.to.uri.host}`;
  }

  return link;
};

export default getLinkError;
