/// <reference types="jest" />
import { generateUserId, hasVideoTracks, parseDisplayName, resolveSipUrl } from '../utils';

describe('utils', () => {
  describe('resolveSipUrl', () => {
    it('should create sip URL with server and id', () => {
      const serverUrl = 'example.com';
      const resolveUrl = resolveSipUrl(serverUrl);

      expect(resolveUrl('user123')).toBe('sip:user123@example.com');
    });

    it('should work with different server URLs', () => {
      const serverUrl = 'sip.server.com';
      const resolveUrl = resolveSipUrl(serverUrl);

      expect(resolveUrl('testuser')).toBe('sip:testuser@sip.server.com');
    });

    it('should work with empty id', () => {
      const serverUrl = 'example.com';
      const resolveUrl = resolveSipUrl(serverUrl);

      expect(resolveUrl('')).toBe('sip:@example.com');
    });
  });

  describe('parseDisplayName', () => {
    it('should trim whitespace and replace spaces with underscores', () => {
      expect(parseDisplayName('  John Doe  ')).toBe('John_Doe');
    });

    it('should replace multiple spaces with single underscore', () => {
      expect(parseDisplayName('John   Doe')).toBe('John___Doe');
    });

    it('should handle empty string', () => {
      expect(parseDisplayName('')).toBe('');
    });

    it('should handle string with only spaces', () => {
      expect(parseDisplayName('   ')).toBe('');
    });

    it('should handle string without spaces', () => {
      expect(parseDisplayName('JohnDoe')).toBe('JohnDoe');
    });
  });

  describe('generateUserId', () => {
    it('should generate number within specified range', () => {
      const userId = generateUserId();

      expect(typeof userId).toBe('number');
      expect(userId).toBeGreaterThanOrEqual(100_000);
      expect(userId).toBeLessThan(99_999_999);
    });

    it('should generate different numbers on multiple calls', () => {
      const userId1 = generateUserId();
      const userId2 = generateUserId();

      // Note: This test might occasionally fail due to randomness
      // but it's very unlikely to generate the same number twice
      expect(userId1).not.toBe(userId2);
    });
  });

  describe('hasVideoTracks', () => {
    it('should return true when video tracks exist', () => {
      const mockVideoTrack = { kind: 'video' } as MediaStreamTrack;
      const mockAudioTrack = { kind: 'audio' } as MediaStreamTrack;

      const tracks = [mockAudioTrack, mockVideoTrack];

      expect(hasVideoTracks(tracks)).toBe(true);
    });

    it('should return false when no video tracks exist', () => {
      const mockAudioTrack1 = { kind: 'audio' } as MediaStreamTrack;
      const mockAudioTrack2 = { kind: 'audio' } as MediaStreamTrack;

      const tracks = [mockAudioTrack1, mockAudioTrack2];

      expect(hasVideoTracks(tracks)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(hasVideoTracks([])).toBe(false);
    });

    it('should return true when only video tracks exist', () => {
      const mockVideoTrack1 = { kind: 'video' } as MediaStreamTrack;
      const mockVideoTrack2 = { kind: 'video' } as MediaStreamTrack;

      const tracks = [mockVideoTrack1, mockVideoTrack2];

      expect(hasVideoTracks(tracks)).toBe(true);
    });
  });
});
