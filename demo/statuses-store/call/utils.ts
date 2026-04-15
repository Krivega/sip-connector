import type { TContextMap, TContext } from '@/CallManager/CallStateMachine';

type TContextPropertyKey = {
  [TState in keyof TContextMap]: keyof TContextMap[TState];
}[keyof TContextMap];

type TContextProperty<K extends TContextPropertyKey> = {
  [TState in keyof TContextMap]: K extends keyof TContextMap[TState]
    ? TContextMap[TState][K]
    : never;
}[keyof TContextMap];

export const readContextField = <K extends TContextPropertyKey>(
  context: TContext,
  key: K,
): TContextProperty<K> | undefined => {
  if (!(key in context)) {
    return undefined;
  }

  return (context as Record<K, TContextProperty<K>>)[key];
};
