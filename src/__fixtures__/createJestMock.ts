import type { FunctionLike } from 'jest-mock';
import type { TCompatibleMock } from './mockTypes';

// Keep the caller's Jest registry while publishing module-scoped mock types.
const createJestMock = <T extends FunctionLike = FunctionLike>(
  implementation?: T,
): TCompatibleMock<T> => {
  return jest.fn(implementation) as unknown as TCompatibleMock<T>;
};

export default createJestMock;
