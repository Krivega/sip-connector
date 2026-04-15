import type { TCallContextMap, TCallContext } from '@/index';

type TCallContextKey = {
  [TState in keyof TCallContextMap]: keyof TCallContextMap[TState];
}[keyof TCallContextMap];

type TCallContextFieldValue<K extends TCallContextKey> = {
  [TState in keyof TCallContextMap]: K extends keyof TCallContextMap[TState]
    ? TCallContextMap[TState][K]
    : never;
}[keyof TCallContextMap];

export const getCallContextField = <K extends TCallContextKey>(
  context: TCallContext,
  key: K,
): TCallContextFieldValue<K> | undefined => {
  if (!(key in context)) {
    return undefined;
  }

  return (context as Record<K, TCallContextFieldValue<K>>)[key];
};
