const isElectronEnvironment = (): boolean => {
  // Декларация типов ошибочная, фактически globalThis.process может быть undefined

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return globalThis.process?.versions?.electron !== undefined;
};

export default isElectronEnvironment;
