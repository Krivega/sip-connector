class RTCRtpSenderMock implements RTCRtpSender {
  public stats: RTCStatsReport = new Map().set('codec', { type: 'codec', mimeType: 'video/h264' });

  public dtmf: RTCDTMFSender | null = null;

  public track: MediaStreamTrack | null = null;

  public transport: RTCDtlsTransport | null = null;

  public transform: RTCRtpScriptTransform | null = null;

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

  public async replaceTrack(track: MediaStreamTrack | null = null): Promise<void> {
    this.track = track;
  }

  public async setParameters(parameters: RTCRtpSendParameters): Promise<void> {
    this.checkParameters(parameters);
    this.applyParameters(parameters);
  }

  // Как в браузере: setParameters принимает только параметры последнего getParameters и сверяет их при вызове
  public checkParameters(parameters: RTCRtpSendParameters): void {
    if (parameters !== this.parametersGets) {
      throw new Error(
        "Failed to execute 'setParameters' on 'RTCRtpSender': Read-only field modified in setParameters().",
      );
    }
  }

  // Применение принятых параметров: отделено от сверки, чтобы фикстура могла его отложить, как в браузере
  public applyParameters(parameters: RTCRtpSendParameters): void {
    const { transactionId } = this.parameters;

    this.parameters = {
      ...this.parameters,
      ...parameters,
      transactionId: `${Number(transactionId) + 1}`,
    };
  }

  public getParameters(): RTCRtpSendParameters {
    // Как в браузере: изменения полученных параметров применяются только через setParameters
    this.parametersGets = {
      ...this.parameters,
      encodings: this.parameters.encodings.map((encoding) => {
        return { ...encoding };
      }),
    };

    return this.parametersGets;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public setStreams(): void {
    throw new Error('Method not implemented.');
  }
}

export default RTCRtpSenderMock;
