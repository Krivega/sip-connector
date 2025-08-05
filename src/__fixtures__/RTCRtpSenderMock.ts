/* eslint-disable unicorn/filename-case */
/* eslint-disable unicorn/no-null */
class RTCRtpSenderMock implements RTCRtpSender {
  public stats: RTCStatsReport = new Map().set('codec', { mimeType: 'video/h264' });

  public dtmf: RTCDTMFSender | null = null;

  public track: MediaStreamTrack | null = null;

  public transport: RTCDtlsTransport | null = null;

  public transform: RTCRtpTransform | null = null;

  private parameters: RTCRtpSendParameters = {
    encodings: [{}],
    transactionId: '0',
    codecs: [],
    headerExtensions: [],
    rtcp: {},
  };

  private parametersGets?: RTCRtpSendParameters;

  public constructor({ track }: { track?: MediaStreamTrack } = {}) {
    this.track = track ?? null;
  }

  public async getStats(): Promise<RTCStatsReport> {
    return this.stats;
  }

  public async replaceTrack(track: MediaStreamTrack | null): Promise<void> {
    this.track = track ?? null;
  }

  public async setParameters(parameters: RTCRtpSendParameters): Promise<void> {
    if (parameters !== this.parametersGets) {
      throw new Error(
        "Failed to execute 'setParameters' on 'RTCRtpSender': Read-only field modified in setParameters().",
      );
    }

    const { transactionId } = this.parameters;

    this.parameters = {
      ...this.parameters,
      ...parameters,
      transactionId: `${Number(transactionId) + 1}`,
    };
  }

  public getParameters(): RTCRtpSendParameters {
    this.parametersGets = { ...this.parameters };

    return this.parametersGets;
  }

  // eslint-disable-next-line class-methods-use-this
  public setStreams(): void {
    throw new Error('Method not implemented.');
  }
}

export default RTCRtpSenderMock;
