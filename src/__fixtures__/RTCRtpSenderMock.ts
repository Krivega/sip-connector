class RTCRtpSenderMock implements RTCRtpSender {
  dtmf: RTCDTMFSender | null = null;

  track: MediaStreamTrack | null = null;

  transport: RTCDtlsTransport | null = null;

  transform: RTCRtpTransform | null = null;

  private parameters: RTCRtpSendParameters = {
    encodings: [{}],
    transactionId: '0',
    codecs: [],
    headerExtensions: [],
    rtcp: {},
  };

  private parametersGets?: RTCRtpSendParameters;

  constructor({ track }: { track?: MediaStreamTrack } = {}) {
    this.track = track ?? null;
  }

  // eslint-disable-next-line class-methods-use-this
  async getStats(): Promise<RTCStatsReport> {
    throw new Error('Method not implemented.');
  }

  async replaceTrack(track: MediaStreamTrack | null): Promise<void> {
    this.track = track ?? null;
  }

  async setParameters(parameters: RTCRtpSendParameters): Promise<void> {
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

  getParameters(): RTCRtpSendParameters {
    this.parametersGets = { ...this.parameters };

    return this.parametersGets;
  }

  // eslint-disable-next-line class-methods-use-this
  setStreams(): void {
    throw new Error('Method not implemented.');
  }
}

export default RTCRtpSenderMock;
