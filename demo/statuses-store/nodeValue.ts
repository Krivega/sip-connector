export type TNodeByState<TState extends string, TContextMap extends Record<TState, unknown>> = {
  state: TState;
  context: TContextMap[TState];
};

export type TNodeValue<TState extends string, TContextMap extends Record<TState, unknown>> = {
  [TCurrentState in TState]: TNodeByState<TCurrentState, TContextMap>;
}[TState];

export type TStateNodeByState<TState extends string> = {
  state: TState;
};

export type TStateNodeValue<TState extends string> = {
  [TCurrentState in TState]: TStateNodeByState<TCurrentState>;
}[TState];
