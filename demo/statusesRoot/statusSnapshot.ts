export type TStatusSnapshotByState<
  TState extends string,
  TContextMap extends Record<TState, unknown>,
> = {
  state: TState;
  context: TContextMap[TState];
};

export type TStatusSnapshot<TState extends string, TContextMap extends Record<TState, unknown>> = {
  [TCurrentState in TState]: TStatusSnapshotByState<TCurrentState, TContextMap>;
}[TState];

export type TStateSnapshotByState<TState extends string> = {
  state: TState;
};

export type TStateSnapshot<TState extends string> = {
  [TCurrentState in TState]: TStateSnapshotByState<TCurrentState>;
}[TState];
