import { EAutoConnectorStatus, ECallStatus, EConnectionStatus, ESystemStatus } from './types';

import type { EIncomingStatus, EPresentationStatus, TSessionSnapshot } from './types';

const selectConnectionStatus = (snapshot: TSessionSnapshot): EConnectionStatus => {
  return snapshot.connection.value;
};

const selectAutoConnectorStatus = (snapshot: TSessionSnapshot): EAutoConnectorStatus => {
  return snapshot.autoConnector.value;
};

const selectCallState = (snapshot: TSessionSnapshot): TSessionSnapshot['call'] => {
  return snapshot.call;
};

const selectCallStatus = (snapshot: TSessionSnapshot): ECallStatus => {
  return snapshot.call.value;
};

const selectIncomingStatus = (snapshot: TSessionSnapshot): EIncomingStatus => {
  return snapshot.incoming.value;
};

const selectPresentationStatus = (snapshot: TSessionSnapshot): EPresentationStatus => {
  return snapshot.presentation.value;
};

const selectIsInCall = (snapshot: TSessionSnapshot): boolean => {
  const status = selectCallStatus(snapshot);

  return (
    status === ECallStatus.IN_ROOM ||
    status === ECallStatus.ROOM_PENDING_AUTH ||
    status === ECallStatus.PURGATORY ||
    status === ECallStatus.P2P_ROOM ||
    status === ECallStatus.DIRECT_P2P_ROOM ||
    status === ECallStatus.PRESENTATION_CALL
  );
};

/**
 * Селектор для определения комбинированного состояния системы
 * на основе состояний Connection, Call и AutoConnector машин
 */
const selectSystemStatus = (snapshot: TSessionSnapshot): ESystemStatus => {
  const callStatus = selectCallStatus(snapshot);

  // В активном звонке общий статус всегда CALL_ACTIVE независимо от connection/incoming/presentation
  if (
    callStatus === ECallStatus.IN_ROOM ||
    callStatus === ECallStatus.ROOM_PENDING_AUTH ||
    callStatus === ECallStatus.PURGATORY ||
    callStatus === ECallStatus.P2P_ROOM ||
    callStatus === ECallStatus.DIRECT_P2P_ROOM ||
    callStatus === ECallStatus.PRESENTATION_CALL
  ) {
    return ESystemStatus.CALL_ACTIVE;
  }

  const connectionStatus = selectConnectionStatus(snapshot);
  const autoConnectorStatus = selectAutoConnectorStatus(snapshot);

  // Идет процесс отключения или AutoConnector в disconnecting
  if (
    connectionStatus === EConnectionStatus.DISCONNECTING ||
    autoConnectorStatus === EAutoConnectorStatus.DISCONNECTING
  ) {
    return ESystemStatus.DISCONNECTING;
  }

  // AutoConnector выполняет попытку соединения (например при IDLE у connection)
  if (
    autoConnectorStatus === EAutoConnectorStatus.ATTEMPTING_CONNECT ||
    autoConnectorStatus === EAutoConnectorStatus.ATTEMPTING_GATE ||
    autoConnectorStatus === EAutoConnectorStatus.WAITING_BEFORE_RETRY ||
    // Мониторинг после успешного connect: CONNECTING только пока SIP ещё не ESTABLISHED
    (autoConnectorStatus === EAutoConnectorStatus.CONNECTED_MONITORING &&
      connectionStatus !== EConnectionStatus.ESTABLISHED)
  ) {
    return ESystemStatus.CONNECTING;
  }

  // Соединение не установлено или отключено
  if (
    connectionStatus === EConnectionStatus.IDLE ||
    connectionStatus === EConnectionStatus.DISCONNECTED
  ) {
    return ESystemStatus.DISCONNECTED;
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
    case ECallStatus.DISCONNECTING: {
      return ESystemStatus.CALL_DISCONNECTING;
    }
    default: {
      // Fallback на READY_TO_CALL для неизвестных состояний call
      return ESystemStatus.READY_TO_CALL;
    }
  }
};

const selectCallSession = (snapshot: TSessionSnapshot): TSessionSnapshot['callSession'] => {
  return snapshot.callSession;
};

const selectCallSessionRole = (
  snapshot: TSessionSnapshot,
): TSessionSnapshot['callSession']['role'] => {
  return snapshot.callSession.role;
};

const hasSpectatorRole = (role: TSessionSnapshot['callSession']['role']): boolean => {
  return role.type === 'spectator' || role.type === 'spectator_synthetic';
};

const hasParticipantRole = (role: TSessionSnapshot['callSession']['role']): boolean => {
  return role.type === 'participant';
};

/**
 * Истинно, если зритель повышен до участника ВО ВРЕМЯ активного звонка
 * (а не в результате сброса роли при завершении). Оба поля берутся из ОДНОГО
 * снапшота, поэтому корреляция «звонок активен + смена роли» консистентна и не
 * зависит от порядка подписок: при завершении звонка next уже не isInCall.
 */
const hasSpectatorPromotedToParticipantDuringCall = (
  previous: TSessionSnapshot,
  next: TSessionSnapshot,
): boolean => {
  return (
    selectIsInCall(next) &&
    hasSpectatorRole(previous.callSession.role) &&
    hasParticipantRole(next.callSession.role)
  );
};

export const sessionSelectors = {
  selectConnectionStatus,
  selectAutoConnectorStatus,
  selectCallState,
  selectCallStatus,
  selectIncomingStatus,
  selectPresentationStatus,
  selectIsInCall,
  selectSystemStatus,
  selectCallSession,
  selectCallSessionRole,
  hasSpectatorPromotedToParticipantDuringCall,
};
