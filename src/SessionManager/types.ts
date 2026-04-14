import type { IAutoConnectorStateMachine, TAutoConnectorSnapshot } from '@/AutoConnectorManager';
import type { ICallStateMachine, TCallSnapshot } from '@/CallManager';
import type {
  ConnectionStateMachine,
  TConnectionSnapshot,
} from '@/ConnectionManager/ConnectionStateMachine';
import type {
  IncomingCallStateMachine,
  TIncomingSnapshot,
} from '@/IncomingCallManager/IncomingCallStateMachine';
import type {
  TPresentationSnapshot,
  PresentationStateMachine,
} from '@/PresentationManager/PresentationStateMachine';

export type TSessionSnapshot = {
  connection: TConnectionSnapshot;
  call: TCallSnapshot;
  incoming: TIncomingSnapshot;
  presentation: TPresentationSnapshot;
  autoConnector: TAutoConnectorSnapshot;
};

export type TSessionMachines = {
  connection: ConnectionStateMachine;
  call: ICallStateMachine;
  incoming: IncomingCallStateMachine;
  presentation: PresentationStateMachine;
  autoConnector: IAutoConnectorStateMachine;
};

export { EState as ECallStatus } from '@/CallManager/CallStateMachine';
export { EAutoConnectorState as EAutoConnectorStatus } from '@/AutoConnectorManager/AutoConnectorStateMachine';
export { EState as EIncomingStatus } from '@/IncomingCallManager/IncomingCallStateMachine';
export { EState as EPresentationStatus } from '@/PresentationManager/PresentationStateMachine';
export { EState as EConnectionStatus } from '@/ConnectionManager/ConnectionStateMachine';

/**
 * Комбинированное состояние системы, объединяющее состояния Connection и Call
 * для однозначного определения текущего состояния системы клиентом
 */
export enum ESystemStatus {
  /** Система не инициализирована, соединение не установлено */
  DISCONNECTED = 'system:disconnected',
  /** Идет процесс отключения (ожидание disconnected от UA) */
  DISCONNECTING = 'system:disconnecting',
  /** Идет процесс подключения (preparing, connecting, connected, registered) */
  CONNECTING = 'system:connecting',
  /** Соединение установлено, готово к звонкам, но звонок не активен */
  READY_TO_CALL = 'system:readyToCall',
  /** Идет установка звонка (connection established, call connecting) */
  CALL_CONNECTING = 'system:callConnecting',
  /** Идет процесс отключения звонка (connection established, call disconnecting) */
  CALL_DISCONNECTING = 'system:callDisconnecting',
  /** Звонок активен (connection established, call accepted/inCall) */
  CALL_ACTIVE = 'system:callActive',
}
