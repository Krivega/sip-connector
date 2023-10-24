import doMockSIPconnector from '../../__fixtures__/doMock';
import dataCall from '../__fixtures__/call';
import { dataForConnectionWithoutAuthorization } from '../__fixtures__/connectToServer';
import resolveCall from '../callToServer';
import resolveConnectToServer from '../connectToServer';

describe('actionsProgressCall', () => {
  const sipConnector = doMockSIPconnector();
  let connectToServer: ReturnType<typeof resolveConnectToServer>;
  let call: ReturnType<typeof resolveCall>;
  let onBeforeProgressCall: jest.Mock<void>;
  let onSuccessProgressCall: jest.Mock<void>;
  let onFailProgressCall: jest.Mock<void>;
  let onFinishProgressCall: jest.Mock<void>;
  let onEndedCall: jest.Mock<void>;

  beforeEach(() => {
    jest.resetModules();

    onBeforeProgressCall = jest.fn();
    onSuccessProgressCall = jest.fn();
    onFailProgressCall = jest.fn();
    onFinishProgressCall = jest.fn();
    onEndedCall = jest.fn();

    connectToServer = resolveConnectToServer(sipConnector);
    call = resolveCall(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 check onBeforeProgressCall, onSuccessProgressCall, onFinishProgressCall', async () => {
    expect.assertions(4);

    return connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return call({
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

    return connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return call({
          ...dataForFailedCall,
          onBeforeProgressCall,
          onSuccessProgressCall,
          onFailProgressCall,
          onFinishProgressCall,
        });
      })
      .catch((error) => {
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

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call({
        ...dataCall,
        onEndedCall,
      });
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('ended', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#4 check onEndedCall when ended: second call', async () => {
    expect.assertions(1);

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call({
        ...dataCall,
        onEndedCall,
      });
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('ended', 'error');

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call(dataCall);
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('ended', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#5 check onEndedCall when failed', async () => {
    expect.assertions(1);

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call({
        ...dataCall,
        onEndedCall,
      });
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('failed', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#6 check onEndedCall when failed: second call', async () => {
    expect.assertions(1);

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call({
        ...dataCall,
        onEndedCall,
      });
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('failed', 'error');

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call(dataCall);
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('failed', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#7 check onEndedCall when race: failed first', async () => {
    expect.assertions(1);

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call({
        ...dataCall,
        onEndedCall,
      });
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('failed', 'error');

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call(dataCall);
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('ended', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });

  it('#8 check onEndedCall when race: ended first', async () => {
    expect.assertions(1);

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call({
        ...dataCall,
        onEndedCall,
      });
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('ended', 'error');

    await connectToServer(dataForConnectionWithoutAuthorization).then(async () => {
      return call(dataCall);
    });

    // @ts-expect-error
    sipConnector._sessionEvents.trigger('failed', 'error');

    expect(onEndedCall.mock.calls.length).toBe(1);
  });
});
