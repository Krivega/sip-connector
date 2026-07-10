import { BaseStateMachine } from '@/tools/BaseStateMachine';
import { createConnectAndCallSessionMachine } from './createConnectAndCallSessionMachine';

import type {
  EConnectAndCallSessionPhase,
  TConnectAndCallSessionContext,
  TConnectAndCallSessionEvent,
} from './types';

type TMachine = ReturnType<typeof createConnectAndCallSessionMachine>;
type TSnapshot = {
  context: TConnectAndCallSessionContext;
  value: EConnectAndCallSessionPhase;
};

export class ConnectAndCallSessionStateMachine extends BaseStateMachine<
  TMachine,
  EConnectAndCallSessionPhase,
  TConnectAndCallSessionContext,
  TSnapshot
> {
  public constructor() {
    super(createConnectAndCallSessionMachine());
  }

  public send(event: TConnectAndCallSessionEvent): void {
    if (this.actor.getSnapshot().can(event)) {
      super.send(event);
    }
  }
}
