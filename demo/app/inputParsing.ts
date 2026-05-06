export type TPositiveIntegerParseResult =
  | {
      isValid: true;
      value: number;
    }
  | {
      isValid: false;
      message: string;
    };

export const parsePositiveIntegerInput = ({
  input,
  invalidMessage,
}: {
  input: HTMLInputElement;
  invalidMessage: string;
}): TPositiveIntegerParseResult => {
  const value = Number.parseInt(input.value, 10);

  if (!Number.isInteger(value) || value < 1) {
    return { isValid: false, message: invalidMessage };
  }

  return { isValid: true, value };
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  const serializedError = JSON.stringify(error);

  return typeof serializedError === 'string' ? serializedError : String(error);
};
