import resolveDebug from '@/logger';
import { BaseStateMachine } from '@/tools/BaseStateMachine';
import { createCallReconnectMachine } from './createCallReconnectMachine';

import type { EState, TCallReconnectEvent, TContext, TContextMap } from './types';

const debug = resolveDebug('CallReconnectStateMachine');

type TMachine = ReturnType<typeof createCallReconnectMachine>;

export type TSnapshot =
  | { value: EState.IDLE; context: TContextMap[EState.IDLE] }
  | { value: EState.ARMED; context: TContextMap[EState.ARMED] }
  | { value: EState.EVALUATING; context: TContextMap[EState.EVALUATING] }
  | { value: EState.BACKOFF; context: TContextMap[EState.BACKOFF] }
  | { value: EState.WAITING_SIGNALING; context: TContextMap[EState.WAITING_SIGNALING] }
  | { value: EState.ATTEMPTING; context: TContextMap[EState.ATTEMPTING] }
  | { value: EState.LIMIT_REACHED; context: TContextMap[EState.LIMIT_REACHED] }
  | { value: EState.ERROR_TERMINAL; context: TContextMap[EState.ERROR_TERMINAL] };

export class CallReconnectStateMachine extends BaseStateMachine<
  TMachine,
  EState,
  TContext,
  TSnapshot
> {
  public constructor(machine: TMachine) {
    super(machine);
  }

  public send(event: TCallReconnectEvent): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      debug(
        `[CallReconnectStateMachine] Invalid transition: ${event.type} from ${String(this.state)}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
  }
}

export const createCallReconnectStateMachine = (
  deps: Parameters<typeof createCallReconnectMachine>[0],
) => {
  return new CallReconnectStateMachine(createCallReconnectMachine(deps));
};

export type { CallReconnectStateMachine as ICallReconnectStateMachine };
