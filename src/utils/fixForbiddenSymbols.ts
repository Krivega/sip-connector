const forbiddenChars = '[@*!|]';
const allowedChar = '_';

const fixForbiddenSymbols = (text: string): string => {
  let fixedTest = text;

  fixedTest = fixedTest.replaceAll(new RegExp(forbiddenChars, 'g'), allowedChar);

  return fixedTest;
};

export default fixForbiddenSymbols;
