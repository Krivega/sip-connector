class RTCRtpSenderMock implements RTCRtpSender {
  dtmf: RTCDTMFSender | null = null;

  track: MediaStreamTrack | null = null;

  transport: RTCDtlsTransport | null = null;

  transform: RTCRtpTransform | null = null;

  private _parameters: RTCRtpSendParameters = {
    encodings: [{}],
    transactionId: '0',
    codecs: [],
    headerExtensions: [],
    rtcp: {},
  };

  constructor({ track }: { track?: MediaStreamTrack } = {}) {
    this.track = track ?? null;
  }

  async getStats(): Promise<RTCStatsReport> {
    throw new Error('Method not implemented.');
  }

  async replaceTrack(track: MediaStreamTrack | null): Promise<void> {
    this.track = track ?? null;
  }

  async setParameters(parameters: RTCRtpSendParameters): Promise<void> {
    const { transactionId } = this._parameters;

    this._parameters = {
      ...this._parameters,
      ...parameters,
      transactionId: `${Number(transactionId) + 1}`,
    };
  }

  getParameters(): RTCRtpSendParameters {
    return { ...this._parameters };
  }

  setStreams(): void {
    throw new Error('Method not implemented.');
  }
}

export default RTCRtpSenderMock;
