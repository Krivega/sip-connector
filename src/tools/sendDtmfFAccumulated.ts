import { sequentPromises } from 'sequent-promises';

type TSendKey = (values: string) => Promise<void>;

const wrapKeysToSend = (sendKey: TSendKey): ((keys: string) => (() => Promise<void>)[]) => {
  return (keys: string) => {
    const keyArray = [...keys];

    return keyArray.map((key) => {
      return async () => {
        return sendKey(key);
      };
    });
  };
};
const sendDtmfAccumulated = async ({
  accumulatedKeys,
  sendKey,
  canRunTask,
}: {
  accumulatedKeys: string;
  sendKey: TSendKey;
  canRunTask?: () => boolean;
}): Promise<{
  isSuccessful: boolean;
}> => {
  const wrapperSendKeys = wrapKeysToSend(sendKey);
  const tasks = wrapperSendKeys(accumulatedKeys);

  return sequentPromises(tasks, canRunTask);
};

export default sendDtmfAccumulated;
