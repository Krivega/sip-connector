/// <reference types="jest" />
// @ts-nocheck
import doMockSIPconnector from '../../doMock';
import dataCall from '../../tools/__fixtures__/call';
import {
  dataForConnectionWithAuthorization,
  dataForConnectionWithoutAuthorization,
} from '../../tools/__fixtures__/connectToServer';
import SipConnectorFacade from '../SipConnectorFacade';

describe('SipConnectorFacade', () => {
  let sipConnectorFacade: SipConnectorFacade;

  beforeEach(() => {
    jest.resetModules();

    sipConnectorFacade = new SipConnectorFacade(doMockSIPconnector());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should proxy method isConfigured before register', () => {
    expect(sipConnectorFacade.isConfigured()).toBe(false);
  });

  it('should proxy method isConfigured after register', async () => {
    await sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization);
    expect(sipConnectorFacade.isConfigured()).toBe(true);
    expect(sipConnectorFacade.sipConnector.isConfigured()).toBe(true);
  });

  it('should proxy method connection before call', () => {
    expect(sipConnectorFacade.connection).toBe(undefined);
  });

  it('should proxy method connection after call', async () => {
    await sipConnectorFacade.connectToServer(dataForConnectionWithoutAuthorization);
    await sipConnectorFacade.callToServer({
      ...dataCall,
    });
    expect(sipConnectorFacade.connection).toBeDefined();
  });
});
