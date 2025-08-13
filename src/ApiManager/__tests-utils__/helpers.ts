export class MockRequest {
  private headers: Record<string, string> = {};

  public static createInfoEvent(originator: string, request: MockRequest) {
    return { originator, request } as const;
  }

  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  public getHeader(name: string): string | undefined {
    return this.headers[name];
  }
}
