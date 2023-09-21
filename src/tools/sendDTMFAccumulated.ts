import sequentPromises from 'sequent-promises';
import flow from 'lodash/flow';
import split from 'lodash/split';

type TSendKey = (values: string) => Promise<void>;

const wrapKeysToSend = (sendKey: TSendKey) => {
  return flow(
    (keys: string): string[] => {
      return split(keys, '');
    },
    (keyArray: string[]) => {
      return keyArray.map((key) => {
        return () => {
          return sendKey(key);
        };
      });
    },
  );
};
const sendDTMFAccumulated = ({
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

  return sequentPromises<void>(tasks, canRunTask);
};

export default sendDTMFAccumulated;
