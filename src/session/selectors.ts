import getChildSnapshot from './getChildSnapshot';
import { ECallStatus, EConnectionStatus, EIncomingStatus, EScreenShareStatus } from './rootMachine';

import type { TRemoteCallerData } from '@/IncomingCallManager/eventNames';
import type { TSessionSnapshot } from './rootMachine';

const selectConnectionStatus = (snapshot: TSessionSnapshot): EConnectionStatus => {
  const childSnapshot = getChildSnapshot(snapshot, 'connection');

  return childSnapshot?.value ?? EConnectionStatus.IDLE;
};

const selectCallStatus = (snapshot: TSessionSnapshot): ECallStatus => {
  const childSnapshot = getChildSnapshot(snapshot, 'call');

  return childSnapshot?.value ?? ECallStatus.IDLE;
};

const selectIncomingStatus = (snapshot: TSessionSnapshot): EIncomingStatus => {
  const childSnapshot = getChildSnapshot(snapshot, 'incoming');

  return childSnapshot?.value ?? EIncomingStatus.IDLE;
};

const selectIncomingRemoteCaller = (snapshot: TSessionSnapshot): TRemoteCallerData | undefined => {
  const childSnapshot = getChildSnapshot(snapshot, 'incoming');

  if (childSnapshot?.value !== EIncomingStatus.IDLE) {
    return childSnapshot?.context.remoteCallerData;
  }

  return undefined;
};

const selectScreenShareStatus = (snapshot: TSessionSnapshot): EScreenShareStatus => {
  const childSnapshot = getChildSnapshot(snapshot, 'screenShare');

  return childSnapshot?.value ?? EScreenShareStatus.IDLE;
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
  selectScreenShareStatus,
  selectIsInCall,
};
