import type { IncomingInfoEvent, OutgoingInfoEvent } from '@krivega/jssip';

export class MockRequest {
  private headers: Record<string, string> = {};

  public static createInfoEvent(originator: 'local' | 'remote', request: MockRequest) {
    if (originator === 'local') {
      return {
        originator,
        request,
        info: { contentType: '', body: '' },
      } as unknown as OutgoingInfoEvent;
    }

    return {
      originator,
      request,
      info: { contentType: '', body: '' },
    } as unknown as IncomingInfoEvent;
  }

  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  public getHeader(name: string): string | undefined {
    return this.headers[name];
  }
}
