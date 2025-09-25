import { hasParametersNotExistError, createParametersNotExistError } from '../errors';

describe('errors', () => {
  describe('hasParametersNotExistError', () => {
    it('должен возвращать true для ошибки с правильным сообщением', () => {
      const error = new Error('Parameters are missing');

      const result = hasParametersNotExistError(error);

      expect(result).toBe(true);
    });

    it('должен возвращать false для ошибки с другим сообщением', () => {
      const error = new Error('Some other error');

      const result = hasParametersNotExistError(error);

      expect(result).toBe(false);
    });

    it('должен возвращать false для не-Error объекта', () => {
      const error = 'String error';

      const result = hasParametersNotExistError(error);

      expect(result).toBe(false);
    });

    it('должен возвращать false для null', () => {
      // eslint-disable-next-line unicorn/no-null
      const result = hasParametersNotExistError(null);

      expect(result).toBe(false);
    });

    it('должен возвращать false для undefined', () => {
      const result = hasParametersNotExistError(undefined);

      expect(result).toBe(false);
    });

    it('должен возвращать false для объекта без свойства message', () => {
      const error = { code: 'SOME_ERROR' };

      const result = hasParametersNotExistError(error);

      expect(result).toBe(false);
    });
  });

  describe('createParametersNotExistError', () => {
    it('должен создавать ошибку с правильным сообщением', () => {
      const error = createParametersNotExistError();

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Parameters are missing');
    });

    it('должен создавать новый экземпляр ошибки каждый раз', () => {
      const error1 = createParametersNotExistError();
      const error2 = createParametersNotExistError();

      expect(error1).not.toBe(error2);
      expect(error1.message).toBe(error2.message);
    });
  });
});
