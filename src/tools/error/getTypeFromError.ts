import * as causes from '../../causes';
import type { TCustomError } from '../../types';
import getLinkError from './getLinkError';

export enum EErrorTypes {
  CONNECT_SERVER_FAILED = 'CONNECT_SERVER_FAILED',
  WRONG_USER_OR_PASSWORD = 'WRONG_USER_OR_PASSWORD',
  BAD_MEDIA_ERROR = 'BAD_MEDIA_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  WS_CONNECTION_FAILED = 'WS_CONNECTION_FAILED',
  CONNECT_SERVER_FAILED_BY_LINK = 'CONNECT_SERVER_FAILED_BY_LINK',
}

const getTypeFromError = (error: TCustomError = new Error()): EErrorTypes => {
  const { cause, socket } = error;

  let type: EErrorTypes = EErrorTypes.CONNECT_SERVER_FAILED;

  switch (cause) {
    case 'Forbidden': {
      type = EErrorTypes.WRONG_USER_OR_PASSWORD;

      break;
    }
    case causes.BAD_MEDIA_DESCRIPTION: {
      type = EErrorTypes.BAD_MEDIA_ERROR;

      break;
    }
    case causes.NOT_FOUND: {
      type = EErrorTypes.NOT_FOUND_ERROR;

      break;
    }
    default: {
      // @ts-expect-error
      // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-unsafe-member-access
      if (socket && socket._ws?.readyState === 3) {
        type = EErrorTypes.WS_CONNECTION_FAILED;
      } else if (getLinkError(error)) {
        type = EErrorTypes.CONNECT_SERVER_FAILED_BY_LINK;
      }
    }
  }

  return type;
};

export default getTypeFromError;
