import { ECallCause } from '@/CallManager';

import type { TCustomError } from '@/CallManager';

const getLink = (error: TCustomError): string => {
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return `${error.message.to.uri.user}@${error.message.to.uri.host}`;
};

const getLinkError = (error: TCustomError): string | undefined => {
  const { url, cause } = error;

  const link =
    cause === ECallCause.BAD_MEDIA_DESCRIPTION || cause === ECallCause.NOT_FOUND
      ? getLink(error)
      : url;

  return link;
};

export default getLinkError;
