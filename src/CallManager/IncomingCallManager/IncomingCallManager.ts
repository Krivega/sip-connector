import type { IncomingRTCSessionEvent, OutgoingRTCSessionEvent, RTCSession } from '@krivega/jssip';
import Events from 'events-constructor';
import type { ConnectionManager } from '../../ConnectionManager';
import type { TEvent } from './constants';
import { EEvent, EVENT_NAMES, Originator } from './constants';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;

type TRemoteCallerData = {
  displayName?: string;
  host?: string;
  incomingNumber?: string;
  rtcSession?: RTCSession;
};

export default class IncomingCallManager {
  private incomingRTCSession?: RTCSession;

  private readonly connectionManager: ConnectionManager;

  private readonly events: Events<typeof EVENT_NAMES>;

  public constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
  }

  public get remoteCallerData(): TRemoteCallerData {
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

  public getIncomingRTCSession(): RTCSession {
    const { incomingRTCSession } = this;

    if (!incomingRTCSession) {
      throw new Error('No incomingRTCSession');
    }

    return incomingRTCSession;
  }

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (originator === Originator.REMOTE) {
      this.setIncomingSession(rtcSession);
    }
  };

  private setIncomingSession(rtcSession: RTCSession): void {
    this.incomingRTCSession = rtcSession;

    const callerData = this.remoteCallerData;

    rtcSession.on('failed', (event: { originator: Originator }) => {
      this.removeIncomingSession();

      if (event.originator === Originator.LOCAL) {
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
