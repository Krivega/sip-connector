export type TStatusNodeByState<
  TState extends string,
  TContextMap extends Record<TState, unknown>,
> = {
  state: TState;
  context: TContextMap[TState];
};

export type TStatusNodeValue<TState extends string, TContextMap extends Record<TState, unknown>> = {
  [TCurrentState in TState]: TStatusNodeByState<TCurrentState, TContextMap>;
}[TState];

export type TStateOnlyNodeByState<TState extends string> = {
  state: TState;
};

export type TStateOnlyNodeValue<TState extends string> = {
  [TCurrentState in TState]: TStateOnlyNodeByState<TCurrentState>;
}[TState];
