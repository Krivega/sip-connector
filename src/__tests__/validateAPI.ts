import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorizationWithDisplayName } from '../__fixtures__';
import createSipConnector from '../__fixtures__/doMock';

describe('validateAPI', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = createSipConnector();
  });

  it('not full data: sipServerUrl', () => {
    expect.assertions(1);

    //@ts-ignore
    return sipConnector.connect({}).catch((error) => {
      expect(error.message).toBe('sipServerUrl is required');
    });
  });

  it('not full data: sipWebSocketServerURL', () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        //@ts-ignore
        sipWebSocketServerURL: undefined,
      })
      .catch((error) => {
        expect(error.message).toBe('sipWebSocketServerURL is required');
      });
  });

  it('not full data: not user with authorization user', () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        user: undefined,
      })
      .catch((error) => {
        expect(error.message).toBe('user is required for authorized connection');
      });
  });

  it('not full data: not password with authorization user', () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        password: undefined,
      })
      .catch((error) => {
        expect(error.message).toBe('password is required for authorized connection');
      });
  });
});
