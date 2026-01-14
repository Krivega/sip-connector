import type { TCallActor, TCallSnapshot } from '@/CallManager/CallStateMachine';
import type {
  TConnectionActor,
  TConnectionSnapshot,
} from '@/ConnectionManager/ConnectionStateMachine';
import type {
  TIncomingActor,
  TIncomingSnapshot,
} from '@/IncomingCallManager/IncomingCallStateMachine';
import type {
  TPresentationActor,
  TPresentationSnapshot,
} from '@/PresentationManager/PresentationStateMachine';

export type TSessionSnapshot = {
  connection: TConnectionSnapshot;
  call: TCallSnapshot;
  incoming: TIncomingSnapshot;
  presentation: TPresentationSnapshot;
};

export type TSessionActors = {
  connection: TConnectionActor;
  call: TCallActor;
  incoming: TIncomingActor;
  presentation: TPresentationActor;
};

export { EState as ECallStatus } from '@/CallManager/CallStateMachine';
export { EState as EIncomingStatus } from '@/IncomingCallManager/IncomingCallStateMachine';
export { EState as EPresentationStatus } from '@/PresentationManager/PresentationStateMachine';
export { EState as EConnectionStatus } from '@/ConnectionManager/ConnectionStateMachine';
