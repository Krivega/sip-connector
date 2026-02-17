import {
  EIncomingStatus,
  ECallStatus,
  ESystemStatus,
  EConnectionStatus,
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

  return (
    status === ECallStatus.IN_ROOM ||
    status === ECallStatus.PURGATORY ||
    status === ECallStatus.P2P_ROOM ||
    status === ECallStatus.DIRECT_P2P_ROOM
  );
};

/**
 * Селектор для определения комбинированного состояния системы
 * на основе состояний Connection и Call машин
 */
const selectSystemStatus = (snapshot: TSessionSnapshot): ESystemStatus => {
  const callStatus = selectCallStatus(snapshot);

  // В активном звонке общий статус всегда CALL_ACTIVE независимо от connection/incoming/presentation
  if (
    callStatus === ECallStatus.IN_ROOM ||
    callStatus === ECallStatus.PURGATORY ||
    callStatus === ECallStatus.P2P_ROOM ||
    callStatus === ECallStatus.DIRECT_P2P_ROOM
  ) {
    return ESystemStatus.CALL_ACTIVE;
  }

  const connectionStatus = selectConnectionStatus(snapshot);

  // Соединение не установлено или отключено
  if (
    connectionStatus === EConnectionStatus.IDLE ||
    connectionStatus === EConnectionStatus.DISCONNECTED
  ) {
    return ESystemStatus.DISCONNECTED;
  }

  // Ошибка соединения
  if (connectionStatus === EConnectionStatus.FAILED) {
    return ESystemStatus.CONNECTION_FAILED;
  }

  // Идет процесс подключения
  if (
    connectionStatus === EConnectionStatus.PREPARING ||
    connectionStatus === EConnectionStatus.CONNECTING ||
    connectionStatus === EConnectionStatus.CONNECTED ||
    connectionStatus === EConnectionStatus.REGISTERED
  ) {
    return ESystemStatus.CONNECTING;
  }

  // Соединение установлено (ESTABLISHED)
  // Теперь определяем состояние на основе звонка
  switch (callStatus) {
    case ECallStatus.IDLE: {
      return ESystemStatus.READY_TO_CALL;
    }
    case ECallStatus.CONNECTING: {
      return ESystemStatus.CALL_CONNECTING;
    }
    default: {
      // Fallback на READY_TO_CALL для неизвестных состояний call
      return ESystemStatus.READY_TO_CALL;
    }
  }
};

export const sessionSelectors = {
  selectConnectionStatus,
  selectCallStatus,
  selectIncomingStatus,
  selectIncomingRemoteCaller,
  selectPresentationStatus,
  selectIsInCall,
  selectSystemStatus,
};
