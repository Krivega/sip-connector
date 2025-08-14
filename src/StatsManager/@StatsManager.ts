import { StatsPeerConnection } from '@/StatsPeerConnection';

import type { CallManager } from '@/CallManager';
import type { TEventMap } from '@/StatsPeerConnection';

class StatsManager {
  public readonly statsPeerConnection: StatsPeerConnection;

  private readonly callManager: CallManager;

  public constructor({ callManager }: { callManager: CallManager }) {
    this.callManager = callManager;
    this.statsPeerConnection = new StatsPeerConnection();

    this.subscribe();
  }

  public get events() {
    return this.statsPeerConnection.events;
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.statsPeerConnection.on(eventName, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.statsPeerConnection.once(eventName, handler);
  }

  public onceRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.statsPeerConnection.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TEventMap>(eventName: T): Promise<TEventMap[T]> {
    return this.statsPeerConnection.wait(eventName);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.statsPeerConnection.off(eventName, handler);
  }

  private subscribe() {
    this.callManager.on('peerconnection:confirmed', this.handleStarted);
    this.callManager.on('failed', this.handleEnded);
    this.callManager.on('ended', this.handleEnded);
  }

  private readonly handleStarted = (peerConnection: RTCPeerConnection) => {
    this.statsPeerConnection.start(peerConnection);
  };

  private readonly handleEnded = () => {
    this.statsPeerConnection.stop();
  };
}

export default StatsManager;
