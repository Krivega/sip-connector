import type { RTCSession } from '@krivega/jssip';
import type { ICallStrategy, TCallConfiguration, TEvents, TOntrack } from './types';

export abstract class AbstractCallStrategy implements ICallStrategy {
  protected isPendingCall = false;

  protected isPendingAnswer = false;

  protected rtcSession?: RTCSession;

  protected remoteStreams: Record<string, MediaStream> = {};

  protected readonly events: TEvents;

  protected readonly callConfiguration: TCallConfiguration = {};

  public constructor(events: TEvents) {
    this.events = events;
  }

  // Свойства (getters)
  public abstract get requested(): boolean;
  public abstract get connection(): RTCPeerConnection | undefined;
  public abstract get establishedRTCSession(): RTCSession | undefined;

  /**
   * Запуск исходящего звонка
   */
  public abstract startCall(
    parameters: Parameters<ICallStrategy['startCall']>[0],
    ua: Parameters<ICallStrategy['startCall']>[1],
    getSipServerUrl: Parameters<ICallStrategy['startCall']>[2],
  ): Promise<RTCPeerConnection>;

  /**
   * Завершение звонка
   */
  public abstract endCall(): Promise<void>;

  /**
   * Ответ на входящий звонок
   */
  public abstract answerIncomingCall(
    getIncomingRTCSession: Parameters<ICallStrategy['answerIncomingCall']>[0],
    removeIncomingSession: Parameters<ICallStrategy['answerIncomingCall']>[1],
    parameters: Parameters<ICallStrategy['answerIncomingCall']>[2],
  ): Promise<RTCPeerConnection>;

  /**
   * Замена медиа-потока
   */
  public abstract replaceMediaStream(
    mediaStream: Parameters<ICallStrategy['replaceMediaStream']>[0],
    options?: Parameters<ICallStrategy['replaceMediaStream']>[1],
  ): Promise<void>;

  public abstract getEstablishedRTCSession(): RTCSession | undefined;

  /**
   * Получение конфигурации звонка
   */
  public abstract getCallConfiguration(): TCallConfiguration;

  /**
   * Получение удаленных медиа-потоков
   */
  public abstract getRemoteStreams(): MediaStream[] | undefined;

  /**
   * Внутренняя обработка звонка (например, для ontrack)
   */
  protected abstract handleCall(options: { ontrack?: TOntrack }): Promise<RTCPeerConnection>;
}
