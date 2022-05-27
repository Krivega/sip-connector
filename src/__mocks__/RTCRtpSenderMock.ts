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
  getStats(): Promise<RTCStatsReport> {
    throw new Error('Method not implemented.');
  }
  replaceTrack(withTrack: MediaStreamTrack | null): Promise<void> {
    throw new Error('Method not implemented.');
  }
  setParameters(parameters: RTCRtpSendParameters): Promise<void> {
    const { transactionId } = this._parameters;

    this._parameters = {
      ...this._parameters,
      ...parameters,
      transactionId: `${+transactionId + 1}`,
    };

    return Promise.resolve();
  }
  getParameters(): RTCRtpSendParameters {
    return { ...this._parameters };
  }
  setStreams(...streams: MediaStream[]): void {
    throw new Error('Method not implemented.');
  }
}

export default RTCRtpSenderMock;
