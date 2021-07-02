import { ValidateError } from './format';

export const getLinesByPos = (code: string, startPos: number) => {
  const prefix = code.slice(0, startPos);
  const currentLineStart = prefix.lastIndexOf('\n') + 1;
  const previousLineStart = prefix.slice(0, currentLineStart - 1).lastIndexOf('\n') + 1;
  const currentLine = prefix.slice(currentLineStart);
  const previousLine = prefix.slice(previousLineStart, currentLineStart);
  const foundIndex = previousLine.split('').findIndex((ele) => ele !== ' ');
  const leadingWhiteSpace = foundIndex === -1 ? 0 : foundIndex;

  return {
    leadingWhiteSpace,
    currentLine,
    previousLine,
  };
};

export const generateWhiteSpace = (whitespace: number) => {
  return Array(Math.max(whitespace + 1, 1)).join(' ');
};

export const insertText = (text: string) => {
  document.execCommand('insertText', false, text);
};

export const getTokensOfCurrentLine = (tokens: (Prism.Token | string)[], cursorIndex: number) => {
  const tokenIndex = getCurrentTokenIndex(tokens, cursorIndex);
  let currentIndex = tokenIndex;
  const line: (Prism.Token | string)[] = [];
  while (currentIndex >= 0) {
    const current = tokens[currentIndex];
    if (isToken(current) && current.type === 'linebreak') {
      break;
    } else {
      line.unshift(current);
    }
    currentIndex--;
  }
  return line;
};

export const getCurrentTokenIndex = (tokens: (Prism.Token | string)[], cursorIndex: number) => {
  let remain = cursorIndex;
  let foundIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    const currentToken = tokens[i];
    if (remain - currentToken.length > 0) {
      remain -= currentToken.length;
    } else {
      foundIndex = i;
      break;
    }
  }
  return foundIndex;
};

export const isToken = (tok: string | Prism.Token | undefined | Prism.Token[]): tok is Prism.Token => {
  return Boolean(tok && typeof tok !== 'string');
};

export const getTokenContent = (tok: Prism.TokenStream | undefined): string => {
  if (Array.isArray(tok)) {
    return tok
      .map((t) => {
        return getTokenContent(t);
      })
      .join('');
  }
  if (isToken(tok)) {
    return getTokenContent(tok.content);
  }
  return tok || '';
};

export const tokenContentEquals = (tok: Prism.TokenStream | undefined, val: string): tok is string => {
  if (!tok) {
    return false;
  }
  if (tok === val) {
    return true;
  }
  if (Array.isArray(tok)) {
    return false;
  }
  if (typeof tok !== 'string') {
    return tokenContentEquals(tok.content, val);
  }
  return false;
};

export const getLengthOfToken = (tok: Prism.TokenStream | undefined): number => {
  // let len = 0
  if (Array.isArray(tok)) {
    return tok.reduce((acc, ele) => {
      return acc + getLengthOfToken(ele);
    }, 0);
  }
  return tok?.length || 0;
};

export const markErrorToken = (tok: (Prism.Token | string)[], formatError: ValidateError | null) => {
  if (!formatError || !formatError.lineNo) {
    return;
  }
  if (!Array.isArray(tok) || tok.length === 0) {
    return;
  }
  let lineNo = 0;
  let column = 0;

  for (let i = 0; i < tok?.length; i++) {
    const current = tok[i];
    if (current) {
      if (tokenContentEquals(current, '\n')) {
        lineNo += 1;
        column = 0;
      } else {
        if (lineNo === Number(formatError.lineNo) - 1) {
          column += getLengthOfToken(current);
          if (column >= Number(formatError.columnNo) && isToken(current)) {
            (current as Prism.Environment).hasError = true;
            break;
          }
        }
      }
    }
  }
};
