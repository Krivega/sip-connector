import type { CallStateMachine, TCallSnapshot } from '@/CallManager/CallStateMachine';
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
};

export type TSessionMachines = {
  connection: ConnectionStateMachine;
  call: CallStateMachine;
  incoming: IncomingCallStateMachine;
  presentation: PresentationStateMachine;
};

export { EState as ECallStatus } from '@/CallManager/CallStateMachine';
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
  /** Идет процесс подключения (preparing, connecting, connected, registered) */
  CONNECTING = 'system:connecting',
  /** Соединение установлено, готово к звонкам, но звонок не активен */
  READY_TO_CALL = 'system:readyToCall',
  /** Идет установка звонка (connection established, call connecting) */
  CALL_CONNECTING = 'system:callConnecting',
  /** Звонок активен (connection established, call accepted/inCall) */
  CALL_ACTIVE = 'system:callActive',
  /** Ошибка соединения (connection failed) */
  CONNECTION_FAILED = 'system:connectionFailed',
  /** Ошибка звонка (connection established, call failed) */
  CALL_FAILED = 'system:callFailed',
}
