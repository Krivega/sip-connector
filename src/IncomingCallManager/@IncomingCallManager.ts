import { EventEmitterProxy } from 'events-constructor';

import { createEvents } from './events';
import { IncomingCallStateMachine } from './IncomingCallStateMachine';

import type { IncomingRTCSessionEvent, OutgoingRTCSessionEvent, RTCSession } from '@krivega/jssip';
import type { ConnectionManager } from '@/ConnectionManager';
import type { Originator, TEventMap, TRemoteCallerData } from './events';

const BUSY_HERE_STATUS_CODE = 486;
const REQUEST_TERMINATED_STATUS_CODE = 487;

const getRemoteCallerData = (incomingRTCSession: RTCSession): TRemoteCallerData => {
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

    rtcSession.on('failed', (event: { originator: `${Originator}` }) => {
      this.removeIncomingSession();

      if (event.originator === 'local') {
        this.events.trigger('terminatedIncomingCall', callerData);
      } else {
        this.events.trigger('failedIncomingCall', callerData);
      }
    });

    this.events.trigger('ringing', callerData);
  }

  private removeIncomingSession(): void {
    delete this.incomingRTCSession;
  }
}
