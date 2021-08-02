import React from 'react';
import { tokenize } from 'prismjs/components/prism-core';
import { endList, startList } from '../constant';
import { getTokenContent, isToken } from './autoComplete';

// const cacheMap = new Map<symbol, { tokens: (string | Prism.Token)[]; code: string }>();
interface WrappedToken extends Prism.Token {
  tag: string;
  classes: string[];
  attributes: {};
  language: string;
  content: WrappedTokenStream;
}

type WrappedTokenStream = WrappedToken | WrappedToken[] | string | string[];

export const lex: Prism.Grammar = {
  collapse: [
    { pattern: /\{┉\}\u200c*/, alias: 'object' },
    { pattern: /\[┉\]\u200c*/, alias: 'array' },
  ],
  property: [
    { pattern: /("|')(?:\\(?:\r\n?|\n|.)|(?!\1)[^\\\r\n])*\1\*?(?=\s*:)/g, greedy: true },
    { pattern: /(?!\s)[_$a-zA-Z\xA0-\uFFFF\*](?:(?!\s)[$\w\xA0-\uFFFF\*\?])*(?=\s*:)/, alias: 'unquoted' },
  ],
  string: {
    pattern: /("|')(?:\\(?:\r\n?|\n|.)|(?!\1)[^\\\r\n])*\1/g,
    greedy: true,
  },
  comment: {
    pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/g,
    greedy: true,
  },
  number: /[+-]?\b(?:NaN|Infinity|0x[a-fA-F\d]+)\b|[+-]?(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[eE][+-]?\d+\b)?/,
  punctuation: /[{}[\]\|\(\),]/,
  operator: /:/,
  boolean: /\b(?:true|false)\b/,
  null: {
    alias: 'keyword',
    pattern: /\bnull\b/,
  },
  // match leading spaces for every lines besides the first line
  leading: [
    {
      pattern: /(\r?\n)+[ ]*/g,
      lookbehind: true,
      inside: {
        indent: {
          pattern: /[ ]{2}/,
        },
      },
    },
    {
      pattern: /^.*/g,
      greedy: true,
      inside: {
        indent: {
          pattern: /[ ]{2}/,
        },
      },
    },
  ],
  linebreak: /\r?\n/,
  unknown: /(?!\s).+(?=\s*)/,
};

// TODO: implement tokenize cache
export const tokenizeWithCache = (code: string, lex: Prism.Grammar, editorId: symbol) => {
  // const cache = cacheMap.get(editorId);
  // // no cache
  // if (!cache) {
  //   const latestTokens = tokenize(code, lex);
  //   cacheMap.set(editorId, { tokens: latestTokens, code });
  //   return latestTokens;
  // }
  // // cache exist
  // let tokenStartIndex = 0;
  // let tokenStartLength = 0;
  // let diffStart = 0;
  // // loop from start to find first diff char
  // const { code: prevCode, tokens: prevTokens } = cache;
  // for (let i = 0; i < code.length; i++) {
  //   if (code[i] === prevCode[i]) {
  //     if (tokenStartLength + prevTokens[tokenStartIndex].length >= i) {
  //       tokenStartLength += prevTokens[tokenStartIndex].length;
  //       tokenStartIndex += 1;
  //     }
  //     i++;
  //   } else {
  //     diffStart = i;
  //     break;
  //   }
  // }

  // let tokenEndIndex = prevTokens.length - 1;
  // let tokenEndLength = code.length;
  // let diffEnd = code.length;
  // // loop from end to find last diff char
  // for (let i = code.length - 1; i >= 0; i--) {
  //   if (code[i] === prevCode[i]) {
  //     if (tokenEndLength - i >= prevTokens[tokenEndIndex].length) {
  //       tokenEndLength -= prevTokens[tokenEndIndex].length;
  //       tokenEndIndex -= 1;
  //     }
  //     i--;
  //   } else {
  //     diffEnd = i;
  //     break;
  //   }
  // }

  // if(diffStart === 0 && diffEnd === code.length) {
  //   return prevTokens;
  // }

  // const diffCode = code.slice(diffStart, diffEnd);
  // const diffTokens = tokenize(diffCode, lex);
  // if (tokenStartIndex > 0 && tokenEndIndex > tokenStartIndex) {
  //   const newTokens = [...prevTokens.slice(0, tokenStartIndex), ...diffTokens, ...prevTokens.slice(tokenEndIndex)];
  //   cacheMap.set(editorId, { tokens: newTokens, code });
  //   return newTokens;
  // }

  return tokenize(code, lex);
};

/**
 * Same as Prism after-tokenize hook, but not mounted globally
 * @param this token caches
 * @param env Prism.Environment
 */
export const afterTokenizeHook = (env: Prism.Environment) => {
  let lastProperty: string | number | symbol = 'root';
  // 当遇到 array 时，插入一个 placeholder symbol，用于在 arrayPrefix 数组中找到真实的 index 后替换
  let prefix: Array<string | number | symbol> = [];
  let arrayPrefix: number[] = [];
  let symbol = Symbol('placeholder');
  const getInnerContent = (str: string) => {
    if (str.startsWith('"') || str.startsWith("'")) {
      return str.slice(1, str.length - 1);
    }
    return str;
  };

  for (let i = 0; i < (env.tokens?.length || 0); i++) {
    if (env.tokens[i].content === '{') {
      prefix.push(lastProperty);
      lastProperty = '';
      // prefix.push(lastProperty);
    }
    if (env.tokens[i].content === '[') {
      prefix.push(lastProperty);
      arrayPrefix.push(0);
      prefix.push(symbol);
      lastProperty = '';
    }
    if (env.tokens[i].content === '}') {
      prefix.pop();
      lastProperty = prefix[prefix.length - 1];
      if (arrayPrefix.length && typeof lastProperty === 'symbol') {
        arrayPrefix[arrayPrefix.length - 1]++;
      }
      lastProperty = '';
    }
    if (env.tokens[i].content === ']') {
      prefix.pop();
      prefix.pop();
      arrayPrefix.pop();
      lastProperty = prefix[prefix.length - 1];
      if (arrayPrefix.length && typeof lastProperty === 'symbol') {
        arrayPrefix[arrayPrefix.length - 1]++;
      }
      lastProperty = '';
    }
    if (env.tokens[i].type === 'property') {
      lastProperty = getInnerContent(env.tokens[i].content);
      let arrayIndex = 0;
      env.tokens[i].alias = `${env.tokens[i].alias || ''} ${[...prefix, lastProperty]
        .filter((ele) => ele !== '')
        .map((ele) => (typeof ele === 'symbol' ? arrayPrefix[arrayIndex++] : ele))
        .join('.')}`.trim();
    }
  }
};

const getObjectPath = (env: WrappedToken) => {
  const extraClassList = (env.classes[2] || '').split(' ');
  return extraClassList[extraClassList.length - 1];
};

/**
 * pre-wrap tokens, add classNames and attributes to token
 * @param token
 * @param language
 * @returns
 */
function preWrap(token: Prism.Token | Prism.TokenStream | string, language: string): WrappedTokenStream {
  if (typeof token == 'string') {
    return token;
  }
  if (Array.isArray(token)) {
    return token.map((tok) => {
      return preWrap(tok, language);
    }) as WrappedTokenStream;
  }

  const env: WrappedToken = {
    ...token,
    tag: 'span',
    classes: ['token', token.type],
    attributes: {},
    language: language,
    content: preWrap(token.content, language),
  };
  const aliases = token.alias;
  if (aliases) {
    if (Array.isArray(aliases)) {
      Array.prototype.push.apply(env.classes, aliases);
    } else {
      env.classes.push(aliases);
    }
  }
  return env;
}

function stringify(token: WrappedTokenStream): string {
  if (typeof token == 'string') {
    return token;
  }
  if (Array.isArray(token)) {
    let ret = '';
    token.forEach((tok: WrappedTokenStream) => {
      ret += stringify(tok);
    });
    return ret;
  }

  let env: Prism.hooks.RequiredEnvironment<'classes' | 'content', Prism.Environment> = {
    ...token,
    content: stringify(token.content),
  };

  if (startList.includes(env.content)) {
    env.classes.push('brace', 'brace-start');
  }
  if (endList.includes(env.content)) {
    env.classes.push('brace', 'brace-end');
  }

  if (env.hasError) {
    env.classes.push('error');
  }

  let attributes = '';
  for (const name in env.attributes) {
    attributes += ' ' + name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
  }

  return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + attributes + '>' + env.content + '</' + env.tag + '>';
}

/**
 * encode tokens and keep attributes
 * @param tokens Prism.TokenStream
 * @returns string
 */
const encode = (tokens: string | WrappedToken | WrappedToken[]): WrappedToken | WrappedToken[] | string | string[] => {
  if (isToken(tokens)) {
    return tokens;
  } else if (Array.isArray(tokens)) {
    return tokens.map(encode) as WrappedToken[];
  } else {
    return tokens
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/\u00a0/g, ' ');
  }
};

export const tokenStreamToHtml = (token: Prism.Token | Prism.TokenStream | string, language: string): string => {
  const encoded = encode(token as WrappedToken);
  const cache: string[] = [];
  const tokens = preWrap(Array.isArray(encoded) ? encoded : [encoded], language) as WrappedToken[];

  for (let i = tokens.length - 1; i >= 0; i--) {
    const current = tokens[i];
    if (typeof current !== 'string' && current.type === 'property') {
      const objectPath = getObjectPath(current);
      if (cache.includes(objectPath)) {
        current.classes.push('exist-property');
      } else {
        cache.push(objectPath);
      }
    }
  }

  return stringify(tokens);
};

export const tokenToNode = (token: Prism.Token | Prism.TokenStream | string, language: string) => {
  const encoded = encode(token as WrappedToken);
  const cache: string[] = [];
  const tokens = preWrap(Array.isArray(encoded) ? encoded : [encoded], language) as WrappedToken[];

  for (let i = tokens.length - 1; i >= 0; i--) {
    const current = tokens[i];
    if (typeof current !== 'string' && current.type === 'property') {
      const objectPath = getObjectPath(current);
      if (cache.includes(objectPath)) {
        current.classes.push('exist-property');
      } else {
        cache.push(objectPath);
      }
    }
  }

  const renderToken = (tok: WrappedTokenStream, key: string): React.ReactNode => {
    if (Array.isArray(tok)) {
      const newKey = `${key}_${getTokenContent(tok)}`;
      return <span key={newKey}>{tok.map((t, i) => renderToken(t, `${newKey}_${i}`))}</span>;
    } else if (isToken(tok)) {
      const newKey = `${key}_${getTokenContent(tok)}`;
      return (
        <span key={newKey} className={tok.classes.join(' ')}>
          {renderToken(tok.content, newKey)}
        </span>
      );
    }
    return <span key={`${key}_${tok}`}>{tok}</span>;
  };

  let lineNo = 0;
  const lines: Prism.Token[][] = [];

  for (let i = 0; i < tokens?.length; i++) {
    const current = tokens[i];
    if (current) {
      if (current.content === '\n') {
        lineNo += 1;
      } else {
        lines[lineNo] = [...(lines[lineNo] || []), current];
      }
    }
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>{(lines[index] || []).map((tok, key) => renderToken(tok as WrappedToken, `${index}_${key}`))}</div>
  );

  return [Row, lines] as const;
};
