import type { IncomingRTCSessionEvent, OutgoingRTCSessionEvent, RTCSession } from '@krivega/jssip';
import type Events from 'events-constructor';
import {
  DECLINED_INCOMING_CALL,
  FAILED,
  FAILED_INCOMING_CALL,
  INCOMING_CALL,
  NEW_RTC_SESSION,
  Originator,
  TERMINATED_INCOMING_CALL,
} from '../constants';
import type { UA_EVENT_NAMES } from '../eventNames';

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

  private readonly uaEvents: Events<typeof UA_EVENT_NAMES>;

  public constructor(uaEvents: Events<typeof UA_EVENT_NAMES>) {
    this.uaEvents = uaEvents;
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
        this.uaEvents.trigger(DECLINED_INCOMING_CALL, callerData);
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

  private subscribe() {
    this.uaEvents.on(NEW_RTC_SESSION, this.handleNewRTCSession);
  }

  private unsubscribe() {
    this.uaEvents.off(NEW_RTC_SESSION, this.handleNewRTCSession);
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

    rtcSession.on(FAILED, (event: { originator: Originator }) => {
      this.removeIncomingSession();

      if (event.originator === Originator.LOCAL) {
        this.uaEvents.trigger(TERMINATED_INCOMING_CALL, callerData);
      } else {
        this.uaEvents.trigger(FAILED_INCOMING_CALL, callerData);
      }
    });

    this.uaEvents.trigger(INCOMING_CALL, callerData);
  }

  private removeIncomingSession(): void {
    delete this.incomingRTCSession;
  }
}
