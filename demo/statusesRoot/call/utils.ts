import type { TContextMap, TContext } from '@/CallManager/CallStateMachine';

type TCallContextKey = {
  [TState in keyof TContextMap]: keyof TContextMap[TState];
}[keyof TContextMap];

type TCallContextFieldValue<K extends TCallContextKey> = {
  [TState in keyof TContextMap]: K extends keyof TContextMap[TState]
    ? TContextMap[TState][K]
    : never;
}[keyof TContextMap];

export const getCallContextField = <K extends TCallContextKey>(
  context: TContext,
  key: K,
): TCallContextFieldValue<K> | undefined => {
  if (!(key in context)) {
    return undefined;
  }

  return (context as Record<K, TCallContextFieldValue<K>>)[key];
};
