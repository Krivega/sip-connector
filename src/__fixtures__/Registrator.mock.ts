import type { Registrator } from '@krivega/jssip';

class RegistratorMock implements Registrator {
  extraHeaders?: string[] = [];

  setExtraHeaders(extraHeaders: string[]) {
    this.extraHeaders = extraHeaders;
  }

  // eslint-disable-next-line class-methods-use-this
  setExtraContactParams() {}
}

export default RegistratorMock;
