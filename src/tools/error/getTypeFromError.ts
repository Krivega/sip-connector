import * as causes from '../../causes';
import type { ICustomError } from '../../SipConnector';
import getLinkError from './getLinkError';

export enum EErrorTypes {
  CONNECT_SERVER_FAILED = 'CONNECT_SERVER_FAILED',
  WRONG_USER_OR_PASSWORD = 'WRONG_USER_OR_PASSWORD',
  BAD_MEDIA_ERROR = 'BAD_MEDIA_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  WS_CONNECTION_FAILED = 'WS_CONNECTION_FAILED',
  CONNECT_SERVER_FAILED_BY_LINK = 'CONNECT_SERVER_FAILED_BY_LINK',
}

const getTypeFromError = (error: ICustomError = new Error()): EErrorTypes => {
  const { cause, socket } = error;

  let type: EErrorTypes = EErrorTypes.CONNECT_SERVER_FAILED;

  if (cause === 'Forbidden') {
    type = EErrorTypes.WRONG_USER_OR_PASSWORD;
  } else if (cause === causes.BAD_MEDIA_DESCRIPTION) {
    type = EErrorTypes.BAD_MEDIA_ERROR;
  } else if (cause === causes.NOT_FOUND) {
    type = EErrorTypes.NOT_FOUND_ERROR;
  } else if (socket && socket?._ws?.readyState === 3) {
    type = EErrorTypes.WS_CONNECTION_FAILED;
  } else if (getLinkError(error)) {
    type = EErrorTypes.CONNECT_SERVER_FAILED_BY_LINK;
  }

  return type;
};

export default getTypeFromError;
