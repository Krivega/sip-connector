import { TypedEvents } from 'events-constructor';

import { EEvent, EVENT_NAMES } from './eventNames';
import { MCUCallStrategy } from './MCUCallStrategy';

import type { RTCSession } from '@krivega/jssip';
import type { TEvents, TEventMap } from './eventNames';
import type { ICallStrategy } from './types';

class CallManager {
  public readonly events: TEvents;

  private strategy: ICallStrategy;

  public constructor(strategy?: ICallStrategy) {
    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);
    this.strategy = strategy ?? new MCUCallStrategy(this.events);

    this.subscribeCallStatusChange();
  }

  public get requested(): boolean {
    return this.strategy.requested;
  }

  public get connection(): RTCPeerConnection | undefined {
    return this.strategy.connection;
  }

  public get establishedRTCSession(): RTCSession | undefined {
    return this.strategy.establishedRTCSession;
  }

  public get isCallActive(): ICallStrategy['isCallActive'] {
    return this.strategy.isCallActive;
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  public onRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onRace(eventNames, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.once(eventName, handler);
  }

  public onceRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TEventMap>(eventName: T): Promise<TEventMap[T]> {
    return this.events.wait(eventName);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.events.off(eventName, handler);
  }

  public setStrategy(strategy: ICallStrategy): void {
    this.strategy = strategy;
  }

  public startCall: ICallStrategy['startCall'] = async (...args) => {
    return this.strategy.startCall(...args);
  };

  public endCall: ICallStrategy['endCall'] = async () => {
    return this.strategy.endCall();
  };

  public answerToIncomingCall: ICallStrategy['answerToIncomingCall'] = async (...args) => {
    return this.strategy.answerToIncomingCall(...args);
  };

  public getEstablishedRTCSession: ICallStrategy['getEstablishedRTCSession'] = () => {
    return this.strategy.getEstablishedRTCSession();
  };

  public getCallConfiguration: ICallStrategy['getCallConfiguration'] = () => {
    return this.strategy.getCallConfiguration();
  };

  public getRemoteStreams: ICallStrategy['getRemoteStreams'] = () => {
    return this.strategy.getRemoteStreams();
  };

  public addTransceiver: ICallStrategy['addTransceiver'] = async (...args) => {
    return this.strategy.addTransceiver(...args);
  };

  public replaceMediaStream: ICallStrategy['replaceMediaStream'] = async (...args) => {
    return this.strategy.replaceMediaStream(...args);
  };

  public restartIce: ICallStrategy['restartIce'] = async (options) => {
    return this.strategy.restartIce(options);
  };

  private subscribeCallStatusChange() {
    let { isCallActive } = this;

    const { ACCEPTED, CONFIRMED, ENDED, FAILED } = EEvent;

    this.onRace([ACCEPTED, CONFIRMED, ENDED, FAILED], () => {
      isCallActive = this.maybeTriggerCallStatus(isCallActive);
    });
  }

  private maybeTriggerCallStatus(isCallActive: boolean) {
    const newStatus = this.isCallActive;

    if (newStatus !== isCallActive) {
      this.events.trigger(EEvent.CALL_STATUS_CHANGED, { isCallActive: newStatus });
    }

    return newStatus;
  }
}

export default CallManager;
