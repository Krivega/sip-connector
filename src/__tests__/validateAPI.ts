import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorizationWithDisplayName } from '../__mocks__';
import type SipConnector from '../SipConnector';

describe('validateAPI', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = createSipConnector();
  });

  it('not full data: sipServerUrl', () => {
    expect.assertions(1);

    return sipConnector.connect({}).catch((error) => {
      expect(error.message).toBe('sipServerUrl is required');
    });
  });

  it('not full data: sipWebSocketServerURL', () => {
    expect.assertions(1);

    return sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
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
