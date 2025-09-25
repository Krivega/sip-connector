import { hasNotReadyForConnectionError, createNotReadyForConnectionError } from '../errors';

describe('errors', () => {
  describe('hasNotReadyForConnectionError', () => {
    it('должен возвращать true для ошибки с правильным сообщением', () => {
      const error = new Error('Not ready for connection');

      const result = hasNotReadyForConnectionError(error);

      expect(result).toBe(true);
    });

    it('должен возвращать false для ошибки с другим сообщением', () => {
      const error = new Error('Some other error');

      const result = hasNotReadyForConnectionError(error);

      expect(result).toBe(false);
    });

    it('должен возвращать false для не-Error объекта', () => {
      const error = 'String error';

      const result = hasNotReadyForConnectionError(error);

      expect(result).toBe(false);
    });

    it('должен возвращать false для null', () => {
      // eslint-disable-next-line unicorn/no-null
      const result = hasNotReadyForConnectionError(null);

      expect(result).toBe(false);
    });

    it('должен возвращать false для undefined', () => {
      const result = hasNotReadyForConnectionError(undefined);

      expect(result).toBe(false);
    });

    it('должен возвращать false для объекта без свойства message', () => {
      const error = { code: 'SOME_ERROR' };

      const result = hasNotReadyForConnectionError(error);

      expect(result).toBe(false);
    });
  });

  describe('createNotReadyForConnectionError', () => {
    it('должен создавать ошибку с правильным сообщением', () => {
      const error = createNotReadyForConnectionError();

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Not ready for connection');
    });

    it('должен создавать новый экземпляр ошибки каждый раз', () => {
      const error1 = createNotReadyForConnectionError();
      const error2 = createNotReadyForConnectionError();

      expect(error1).not.toBe(error2);
      expect(error1.message).toBe(error2.message);
    });
  });
});
