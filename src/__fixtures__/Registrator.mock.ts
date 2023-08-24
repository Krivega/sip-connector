import type { Registrator } from '@krivega/jssip/lib/Registrator';

class RegistratorMock implements Registrator {
  extraHeaders?: string[];
  setExtraHeaders(extraHeaders: string[]) {
    this.extraHeaders = extraHeaders;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setExtraContactParams() {}
}

export default RegistratorMock;
