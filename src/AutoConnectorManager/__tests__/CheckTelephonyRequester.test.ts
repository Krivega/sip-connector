import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import { doMockSipConnector } from '@/doMock';
import CheckTelephonyRequester from '../CheckTelephonyRequester';

import type { TParametersCheckTelephony } from '../types';

const startMock = jest.fn();
const stopMock = jest.fn();

const mockResolveRequesterByTimeout = resolveRequesterByTimeout as jest.MockedFunction<
  typeof resolveRequesterByTimeout
>;

jest.mock('@krivega/timeout-requester', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    ...jest.requireActual('@krivega/timeout-requester'),
    resolveRequesterByTimeout: jest.fn(() => {
      return {
        start: startMock,
        stop: stopMock,
      };
    }),
  };
});

describe('CheckTelephonyRequester', () => {
  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let checkTelephonyRequester: CheckTelephonyRequester;
  let onBeforeRequestMock: jest.Mock;

  const interval = 10_000;

  beforeEach(() => {
    jest.clearAllMocks();

    sipConnector = doMockSipConnector();
    onBeforeRequestMock = jest.fn().mockResolvedValue(undefined);

    checkTelephonyRequester = new CheckTelephonyRequester({
      connectionManager: sipConnector.connectionManager,
      interval,
      onBeforeRequest: onBeforeRequestMock,
    });
  });

  afterEach(() => {
    checkTelephonyRequester.stop();
    jest.restoreAllMocks();
  });

  describe('start', () => {
    const getParametersMock = jest.fn();
    const onSuccessRequestMock = jest.fn();
    const onFailRequestMock = jest.fn();

    const mockParameters: TParametersCheckTelephony = {
      sipServerUrl: 'sip://test.com',
      sipWebSocketServerURL: 'wss://test.com',
      displayName: 'Test User',
    };

    beforeEach(() => {
      getParametersMock.mockResolvedValue(mockParameters);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('вызывает stop перед началом нового запроса', () => {
      const stopSpy = jest.spyOn(checkTelephonyRequester, 'stop');

      checkTelephonyRequester.start({
        getParameters: getParametersMock,
        onSuccessRequest: onSuccessRequestMock,
        onFailRequest: onFailRequestMock,
      });

      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    it('создает resolveRequesterByTimeout с корректными параметрами', () => {
      checkTelephonyRequester.start({
        getParameters: getParametersMock,
        onSuccessRequest: onSuccessRequestMock,
        onFailRequest: onFailRequestMock,
      });

      expect(mockResolveRequesterByTimeout).toHaveBeenCalledTimes(1);

      const [config] = mockResolveRequesterByTimeout.mock.calls[0] as [
        {
          isDontStopOnFail: boolean;
          requestInterval: number;
          request: () => Promise<void>;
        },
      ];

      expect(config.isDontStopOnFail).toBe(true);
      expect(config.requestInterval).toBe(interval);
      expect(typeof config.request).toBe('function');
    });

    it('запускает checkTelephonyByTimeout с корректными callbacks', () => {
      checkTelephonyRequester.start({
        getParameters: getParametersMock,
        onSuccessRequest: onSuccessRequestMock,
        onFailRequest: onFailRequestMock,
      });

      expect(startMock).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledWith(undefined, {
        onFailRequest: onFailRequestMock,
        onSuccessRequest: expect.any(Function) as () => void,
      });
    });

    it('request функция вызывает onBeforeRequest и checkTelephony', async () => {
      const checkTelephonySpy = jest
        .spyOn(sipConnector.connectionManager, 'checkTelephony')
        .mockResolvedValue(undefined);

      checkTelephonyRequester.start({
        getParameters: getParametersMock,
        onSuccessRequest: onSuccessRequestMock,
        onFailRequest: onFailRequestMock,
      });

      const [config] = mockResolveRequesterByTimeout.mock.calls[0] as unknown as [
        { request: () => Promise<void> },
      ];

      await config.request();

      expect(onBeforeRequestMock).toHaveBeenCalledTimes(1);
      expect(getParametersMock).toHaveBeenCalledTimes(1);
      expect(checkTelephonySpy).toHaveBeenCalledTimes(1);
      expect(checkTelephonySpy).toHaveBeenCalledWith(mockParameters);
    });

    it('onSuccessRequest оборачивает вызов stop и оригинальный onSuccessRequest', () => {
      const stopSpy = jest.spyOn(checkTelephonyRequester, 'stop');

      checkTelephonyRequester.start({
        getParameters: getParametersMock,
        onSuccessRequest: onSuccessRequestMock,
        onFailRequest: onFailRequestMock,
      });

      const [, startOptions] = startMock.mock.calls[0] as [
        undefined,
        { onSuccessRequest: () => void },
      ];
      const onSuccessRequestWrapper = startOptions.onSuccessRequest;

      onSuccessRequestWrapper();

      expect(stopSpy).toHaveBeenCalledTimes(2);
      expect(onSuccessRequestMock).toHaveBeenCalledTimes(1);
    });

    it('обрабатывает ошибки в onBeforeRequest', async () => {
      const error = new Error('onBeforeRequest failed');

      onBeforeRequestMock.mockRejectedValue(error);

      checkTelephonyRequester.start({
        getParameters: getParametersMock,
        onSuccessRequest: onSuccessRequestMock,
        onFailRequest: onFailRequestMock,
      });

      const [config] = mockResolveRequesterByTimeout.mock.calls[0] as unknown as [
        { request: () => Promise<void> },
      ];

      await expect(config.request()).rejects.toThrow('onBeforeRequest failed');
    });

    it('обрабатывает ошибки в getParameters', async () => {
      const getParametersError = new Error('Get parameters failed');

      getParametersMock.mockRejectedValue(getParametersError);

      checkTelephonyRequester.start({
        getParameters: getParametersMock,
        onSuccessRequest: onSuccessRequestMock,
        onFailRequest: onFailRequestMock,
      });

      const [config] = mockResolveRequesterByTimeout.mock.calls[0] as unknown as [
        { request: () => Promise<void> },
      ];

      await expect(config.request()).rejects.toThrow('Get parameters failed');
    });

    it('обрабатывает ошибки в checkTelephony', async () => {
      const checkTelephonyError = new Error('Check telephony failed');

      jest
        .spyOn(sipConnector.connectionManager, 'checkTelephony')
        .mockRejectedValue(checkTelephonyError);

      checkTelephonyRequester.start({
        getParameters: getParametersMock,
        onSuccessRequest: onSuccessRequestMock,
        onFailRequest: onFailRequestMock,
      });

      const [config] = mockResolveRequesterByTimeout.mock.calls[0] as unknown as [
        { request: () => Promise<void> },
      ];

      await expect(config.request()).rejects.toThrow('Check telephony failed');
    });
  });

  describe('stop', () => {
    it('отменяет cancelableBeforeRequest', () => {
      const cancelRequestSpy = jest.spyOn(
        // @ts-ignore приватное свойство
        checkTelephonyRequester.cancelableBeforeRequest,
        'cancelRequest',
      );

      checkTelephonyRequester.stop();

      expect(cancelRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('останавливает и сбрасывает checkTelephonyByTimeout если он существует', () => {
      checkTelephonyRequester.start({
        getParameters: jest.fn().mockResolvedValue({}),
        onSuccessRequest: jest.fn(),
        onFailRequest: jest.fn(),
      });

      // @ts-ignore приватное свойство
      expect(checkTelephonyRequester.checkTelephonyByTimeout).toBeDefined();

      checkTelephonyRequester.stop();

      expect(stopMock).toHaveBeenCalledTimes(1);
      // @ts-ignore приватное свойство
      expect(checkTelephonyRequester.checkTelephonyByTimeout).toBeUndefined();
    });

    it('не вызывает stop если checkTelephonyByTimeout не существует', () => {
      // @ts-ignore приватное свойство
      expect(checkTelephonyRequester.checkTelephonyByTimeout).toBeUndefined();

      checkTelephonyRequester.stop();

      expect(stopMock).not.toHaveBeenCalled();
    });

    it('может быть вызван несколько раз без ошибок', () => {
      checkTelephonyRequester.start({
        getParameters: jest.fn().mockResolvedValue({}),
        onSuccessRequest: jest.fn(),
        onFailRequest: jest.fn(),
      });

      checkTelephonyRequester.stop();
      checkTelephonyRequester.stop();
      checkTelephonyRequester.stop();

      expect(stopMock).toHaveBeenCalledTimes(1);
    });
  });
});
