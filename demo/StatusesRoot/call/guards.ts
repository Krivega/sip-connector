import { ECallStatus } from '@/index';

type THasCallState = {
  state: ECallStatus;
};

export const isCallInState = <T extends THasCallState, S extends ECallStatus>(
  call: T,
  state: S,
): call is Extract<T, { state: S }> => {
  return call.state === state;
};

export const isIdleCall = <T extends THasCallState>(
  call: T,
): call is Extract<T, { state: ECallStatus.IDLE }> => {
  return isCallInState(call, ECallStatus.IDLE);
};
export const isConnectingCall = <T extends THasCallState>(
  call: T,
): call is Extract<T, { state: ECallStatus.CONNECTING }> => {
  return isCallInState(call, ECallStatus.CONNECTING);
};
export const isPresentationCall = <T extends THasCallState>(
  call: T,
): call is Extract<T, { state: ECallStatus.PRESENTATION_CALL }> => {
  return isCallInState(call, ECallStatus.PRESENTATION_CALL);
};
export const isRoomPendingAuthCall = <T extends THasCallState>(
  call: T,
): call is Extract<T, { state: ECallStatus.ROOM_PENDING_AUTH }> => {
  return isCallInState(call, ECallStatus.ROOM_PENDING_AUTH);
};
export const isPurgatoryCall = <T extends THasCallState>(
  call: T,
): call is Extract<T, { state: ECallStatus.PURGATORY }> => {
  return isCallInState(call, ECallStatus.PURGATORY);
};
export const isP2PRoomCall = <T extends THasCallState>(
  call: T,
): call is Extract<T, { state: ECallStatus.P2P_ROOM }> => {
  return isCallInState(call, ECallStatus.P2P_ROOM);
};
export const isDirectP2PRoomCall = <T extends THasCallState>(
  call: T,
): call is Extract<T, { state: ECallStatus.DIRECT_P2P_ROOM }> => {
  return isCallInState(call, ECallStatus.DIRECT_P2P_ROOM);
};
export const isInRoomCall = <T extends THasCallState>(
  call: T,
): call is Extract<T, { state: ECallStatus.IN_ROOM }> => {
  return isCallInState(call, ECallStatus.IN_ROOM);
};
export const isDisconnectingCall = <T extends THasCallState>(
  call: T,
): call is Extract<T, { state: ECallStatus.DISCONNECTING }> => {
  return isCallInState(call, ECallStatus.DISCONNECTING);
};
