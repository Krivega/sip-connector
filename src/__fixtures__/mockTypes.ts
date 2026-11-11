import type { FunctionLike, MockInstance } from 'jest-mock';

type TFluentMethod =
  | 'mockClear'
  | 'mockReset'
  | 'mockImplementationOnce'
  | 'mockName'
  | 'mockReturnThis'
  | 'mockReturnValue'
  | 'mockReturnValueOnce'
  | 'mockResolvedValue'
  | 'mockResolvedValueOnce'
  | 'mockRejectedValue'
  | 'mockRejectedValueOnce';
type TMethod<TParameters extends unknown[], TResult> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- Сохраняем прежнюю вариантность методов Jest/Vitest.
  invoke(...parameters: TParameters): TResult;
}['invoke'];
type TControls<T extends FunctionLike> = Omit<
  MockInstance<T>,
  | TFluentMethod
  | 'mockImplementation'
  | '_isMockFunction'
  | '_protoImpl'
  | 'whenCalledWith'
  | symbol
>;

export type TCompatibleSpy<T extends FunctionLike> = TControls<T> & {
  mockImplementation: TMethod<[implementation?: T], TCompatibleSpy<T>>;
} & {
  [K in TFluentMethod]: TMethod<Parameters<MockInstance<T>[K]>, TCompatibleSpy<T>>;
};

export type TCompatibleMock<T extends FunctionLike = FunctionLike> = TControls<T> & {
  (...parameters: Parameters<T>): ReturnType<T>;
  mockImplementation: TMethod<[implementation?: T], TCompatibleMock<T>>;
  new (...parameters: Parameters<T>): ReturnType<T>;
} & {
  [K in TFluentMethod]: TMethod<Parameters<MockInstance<T>[K]>, TCompatibleMock<T>>;
};
