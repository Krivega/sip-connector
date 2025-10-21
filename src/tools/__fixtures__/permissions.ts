const hasNoEmptyString = (value?: string) => {
  return value !== undefined && value !== '';
};

export const canConnectToServer = ({
  remoteAddress,
  sipServerUrl,
  sipWebSocketServerURL,
  user,
  password,
  register,
}: {
  remoteAddress: string | undefined;
  sipServerUrl: string | undefined;
  sipWebSocketServerURL: string | undefined;
  user: string;
  password: string;
  register: boolean;
}) => {
  const hasInitParameters =
    remoteAddress !== undefined &&
    sipServerUrl !== undefined &&
    sipWebSocketServerURL !== undefined;

  if (register) {
    return hasInitParameters && hasNoEmptyString(user) && hasNoEmptyString(password);
  }

  return hasInitParameters;
};
