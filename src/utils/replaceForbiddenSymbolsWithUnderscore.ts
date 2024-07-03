const forbiddenChars = '[@*!|]';
const allowedChar = '_';

const replaceForbiddenSymbolsWithUnderscore = (text: string): string => {
  let fixedTest = text;

  fixedTest = fixedTest.replaceAll(new RegExp(forbiddenChars, 'g'), allowedChar);

  return fixedTest;
};

export default replaceForbiddenSymbolsWithUnderscore;
