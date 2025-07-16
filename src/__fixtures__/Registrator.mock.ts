import type { Registrator } from '@krivega/jssip';

class RegistratorMock implements Registrator {
  public extraHeaders?: string[] = [];

  public setExtraHeaders(extraHeaders: string[]) {
    this.extraHeaders = extraHeaders;
  }

  // eslint-disable-next-line class-methods-use-this
  public setExtraContactParams() {}
}

export default RegistratorMock;
