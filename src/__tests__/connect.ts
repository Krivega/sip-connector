/// <reference types="jest" />
import type SipConnector from '../SipConnector';
import {
  SIP_SERVER_URL,
  dataForConnectionWithAuthorization,
  dataForConnectionWithAuthorizationWithDisplayName,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithoutDisplayName,
  extraHeadersRemoteAddress,
  remoteAddress,
  uaConfigurationWithAuthorization,
  uaConfigurationWithAuthorizationWithDisplayName,
  uaConfigurationWithoutAuthorization,
  uaConfigurationWithoutAuthorizationWithoutDisplayName,
} from '../__fixtures__';
import UAMock, { createWebsocketHandshakeTimeoutError } from '../__fixtures__/UA.mock';
import { doMockSipConnector } from '../doMock';
import { uriWithName } from '../tools/__fixtures__/connectToServer';

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

  it('authorization user', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(ua.configuration).toEqual(uaConfigurationWithAuthorization);
  });

  it('authorization user with wrong password', async () => {
    expect.assertions(1);

    const rejectedError = await sipConnector
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        password: wrongPassword,
      })
      .catch((error: unknown) => {
        return error;
      });

    expect(rejectedError).toEqual({ response: null, cause: 'Wrong credentials' });
  });

  it('and change sipServerUrl', async () => {
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

  it('authorization user with displayName', async () => {
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

  it('without authorization', async () => {
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

  it('without authorization without displayName', async () => {
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

  it('connectionConfiguration after connect', async () => {
    expect.assertions(6);

    const connectPromise = sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.getConnectionConfiguration().answer).toBe(undefined);

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

  it('set password after with authorization', async () => {
    expect.assertions(3);

    try {
      await sipConnector.connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        password: wrongPassword,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('error', error);
    }

    expect(sipConnector.getConnectionConfiguration().password).toBe(wrongPassword);

    await sipConnector.set({
      password: dataForConnectionWithAuthorizationWithDisplayName.password,
    });

    expect(sipConnector.getConnectionConfiguration().password).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.password,
    );
    expect(sipConnector.ua!.configuration).toEqual(uaConfigurationWithAuthorizationWithDisplayName);
  });

  it('set same password after with authorization', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorizationWithDisplayName);

    return sipConnector
      .set({
        password: dataForConnectionWithAuthorizationWithDisplayName.password,
      })
      .catch((error: unknown) => {
        expect(error).toEqual(new Error('nothing changed'));
        expect(sipConnector.getConnectionConfiguration().password).toBe(
          dataForConnectionWithAuthorizationWithDisplayName.password,
        );
        expect(sipConnector.ua!.configuration).toEqual(
          uaConfigurationWithAuthorizationWithDisplayName,
        );
      });
  });

  it('set displayName after with authorization', async () => {
    const anotherDisplayName = 'anotherDisplayName';

    await sipConnector.connect(dataForConnectionWithAuthorizationWithDisplayName);
    await sipConnector.set({
      displayName: anotherDisplayName,
    });

    expect(sipConnector.getConnectionConfiguration().displayName).toBe(anotherDisplayName);
  });

  it('send base extraHeaders', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    // @ts-expect-error
    expect(ua.registrator().extraHeaders).toEqual([]);
  });

  it('send extraHeaders with remoteAddress', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect({ ...dataForConnectionWithAuthorization, remoteAddress });

    // @ts-expect-error
    expect(ua.registrator().extraHeaders).toEqual(extraHeadersRemoteAddress);
  });

  it('send extended extraHeaders', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    const ua = await sipConnector.connect({ ...dataForConnectionWithAuthorization, extraHeaders });

    // @ts-expect-error
    expect(ua.registrator().extraHeaders).toEqual(extraHeaders);
  });

  it('send extended extraHeaders with remoteAddress', async () => {
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

  it('should repeat connection process when connection has failed with 1006 error', async () => {
    expect.assertions(2);

    UAMock.setStartError(websocketHandshakeTimeoutError);

    // @ts-expect-error
    sipConnector.JsSIP.UA = UAMock;

    // @ts-expect-error
    const requestConnectMocked = jest.spyOn(sipConnector._cancelableConnect, 'request');

    try {
      await sipConnector.connect(dataForConnectionWithoutAuthorization, {
        callLimit: connectCallLimit,
      });
    } catch (error) {
      expect(error).toEqual(new Error('call limit (3) is reached'));
    }

    expect(requestConnectMocked).toHaveBeenCalledTimes(connectCallLimit);
  });

  it('should complete connection process after 2 connection has failed with 1006 error', async () => {
    expect.assertions(2);

    UAMock.setStartError(websocketHandshakeTimeoutError, { count: 2 });

    // @ts-expect-error
    sipConnector.JsSIP.UA = UAMock;

    // @ts-expect-error
    const requestConnectMocked = jest.spyOn(sipConnector._cancelableConnect, 'request');

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization, {
      callLimit: connectCallLimit,
    });

    expect(ua.configuration).toEqual(uaConfigurationWithAuthorization);
    expect(requestConnectMocked).toHaveBeenCalledTimes(2);
  });
});
