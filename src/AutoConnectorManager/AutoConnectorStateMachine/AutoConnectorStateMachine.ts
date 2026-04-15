import resolveDebug from '@/logger';
import { BaseStateMachine } from '@/tools/BaseStateMachine';
import { createAutoConnectorMachine } from './createAutoConnectorMachine';

import type { EState, TAutoConnectorEvent, TContext, TContextMap } from './types';
import type { TParametersAutoConnect } from '../types';

const debug = resolveDebug('AutoConnectorStateMachine');

type TMachine = ReturnType<typeof createAutoConnectorMachine>;

export type TSnapshot =
  | { value: EState.IDLE; context: TContextMap[EState.IDLE] }
  | { value: EState.DISCONNECTING; context: TContextMap[EState.DISCONNECTING] }
  | { value: EState.ATTEMPTING_GATE; context: TContextMap[EState.ATTEMPTING_GATE] }
  | { value: EState.ATTEMPTING_CONNECT; context: TContextMap[EState.ATTEMPTING_CONNECT] }
  | { value: EState.WAITING_BEFORE_RETRY; context: TContextMap[EState.WAITING_BEFORE_RETRY] }
  | { value: EState.CONNECTED_MONITORING; context: TContextMap[EState.CONNECTED_MONITORING] }
  | { value: EState.TELEPHONY_CHECKING; context: TContextMap[EState.TELEPHONY_CHECKING] }
  | { value: EState.ERROR_TERMINAL; context: TContextMap[EState.ERROR_TERMINAL] };

export class AutoConnectorStateMachine extends BaseStateMachine<
  TMachine,
  EState,
  TContext,
  TSnapshot
> {
  public constructor(machine: TMachine) {
    super(machine);
  }

  public send(event: TAutoConnectorEvent): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      debug(
        `[AutoConnectorStateMachine] Invalid transition: ${event.type} from ${String(this.state)}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
  }

  public toStop(): void {
    this.send({ type: 'AUTO.STOP' });
  }

  public toRestart(parameters: TParametersAutoConnect): void {
    this.send({ type: 'AUTO.RESTART', parameters });
  }

  public toTelephonyResult(outcome: 'stillConnected'): void {
    this.send({ type: 'TELEPHONY.RESULT', outcome });
  }

  public toTelephonyResultStillConnected(): void {
    this.toTelephonyResult('stillConnected');
  }
}

export const createAutoConnectorStateMachine = (
  deps: Parameters<typeof createAutoConnectorMachine>[0],
) => {
  return new AutoConnectorStateMachine(createAutoConnectorMachine(deps));
};

export type { AutoConnectorStateMachine as IAutoConnectorStateMachine };
