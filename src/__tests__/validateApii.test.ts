/// <reference types="jest" />
import { dataForConnectionWithAuthorizationWithDisplayName } from '../__fixtures__';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

describe('validateApi', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
  });

  it('должен требовать sipServerUrl', async () => {
    expect.assertions(1);

    // @ts-expect-error
    return sipConnector.connect({}).catch((error: unknown) => {
      // eslint-disable-next-line jest/no-conditional-expect
      expect((error as Error).message).toBe('sipServerUrl is required');
    });
  });

  it('должен требовать sipWebSocketServerURL', async () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        // @ts-expect-error
        sipWebSocketServerURL: undefined,
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((error as Error).message).toBe('sipWebSocketServerURL is required');
      });
  });

  it('должен требовать user для авторизованного подключения', async () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        user: undefined,
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((error as Error).message).toBe('user is required for authorized connection');
      });
  });

  it('должен требовать password для авторизованного подключения', async () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        password: undefined,
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((error as Error).message).toBe('password is required for authorized connection');
      });
  });
});
