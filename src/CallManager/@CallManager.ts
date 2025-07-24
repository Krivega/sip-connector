import type { RTCSession } from '@krivega/jssip';
import Events from 'events-constructor';
import type { TEvent, TEvents } from './eventNames';
import { EVENT_NAMES } from './eventNames';
import { MCUCallStrategy } from './MCUCallStrategy';
import type { ICallStrategy } from './types';

class CallManager {
  public readonly events: TEvents;

  private strategy: ICallStrategy;

  public constructor(strategy?: ICallStrategy) {
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.strategy = strategy ?? new MCUCallStrategy(this.events);
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public on<T>(eventName: TEvent, handler: (data: T) => void) {
    return this.events.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public once<T>(eventName: TEvent, handler: (data: T) => void) {
    return this.events.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRace<T>(eventNames: TEvent[], handler: (data: T, eventName: string) => void) {
    return this.events.onceRace<T>(eventNames, handler);
  }

  public async wait<T>(eventName: TEvent): Promise<T> {
    return this.events.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public off<T>(eventName: TEvent, handler: (data: T) => void) {
    this.events.off<T>(eventName, handler);
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

  public replaceMediaStream: ICallStrategy['replaceMediaStream'] = async (...args) => {
    return this.strategy.replaceMediaStream(...args);
  };
}

export default CallManager;
