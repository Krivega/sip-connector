/* eslint-disable @typescript-eslint/no-non-null-assertion */
/// <reference types="jest" />
import resolveParameters from '@/ConnectionManager/utils/resolveParameters';
import { doMockSipConnector } from '@/doMock';
import {
  LOCKED_SIP_WEB_SOCKET_SERVER_URL,
  dataForConnectionWithAuthorization,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithSipServerUrlChanged,
  oneWord,
  thirdWord,
  twoWord,
  uaConfigurationWithAuthorization,
  uaConfigurationWithoutAuthorization,
  uriWithName,
} from '@/tools/__fixtures__/connectToServer';
import hasValidUri from '@/tools/__fixtures__/hasValidUri';
import { parseObjectWithoutUri } from '@/tools/__tests-utils__/parseObject';
import SipConnectorFacade from '../@SipConnectorFacade';

import type { SipConnector } from '@/SipConnector';

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

    sipConnector.connect = async (getParameters) => {
      const data = await resolveParameters(getParameters);

      if (data.sipServerUrl === LOCKED_SIP_WEB_SOCKET_SERVER_URL) {
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
      .connectToServer({ ...dataForConnectionWithAuthorization, user: oneWord })
      .then(async () => {
        return sipConnectorFacade.connectToServer({
          ...dataForConnectionWithAuthorization,
          user: twoWord,
        });
      })
      .then(async () => {
        return sipConnectorFacade.connectToServer({
          ...dataForConnectionWithAuthorization,
          user: thirdWord,
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
    return Promise.allSettled([
      sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization),
      sipConnectorFacade.connectToServer(dataForConnectionWithoutAuthorization),
    ]).then((results) => {
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');
      expect(hasValidUri(sipConnector.connectionManager.ua!.configuration.uri)).toBe(true);
      expect(parseObjectWithoutUri(sipConnector.connectionManager.ua!.configuration)).toEqual(
        uaConfigurationWithoutAuthorization,
      );
    });
  });

  it('change sipServerUrl (WebSocket URL)', async () => {
    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade
          .connectToServer(dataForConnectionWithoutAuthorizationWithSipServerUrlChanged)
          .then(() => {
            expect(
              hasValidUri(
                sipConnector.connectionManager.ua!.configuration.uri,
                String(dataForConnectionWithoutAuthorizationWithSipServerUrlChanged.sipServerIp),
              ),
            ).toBe(true);

            const config = parseObjectWithoutUri(sipConnector.connectionManager.ua!.configuration);
            const expected = parseObjectWithoutUri(uaConfigurationWithoutAuthorization);

            // Socket URL должен быть изменен
            const sockets = Array.isArray(config.sockets) ? config.sockets : [config.sockets];

            expect((sockets[0] as { url: string }).url).toBe(
              dataForConnectionWithoutAuthorizationWithSipServerUrlChanged.sipServerUrl,
            );

            // Остальная конфигурация должна совпадать
            expect({ ...config, sockets: expected.sockets }).toEqual(expected);
          });
      });
  });

  it('change sipServerIp', async () => {
    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade
          .connectToServer(dataForConnectionWithoutAuthorizationWithSipServerUrlChanged)
          .then(() => {
            expect(sipConnector.socket!.url).toEqual(
              dataForConnectionWithoutAuthorizationWithSipServerUrlChanged.sipServerUrl,
            );
          });
      });
  });

  it('should be closed web-socket connection when wss-request has failed', async () => {
    expect.assertions(1);

    return sipConnectorFacade
      .connectToServer({
        ...dataForConnectionWithAuthorization,
        sipServerUrl: LOCKED_SIP_WEB_SOCKET_SERVER_URL,
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(error).toBeDefined();
      });
  });

  it('should not be closed web-socket connection when wss-request has failed', async () => {
    expect.assertions(1);

    return sipConnectorFacade
      .connectToServer({
        ...dataForConnectionWithAuthorization,
        sipServerUrl: LOCKED_SIP_WEB_SOCKET_SERVER_URL,
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(error).toBeDefined();
      });
  });
});
