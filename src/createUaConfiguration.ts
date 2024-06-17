import type { TParametersCreateUa } from './types';
import { generateUserId, parseDisplayName } from './utils';

const createUaConfiguration = ({
  user,
  password,
  socket,
  displayName,
  getSipServerUrl,
  register = false,
  sdpSemantics = 'plan-b',
  sessionTimers = false,
  registerExpires = 60 * 5, // 5 minutes in sec
  connectionRecoveryMinInterval = 2,
  connectionRecoveryMaxInterval = 6,
  userAgent,
}: TParametersCreateUa) => {
  if (register && !password) {
    throw new Error('password is required for authorized connection');
  }

  const authorizationUser = register && user ? user.trim() : `${generateUserId()}`;
  const uri = getSipServerUrl(authorizationUser);

  return {
    password,
    register,
    uri,
    display_name: parseDisplayName(displayName),
    user_agent: userAgent,
    sdp_semantics: sdpSemantics,
    sockets: [socket],
    session_timers: sessionTimers,
    register_expires: registerExpires,

    connection_recovery_min_interval: connectionRecoveryMinInterval,
    connection_recovery_max_interval: connectionRecoveryMaxInterval,
  };
};

export default createUaConfiguration;
