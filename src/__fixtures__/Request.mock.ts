import { IncomingRequest } from '@krivega/jssip/lib/SIPMessage';

type TExtraHeaders = [string, string][];

class Request extends IncomingRequest {
  private headers: Headers;

  constructor(extraHeaders: TExtraHeaders) {
    super();

    this.headers = new Headers(extraHeaders);
  }

  getHeader(headerName: string) {
    return this.headers.get(headerName) || '';
  }
}

export default Request;
