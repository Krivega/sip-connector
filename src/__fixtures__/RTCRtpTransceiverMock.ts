import type RTCRtpSenderMock from './RTCRtpSenderMock';

/**
 * Мок для RTCRtpTransceiver
 */
export class RTCRtpTransceiverMock implements RTCRtpTransceiver {
  public readonly currentDirection: RTCRtpTransceiverDirection | null = 'sendrecv';

  public readonly direction: RTCRtpTransceiverDirection = 'sendrecv';

  // eslint-disable-next-line unicorn/no-null
  public mid: string | null = null;

  public readonly receiver!: RTCRtpReceiver;

  public readonly sender: RTCRtpSenderMock;

  public readonly stopped = false;

  public constructor(sender: RTCRtpSenderMock) {
    this.sender = sender;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public setCodecPreferences(_codecs: RTCRtpCodec[]): void {
    // Mock implementation
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public stop(): void {
    // Mock implementation
  }
}

export default RTCRtpTransceiverMock;
