import { ECallStatus } from '@/index';

type TCallStateful = {
  state: ECallStatus;
};

export const isCallState = <T extends TCallStateful, S extends ECallStatus>(
  node: T,
  state: S,
): node is Extract<T, { state: S }> => {
  return node.state === state;
};

export const isIdleCallNode = <T extends TCallStateful>(
  node: T,
): node is Extract<T, { state: ECallStatus.IDLE }> => {
  return isCallState(node, ECallStatus.IDLE);
};
export const isConnectingCallNode = <T extends TCallStateful>(
  node: T,
): node is Extract<T, { state: ECallStatus.CONNECTING }> => {
  return isCallState(node, ECallStatus.CONNECTING);
};
export const isPresentationCallNode = <T extends TCallStateful>(
  node: T,
): node is Extract<T, { state: ECallStatus.PRESENTATION_CALL }> => {
  return isCallState(node, ECallStatus.PRESENTATION_CALL);
};
export const isRoomPendingAuthCallState = <T extends TCallStateful>(
  node: T,
): node is Extract<T, { state: ECallStatus.ROOM_PENDING_AUTH }> => {
  return isCallState(node, ECallStatus.ROOM_PENDING_AUTH);
};
export const isPurgatoryCallNode = <T extends TCallStateful>(
  node: T,
): node is Extract<T, { state: ECallStatus.PURGATORY }> => {
  return isCallState(node, ECallStatus.PURGATORY);
};
export const isP2PRoomCallNode = <T extends TCallStateful>(
  node: T,
): node is Extract<T, { state: ECallStatus.P2P_ROOM }> => {
  return isCallState(node, ECallStatus.P2P_ROOM);
};
export const isDirectP2PRoomCallNode = <T extends TCallStateful>(
  node: T,
): node is Extract<T, { state: ECallStatus.DIRECT_P2P_ROOM }> => {
  return isCallState(node, ECallStatus.DIRECT_P2P_ROOM);
};
export const isInRoomCallNode = <T extends TCallStateful>(
  node: T,
): node is Extract<T, { state: ECallStatus.IN_ROOM }> => {
  return isCallState(node, ECallStatus.IN_ROOM);
};
export const isDisconnectingCallNode = <T extends TCallStateful>(
  node: T,
): node is Extract<T, { state: ECallStatus.DISCONNECTING }> => {
  return isCallState(node, ECallStatus.DISCONNECTING);
};
