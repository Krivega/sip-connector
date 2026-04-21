/// <reference types="jest" />
import {
  dataForConnectionWithAuthorization,
  dataForConnectionWithAuthorizationWithDisplayName,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithoutDisplayName,
  extraHeadersRemoteAddress,
  remoteAddress,
  SIP_SERVER_URL,
  uaConfigurationWithAuthorization,
  uaConfigurationWithAuthorizationWithDisplayName,
  uaConfigurationWithoutAuthorization,
  uaConfigurationWithoutAuthorizationWithoutDisplayName,
} from '../__fixtures__';
import UAMock, { createWebsocketHandshakeTimeoutError } from '../__fixtures__/UA.mock';
import { doMockSipConnector, JsSIP } from '../doMock';
import { SipConnector } from '../SipConnector';
import { uriWithName } from '../tools/__fixtures__/connectToServer';

import type { TJsSIP } from '../types';

const wrongPassword = 'wrongPassword';
const websocketHandshakeTimeoutError = createWebsocketHandshakeTimeoutError(SIP_SERVER_URL);

const numberOfConnectionAttempts = 3;

describe('connect', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
  });

  afterEach(() => {
    UAMock.resetStartError();
  });

  it('должен подключать пользователя с авторизацией', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.connectionManager.ua?.configuration).toEqual(
      uaConfigurationWithAuthorization,
    );
  });

  it('должен отклонять подключение с неправильным паролем', async () => {
    expect.assertions(1);

    const rejectedError = await sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        password: wrongPassword,
      })
      .catch((error: unknown) => {
        return error;
      });

    expect(rejectedError).toEqual({
      response: {
        status_code: 401,
        reason_phrase: 'Unauthorized',
      },
      cause: 'Rejected',
    });
  });

  it('должен изменять sipServerUrl при повторном подключении', async () => {
    expect.assertions(1);

    const sipServerUrlChanged = `${dataForConnectionWithAuthorization.sipServerUrl}Changed`;

    await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      sipServerIp: sipServerUrlChanged,
    });

    expect(sipConnector.connectionManager.ua?.configuration).toEqual({
      ...uaConfigurationWithAuthorization,
      uri: uriWithName(uaConfigurationWithAuthorization.uri.user, sipServerUrlChanged),
    });
  });

  it('должен подключать пользователя с авторизацией и displayName', async () => {
    expect.assertions(6);

    await sipConnector.connect(dataForConnectionWithAuthorizationWithDisplayName);

    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration?.sipServerIp).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.sipServerIp,
    );
    expect(connectionConfiguration?.displayName).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.displayName,
    );
    expect(connectionConfiguration?.register).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.register,
    );
    expect(connectionConfiguration?.user).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.user,
    );
    expect(connectionConfiguration?.password).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.password,
    );
    expect(sipConnector.connectionManager.ua?.configuration).toEqual(
      uaConfigurationWithAuthorizationWithDisplayName,
    );
  });

  it('должен подключать пользователя без авторизации', async () => {
    expect.assertions(6);

    await sipConnector.connect(dataForConnectionWithoutAuthorization);

    const { uri, ...configuration } = sipConnector.connectionManager.ua?.configuration ?? {};
    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration?.sipServerIp).toBe(
      dataForConnectionWithoutAuthorization.sipServerIp,
    );
    expect(connectionConfiguration?.displayName).toBe(
      dataForConnectionWithoutAuthorization.displayName,
    );
    expect(connectionConfiguration?.register).toBe(dataForConnectionWithoutAuthorization.register);
    expect(connectionConfiguration?.user).toBe(undefined);
    expect(connectionConfiguration?.password).toBe(undefined);

    expect(configuration).toEqual(uaConfigurationWithoutAuthorization);
  });

  it('должен подключать пользователя без авторизации и displayName', async () => {
    expect.assertions(6);

    await sipConnector.connect(dataForConnectionWithoutAuthorizationWithoutDisplayName);

    const { uri, ...configuration } = sipConnector.connectionManager.ua?.configuration ?? {};
    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration?.sipServerIp).toBe(
      dataForConnectionWithoutAuthorizationWithoutDisplayName.sipServerIp,
    );
    expect(connectionConfiguration?.displayName).toBe('DISPLAY_NAME');
    expect(connectionConfiguration?.register).toBe(false);
    expect(connectionConfiguration?.user).toBe(undefined);
    expect(connectionConfiguration?.password).toBe(undefined);
    expect(configuration).toEqual(uaConfigurationWithoutAuthorizationWithoutDisplayName);
  });

  it('должен сохранять connectionConfiguration после подключения', async () => {
    expect.assertions(5);

    const connectPromise = sipConnector.connect(dataForConnectionWithAuthorization);

    await connectPromise;

    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration?.sipServerIp).toBe(
      dataForConnectionWithAuthorization.sipServerIp,
    );
    expect(connectionConfiguration?.displayName).toBe('DISPLAY_NAME');
    expect(connectionConfiguration?.register).toBe(dataForConnectionWithAuthorization.register);
    expect(connectionConfiguration?.user).toBe(dataForConnectionWithAuthorization.user);
    expect(connectionConfiguration?.password).toBe(dataForConnectionWithAuthorization.password);
  });

  it('должен отправлять базовые extraHeaders', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    // @ts-expect-error
    expect(sipConnector.connectionManager.ua?.registrator().extraHeaders).toEqual(
      extraHeadersRemoteAddress,
    );
  });

  it('должен отправлять extraHeaders с remoteAddress', async () => {
    expect.assertions(1);

    await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      remoteAddress,
    });

    // @ts-expect-error
    expect(sipConnector.connectionManager.ua?.registrator().extraHeaders).toEqual(
      extraHeadersRemoteAddress,
    );
  });

  it('должен отправлять расширенные extraHeaders', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      extraHeaders,
    });

    // @ts-expect-error
    expect(sipConnector.connectionManager.ua?.registrator().extraHeaders).toEqual([
      ...extraHeadersRemoteAddress,
      ...extraHeaders,
    ]);
  });

  it('должен отправлять расширенные extraHeaders с remoteAddress', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      remoteAddress,
      extraHeaders,
    });

    // @ts-expect-error
    expect(sipConnector.connectionManager.ua?.registrator().extraHeaders).toEqual([
      ...extraHeadersRemoteAddress,
      ...extraHeaders,
    ]);
  });

  it('должен повторять процесс подключения при ошибке 1006', async () => {
    expect.assertions(2);

    UAMock.setStartError(websocketHandshakeTimeoutError);

    const requestConnectMocked = jest.spyOn(
      // @ts-expect-error
      sipConnector.connectionManager.connectionFlow,
      // @ts-expect-error
      'connectInner',
    );

    try {
      await sipConnector.connect(dataForConnectionWithoutAuthorization, {
        numberOfConnectionAttempts,
      });
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('call limit (3) is reached'));
    }

    expect(requestConnectMocked).toHaveBeenCalledTimes(numberOfConnectionAttempts);
  });

  it('должен завершать процесс подключения после 2 неудачных попыток с ошибкой 1006', async () => {
    expect.assertions(2);

    UAMock.setStartError(websocketHandshakeTimeoutError, { count: 2 });

    const requestConnectMocked = jest.spyOn(
      // @ts-expect-error
      sipConnector.connectionManager.connectionFlow,
      // @ts-expect-error
      'connectInner',
    );

    await sipConnector.connect(dataForConnectionWithAuthorization, {
      numberOfConnectionAttempts,
    });

    expect(sipConnector.connectionManager.ua?.configuration).toEqual(
      uaConfigurationWithAuthorization,
    );
    expect(requestConnectMocked).toHaveBeenCalledTimes(2);
  });

  it('должен использовать callLimit из конструктора SipConnector', async () => {
    expect.assertions(2);

    const callLimit = 5;

    const sipConnectorWithCallLimit = new SipConnector(
      { JsSIP: JsSIP as unknown as TJsSIP },
      { numberOfConnectionAttempts: callLimit },
    );

    UAMock.setStartError(websocketHandshakeTimeoutError);

    const requestConnectMocked = jest.spyOn(
      // @ts-expect-error - тестируем приватный метод
      sipConnectorWithCallLimit.connectionManager.connectionFlow,
      // @ts-expect-error - тестируем приватный метод
      'connectInner',
    );

    try {
      await sipConnectorWithCallLimit.connect(dataForConnectionWithoutAuthorization);
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error(`call limit (${callLimit}) is reached`));
    }

    expect(requestConnectMocked).toHaveBeenCalledTimes(callLimit);
  });

  it('должен переопределять callLimit опциями connect в SipConnector', async () => {
    expect.assertions(2);

    const constructorCallLimit = 5;
    const callLimit = 2;

    const sipConnectorWithConstructorCallLimit = new SipConnector(
      { JsSIP: JsSIP as unknown as TJsSIP },
      { numberOfConnectionAttempts: constructorCallLimit },
    );

    UAMock.setStartError(websocketHandshakeTimeoutError);

    const requestConnectMocked = jest.spyOn(
      // @ts-expect-error - тестируем приватный метод
      sipConnectorWithConstructorCallLimit.connectionManager.connectionFlow,
      // @ts-expect-error - тестируем приватный метод
      'connectInner',
    );

    try {
      await sipConnectorWithConstructorCallLimit.connect(dataForConnectionWithoutAuthorization, {
        numberOfConnectionAttempts: callLimit,
      });
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error(`call limit (${callLimit}) is reached`));
    }

    expect(requestConnectMocked).toHaveBeenCalledTimes(callLimit);
  });
});
