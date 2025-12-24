import { doMockSipConnector } from '@/doMock';
import NotActiveCallSubscriber from '../NotActiveCallSubscriber';

describe('NotActiveCallSubscriber', () => {
  const onActive = jest.fn();
  const onInactive = jest.fn();

  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let subscriber: NotActiveCallSubscriber;

  let startCall: () => void;
  let endCall: () => void;

  beforeEach(() => {
    jest.clearAllMocks();

    sipConnector = doMockSipConnector();
    subscriber = new NotActiveCallSubscriber({
      callManager: sipConnector.callManager,
    });

    startCall = () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);
      sipConnector.callManager.events.trigger('call-status-changed', { isCallActive: true });
    };

    endCall = () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);
      sipConnector.callManager.events.trigger('call-status-changed', { isCallActive: false });
    };
  });

  afterEach(() => {
    subscriber.unsubscribe();
    jest.restoreAllMocks();
  });

  describe('subscribe', () => {
    it('подписывается на call-status-changed', () => {
      const onSpy = jest.spyOn(sipConnector.callManager, 'on');

      subscriber.subscribe({ onActive, onInactive });

      expect(onSpy).toHaveBeenCalledTimes(1);
      expect(onSpy).toHaveBeenCalledWith('call-status-changed', expect.any(Function));
    });

    it('отписывается от предыдущих подписок при повторном вызове subscribe', () => {
      const unsubscribeSpy = jest.spyOn(subscriber, 'unsubscribe');

      subscriber.subscribe({ onActive, onInactive });

      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('вызывает onInactive сразу при подписке если isCallActive изначально false', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

      subscriber.subscribe({ onActive, onInactive });

      expect(onActive).not.toHaveBeenCalled();
      expect(onInactive).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onActive при подписке если isCallActive изначально true', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);

      subscriber.subscribe({ onActive, onInactive });

      expect(onActive).toHaveBeenCalledTimes(1);
      expect(onInactive).not.toHaveBeenCalled();
    });

    it('вызывает onActive когда звонок становится активным', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

      subscriber.subscribe({ onActive, onInactive });

      expect(onActive).not.toHaveBeenCalled();
      expect(onInactive).toHaveBeenCalledTimes(1);

      startCall();

      expect(onActive).toHaveBeenCalledTimes(1);
      expect(onInactive).toHaveBeenCalledTimes(1);
    });

    it('вызывает onInactive когда звонок становится неактивным', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);

      subscriber.subscribe({ onActive, onInactive });

      expect(onActive).toHaveBeenCalledTimes(1);
      expect(onInactive).not.toHaveBeenCalled();

      endCall();

      expect(onActive).toHaveBeenCalledTimes(1);
      expect(onInactive).toHaveBeenCalledTimes(1);
    });

    it('вызывает onActive и onInactive при смене статуса звонка', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

      subscriber.subscribe({ onActive, onInactive });

      expect(onInactive).toHaveBeenCalledTimes(1);

      startCall();

      expect(onActive).toHaveBeenCalledTimes(1);
      expect(onInactive).toHaveBeenCalledTimes(1);

      endCall();

      expect(onActive).toHaveBeenCalledTimes(1);
      expect(onInactive).toHaveBeenCalledTimes(2);
    });

    it('вызывает onActive несколько раз при повторных звонках', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

      subscriber.subscribe({ onActive, onInactive });

      expect(onInactive).toHaveBeenCalledTimes(1);

      startCall();
      endCall();
      startCall();
      endCall();

      expect(onActive).toHaveBeenCalledTimes(2);
      expect(onInactive).toHaveBeenCalledTimes(3);
    });
  });

  describe('unsubscribe', () => {
    it('отписывается от call-status-changed', () => {
      const dispose = jest.fn();

      jest.spyOn(sipConnector.callManager, 'on').mockImplementation(() => {
        return dispose;
      });

      subscriber.subscribe({ onActive, onInactive });

      jest.clearAllMocks();

      subscriber.unsubscribe();

      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onActive после unsubscribe', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);

      subscriber.subscribe({ onActive, onInactive });

      expect(onInactive).toHaveBeenCalledTimes(1);

      startCall();

      expect(onActive).toHaveBeenCalledTimes(1);

      subscriber.unsubscribe();

      endCall();
      startCall();

      expect(onActive).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onInactive после unsubscribe', () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);

      subscriber.subscribe({ onActive, onInactive });

      endCall();

      expect(onInactive).toHaveBeenCalledTimes(1);

      subscriber.unsubscribe();

      startCall();
      endCall();

      expect(onInactive).toHaveBeenCalledTimes(1);
    });

    it('можно безопасно вызывать unsubscribe несколько раз', () => {
      subscriber.subscribe({ onActive, onInactive });

      expect(() => {
        subscriber.unsubscribe();
        subscriber.unsubscribe();
        subscriber.unsubscribe();
      }).not.toThrow();
    });
  });
});
