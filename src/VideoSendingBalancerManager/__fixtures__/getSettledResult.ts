import settle from './settle';

type TPendingResult = { status: 'pending' };

/**
 * Результат промиса после settle; `{ status: 'pending' }`, если промис к этому моменту не завершился
 */
const getSettledResult = async <T>(
  promise: Promise<T>,
): Promise<PromiseSettledResult<T> | TPendingResult> => {
  const pending: TPendingResult = { status: 'pending' };

  return Promise.race([
    Promise.allSettled([promise]).then(([result]) => {
      return result;
    }),
    settle().then(() => {
      return pending;
    }),
  ]);
};

export default getSettledResult;
