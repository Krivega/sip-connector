import { doMockSipConnector } from '@/doMock';
import CallStatusSubscriber from '../CallStatusSubscriber';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';
import RegistrationFailedSubscriber from '../RegistrationFailedSubscriber';

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
      sipConnector.callManager.events.trigger('ended', {});
    };
  });

  afterEach(() => {
    subscriber.unsubscribe();
    jest.restoreAllMocks();
  });

  describe('subscribe', () => {
    it('подписывается на RegistrationFailedSubscriber', () => {
      const registrationFailedSubscribeSpy = jest.spyOn(
        RegistrationFailedSubscriber.prototype,
        'subscribe',
      );

      subscriber.subscribe(callback);

      expect(registrationFailedSubscribeSpy).toHaveBeenCalledTimes(1);
      expect(typeof registrationFailedSubscribeSpy.mock.calls[0][0]).toBe('function');
    });

    it('отписывается от предыдущих подписок при повторном вызове subscribe', () => {
      const unsubscribeSpy = jest.spyOn(subscriber, 'unsubscribe');

      subscriber.subscribe(callback);

      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('вызывает callback только когда registrationFailed происходит вне звонка', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

      const registrationFailedSubscribeSpy = jest.spyOn(
        RegistrationFailedSubscriber.prototype,
        'subscribe',
      );
      const callStatusSubscribeSpy = jest.spyOn(CallStatusSubscriber.prototype, 'subscribe');

      subscriber.subscribe(callback);

      const registrationFailedCallback = registrationFailedSubscribeSpy.mock.calls[0][0];

      registrationFailedCallback();

      expect(callStatusSubscribeSpy).toHaveBeenCalledTimes(1);

      const callStatusCallback = callStatusSubscribeSpy.mock.calls[0][0];

      callStatusCallback(false);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('не вызывает callback когда registrationFailed происходит во время активного звонка', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);

      const registrationFailedSubscribeSpy = jest.spyOn(
        RegistrationFailedSubscriber.prototype,
        'subscribe',
      );
      const callStatusSubscribeSpy = jest.spyOn(CallStatusSubscriber.prototype, 'subscribe');

      subscriber.subscribe(callback);

      const registrationFailedCallback = registrationFailedSubscribeSpy.mock.calls[0][0];

      registrationFailedCallback();

      expect(callStatusSubscribeSpy).toHaveBeenCalledTimes(1);

      const callStatusCallback = callStatusSubscribeSpy.mock.calls[0][0];

      callStatusCallback(true);

      expect(callback).not.toHaveBeenCalled();
    });

    it('корректно обрабатывает последовательность событий: registrationFailed -> звонок завершен', () => {
      let isCallActive = true;

      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockImplementation(() => {
        return isCallActive;
      });

      const registrationFailedSubscribeSpy = jest.spyOn(
        RegistrationFailedSubscriber.prototype,
        'subscribe',
      );
      const callStatusSubscribeSpy = jest.spyOn(CallStatusSubscriber.prototype, 'subscribe');

      subscriber.subscribe(callback);

      const registrationFailedCallback = registrationFailedSubscribeSpy.mock.calls[0][0];

      registrationFailedCallback();

      const callStatusCallback = callStatusSubscribeSpy.mock.calls[0][0];

      callStatusCallback(true);
      expect(callback).not.toHaveBeenCalled();

      isCallActive = false;
      callStatusCallback(false);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('отписывается от обоих подписчиков', () => {
      const callStatusUnsubscribeSpy = jest.spyOn(CallStatusSubscriber.prototype, 'unsubscribe');
      const registrationFailedUnsubscribeSpy = jest.spyOn(
        RegistrationFailedSubscriber.prototype,
        'unsubscribe',
      );

      subscriber.subscribe(callback);

      jest.clearAllMocks();

      subscriber.unsubscribe();

      expect(callStatusUnsubscribeSpy).toHaveBeenCalledTimes(1);
      expect(registrationFailedUnsubscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('не вызывает callback после unsubscribe', () => {
      startCall();

      const registrationFailedSubscribeSpy = jest.spyOn(
        RegistrationFailedSubscriber.prototype,
        'subscribe',
      );

      subscriber.subscribe(callback);

      const registrationFailedCallback = registrationFailedSubscribeSpy.mock.calls[0][0];

      registrationFailedCallback();

      endCall();

      expect(callback).toHaveBeenCalledTimes(1);

      subscriber.unsubscribe();

      startCall();
      endCall();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
