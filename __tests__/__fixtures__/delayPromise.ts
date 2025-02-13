const noop = () => {};
const deferred = <T = void>() => {
  let resolveDeferred: (data: T) => void = noop;
  let rejectDeferred: (error: Error) => void = noop;

  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  return { promise, resolve: resolveDeferred, reject: rejectDeferred };
};

const delayPromise = async (timeout: number): Promise<void> => {
  const { promise, resolve } = deferred();

  setTimeout(resolve, timeout);

  return promise;
};

export default delayPromise;
