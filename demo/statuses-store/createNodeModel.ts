import { types } from 'mobx-state-tree';

export const createNodeModel = <TState extends string, TContext>(state: TState) => {
  return types.model({
    state: types.literal(state),
    context: types.frozen<TContext>(),
  });
};
