import { BaseStateMachine } from '@/tools/BaseStateMachine';
import { createAutoConnectorMachine } from './createAutoConnectorMachine';

import type { EAutoConnectorState, TAutoConnectorContext, TAutoConnectorEvent } from './types';
import type { TParametersAutoConnect } from '../types';

type TMachine = ReturnType<typeof createAutoConnectorMachine>;

export type TAutoConnectorSnapshot = {
  value: EAutoConnectorState;
  context: TAutoConnectorContext;
};

export class AutoConnectorStateMachine extends BaseStateMachine<
  TMachine,
  EAutoConnectorState,
  TAutoConnectorContext,
  TAutoConnectorSnapshot
> {
  public constructor(machine: TMachine) {
    super(machine);
  }

  public send(event: TAutoConnectorEvent): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      // eslint-disable-next-line no-console
      console.warn(
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

  public toFlowRestart(): void {
    this.send({ type: 'FLOW.RESTART' });
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
