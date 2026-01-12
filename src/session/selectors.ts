import getChildSnapshot from './getChildSnapshot';
import { ECallStatus, EConnectionStatus, EIncomingStatus, EScreenShareStatus } from './types';

import type { TRemoteCallerData } from '@/IncomingCallManager/eventNames';
import type { TSipSessionSnapshot } from './rootMachine';

export const selectConnectionStatus = (snapshot: TSipSessionSnapshot): EConnectionStatus => {
  const childSnapshot = getChildSnapshot(snapshot, 'connection');

  return childSnapshot?.value ?? EConnectionStatus.IDLE;
};

export const selectCallStatus = (snapshot: TSipSessionSnapshot): ECallStatus => {
  const childSnapshot = getChildSnapshot(snapshot, 'call');

  return childSnapshot?.value ?? ECallStatus.IDLE;
};

export const selectIncomingStatus = (snapshot: TSipSessionSnapshot): EIncomingStatus => {
  const childSnapshot = getChildSnapshot(snapshot, 'incoming');

  return childSnapshot?.value ?? EIncomingStatus.IDLE;
};

export const selectIncomingRemoteCaller = (
  snapshot: TSipSessionSnapshot,
): TRemoteCallerData | undefined => {
  const childSnapshot = getChildSnapshot(snapshot, 'incoming');

  if (childSnapshot?.value !== EIncomingStatus.IDLE) {
    return (childSnapshot?.context as { remoteCallerData?: TRemoteCallerData }).remoteCallerData;
  }

  return undefined;
};

export const selectScreenShareStatus = (snapshot: TSipSessionSnapshot): EScreenShareStatus => {
  const childSnapshot = getChildSnapshot(snapshot, 'screenShare');

  return childSnapshot?.value ?? EScreenShareStatus.IDLE;
};

export const selectIsInCall = (snapshot: TSipSessionSnapshot): boolean => {
  const status = selectCallStatus(snapshot);

  return status === ECallStatus.IN_CALL || status === ECallStatus.ACCEPTED;
};
