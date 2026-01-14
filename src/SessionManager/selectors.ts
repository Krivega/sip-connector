import {
  EIncomingStatus,
  ECallStatus,
  type EConnectionStatus,
  type EPresentationStatus,
  type TSessionSnapshot,
} from './types';

import type { TRemoteCallerData } from '@/IncomingCallManager';

const selectConnectionStatus = (snapshot: TSessionSnapshot): EConnectionStatus => {
  return snapshot.connection.value;
};

const selectCallStatus = (snapshot: TSessionSnapshot): ECallStatus => {
  return snapshot.call.value;
};

const selectIncomingStatus = (snapshot: TSessionSnapshot): EIncomingStatus => {
  return snapshot.incoming.value;
};

const selectIncomingRemoteCaller = (snapshot: TSessionSnapshot): TRemoteCallerData | undefined => {
  if (snapshot.incoming.value !== EIncomingStatus.IDLE) {
    return snapshot.incoming.context.remoteCallerData;
  }

  return undefined;
};

const selectPresentationStatus = (snapshot: TSessionSnapshot): EPresentationStatus => {
  return snapshot.presentation.value;
};

const selectIsInCall = (snapshot: TSessionSnapshot): boolean => {
  const status = selectCallStatus(snapshot);

  return status === ECallStatus.IN_CALL || status === ECallStatus.ACCEPTED;
};

export const sessionSelectors = {
  selectConnectionStatus,
  selectCallStatus,
  selectIncomingStatus,
  selectIncomingRemoteCaller,
  selectPresentationStatus,
  selectIsInCall,
};
