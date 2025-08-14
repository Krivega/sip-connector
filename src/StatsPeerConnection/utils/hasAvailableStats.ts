import { createUaParser } from '@/tools';

const hasAvailableStats = (): boolean => {
  const uaParser = createUaParser();

  return uaParser.isChrome;
};

export default hasAvailableStats;
