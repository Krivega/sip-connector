import type { RTCSession, UA } from '@krivega/jssip';
import type { ICallStrategy, TEvents, TGetServerUrl, TOntrack, TParametersCall } from './types';

export abstract class AbstractCallStrategy implements ICallStrategy {
  protected isPendingCall = false;

  protected rtcSession?: RTCSession;

  protected remoteStreams: Record<string, MediaStream> = {};

  protected readonly events: TEvents;

  protected readonly callConfiguration: {
    answer?: boolean;
    number?: string;
  } = {};

  public constructor(events: TEvents) {
    this.events = events;
  }

  /**
   * Запуск исходящего звонка
   */
  public abstract startCall(
    parameters: TParametersCall,
    ua: UA,
    getSipServerUrl: TGetServerUrl,
  ): Promise<RTCPeerConnection>;

  /**
   * Завершение звонка
   */
  public abstract endCall(): Promise<void>;

  /**
   * Ответ на входящий звонок
   */
  public abstract answerIncomingCall(localStream: MediaStream): Promise<void>;

  public abstract getEstablishedRTCSession(): RTCSession | undefined;

  /**
   * Внутренняя обработка звонка (например, для ontrack)
   */
  protected abstract handleCall(options: { ontrack?: TOntrack }): Promise<RTCPeerConnection>;
}
