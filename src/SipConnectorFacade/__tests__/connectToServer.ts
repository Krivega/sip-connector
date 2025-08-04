/* eslint-disable @typescript-eslint/no-non-null-assertion */
/// <reference types="jest" />
import type { SipConnector } from '@/SipConnector';
import { doMockSipConnector } from '@/doMock';
import {
  LOCKED_SIP_WEB_SOCKET_SERVER_URL,
  dataForConnectionWithAuthorization,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithSipServerUrlChanged,
  dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged,
  oneWord,
  thirdWord,
  twoWord,
  uaConfigurationWithAuthorization,
  uaConfigurationWithoutAuthorization,
  uriWithName,
} from '@/tools/__fixtures__/connectToServer';
import hasValidUri from '@/tools/__fixtures__/hasValidUri';
import { parseObjectWithoutUri } from '@/tools/__tests-utils__/parseObject';
import SipConnectorFacade from '../SipConnectorFacade';

describe('connectToServer', () => {
  let sipConnector: SipConnector;
  let sipConnectorFacade: SipConnectorFacade;
  let disconnectedMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    sipConnector = doMockSipConnector();
    sipConnectorFacade = new SipConnectorFacade(sipConnector);

    disconnectedMock = jest.fn();

    const { disconnect: disconnectOrigin, connect: connectOrigin } = sipConnector;

    sipConnector.disconnect = async () => {
      disconnectedMock();

      return disconnectOrigin();
    };

    sipConnector.connect = async (data) => {
      if (data.sipWebSocketServerURL === LOCKED_SIP_WEB_SOCKET_SERVER_URL) {
        const error = new Error('failed wss-request');

        throw error;
      }

      return connectOrigin(data);
    };
  });

  it('registered', async () => {
    return sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization).then(() => {
      expect(sipConnector.connectionManager.ua?.configuration).toEqual(
        uaConfigurationWithAuthorization,
      );
    });
  });

  it('registered sync', async () => {
    return sipConnectorFacade
      .connectToServer({ ...dataForConnectionWithAuthorization, name: oneWord })
      .then(async () => {
        return sipConnectorFacade.connectToServer({
          ...dataForConnectionWithAuthorization,
          name: twoWord,
        });
      })
      .then(async () => {
        return sipConnectorFacade.connectToServer({
          ...dataForConnectionWithAuthorization,
          name: thirdWord,
        });
      })
      .then(() => {
        expect(sipConnector.connectionManager.ua?.configuration).toEqual({
          ...uaConfigurationWithAuthorization,
          uri: uriWithName(thirdWord),
        });
      });
  });

  it('unregistered', async () => {
    return sipConnectorFacade.connectToServer(dataForConnectionWithoutAuthorization).then(() => {
      expect(hasValidUri(sipConnector.connectionManager.ua!.configuration.uri)).toBe(true);
      expect(parseObjectWithoutUri(sipConnector.connectionManager.ua!.configuration)).toEqual(
        uaConfigurationWithoutAuthorization,
      );
    });
  });

  it('unregistered async', async () => {
    return Promise.all([
      sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization),
      sipConnectorFacade.connectToServer(dataForConnectionWithoutAuthorization),
    ]).then(() => {
      expect(hasValidUri(sipConnector.connectionManager.ua!.configuration.uri)).toBe(true);
      expect(parseObjectWithoutUri(sipConnector.connectionManager.ua!.configuration)).toEqual(
        uaConfigurationWithoutAuthorization,
      );
    });
  });

  it('change sipServerUrl', async () => {
    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade
          .connectToServer(dataForConnectionWithoutAuthorizationWithSipServerUrlChanged)
          .then(() => {
            expect(
              hasValidUri(
                sipConnector.connectionManager.ua!.configuration.uri,
                dataForConnectionWithoutAuthorizationWithSipServerUrlChanged.sipServerUrl,
              ),
            ).toBe(true);
            expect(parseObjectWithoutUri(sipConnector.connectionManager.ua!.configuration)).toEqual(
              uaConfigurationWithoutAuthorization,
            );
          });
      });
  });

  it('change sipWebSocketServerUrl', async () => {
    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade
          .connectToServer(dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged)
          .then(() => {
            expect(sipConnector.socket!.url).toEqual(
              dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged.sipWebSocketServerURL,
            );
          });
      });
  });

  it('should be closed web-socket connection when wss-request has failed and isDisconnectOnFail is true', async () => {
    expect.assertions(2);

    return sipConnectorFacade
      .connectToServer({
        ...dataForConnectionWithAuthorization,
        sipWebSocketServerURL: LOCKED_SIP_WEB_SOCKET_SERVER_URL,
        isDisconnectOnFail: true,
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(disconnectedMock).toHaveBeenCalledTimes(1);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(error).toBeDefined();
      });
  });

  it('should not be closed web-socket connection when wss-request has failed and isDisconnectOnFail is false', async () => {
    expect.assertions(2);

    return sipConnectorFacade
      .connectToServer({
        ...dataForConnectionWithAuthorization,
        sipWebSocketServerURL: LOCKED_SIP_WEB_SOCKET_SERVER_URL,
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(disconnectedMock).toHaveBeenCalledTimes(0);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(error).toBeDefined();
      });
  });
});
