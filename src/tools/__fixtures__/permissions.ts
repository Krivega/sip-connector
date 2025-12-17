const hasNoEmptyString = (value?: string) => {
  return value !== undefined && value !== '';
};

export const canConnectToServer = ({
  remoteAddress,
  sipServerIp,
  sipServerUrl,
  user,
  password,
  register,
}: {
  remoteAddress: string | undefined;
  sipServerIp: string | undefined;
  sipServerUrl: string | undefined;
  user: string;
  password: string;
  register: boolean;
}) => {
  const hasInitParameters =
    remoteAddress !== undefined && sipServerIp !== undefined && sipServerUrl !== undefined;

  if (register) {
    return hasInitParameters && hasNoEmptyString(user) && hasNoEmptyString(password);
  }

  return hasInitParameters;
};
