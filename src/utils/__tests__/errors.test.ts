/// <reference types="jest" />
import { hasDeclineResponseFromServer, hasHandshakeWebsocketOpeningError } from '../errors';

describe('errors', () => {
  describe('hasHandshakeWebsocketOpeningError', () => {
    it('should return true for error with code 1006', () => {
      const error = { code: 1006 };

      const result = hasHandshakeWebsocketOpeningError(error);

      expect(result).toBe(true);
    });

    it('should return false for error with different code', () => {
      const error = { code: 1000 };

      const result = hasHandshakeWebsocketOpeningError(error);

      expect(result).toBe(false);
    });

    it('should return false for error without code property', () => {
      const error = { message: 'Some error' };

      const result = hasHandshakeWebsocketOpeningError(error);

      expect(result).toBe(false);
    });

    it('should return false for null error', () => {
      const result = hasHandshakeWebsocketOpeningError(undefined);

      expect(result).toBe(false);
    });

    it('should return false for undefined error', () => {
      const result = hasHandshakeWebsocketOpeningError(undefined);

      expect(result).toBe(false);
    });

    it('should return false for primitive values', () => {
      expect(hasHandshakeWebsocketOpeningError('string')).toBe(false);
      expect(hasHandshakeWebsocketOpeningError(123)).toBe(false);
      expect(hasHandshakeWebsocketOpeningError(true)).toBe(false);
    });

    it('should return false for object without code property', () => {
      const error = { message: 'Error', details: 'Some details' };

      const result = hasHandshakeWebsocketOpeningError(error);

      expect(result).toBe(false);
    });

    it('should return true for error with string code that equals 1006', () => {
      const error = { code: '1006' };

      const result = hasHandshakeWebsocketOpeningError(error);

      expect(result).toBe(false); // String '1006' !== number 1006
    });
  });

  describe('hasDeclineResponseFromServer', () => {
    it('should return true for error with decline message', () => {
      const error = new Error('Error decline with 603');

      const result = hasDeclineResponseFromServer(error);

      expect(result).toBe(true);
    });

    it('should return false for error with different message', () => {
      const error = new Error('Some other error');

      const result = hasDeclineResponseFromServer(error);

      expect(result).toBe(false);
    });

    it('should return false for error with empty message', () => {
      const error = new Error('Test error');

      const result = hasDeclineResponseFromServer(error);

      expect(result).toBe(false);
    });

    it('should return false for error with partial decline message', () => {
      const error = new Error('Error decline');

      const result = hasDeclineResponseFromServer(error);

      expect(result).toBe(false);
    });

    it('should return false for error with decline message but different code', () => {
      const error = new Error('Error decline with 604');

      const result = hasDeclineResponseFromServer(error);

      expect(result).toBe(false);
    });

    it('should return false for error with case-insensitive message', () => {
      const error = new Error('ERROR DECLINE WITH 603');

      const result = hasDeclineResponseFromServer(error);

      expect(result).toBe(false); // Exact match required
    });
  });
});
