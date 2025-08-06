/// <reference types="jest" />
import { doMockSipConnector } from '@/doMock';
import dataCall, { dataCallPurgatory, peerConnectionFromData } from '@/tools/__fixtures__/call';
import { dataForConnectionWithoutAuthorization } from '@/tools/__fixtures__/connectToServer';
import parseObject from '@/tools/__tests-utils__/parseObject';
import SipConnectorFacade from '../SipConnectorFacade';

describe('callToServer', () => {
  let sipConnectorFacade: SipConnectorFacade;

  beforeEach(() => {
    jest.resetModules();

    const sipConnector = doMockSipConnector();

    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  it('check call', async () => {
    expect.assertions(3);

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCall);
      })
      .then((peerConnection) => {
        expect(parseObject(peerConnection.getReceivers())).toEqual(
          parseObject(peerConnectionFromData.getReceivers()),
        );
        expect(dataCall.onEnterPurgatory).toHaveBeenCalledTimes(0);
        expect(dataCall.onEnterConference).toHaveBeenCalledTimes(1);
      });
  });

  it('should call correct handler after purgatory call', async () => {
    expect.assertions(2);

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCallPurgatory);
      })
      .then(() => {
        expect(dataCallPurgatory.onEnterPurgatory).toHaveBeenCalledTimes(1);
        expect(dataCallPurgatory.onEnterConference).toHaveBeenCalledTimes(0);
      });
  });
});
