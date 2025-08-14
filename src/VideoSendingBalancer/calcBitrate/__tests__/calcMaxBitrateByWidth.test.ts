/// <reference types="jest" />
import calcMaxBitrateByWidth, { MAXIMUM_BITRATE, MINIMUM_BITRATE } from '../calcMaxBitrateByWidth';

describe('calcMaxBitrateByWidth', () => {
  describe('граничные значения', () => {
    it('должен возвращать MINIMUM_BITRATE для ширины <= 64', () => {
      expect(calcMaxBitrateByWidth(0)).toBe(MINIMUM_BITRATE);
      expect(calcMaxBitrateByWidth(32)).toBe(MINIMUM_BITRATE);
      expect(calcMaxBitrateByWidth(64)).toBe(MINIMUM_BITRATE);
    });

    it('должен возвращать MAXIMUM_BITRATE для ширины > 1920', () => {
      expect(calcMaxBitrateByWidth(1921)).toBe(MAXIMUM_BITRATE);
      expect(calcMaxBitrateByWidth(2560)).toBe(MAXIMUM_BITRATE);
      expect(calcMaxBitrateByWidth(3840)).toBe(MAXIMUM_BITRATE);
      expect(calcMaxBitrateByWidth(4096)).toBe(MAXIMUM_BITRATE);
    });
  });

  describe('диапазоны ширины', () => {
    it('должен возвращать 0.12 Мбит/с для ширины 65-128', () => {
      expect(calcMaxBitrateByWidth(65)).toBe(120_000);
      expect(calcMaxBitrateByWidth(96)).toBe(120_000);
      expect(calcMaxBitrateByWidth(128)).toBe(120_000);
    });

    it('должен возвращать 0.25 Мбит/с для ширины 129-256', () => {
      expect(calcMaxBitrateByWidth(129)).toBe(250_000);
      expect(calcMaxBitrateByWidth(192)).toBe(250_000);
      expect(calcMaxBitrateByWidth(256)).toBe(250_000);
    });

    it('должен возвращать 0.32 Мбит/с для ширины 257-384', () => {
      expect(calcMaxBitrateByWidth(257)).toBe(320_000);
      expect(calcMaxBitrateByWidth(320)).toBe(320_000);
      expect(calcMaxBitrateByWidth(384)).toBe(320_000);
    });

    it('должен возвращать 0.38 Мбит/с для ширины 385-426', () => {
      expect(calcMaxBitrateByWidth(385)).toBe(380_000);
      expect(calcMaxBitrateByWidth(400)).toBe(380_000);
      expect(calcMaxBitrateByWidth(426)).toBe(380_000);
    });

    it('должен возвращать 0.5 Мбит/с для ширины 427-640', () => {
      expect(calcMaxBitrateByWidth(427)).toBe(500_000);
      expect(calcMaxBitrateByWidth(480)).toBe(500_000);
      expect(calcMaxBitrateByWidth(640)).toBe(500_000);
    });

    it('должен возвращать 0.7 Мбит/с для ширины 641-848', () => {
      expect(calcMaxBitrateByWidth(641)).toBe(700_000);
      expect(calcMaxBitrateByWidth(720)).toBe(700_000);
      expect(calcMaxBitrateByWidth(848)).toBe(700_000);
    });

    it('должен возвращать 1 Мбит/с для ширины 849-1280', () => {
      expect(calcMaxBitrateByWidth(849)).toBe(1_000_000);
      expect(calcMaxBitrateByWidth(1024)).toBe(1_000_000);
      expect(calcMaxBitrateByWidth(1280)).toBe(1_000_000);
    });

    it('должен возвращать 2 Мбит/с для ширины 1281-1920', () => {
      expect(calcMaxBitrateByWidth(1281)).toBe(2_000_000);
      expect(calcMaxBitrateByWidth(1600)).toBe(2_000_000);
      expect(calcMaxBitrateByWidth(1920)).toBe(2_000_000);
    });
  });

  describe('стандартные разрешения', () => {
    it('должен корректно обрабатывать QVGA (320x240)', () => {
      expect(calcMaxBitrateByWidth(320)).toBe(320_000);
    });

    it('должен корректно обрабатывать VGA (640x480)', () => {
      expect(calcMaxBitrateByWidth(640)).toBe(500_000);
    });

    it('должен корректно обрабатывать SVGA (800x600)', () => {
      expect(calcMaxBitrateByWidth(800)).toBe(700_000);
    });

    it('должен корректно обрабатывать XGA (1024x768)', () => {
      expect(calcMaxBitrateByWidth(1024)).toBe(1_000_000);
    });

    it('должен корректно обрабатывать HD (1280x720)', () => {
      expect(calcMaxBitrateByWidth(1280)).toBe(1_000_000);
    });

    it('должен корректно обрабатывать Full HD (1920x1080)', () => {
      expect(calcMaxBitrateByWidth(1920)).toBe(2_000_000);
    });

    it('должен корректно обрабатывать 2K (2560x1440)', () => {
      expect(calcMaxBitrateByWidth(2560)).toBe(4_000_000);
    });

    it('должен корректно обрабатывать 4K (3840x2160)', () => {
      expect(calcMaxBitrateByWidth(3840)).toBe(4_000_000);
    });
  });

  describe('проверка констант', () => {
    it('должен экспортировать MINIMUM_BITRATE как 0.06 Мбит/с', () => {
      expect(MINIMUM_BITRATE).toBe(60_000);
    });

    it('должен экспортировать MAXIMUM_BITRATE как 4 Мбит/с', () => {
      expect(MAXIMUM_BITRATE).toBe(4_000_000);
    });
  });

  describe('граничные случаи', () => {
    it('должен обрабатывать отрицательные значения как минимальный битрейт', () => {
      expect(calcMaxBitrateByWidth(-1)).toBe(MINIMUM_BITRATE);
      expect(calcMaxBitrateByWidth(-100)).toBe(MINIMUM_BITRATE);
    });

    it('должен обрабатывать дробные значения корректно', () => {
      expect(calcMaxBitrateByWidth(64.5)).toBe(120_000);
      expect(calcMaxBitrateByWidth(128.9)).toBe(250_000);
      expect(calcMaxBitrateByWidth(256.1)).toBe(320_000);
    });

    it('должен обрабатывать очень большие значения как максимальный битрейт', () => {
      expect(calcMaxBitrateByWidth(10_000)).toBe(MAXIMUM_BITRATE);
      expect(calcMaxBitrateByWidth(999_999)).toBe(MAXIMUM_BITRATE);
    });
  });

  describe('проверка монотонности', () => {
    it('должен возвращать монотонно возрастающие значения', () => {
      const widths = [64, 128, 256, 384, 426, 640, 848, 1280, 1920, 1921];
      const bitrates = widths.map(calcMaxBitrateByWidth);

      for (let i = 1; i < bitrates.length; i++) {
        expect(bitrates[i]).toBeGreaterThanOrEqual(bitrates[i - 1]);
      }
    });
  });
});
