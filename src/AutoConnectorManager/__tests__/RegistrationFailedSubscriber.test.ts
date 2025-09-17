import { doMockSipConnector } from '@/doMock';
import RegistrationFailedSubscriber from '../RegistrationFailedSubscriber';

describe('RegistrationFailedSubscriber', () => {
  const callback = jest.fn();

  let registrationFailedSubscriber: RegistrationFailedSubscriber;
  let sipConnector: ReturnType<typeof doMockSipConnector>;

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    registrationFailedSubscriber = new RegistrationFailedSubscriber({
      connectionManager: sipConnector.connectionManager,
    });
  });

  describe('подписка', () => {
    it('подписывается на событие registrationFailed', () => {
      registrationFailedSubscriber.subscribe(callback);

      sipConnector.connectionManager.events.trigger('registrationFailed');

      expect(callback).toHaveBeenCalled();
    });

    it('отписывается от предыдущих обработчиков', () => {
      const disposer = jest.fn();

      jest.spyOn(sipConnector.connectionManager, 'on').mockImplementation(() => {
        return disposer;
      });

      registrationFailedSubscriber.subscribe(callback);

      expect(disposer).toHaveBeenCalledTimes(0);

      registrationFailedSubscriber.subscribe(callback);

      expect(disposer).toHaveBeenCalledTimes(1);
    });
  });

  describe('отписка', () => {
    it('отписывается от события registrationFailed', () => {
      const disposer = jest.fn();

      jest.spyOn(sipConnector.connectionManager, 'on').mockImplementation(() => {
        return disposer;
      });

      registrationFailedSubscriber.subscribe(callback);
      registrationFailedSubscriber.unsubscribe();

      sipConnector.connectionManager.events.trigger('registrationFailed');

      expect(disposer).toHaveBeenCalledTimes(1);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
