/* eslint-disable unicorn/filename-case */
/// <reference types="jest" />
import delayPromise from '../../__fixtures__/delayPromise';
import { doMockSipConnector } from '../../doMock.new';
import { SipConnectorFacade } from '../../SipConnectorFacade';
import dataCall from '../__fixtures__/call';
import { dataForConnectionWithoutAuthorization } from '../__fixtures__/connectToServer';
import sendDtmfAccumulated from '../sendDtmfFAccumulated';

describe('sendDtmfAccumulated', () => {
  const DTMF_SENDING_DELAY = 100;
  const dtmf = '1234#';
  const sipConnector = doMockSipConnector();
  let sipConnectorFacade: SipConnectorFacade;

  beforeEach(() => {
    jest.resetModules();

    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  it('should be sent dtmf from sendDtmfAccumulated', async () => {
    expect.assertions(5);

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCall);
      })
      .then(async () => {
        sipConnector.onApi('newDTMF', ({ originator }: { originator: string }) => {
          expect(originator).toEqual('local');
        });

        const sendKey = async (key: string): Promise<void> => {
          return sipConnector.sendDTMF(key);
        };

        await sendDtmfAccumulated({ accumulatedKeys: dtmf, sendKey });

        await delayPromise(DTMF_SENDING_DELAY);
      });
  });
});
