// Хелпер ожидания выполнения всех микротасок без использования setTimeout 0
const flushPromises = async () => {
  return new Promise<void>((resolve) => {
    // Используем process.nextTick, чтобы исключить возврат значения из executor
    process.nextTick(resolve);
  });
};

export default flushPromises;
