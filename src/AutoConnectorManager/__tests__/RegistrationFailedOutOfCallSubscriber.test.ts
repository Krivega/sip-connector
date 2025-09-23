import { doMockSipConnector } from '@/doMock';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';

describe('RegistrationFailedOutOfCallSubscriber', () => {
  const callback = jest.fn();

  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let subscriber: RegistrationFailedOutOfCallSubscriber;

  let startCall: () => void;
  let endCall: () => void;

  beforeEach(() => {
    jest.clearAllMocks();

    sipConnector = doMockSipConnector();
    subscriber = new RegistrationFailedOutOfCallSubscriber({
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
    });

    startCall = () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);
      sipConnector.callManager.events.trigger('confirmed', {});
    };
    endCall = () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);
      // @ts-expect-error
      sipConnector.callManager.events.trigger('ended', {});
    };
  });

  afterEach(() => {
    subscriber.unsubscribe();
    jest.restoreAllMocks();
  });

  describe('subscribe', () => {
    it('подписывается на registrationFailed', () => {
      const onSpy = jest.spyOn(sipConnector.connectionManager, 'on');

      subscriber.subscribe(callback);

      expect(onSpy).toHaveBeenCalledTimes(1);
      expect(onSpy).toHaveBeenCalledWith('registrationFailed', expect.any(Function));
    });

    it('отписывается от предыдущих подписок при повторном вызове subscribe', () => {
      const unsubscribeSpy = jest.spyOn(subscriber, 'unsubscribe');

      subscriber.subscribe(callback);

      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('вызывает callback только когда registrationFailed происходит вне звонка', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

      const callManagerOnSpy = jest.spyOn(sipConnector.callManager, 'on');

      subscriber.subscribe(callback);

      sipConnector.connectionManager.events.trigger('registrationFailed', {});

      expect(callManagerOnSpy).toHaveBeenCalledTimes(1);

      const callStatusCallback = callManagerOnSpy.mock.calls[0][1];

      callStatusCallback(false);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('не вызывает callback когда registrationFailed происходит во время активного звонка', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);

      const callManagerOnSpy = jest.spyOn(sipConnector.callManager, 'on');

      subscriber.subscribe(callback);

      startCall();

      sipConnector.connectionManager.events.trigger('registrationFailed', {});

      expect(callManagerOnSpy).toHaveBeenCalledTimes(1);
      expect(callback).not.toHaveBeenCalled();
    });

    it('подписывается на оба события сразу', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

      const connectionManagerOnSpy = jest.spyOn(sipConnector.connectionManager, 'on');

      const callManagerOnSpy = jest.spyOn(sipConnector.callManager, 'on');

      subscriber.subscribe(callback);

      expect(callManagerOnSpy).toHaveBeenCalledTimes(1);
      expect(connectionManagerOnSpy).toHaveBeenCalledTimes(1);

      startCall();

      sipConnector.connectionManager.events.trigger('registrationFailed', {});

      expect(callback).not.toHaveBeenCalled();

      endCall();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('отписывается от обоих подписчиков', () => {
      const disposeRegistrationFailed = jest.fn();
      const disposeCallManager = jest.fn();

      jest.spyOn(sipConnector.callManager, 'on').mockImplementation(() => {
        return disposeCallManager;
      });

      jest.spyOn(sipConnector.connectionManager, 'on').mockImplementation(() => {
        return disposeRegistrationFailed;
      });

      subscriber.subscribe(callback);

      jest.clearAllMocks();

      subscriber.unsubscribe();

      expect(disposeCallManager).toHaveBeenCalledTimes(1);
      expect(disposeRegistrationFailed).toHaveBeenCalledTimes(1);
    });

    it('не вызывает callback после unsubscribe', () => {
      startCall();

      subscriber.subscribe(callback);

      sipConnector.connectionManager.events.trigger('registrationFailed', {});

      endCall();

      expect(callback).toHaveBeenCalledTimes(1);

      subscriber.unsubscribe();

      startCall();
      endCall();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
