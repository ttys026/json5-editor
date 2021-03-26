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

const editorCacheMap = new Map<symbol, EditorState>();

export function registerPlugin(uid: symbol) {
  editorCacheMap.set(uid, {
    cache: [],
  });

  // object path
  Prism.hooks.add('after-tokenize', function(env) {
    if (((env.language as unknown) as symbol) !== uid) {
      return;
    }
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

  Prism.hooks.add('before-insert', () => {
    editorCacheMap.set(uid, {
      cache: [],
    });
  });

  // exist property
  Prism.hooks.add('wrap', env => {
    if (((env.language as unknown) as symbol) !== uid) {
      return;
    }
    let { cache } = editorCacheMap.get(uid)!;
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

export function unRegisterPlugin(uid: symbol) {
  editorCacheMap.delete(uid);
}
