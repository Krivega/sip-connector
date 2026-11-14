import type { TResolutionSize } from '@/types';
import type { SenderBalancer } from '../SenderBalancer';
import type { IBalancerOptions, IMainCamHeaders } from '../types';

type TSenderBalancerOptions = ConstructorParameters<typeof SenderBalancer>[1];

export const NO_MAX_RESOLUTION_BALANCER_OPTIONS: IBalancerOptions = {
  getMaxResolution: () => {
    return undefined;
  },
};

export const createBalancerOptions = (
  options: Partial<Omit<IBalancerOptions, 'getMaxResolution'>> & {
    maxResolution?: TResolutionSize;
  } = {},
): IBalancerOptions => {
  const { maxResolution, ...rest } = options;

  return {
    getMaxResolution: () => {
      return maxResolution;
    },
    ...rest,
  };
};

export const createSenderBalancerOptions = ({
  ignoreForCodec,
  maxResolution,
  getServerHeaders = () => {
    return undefined;
  },
}: {
  ignoreForCodec?: string;
  maxResolution?: TResolutionSize;
  getServerHeaders?: () => IMainCamHeaders | undefined;
} = {}): TSenderBalancerOptions => {
  return {
    ignoreForCodec,
    getMaxResolution: () => {
      return maxResolution;
    },
    getServerHeaders,
  };
};
