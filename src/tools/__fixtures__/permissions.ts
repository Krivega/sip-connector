const hasNoEmptyString = (str) => {
  return str !== undefined && str !== '';
};

export const canConnectToServer = ({
  remoteAddress,
  sipServerUrl,
  sipWebSocketServerURL,
  name,
  password,
  isRegisteredUser,
}) => {
  const hasInitParams = !!(remoteAddress && sipServerUrl && sipWebSocketServerURL);

  if (isRegisteredUser) {
    return !!(hasInitParams && hasNoEmptyString(name) && hasNoEmptyString(password));
  }

  return hasInitParams;
};
