class RTCRtpSenderMock implements RTCRtpSender {
  dtmf: RTCDTMFSender | null = null;

  track: MediaStreamTrack | null = null;

  transport: RTCDtlsTransport | null = null;

  private _parameters: RTCRtpSendParameters = {
    encodings: [{}],
    transactionId: '0',
    codecs: [],
    headerExtensions: [],
    rtcp: {},
  };

  async getStats(): Promise<RTCStatsReport> {
    throw new Error('Method not implemented.');
  }

  async replaceTrack(): Promise<void> {
    throw new Error('Method not implemented.');
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
