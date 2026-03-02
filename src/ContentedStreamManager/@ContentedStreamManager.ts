import { EventEmitterProxy } from '@/EventEmitterProxy';
import { ContentedStreamStateMachine } from './ContentedStreamStateMachine';
import { createEvents, EEvent } from './events';

import type { ApiManager, EContentedStreamCodec } from '@/ApiManager';
import type { TEventMap } from './events';
import type { TContentedStreamStateInfo } from './types';

class ContentedStreamManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: ContentedStreamStateMachine;

  public constructor() {
    super(createEvents());

    this.stateMachine = new ContentedStreamStateMachine();

    this.proxyEvents();
  }

  public get isAvailable(): boolean {
    return this.stateMachine.isAvailable;
  }

  public get codec(): EContentedStreamCodec | undefined {
    return this.stateMachine.codec;
  }

  public getStateInfo(): TContentedStreamStateInfo {
    return this.stateMachine.getStateInfo();
  }

  public reset(): void {
    this.stateMachine.reset();
  }

  public subscribeToApiEvents(apiManager: ApiManager): void {
    this.stateMachine.subscribeToApiEvents(apiManager.events);
  }

  private proxyEvents(): void {
    this.stateMachine.onStateChange(() => {
      const stateInfo = this.getStateInfo();

      if (stateInfo.isAvailable) {
        this.events.trigger(EEvent.AVAILABLE, { codec: stateInfo.codec });
      } else {
        this.events.trigger(EEvent.NOT_AVAILABLE, {});
      }
    });
  }
}

export default ContentedStreamManager;
