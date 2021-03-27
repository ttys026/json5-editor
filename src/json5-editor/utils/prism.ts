/* eslint-disable */
import Prism, { hooks, Environment } from 'prismjs';

// 参考 1：https://prismjs.com/test.html#language=json5 // inspect element to check deps and its order
// 参考 2：https://prismjs.com/extending.html#resolving-dependencies
import 'prismjs/components/prism-markup.min.js';
import 'prismjs/components/prism-json.min.js';
import 'prismjs/components/prism-json5.min.js';

const getInnerContent = (str: string) => {
  if (str.startsWith('"') || str.startsWith("'")) {
    return str.slice(1, str.length - 1);
  }
  return str;
};

interface EditorState {
  cache: string[];
}

const getLanguageAsSymbol = (
  env: hooks.RequiredEnvironment<'language', Environment>,
) => {
  return (env.language as unknown) as symbol;
};

const editorCacheMap = new Map<symbol, EditorState>();

export function registerPlugin(uid: symbol) {
  editorCacheMap.set(uid, {
    cache: [],
  });

  // before-insert is a self registered hook that can determine first time registration
  if (!((Prism.hooks.all || {})['before-insert'] || []).length) {
    Prism.hooks.add('before-tokenize', env => {
      env.grammar.indent = /[ ]{2}/;
    });

    Prism.hooks.add('after-tokenize', function(env) {
      let lastProperty = 'root';
      let prefix: Array<string | number> = [];
      for (let i = 0; i < (env.tokens?.length || 0); i++) {
        if (env.tokens[i].content === '{') {
          prefix.push(lastProperty);
        }
        if (env.tokens[i].content === '[') {
          prefix.push(0);
        }
        if (env.tokens[i].content === '}') {
          prefix.pop();
          const last = prefix.pop();
          if (typeof last === 'number') {
            prefix.push(last + 1);
          }
        }
        if (env.tokens[i].content === ']') {
          prefix.pop();
          const last = prefix.pop();
          if (typeof last === 'number') {
            prefix.push(last + 1);
          }
        }
        if (env.tokens[i].type === 'property') {
          const last = prefix.pop();
          if (typeof last === 'number') {
            prefix.push(last);
          }
          lastProperty = getInnerContent(env.tokens[i].content);
          prefix.push(lastProperty);
          env.tokens[i].alias = `${env.tokens[i].alias || ''} ${prefix.join(
            '-',
          )}`.trim();
        }
      }
    });

    Prism.hooks.add('before-insert', env => {
      editorCacheMap.set(getLanguageAsSymbol(env), {
        cache: [],
      });
    });

    // exist property
    Prism.hooks.add('wrap', env => {
      let { cache } = editorCacheMap.get(getLanguageAsSymbol(env))!;
      if (env.type === 'property') {
        const extraClassList = env.classes[2].split(' ');
        const objectPath = extraClassList[extraClassList.length - 1];
        if (cache.includes(`${getInnerContent(env.content)}-${objectPath}`)) {
          env.classes.push('exist-property');
        } else {
          cache.push(`${getInnerContent(env.content)}-${objectPath}`);
        }
      }

      if (['{', '(', '['].includes(env.content)) {
        env.classes.push('brace', 'brace-start');
      }
      if (['}', ')', ']'].includes(env.content)) {
        env.classes.push('brace', 'brace-end');
      }
    });
  }
}

export function unRegisterPlugin(uid: symbol) {
  editorCacheMap.delete(uid);
}
