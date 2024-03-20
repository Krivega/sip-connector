import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorizationWithDisplayName } from '../__fixtures__';
import createSipConnector from '../doMock';

describe('validateAPI', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = createSipConnector();
  });

  it('not full data: sipServerUrl', async () => {
    expect.assertions(1);

    // @ts-expect-error
    return sipConnector.connect({}).catch((error: unknown) => {
      expect((error as Error).message).toBe('sipServerUrl is required');
    });
  });

  it('not full data: sipWebSocketServerURL', async () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        // @ts-expect-error
        sipWebSocketServerURL: undefined,
      })
      .catch((error: unknown) => {
        expect((error as Error).message).toBe('sipWebSocketServerURL is required');
      });
  });

  it('not full data: not user with authorization user', async () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        user: undefined,
      })
      .catch((error: unknown) => {
        expect((error as Error).message).toBe('user is required for authorized connection');
      });
  });

  it('not full data: not password with authorization user', async () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        password: undefined,
      })
      .catch((error: unknown) => {
        expect((error as Error).message).toBe('password is required for authorized connection');
      });
  });
});
