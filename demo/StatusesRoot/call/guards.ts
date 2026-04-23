import { ECallStatus } from '@/index';

import type { TCallContextMap } from '@/index';

type THasCallState = {
  state: ECallStatus;
  context: unknown;
};

type TCallSnapshotByState<TState extends ECallStatus> = {
  state: TState;
  context: TCallContextMap[TState];
};

export const isCallInState = <TCall extends THasCallState, TState extends ECallStatus>(
  call: TCall,
  state: TState,
): call is TCall & TCallSnapshotByState<TState> => {
  return call.state === state;
};

export const isIdleCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TCallSnapshotByState<ECallStatus.IDLE> => {
  return isCallInState(call, ECallStatus.IDLE);
};
export const isConnectingCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TCallSnapshotByState<ECallStatus.CONNECTING> => {
  return isCallInState(call, ECallStatus.CONNECTING);
};
export const isPresentationCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TCallSnapshotByState<ECallStatus.PRESENTATION_CALL> => {
  return isCallInState(call, ECallStatus.PRESENTATION_CALL);
};
export const isRoomPendingAuthCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TCallSnapshotByState<ECallStatus.ROOM_PENDING_AUTH> => {
  return isCallInState(call, ECallStatus.ROOM_PENDING_AUTH);
};
export const isPurgatoryCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TCallSnapshotByState<ECallStatus.PURGATORY> => {
  return isCallInState(call, ECallStatus.PURGATORY);
};
export const isP2PRoomCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TCallSnapshotByState<ECallStatus.P2P_ROOM> => {
  return isCallInState(call, ECallStatus.P2P_ROOM);
};
export const isDirectP2PRoomCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TCallSnapshotByState<ECallStatus.DIRECT_P2P_ROOM> => {
  return isCallInState(call, ECallStatus.DIRECT_P2P_ROOM);
};
export const isInRoomCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TCallSnapshotByState<ECallStatus.IN_ROOM> => {
  return isCallInState(call, ECallStatus.IN_ROOM);
};
export const isDisconnectingCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TCallSnapshotByState<ECallStatus.DISCONNECTING> => {
  return isCallInState(call, ECallStatus.DISCONNECTING);
};
