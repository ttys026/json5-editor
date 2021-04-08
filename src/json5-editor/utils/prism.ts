/* eslint-disable */
import Prism, { hooks, Environment, Token } from 'prismjs';

// 参考 1：https://prismjs.com/test.html#language=json5 // inspect element to check deps and its order
// 参考 2：https://prismjs.com/extending.html#resolving-dependencies
import 'prismjs/components/prism-markup.min.js';
import 'prismjs/components/prism-json.min.js';
import 'prismjs/components/prism-json5.min.js';
import { endList, startList } from '../constant';

const getInnerContent = (str: string) => {
  if (str.startsWith('"') || str.startsWith("'")) {
    return str.slice(1, str.length - 1);
  }
  return str;
};

interface EditorState {
  cache: string[];
  latestTokens: Token[];
}

const getLanguageAsSymbol = (
  env: hooks.RequiredEnvironment<'language', Environment>,
) => {
  return (env.language as unknown) as symbol;
};

const cacheTokens = (uid: symbol, tokens: Token[]) => {
  setTimeout(() => {
    // 如果已经被卸载了，则不重新缓存 tokens
    if (editorCacheMap.has(uid)) {
      editorCacheMap.set(uid, {
        cache: editorCacheMap.get(uid)?.cache || [],
        latestTokens: tokens,
      });
    }
  });
};

const resetTokens = (uid: symbol) => {
  if (editorCacheMap.has(uid)) {
    editorCacheMap.set(uid, {
      cache: [],
      latestTokens: [],
    });
  }
};

export const getTokens = (uid: symbol) => {
  return editorCacheMap.get(uid)?.latestTokens;
};

const editorCacheMap = new Map<symbol, EditorState>();

export function registerPlugin(uid: symbol) {
  editorCacheMap.set(uid, {
    cache: [],
    latestTokens: [],
  });

  // before-insert is a self registered hook that can determine first time registration
  if (!((Prism.hooks.all || {})['before-insert'] || []).length) {
    Prism.languages.json5 = Prism.languages.extend('json5', {
      // TODO: should skip non-leading spaces
      indent: /[ ]{2}/,
      punctuation: /[{}[\],\|\(\)]/,
      unknown: /(?!\s).+(?=\s*)/,
    });

    Prism.hooks.add('after-tokenize', function(env) {
      resetTokens(getLanguageAsSymbol(env));
      let lastProperty: string | number | symbol = 'root';
      // 当遇到 array 时，插入一个 placeholder symbol，用于在 arrayPrefix 数组中找到真实的 index 后替换
      let prefix: Array<string | number | symbol> = [];
      let arrayPrefix: number[] = [];
      let symbol = Symbol('placeholder');
      let skipCount = 0;
      const pushIfNeed = (property: string | number) => {
        if (property && property !== 0) {
          prefix.push(property);
        } else {
          skipCount += 1;
        }
      };

      const popIfNeed = () => {
        if (skipCount === 0) {
          prefix.pop();
        } else {
          skipCount -= 1;
        }
      };

      cacheTokens(getLanguageAsSymbol(env), env.tokens);
      for (let i = 0; i < (env.tokens?.length || 0); i++) {
        if (env.tokens[i].content === '{') {
          pushIfNeed(lastProperty);
          lastProperty = '';
          // prefix.push(lastProperty);
        }
        if (env.tokens[i].content === '[') {
          pushIfNeed(lastProperty);
          arrayPrefix.push(0);
          prefix.push(symbol);
          lastProperty = '';
        }
        if (env.tokens[i].content === '}') {
          popIfNeed();
          lastProperty = prefix[prefix.length - 1];
          if (arrayPrefix.length && typeof lastProperty === 'symbol') {
            arrayPrefix[arrayPrefix.length - 1]++;
          }
          lastProperty = '';
        }
        if (env.tokens[i].content === ']') {
          // should pop out a symbol
          prefix.pop();
          popIfNeed();
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
          env.tokens[i].alias = `${env.tokens[i].alias || ''} ${[
            ...prefix,
            lastProperty,
          ]
            .map(ele =>
              typeof ele === 'symbol' ? arrayPrefix[arrayIndex++] : ele,
            )
            .join('.')}`.trim();
        }
      }
    });

    Prism.hooks.add('before-insert', env => {
      resetTokens(getLanguageAsSymbol(env));
    });

    // exist property
    Prism.hooks.add('wrap', env => {
      if (editorCacheMap.get(getLanguageAsSymbol(env))) {
        let { cache = [] } = editorCacheMap.get(getLanguageAsSymbol(env)) || {};
        if (env.type === 'property') {
          const extraClassList = (env.classes[2] || '').split(' ');
          const objectPath = extraClassList[extraClassList.length - 1];
          if (cache.includes(objectPath)) {
            env.classes.push('exist-property');
          } else {
            cache.push(objectPath);
          }
        }
      }

      if (startList.includes(env.content)) {
        env.classes.push('brace', 'brace-start');
      }
      if (endList.includes(env.content)) {
        env.classes.push('brace', 'brace-end');
      }
    });
  }
}

export function unRegisterPlugin(uid: symbol) {
  editorCacheMap.delete(uid);
}
