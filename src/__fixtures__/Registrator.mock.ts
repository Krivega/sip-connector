import type { Registrator } from '@krivega/jssip';

class RegistratorMock implements Registrator {
  extraHeaders?: string[] = [];

  setExtraHeaders(extraHeaders: string[]) {
    this.extraHeaders = extraHeaders;
  }

  setExtraContactParams() {}
}

export default RegistratorMock;
