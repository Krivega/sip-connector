import type { ICallStrategy } from './@CallManager';

export class MCUCallStrategy implements ICallStrategy {
  public startCall(localStream: MediaStream): void {
    console.log('MCUCallStrategy.startCall', localStream);
    // TODO: Реализация логики звонка MCU
  }

  public endCall(): void {
    console.log('MCUCallStrategy.endCall');
    // TODO: Реализация завершения звонка MCU
  }

  public answerIncomingCall(localStream: MediaStream): void {
    console.log('MCUCallStrategy.answerIncomingCall', localStream);
    // TODO: Реализация ответа на входящий звонок MCU
  }
}
