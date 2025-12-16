const onUnloadPage = (handler: () => void) => {
  window.addEventListener('unload', handler);
};

export default onUnloadPage;
