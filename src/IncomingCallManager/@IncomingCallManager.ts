import { TypedEvents } from 'events-constructor';

import { EEvent, EVENT_NAMES } from './eventNames';

import type { IncomingRTCSessionEvent, OutgoingRTCSessionEvent, RTCSession } from '@krivega/jssip';
import type { ConnectionManager } from '@/ConnectionManager';
import type { Originator, TEventMap, TEvents } from './eventNames';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;

export default class IncomingCallManager {
  public readonly events: TEvents;

  private incomingRTCSession?: RTCSession;

  private readonly connectionManager: ConnectionManager;

  public constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);
    this.start();
  }

  public get remoteCallerData(): TEventMap['incomingCall'] {
    return {
      displayName: this.incomingRTCSession?.remote_identity.display_name,
      host: this.incomingRTCSession?.remote_identity.uri.host,
      incomingNumber: this.incomingRTCSession?.remote_identity.uri.user,
      rtcSession: this.incomingRTCSession,
    };
  }

  public get isAvailableIncomingCall(): boolean {
    return !!this.incomingRTCSession;
  }

  public start() {
    this.subscribe();
  }

  public stop() {
    this.unsubscribe();
    this.removeIncomingSession();
  }

  public getIncomingRTCSession = (): RTCSession => {
    const { incomingRTCSession } = this;

    if (!incomingRTCSession) {
      throw new Error('No incomingRTCSession');
    }

    return incomingRTCSession;
  };

  public extractIncomingRTCSession = (): RTCSession => {
    const incomingRTCSession = this.getIncomingRTCSession();

    this.removeIncomingSession();

    return incomingRTCSession;
  };

  public async declineToIncomingCall({
    statusCode = REQUEST_TERMINATED_STATUS_CODE,
  }: { statusCode?: number } = {}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const incomingRTCSession = this.getIncomingRTCSession();
        const callerData = this.remoteCallerData;

        this.removeIncomingSession();
        this.events.trigger(EEvent.DECLINED_INCOMING_CALL, callerData);
        incomingRTCSession.terminate({ status_code: statusCode });
        resolve();
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  public async busyIncomingCall(): Promise<void> {
    return this.declineToIncomingCall({ statusCode: BUSY_HERE_STATUS_CODE });
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
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

  private subscribe() {
    this.connectionManager.on('newRTCSession', this.handleNewRTCSession);
  }

  private unsubscribe() {
    this.connectionManager.off('newRTCSession', this.handleNewRTCSession);
  }

  private readonly handleNewRTCSession = ({
    originator,
    session: rtcSession,
  }: IncomingRTCSessionEvent | OutgoingRTCSessionEvent) => {
    if (originator === 'remote') {
      this.setIncomingSession(rtcSession);
    }
  };

  private setIncomingSession(rtcSession: RTCSession): void {
    this.incomingRTCSession = rtcSession;

    const callerData = this.remoteCallerData;

    rtcSession.on('failed', (event: { originator: `${Originator}` }) => {
      this.removeIncomingSession();

      if (event.originator === 'local') {
        this.events.trigger(EEvent.TERMINATED_INCOMING_CALL, callerData);
      } else {
        this.events.trigger(EEvent.FAILED_INCOMING_CALL, callerData);
      }
    });

    this.events.trigger(EEvent.INCOMING_CALL, callerData);
  }

  private removeIncomingSession(): void {
    delete this.incomingRTCSession;
  }
}
