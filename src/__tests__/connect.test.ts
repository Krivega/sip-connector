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
import { uriWithName } from '../tools/__fixtures__/connectToServer';

import type { SipConnector } from '../SipConnector';

const wrongPassword = 'wrongPassword';
const websocketHandshakeTimeoutError = createWebsocketHandshakeTimeoutError(SIP_SERVER_URL);

const connectCallLimit = 3;

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

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(ua.configuration).toEqual(uaConfigurationWithAuthorization);
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

    const ua = await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      sipServerUrl: sipServerUrlChanged,
    });

    expect(ua.configuration).toEqual({
      ...uaConfigurationWithAuthorization,
      uri: uriWithName(uaConfigurationWithAuthorization.uri.user, sipServerUrlChanged),
    });
  });

  it('должен подключать пользователя с авторизацией и displayName', async () => {
    expect.assertions(6);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorizationWithDisplayName);
    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration.sipServerUrl).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.sipServerUrl,
    );
    expect(connectionConfiguration.displayName).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.displayName,
    );
    expect(connectionConfiguration.register).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.register,
    );
    expect(connectionConfiguration.user).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.user,
    );
    expect(connectionConfiguration.password).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.password,
    );
    expect(ua.configuration).toEqual(uaConfigurationWithAuthorizationWithDisplayName);
  });

  it('должен подключать пользователя без авторизации', async () => {
    expect.assertions(6);

    const ua = await sipConnector.connect(dataForConnectionWithoutAuthorization);

    const { uri, ...configuration } = ua.configuration;
    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration.sipServerUrl).toBe(
      dataForConnectionWithoutAuthorization.sipServerUrl,
    );
    expect(connectionConfiguration.displayName).toBe(
      dataForConnectionWithoutAuthorization.displayName,
    );
    expect(connectionConfiguration.register).toBe(dataForConnectionWithoutAuthorization.register);
    expect(connectionConfiguration.user).toBe(undefined);
    expect(connectionConfiguration.password).toBe(undefined);

    expect(configuration).toEqual(uaConfigurationWithoutAuthorization);
  });

  it('должен подключать пользователя без авторизации и displayName', async () => {
    expect.assertions(6);

    const ua = await sipConnector.connect(dataForConnectionWithoutAuthorizationWithoutDisplayName);

    const { uri, ...configuration } = ua.configuration;
    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration.sipServerUrl).toBe(
      dataForConnectionWithoutAuthorizationWithoutDisplayName.sipServerUrl,
    );
    expect(connectionConfiguration.displayName).toBe('');
    expect(connectionConfiguration.register).toBe(false);
    expect(connectionConfiguration.user).toBe(undefined);
    expect(connectionConfiguration.password).toBe(undefined);
    expect(configuration).toEqual(uaConfigurationWithoutAuthorizationWithoutDisplayName);
  });

  it('должен сохранять connectionConfiguration после подключения', async () => {
    expect.assertions(6);

    const connectPromise = sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.getCallConfiguration().answer).toBe(undefined);

    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration.sipServerUrl).toBe(
      dataForConnectionWithAuthorization.sipServerUrl,
    );
    expect(connectionConfiguration.displayName).toBe('');
    expect(connectionConfiguration.register).toBe(dataForConnectionWithAuthorization.register);
    expect(connectionConfiguration.user).toBe(dataForConnectionWithAuthorization.user);
    expect(connectionConfiguration.password).toBe(dataForConnectionWithAuthorization.password);

    return connectPromise;
  });

  it('должен устанавливать displayName после подключения с авторизацией', async () => {
    const anotherDisplayName = 'anotherDisplayName';

    await sipConnector.connect(dataForConnectionWithAuthorizationWithDisplayName);
    await sipConnector.set({
      displayName: anotherDisplayName,
    });

    expect(sipConnector.getConnectionConfiguration().displayName).toBe(anotherDisplayName);
  });

  it('должен отправлять базовые extraHeaders', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    // @ts-expect-error
    expect(ua.registrator().extraHeaders).toEqual([]);
  });

  it('должен отправлять extraHeaders с remoteAddress', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect({ ...dataForConnectionWithAuthorization, remoteAddress });

    // @ts-expect-error
    expect(ua.registrator().extraHeaders).toEqual(extraHeadersRemoteAddress);
  });

  it('должен отправлять расширенные extraHeaders', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    const ua = await sipConnector.connect({ ...dataForConnectionWithAuthorization, extraHeaders });

    // @ts-expect-error
    expect(ua.registrator().extraHeaders).toEqual(extraHeaders);
  });

  it('должен отправлять расширенные extraHeaders с remoteAddress', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    const ua = await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      remoteAddress,
      extraHeaders,
    });

    // @ts-expect-error
    expect(ua.registrator().extraHeaders).toEqual([...extraHeadersRemoteAddress, ...extraHeaders]);
  });

  it('должен повторять процесс подключения при ошибке 1006', async () => {
    expect.assertions(2);

    UAMock.setStartError(websocketHandshakeTimeoutError);
    JsSIP.UA = UAMock;

    const requestConnectMocked = jest.spyOn(
      // @ts-expect-error
      sipConnector.connectionManager.connectionFlow,
      // @ts-expect-error
      'connectInner',
    );

    try {
      await sipConnector.connect(dataForConnectionWithoutAuthorization, {
        callLimit: connectCallLimit,
      });
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('call limit (3) is reached'));
    }

    expect(requestConnectMocked).toHaveBeenCalledTimes(connectCallLimit);
  });

  it('должен завершать процесс подключения после 2 неудачных попыток с ошибкой 1006', async () => {
    expect.assertions(2);

    UAMock.setStartError(websocketHandshakeTimeoutError, { count: 2 });

    JsSIP.UA = UAMock;

    const requestConnectMocked = jest.spyOn(
      // @ts-expect-error
      sipConnector.connectionManager.connectionFlow,
      // @ts-expect-error
      'connectInner',
    );

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization, {
      callLimit: connectCallLimit,
    });

    expect(ua.configuration).toEqual(uaConfigurationWithAuthorization);
    expect(requestConnectMocked).toHaveBeenCalledTimes(2);
  });
});
