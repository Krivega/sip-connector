import { createUaParser } from '@/tools';
import hasAvailableStats from '../hasAvailableStats';

jest.mock('@/tools', () => {
  return {
    createUaParser: jest.fn(),
  };
});

describe('hasAvailableStats', () => {
  beforeEach(() => {
    (createUaParser as jest.Mock).mockReset();
  });

  it('#1 returns true when UA is Chrome', () => {
    (createUaParser as jest.Mock).mockReturnValue({ isChrome: true });

    expect(hasAvailableStats()).toBe(true);
  });

  it('#2 returns false when UA is not Chrome', () => {
    (createUaParser as jest.Mock).mockReturnValue({ isChrome: false });

    expect(hasAvailableStats()).toBe(false);
  });
});
