import { IncomingRequest } from '@krivega/jssip/lib/SIPMessage';

type TExtraHeaders = [string, string][];

class Request extends IncomingRequest {
  private readonly headers: Headers;

  public constructor(extraHeaders: TExtraHeaders) {
    super();

    this.headers = new Headers(extraHeaders);
  }

  public getHeader(headerName: string) {
    return this.headers.get(headerName) ?? '';
  }
}

export default Request;
