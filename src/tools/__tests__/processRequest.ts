import delayPromise from 'promise-delay';
import type SipConnector from '../../SipConnector';
import doMockSIPconnector from '../../__fixtures__/doMock';
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

    sipConnector = doMockSIPconnector();
    processRequest = resolveProcessRequest(sipConnector);
  });

  it('#1 Unregistered user: correct', () => {
    expect.assertions(4);

    return processRequest(dataForConnectionWithoutAuthorization).then((success) => {
      expect(success).toBe(true);
      expect(sipConnector.isConfigured()).toBe(true);
      // @ts-ignore
      expect(hasValidUri(parseObject(sipConnector.ua!.configuration).uri)).toBe(true);
      expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
        uaConfigurationWithoutAuthorization,
      );
    });
  });

  it('#2 Unregistered user isRequiredDisplayName=false: correct', () => {
    expect.assertions(4);

    return processRequest(dataForConnectionWithoutAuthorizationWithoutDisplayName).then(
      (success) => {
        expect(success).toBe(true);
        expect(sipConnector.isConfigured()).toBe(true);
        // @ts-ignore
        expect(hasValidUri(parseObject(sipConnector.ua!.configuration).uri)).toBe(true);
        expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
          uaConfigurationWithoutAuthorizationWithoutDisplayName,
        );
      },
    );
  });

  it('#3 Unregistered user change isRequiredDisplayName to true: correct', () => {
    expect.assertions(4);

    return processRequest(dataForConnectionWithoutAuthorizationWithoutDisplayName)
      .then(() => {
        return processRequest(dataForConnectionWithoutAuthorization);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.isConfigured()).toBe(true);
        // @ts-ignore
        expect(hasValidUri(parseObject(sipConnector.ua!.configuration).uri)).toBe(true);
        expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
          uaConfigurationWithoutAuthorization,
        );
      });
  });

  it('#4 Unregistered user: remove displayName', () => {
    expect.assertions(3);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(() => {
        return processRequest({
          ...dataForConnectionWithoutAuthorizationWithoutDisplayName,
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

  it('#5 Registered user: correct', () => {
    expect.assertions(3);

    return processRequest(dataForConnectionWithAuthorization).then((success) => {
      expect(success).toBe(true);
      expect(sipConnector.isConfigured()).toBe(true);
      expect(sipConnector.ua!.configuration).toEqual(uaConfigurationWithAuthorization);
    });
  });

  it('#6 Registered user: remove name', () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithAuthorization)
      .then(() => {
        return processRequest({ ...dataForConnectionWithAuthorization, name: '' });
      })
      .then((success) => {
        expect(success).toBe(false);
        expect(sipConnector.isConfigured()).toBe(false);
      });
  });

  it('#7 Registered user: incorrect password', () => {
    expect.assertions(1);

    return processRequest(dataForConnectionWithAuthorizationIncorrectPassword).catch((error) => {
      expect(error).toBeDefined();
    });
  });

  it('#8 Registered user: incorrect name', () => {
    expect.assertions(1);

    return processRequest(dataForConnectionWithAuthorizationIncorrectUser).catch((error) => {
      expect(error).toBeDefined();
    });
  });

  it('#9 sync changed displayName', () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(() => {
        return processRequest({
          ...dataForConnectionWithoutAuthorization,
          displayNameChanged: true,
          displayName: thirdWord,
        });
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.ua!.configuration.display_name).toBe(thirdWord);
      });
  });

  it('#10 debounce changed displayName', () => {
    expect.assertions(2);
    processRequest(dataForConnectionWithoutAuthorization);

    return processRequest({
      ...dataForConnectionWithoutAuthorization,
      displayNameChanged: true,
      displayName: thirdWord,
    }).then((success) => {
      expect(success).toBe(true);
      expect(sipConnector.ua!.configuration.display_name).toBe(thirdWord);
    });
  });

  it('#11 async changed displayName', () => {
    expect.assertions(3);

    return Promise.all([
      processRequest(dataForConnectionWithoutAuthorization),
      // 300 -debounced value
      delayPromise(300).then(() => {
        return processRequest({
          ...dataForConnectionWithoutAuthorization,
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

  it('#12 sync changed name', () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithAuthorization)
      .then(() => {
        return processRequest({ ...withNameChanged, name: thirdWord });
      })
      .then((success) => {
        expect(success).toBe(true);
        // @ts-ignore
        expect(sipConnector.ua!.configuration.uri).toBe(sipConnector.getSipServerUrl(thirdWord));
      });
  });

  it('#13 sync remove name', () => {
    expect.assertions(1);

    return processRequest(dataForConnectionWithAuthorization)
      .then(() => {
        return processRequest({ ...withNameChanged, name: '' });
      })
      .then((success) => {
        expect(success).toBe(false);
      });
  });

  it('#14 debounce changed name', () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(() => {
        processRequest(withNameChanged);

        return processRequest({ ...withNameChanged, name: thirdWord });
      })
      .then((success) => {
        expect(success).toBe(true);
        // @ts-ignore
        expect(sipConnector.ua!.configuration.uri).toBe(sipConnector.getSipServerUrl(thirdWord));
      });
  });

  it('# 15async changed name', () => {
    expect.assertions(3);

    return processRequest(dataForConnectionWithAuthorization).then(() => {
      return Promise.all([
        processRequest(withNameChanged),
        // 300 -debounced value
        delayPromise(300).then(() => {
          return processRequest({ ...withNameChanged, name: thirdWord });
        }),
      ]).then(([success1, success2]) => {
        expect(success1).toBe(false); // cancel first request
        expect(success2).toBe(true);

        // @ts-ignore
        expect(sipConnector.ua!.configuration.uri).toBe(sipConnector.getSipServerUrl(thirdWord));
      });
    });
  });

  it('#16 sync changed password', () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithAuthorization)
      .then(() => {
        return processRequest({ ...dataForConnectionWithAuthorization, password: 'wrong' });
      })
      .catch(() => {
        return processRequest(dataForConnectionWithAuthorizationPasswordChanged);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.ua!.configuration).toEqual(
          uaConfigurationWithAuthorizationPasswordChanged,
        );
      });
  });

  it('#17 sync remove password', () => {
    expect.assertions(1);

    return processRequest(dataForConnectionWithAuthorization)
      .then(() => {
        return processRequest({
          ...dataForConnectionWithAuthorizationPasswordChanged,
          password: '',
        });
      })
      .then((success) => {
        expect(success).toBe(false);
      });
  });

  it('#18 debounce changed password', () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(() => {
        const dataForRequest = {
          ...dataForConnectionWithAuthorizationPasswordChanged,
          isRegisteredUserChanged: true,
        };

        processRequest(dataForRequest);

        return processRequest(dataForRequest);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.ua!.configuration).toEqual(
          uaConfigurationWithAuthorizationPasswordChanged,
        );
      });
  });

  it('#19 debounce changed registered, with PasswordChanged', () => {
    expect.assertions(3);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then((success) => {
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

  it('#20 debounce changed registered, with NameChanged', () => {
    expect.assertions(3);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then((success) => {
        expect(success).toBe(true);

        return processRequest(withNameChanged);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(sipConnector.ua!.configuration).toEqual(uaConfigurationWithAuthorization);
      });
  });

  it('#21 change sipServerUrl', () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(() => {
        return processRequest(dataForConnectionWithoutAuthorizationWithSipServerUrlChanged);
      })
      .then((success) => {
        expect(success).toBe(true);
        expect(
          hasValidUri(
            // @ts-ignore
            parseObject(sipConnector.ua!.configuration).uri,
            dataForConnectionWithoutAuthorizationWithSipServerUrlChanged.sipServerUrl,
          ),
        ).toBe(true);
      });
  });

  it('#22 change sipWebSocketServerURL', () => {
    expect.assertions(2);

    return processRequest(dataForConnectionWithoutAuthorization)
      .then(() => {
        return processRequest(
          dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged,
        );
      })
      .then((success) => {
        expect(success).toBe(true);
        // @ts-ignore
        expect(parseObject(sipConnector.socket).url).toEqual(
          dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged.sipWebSocketServerURL,
        );
      });
  });
});
