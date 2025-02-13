/* eslint-disable @typescript-eslint/consistent-type-definitions */
/// <reference types="node" />
/// <reference types="vite/client" />
/// <reference types="jest" />
/// <reference types="dom-mediacapture-transform" />
interface RTCRtpSendParameters {
  // for old browsers (see Firefox<=109)
  rtcp?: RTCRtcpParameters;
}
interface RTCRtpParameters {
  // for old browsers (see Firefox<=109)
  rtcp?: RTCRtcpParameters;
}
