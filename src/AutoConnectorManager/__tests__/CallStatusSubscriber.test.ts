import { doMockSipConnector } from '@/doMock';
import CallStatusSubscriber from '../CallStatusSubscriber';

describe('CallStatusSubscriber', () => {
  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let subscriber: CallStatusSubscriber;
  let callback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    sipConnector = doMockSipConnector();
    subscriber = new CallStatusSubscriber({ callManager: sipConnector.callManager });
    callback = jest.fn();
  });

  afterEach(() => {
    subscriber.unsubscribe();
    jest.restoreAllMocks();
  });

  describe('подписка', () => {
    it('вызывает callback сразу при fireImmediately=true', () => {
      subscriber.subscribe(callback, { fireImmediately: true });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false);
    });

    it('вызывает callback сразу при активном звонке и fireImmediately=true', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);

      subscriber.subscribe(callback, { fireImmediately: true });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(true);
    });

    it('не вызывает callback сразу без fireImmediately', () => {
      subscriber.subscribe(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it('регистрирует обработчик onceRace callManager', () => {
      const spyOnceRace = jest.spyOn(sipConnector.callManager, 'onceRace');

      subscriber.subscribe(callback);

      expect(spyOnceRace).toHaveBeenCalledTimes(1);
      expect(spyOnceRace).toHaveBeenCalledWith(
        ['accepted', 'confirmed', 'ended', 'failed'],
        expect.any(Function),
      );
    });

    it('отписывается от предыдущих обработчиков', () => {
      const disposer = jest.fn();

      jest.spyOn(sipConnector.callManager, 'onceRace').mockImplementation(() => {
        return disposer;
      });

      subscriber.subscribe(callback);

      expect(disposer).toHaveBeenCalledTimes(0);

      subscriber.subscribe(callback);

      expect(disposer).toHaveBeenCalledTimes(1);
    });
  });

  describe('изменение состояния', () => {
    it('вызывает callback при смене состояния с false на true и с true на false', () => {
      let active = false;

      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockImplementation(() => {
        return active;
      });

      subscriber.subscribe(callback);

      active = true;
      sipConnector.callManager.events.trigger('accepted', {});

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenLastCalledWith(true);

      active = false;
      sipConnector.callManager.events.trigger('ended', {});

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(false);
    });

    it('не вызывает callback без смены состояния при повторных ивентах', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

      subscriber.subscribe(callback);

      sipConnector.callManager.events.trigger('accepted');
      sipConnector.callManager.events.trigger('confirmed');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('отписка', () => {
    it('не вызывает callback после unsubscribe', () => {
      let active = false;

      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockImplementation(() => {
        return active;
      });

      subscriber.subscribe(callback);

      active = true;
      sipConnector.callManager.events.trigger('accepted', {});

      expect(callback).toHaveBeenCalledTimes(1);

      subscriber.unsubscribe();

      active = false;
      sipConnector.callManager.events.trigger('ended', {});

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
