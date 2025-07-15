/* eslint-disable @typescript-eslint/no-non-null-assertion */
/// <reference types="jest" />
// @ts-nocheck

import type SipConnector from '../../SipConnector';
import delayPromise from '../../__fixtures__/delayPromise';
import { doMockSipConnector } from '../../doMock';
import {
  dataForConnectionWithAuthorization,
  dataForConnectionWithAuthorizationIncorrectPassword,
  dataForConnectionWithAuthorizationIncorrectUser,
  dataForConnectionWithAuthorizationPasswordChanged,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithSipServerUrlChanged,
  dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged,
  dataForConnectionWithoutAuthorizationWithoutDisplayName,
  thirdWord,
  uaConfigurationWithAuthorization,
  uaConfigurationWithAuthorizationPasswordChanged,
  uaConfigurationWithoutAuthorization,
  uaConfigurationWithoutAuthorizationWithoutDisplayName,
  withNameChanged,
} from '../__fixtures__/connectToServer';
import hasValidUri from '../__fixtures__/hasValidUri';
import resolveProcessRequest from '../__fixtures__/processRequest';
import parseObject, { parseObjectWithoutUri } from '../__tests-utils__/parseObject';

describe('processRequest', () => {
  let sipConnector: SipConnector;
  let processRequest: ReturnType<typeof resolveProcessRequest>;

  beforeEach(() => {
    jest.resetModules();

    sipConnector = doMockSipConnector();
    processRequest = resolveProcessRequest(sipConnector);
  });

  it('#1 Unregistered user: correct', async () => {
    expect.assertions(4);

    // @ts-expect-error
    return processRequest(dataForConnectionWithoutAuthorization).then((success) => {
      expect(success).toBe(true);
      expect(sipConnector.isConfigured()).toBe(true);
      expect(hasValidUri(sipConnector.ua!.configuration.uri)).toBe(true);
      expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
        uaConfigurationWithoutAuthorization,
      );
    });
  });

  it('#2 Unregistered user isRequiredDisplayName=false: correct', async () => {
    expect.assertions(4);

    return processRequest(dataForConnectionWithoutAuthorizationWithoutDisplayName).then(
      (success) => {
        expect(success).toBe(true);
        expect(sipConnector.isConfigured()).toBe(true);
        expect(hasValidUri(sipConnector.ua!.configuration.uri)).toBe(true);
        expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
          uaConfigurationWithoutAuthorizationWithoutDisplayName,
        );
      },
    );
  });

  it('#3 Unregistered user change isRequiredDisplayName to true: correct', async () => {
    expect.assertions(4);

    // @ts-expect-error
    return processRequest(dataForConnectionWithoutAuthorizationWithoutDisplayName)
      .then(async () => {
        // @ts-expect-error
        return processRequest(dataForConnectionWithoutAuthorization);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.isConfigured()).toBe(true);
        expect(hasValidUri(sipConnector.ua!.configuration.uri)).toBe(true);
        expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
          uaConfigurationWithoutAuthorization,
        );
      });
  });

  it('#4 Unregistered user: remove displayName', async () => {
    expect.assertions(3);

    // @ts-expect-error
    return processRequest(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return processRequest({
          ...dataForConnectionWithoutAuthorizationWithoutDisplayName,
          // @ts-expect-error
          displayNameChanged: true,
        });
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.isConfigured()).toBe(true);
        expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
          uaConfigurationWithoutAuthorizationWithoutDisplayName,
        );
      });
  });

  it('#5 Registered user: correct', async () => {
    expect.assertions(3);

    // @ts-expect-error
    return processRequest(dataForConnectionWithAuthorization).then((success) => {
      expect(success).toBe(true);
      expect(sipConnector.isConfigured()).toBe(true);
      expect(sipConnector.ua!.configuration).toEqual(uaConfigurationWithAuthorization);
    });
  });

  it('#6 Registered user: remove name', async () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithAuthorization)
      .then(async () => {
        return processRequest({ ...dataForConnectionWithAuthorization, name: '' });
      })
      .then((success) => {
        expect(success).toBe(false);
        expect(sipConnector.isConfigured()).toBe(false);
      });
  });

  it('#7 Registered user: incorrect password', async () => {
    expect.assertions(1);

    // @ts-expect-error
    return processRequest(dataForConnectionWithAuthorizationIncorrectPassword).catch(
      (error: unknown) => {
        expect(error).toBeDefined();
      },
    );
  });

  it('#8 Registered user: incorrect name', async () => {
    expect.assertions(1);

    // @ts-expect-error
    return processRequest(dataForConnectionWithAuthorizationIncorrectUser).catch(
      (error: unknown) => {
        expect(error).toBeDefined();
      },
    );
  });

  it('#9 sync changed displayName', async () => {
    expect.assertions(2);

    // @ts-expect-error
    return processRequest(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return processRequest({
          ...dataForConnectionWithoutAuthorization,
          // @ts-expect-error
          displayNameChanged: true,
          displayName: thirdWord,
        });
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.ua!.configuration.display_name).toBe(thirdWord);
      });
  });

  it('#10 debounce changed displayName', async () => {
    expect.assertions(2);
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    processRequest(dataForConnectionWithoutAuthorization);

    return processRequest({
      ...dataForConnectionWithoutAuthorization,
      // @ts-expect-error
      displayNameChanged: true,
      displayName: thirdWord,
    }).then((success) => {
      expect(success).toBe(true);
      expect(sipConnector.ua!.configuration.display_name).toBe(thirdWord);
    });
  });

  it('#11 async changed displayName', async () => {
    expect.assertions(3);

    return Promise.all([
      // @ts-expect-error
      processRequest(dataForConnectionWithoutAuthorization),
      // 300 -debounced value
      delayPromise(300).then(async () => {
        return processRequest({
          ...dataForConnectionWithoutAuthorization,
          // @ts-expect-error
          displayNameChanged: true,
          displayName: thirdWord,
        });
      }),
    ]).then(([success1, success2]) => {
      expect(success1).toBe(true); // because change Display name hanlded sipConnector.st, - sync fucntion
      expect(success2).toBe(true);
      expect(sipConnector.ua!.configuration.display_name).toBe(thirdWord);
    });
  });

  it('#12 sync changed name', async () => {
    expect.assertions(3);

    // @ts-expect-error
    return processRequest(dataForConnectionWithAuthorization)
      .then(async () => {
        // @ts-expect-error
        return processRequest({ ...withNameChanged, name: thirdWord });
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.ua!.configuration.uri.user).toBe(thirdWord);
        expect(sipConnector.ua!.configuration.uri.host).toBe(
          dataForConnectionWithAuthorization.sipServerUrl,
        );
      });
  });

  it('#13 sync remove name', async () => {
    expect.assertions(1);

    // @ts-expect-error
    return processRequest(dataForConnectionWithAuthorization)
      .then(async () => {
        // @ts-expect-error
        return processRequest({ ...withNameChanged, name: '' });
      })
      .then((success) => {
        expect(success).toBe(false);
      });
  });

  it('#14 async changed name', async () => {
    expect.assertions(4);

    // @ts-expect-error
    return processRequest(dataForConnectionWithAuthorization).then(async () => {
      return Promise.all([
        // @ts-expect-error
        processRequest(withNameChanged),
        // 300 -debounced value
        delayPromise(300).then(async () => {
          // @ts-expect-error
          return processRequest({ ...withNameChanged, name: thirdWord });
        }),
      ]).then(([success1, success2]) => {
        expect(success1).toBe(false); // cancel first request
        expect(success2).toBe(true);
        expect(sipConnector.ua!.configuration.uri.user).toBe(thirdWord);
        expect(sipConnector.ua!.configuration.uri.host).toBe(
          dataForConnectionWithAuthorization.sipServerUrl,
        );
      });
    });
  });

  it('#15 sync changed password', async () => {
    expect.assertions(2);

    // @ts-expect-error
    return processRequest(dataForConnectionWithAuthorization)
      .then(async () => {
        // @ts-expect-error
        return processRequest({ ...dataForConnectionWithAuthorization, password: 'wrong' });
      })
      .catch(async () => {
        // @ts-expect-error
        return processRequest(dataForConnectionWithAuthorizationPasswordChanged);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.ua!.configuration).toEqual(
          uaConfigurationWithAuthorizationPasswordChanged,
        );
      });
  });

  it('#16 sync remove password', async () => {
    expect.assertions(1);

    // @ts-expect-error
    return processRequest(dataForConnectionWithAuthorization)
      .then(async () => {
        return processRequest({
          ...dataForConnectionWithAuthorizationPasswordChanged,
          password: '',
        });
      })
      .then((success) => {
        expect(success).toBe(false);
      });
  });

  it('#17 debounce changed registered, with PasswordChanged', async () => {
    expect.assertions(3);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(async (success) => {
        expect(success).toBe(true);

        return processRequest(dataForConnectionWithAuthorizationPasswordChanged);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.ua!.configuration).toEqual(
          uaConfigurationWithAuthorizationPasswordChanged,
        );
      });
  });

  it('#18 debounce changed registered, with NameChanged', async () => {
    expect.assertions(3);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(async (success) => {
        expect(success).toBe(true);

        return processRequest(withNameChanged);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.ua!.configuration).toEqual(uaConfigurationWithAuthorization);
      });
  });

  it('#19 change sipServerUrl', async () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return processRequest(dataForConnectionWithoutAuthorizationWithSipServerUrlChanged);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(
          hasValidUri(
            sipConnector.ua!.configuration.uri,
            dataForConnectionWithoutAuthorizationWithSipServerUrlChanged.sipServerUrl,
          ),
        ).toBe(true);
      });
  });

  it('#20 change sipWebSocketServerURL', async () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return processRequest(
          dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged,
        );
      })
      .then((success) => {
        expect(success).toBe(true);
        // @ts-expect-error
        expect(parseObject(sipConnector.socket).url).toEqual(
          dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged.sipWebSocketServerURL,
        );
      });
  });
});
