import { types } from 'mobx-state-tree';

export const createStatusStateModel = <TStatus extends string, TContext>(status: TStatus) => {
  return types.model({
    state: types.literal(status),
    context: types.frozen<TContext>(),
  });
};
