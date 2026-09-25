import { EventEmitterProxy } from 'events-constructor';

import { resolveCallEndEvent } from '@/tools';
import { createEvents } from './events';
import { IncomingCallStateMachine } from './IncomingCallStateMachine';

import type {
  EndEvent,
  IncomingRTCSessionEvent,
  OutgoingRTCSessionEvent,
  RTCSession,
} from '@krivega/jssip';
import type { ConnectionManager } from '@/ConnectionManager';
import type { TEventMap, TRemoteCallerDataWithRTCSession } from './events';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;

const getRemoteCallerData = (incomingRTCSession: RTCSession): TRemoteCallerDataWithRTCSession => {
  return {
    displayName: incomingRTCSession.remote_identity.display_name,
    host: incomingRTCSession.remote_identity.uri.host,
    incomingNumber: incomingRTCSession.remote_identity.uri.user,
    rtcSession: incomingRTCSession,
  };
};

export default class IncomingCallManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: IncomingCallStateMachine;

  private incomingRTCSession?: RTCSession;

  private disposeIncomingEndedListener?: () => void;

  private readonly connectionManager: ConnectionManager;

  public constructor(connectionManager: ConnectionManager) {
    super(createEvents());
    this.connectionManager = connectionManager;
    this.stateMachine = new IncomingCallStateMachine({
      incomingEvents: this.events,
      connectionEvents: this.connectionManager.events,
    });
    this.start();
  }

  public get remoteCallerData(): TEventMap['ringing'] | undefined {
    if (!this.incomingRTCSession) {
      return undefined;
    }

    return getRemoteCallerData(this.incomingRTCSession);
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

    this.stateMachine.toConsumed();
    this.removeIncomingSession();

    return incomingRTCSession;
  };

  public async declineToIncomingCall({
    statusCode = REQUEST_TERMINATED_STATUS_CODE,
  }: { statusCode?: number } = {}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const incomingRTCSession = this.getIncomingRTCSession();
        const callerData = getRemoteCallerData(incomingRTCSession);

        this.removeIncomingSession();
        this.events.trigger('declinedIncomingCall', callerData);
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

    const callerData = getRemoteCallerData(rtcSession);

    const handleFailed = (event: EndEvent) => {
      this.handleSessionFailed(event, callerData);
    };
    const handleEnded = (event: EndEvent) => {
      this.handleSessionEnded(event, callerData);
    };

    rtcSession.on('failed', handleFailed);
    rtcSession.on('ended', handleEnded);

    this.disposeIncomingEndedListener = () => {
      rtcSession.off('ended', handleEnded);
    };

    this.events.trigger('ringing', callerData);
  }

  private handleSessionFailed(event: EndEvent, callerData: TRemoteCallerDataWithRTCSession): void {
    this.removeIncomingSession();

    if (event.originator === 'local') {
      this.events.trigger('terminatedIncomingCall', callerData);
    } else {
      this.triggerFailedIncomingCall(event, callerData);
    }
  }

  private triggerFailedIncomingCall(
    event: EndEvent,
    callerData: TRemoteCallerDataWithRTCSession,
  ): void {
    const { disconnectCause } = resolveCallEndEvent(event);

    this.events.trigger('failedIncomingCall', { ...callerData, disconnectCause });
  }

  private handleSessionEnded(event: EndEvent, callerData: TRemoteCallerDataWithRTCSession): void {
    if (this.incomingRTCSession !== callerData.rtcSession) {
      return;
    }

    this.handleSessionFailed(event, callerData);
  }

  private removeIncomingSession(): void {
    this.disposeIncomingEndedListener?.();
    this.disposeIncomingEndedListener = undefined;

    delete this.incomingRTCSession;
  }
}
