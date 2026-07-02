/// <reference types="jest" />
import {
  dataForConnectionWithAuthorization,
  dataForConnectionWithAuthorizationWithDisplayName,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithoutDisplayName,
  extraHeadersRemoteAddress,
  remoteAddress,
  SIP_SERVER_URL,
  uaConfigWithAuthorization,
  uaConfigWithAuthorizationWithDisplayName,
  uaConfigWithoutAuthorization,
  uaConfigWithoutAuthorizationWithoutDisplayName,
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

    expect(sipConnector.connectionManager.ua?.configuration).toEqual(uaConfigWithAuthorization);
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
      ...uaConfigWithAuthorization,
      uri: uriWithName(uaConfigWithAuthorization.uri.user, sipServerUrlChanged),
    });
  });

  it('должен подключать пользователя с авторизацией и displayName', async () => {
    expect.assertions(6);

    await sipConnector.connect(dataForConnectionWithAuthorizationWithDisplayName);

    const connectionConfig = sipConnector.getConnectionConfiguration();

    expect(connectionConfig?.sipServerIp).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.sipServerIp,
    );
    expect(connectionConfig?.displayName).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.displayName,
    );
    expect(connectionConfig?.register).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.register,
    );
    expect(connectionConfig?.user).toBe(dataForConnectionWithAuthorizationWithDisplayName.user);
    expect(connectionConfig?.password).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.password,
    );
    expect(sipConnector.connectionManager.ua?.configuration).toEqual(
      uaConfigWithAuthorizationWithDisplayName,
    );
  });

  it('должен подключать пользователя без авторизации', async () => {
    expect.assertions(6);

    await sipConnector.connect(dataForConnectionWithoutAuthorization);

    const { uri, ...config } = sipConnector.connectionManager.ua?.configuration ?? {};
    const connectionConfig = sipConnector.getConnectionConfiguration();

    expect(connectionConfig?.sipServerIp).toBe(dataForConnectionWithoutAuthorization.sipServerIp);
    expect(connectionConfig?.displayName).toBe(dataForConnectionWithoutAuthorization.displayName);
    expect(connectionConfig?.register).toBe(dataForConnectionWithoutAuthorization.register);
    expect(connectionConfig?.user).toBe(undefined);
    expect(connectionConfig?.password).toBe(undefined);

    expect(config).toEqual(uaConfigWithoutAuthorization);
  });

  it('должен подключать пользователя без авторизации и displayName', async () => {
    expect.assertions(6);

    await sipConnector.connect(dataForConnectionWithoutAuthorizationWithoutDisplayName);

    const { uri, ...config } = sipConnector.connectionManager.ua?.configuration ?? {};
    const connectionConfig = sipConnector.getConnectionConfiguration();

    expect(connectionConfig?.sipServerIp).toBe(
      dataForConnectionWithoutAuthorizationWithoutDisplayName.sipServerIp,
    );
    expect(connectionConfig?.displayName).toBe('DISPLAY_NAME');
    expect(connectionConfig?.register).toBe(false);
    expect(connectionConfig?.user).toBe(undefined);
    expect(connectionConfig?.password).toBe(undefined);
    expect(config).toEqual(uaConfigWithoutAuthorizationWithoutDisplayName);
  });

  it('должен сохранять connectionConfiguration после подключения', async () => {
    expect.assertions(5);

    const connectPromise = sipConnector.connect(dataForConnectionWithAuthorization);

    await connectPromise;

    const connectionConfig = sipConnector.getConnectionConfiguration();

    expect(connectionConfig?.sipServerIp).toBe(dataForConnectionWithAuthorization.sipServerIp);
    expect(connectionConfig?.displayName).toBe('DISPLAY_NAME');
    expect(connectionConfig?.register).toBe(dataForConnectionWithAuthorization.register);
    expect(connectionConfig?.user).toBe(dataForConnectionWithAuthorization.user);
    expect(connectionConfig?.password).toBe(dataForConnectionWithAuthorization.password);
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

    expect(sipConnector.connectionManager.ua?.configuration).toEqual(uaConfigWithAuthorization);
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
