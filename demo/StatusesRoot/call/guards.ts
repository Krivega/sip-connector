import { ECallStatus } from '@/index';

import type { TSnapshotByState } from './Model';

type THasCallState = {
  state: ECallStatus;
  context: unknown;
};

export const isCallInState = <TCall extends THasCallState, TState extends ECallStatus>(
  call: TCall,
  state: TState,
): call is TCall & TSnapshotByState<TState> => {
  return call.state === state;
};

export const isIdleCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TSnapshotByState<ECallStatus.IDLE> => {
  return isCallInState(call, ECallStatus.IDLE);
};
export const isConnectingCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TSnapshotByState<ECallStatus.CONNECTING> => {
  return isCallInState(call, ECallStatus.CONNECTING);
};
export const isPresentationCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TSnapshotByState<ECallStatus.PRESENTATION_CALL> => {
  return isCallInState(call, ECallStatus.PRESENTATION_CALL);
};
export const isRoomPendingAuthCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TSnapshotByState<ECallStatus.ROOM_PENDING_AUTH> => {
  return isCallInState(call, ECallStatus.ROOM_PENDING_AUTH);
};
export const isPurgatoryCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TSnapshotByState<ECallStatus.PURGATORY> => {
  return isCallInState(call, ECallStatus.PURGATORY);
};
export const isP2PRoomCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TSnapshotByState<ECallStatus.P2P_ROOM> => {
  return isCallInState(call, ECallStatus.P2P_ROOM);
};
export const isDirectP2PRoomCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TSnapshotByState<ECallStatus.DIRECT_P2P_ROOM> => {
  return isCallInState(call, ECallStatus.DIRECT_P2P_ROOM);
};
export const isInRoomCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TSnapshotByState<ECallStatus.IN_ROOM> => {
  return isCallInState(call, ECallStatus.IN_ROOM);
};
export const isDisconnectingCall = <TCall extends THasCallState>(
  call: TCall,
): call is TCall & TSnapshotByState<ECallStatus.DISCONNECTING> => {
  return isCallInState(call, ECallStatus.DISCONNECTING);
};
