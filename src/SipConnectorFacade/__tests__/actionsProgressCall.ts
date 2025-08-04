/// <reference types="jest" />
import { doMockSipConnector } from '../../doMock';
import dataCall from '../../tools/__fixtures__/call';
import { dataForConnectionWithoutAuthorization } from '../../tools/__fixtures__/connectToServer';

import SipConnectorFacade from '../SipConnectorFacade';

describe('actionsProgressCall', () => {
  const sipConnector = doMockSipConnector();
  let sipConnectorFacade: SipConnectorFacade;
  let onBeforeProgressCall: jest.Mock<void>;
  let onSuccessProgressCall: jest.Mock<void>;
  let onFailProgressCall: jest.Mock<void>;
  let onFinishProgressCall: jest.Mock<void>;
  let onEndedCall: jest.Mock<void>;

  beforeEach(() => {
    jest.resetModules();

    onBeforeProgressCall = jest.fn() as jest.Mock<void>;
    onSuccessProgressCall = jest.fn() as jest.Mock<void>;
    onFailProgressCall = jest.fn() as jest.Mock<void>;
    onFinishProgressCall = jest.fn() as jest.Mock<void>;
    onEndedCall = jest.fn() as jest.Mock<void>;

    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 check onBeforeProgressCall, onSuccessProgressCall, onFinishProgressCall', async () => {
    expect.assertions(4);

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer({
          ...dataCall,
          onBeforeProgressCall,
          onSuccessProgressCall,
          onFailProgressCall,
          onFinishProgressCall,
        });
      })
      .finally(() => {
        expect(onBeforeProgressCall.mock.calls.length).toBe(1);
        expect(onSuccessProgressCall.mock.calls.length).toBe(1);
        expect(onFailProgressCall.mock.calls.length).toBe(0);
        expect(onFinishProgressCall.mock.calls.length).toBe(1);
      });
  });

  it('#2 check onFailProgressCall', async () => {
    expect.assertions(4);

    const mediaStream = {} as MediaStream;

    const dataForFailedCall = { ...dataCall, mediaStream };

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer({
          ...dataForFailedCall,
          onBeforeProgressCall,
          onSuccessProgressCall,
          onFailProgressCall,
          onFinishProgressCall,
        });
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.log(error);
      })
      .finally(() => {
        expect(onBeforeProgressCall.mock.calls.length).toBe(1);
        expect(onSuccessProgressCall.mock.calls.length).toBe(0);
        expect(onFailProgressCall.mock.calls.length).toBe(1);
        expect(onFinishProgressCall.mock.calls.length).toBe(1);
      });
  });

  it('#3 check onEndedCall when ended', async () => {
    expect.assertions(1);

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer({
          ...dataCall,
          onEndedCall,
        });
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('ended', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#4 check onEndedCall when ended: second call', async () => {
    expect.assertions(1);

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer({
          ...dataCall,
          onEndedCall,
        });
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('ended', 'error');

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCall);
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('ended', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#5 check onEndedCall when failed', async () => {
    expect.assertions(1);

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer({
          ...dataCall,
          onEndedCall,
        });
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('failed', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#6 check onEndedCall when failed: second call', async () => {
    expect.assertions(1);

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer({
          ...dataCall,
          onEndedCall,
        });
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('failed', 'error');

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCall);
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('failed', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#7 check onEndedCall when race: failed first', async () => {
    expect.assertions(1);

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer({
          ...dataCall,
          onEndedCall,
        });
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('failed', 'error');

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCall);
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('ended', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#8 check onEndedCall when race: ended first', async () => {
    expect.assertions(1);

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer({
          ...dataCall,
          onEndedCall,
        });
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('ended', 'error');

    await sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCall);
      });

    // @ts-expect-error
    sipConnector.sessionEvents.trigger('failed', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });
});
