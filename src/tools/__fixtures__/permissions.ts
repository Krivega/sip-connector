const hasNoEmptyString = (string_: string) => {
  return string_ !== undefined && string_ !== '';
};

export const canConnectToServer = ({
  remoteAddress,
  sipServerUrl,
  sipWebSocketServerURL,
  name,
  password,
  isRegisteredUser,
}: {
  remoteAddress: string | undefined;
  sipServerUrl: string | undefined;
  sipWebSocketServerURL: string | undefined;
  name: string;
  password: string;
  isRegisteredUser: boolean;
}) => {
  const hasInitParameters = !!(remoteAddress && sipServerUrl && sipWebSocketServerURL);

  if (isRegisteredUser) {
    return !!(hasInitParameters && hasNoEmptyString(name) && hasNoEmptyString(password));
  }

  return hasInitParameters;
};
