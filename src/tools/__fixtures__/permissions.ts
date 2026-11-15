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

  return register
    ? hasInitParameters && hasNoEmptyString(user) && hasNoEmptyString(password)
    : hasInitParameters;
};
