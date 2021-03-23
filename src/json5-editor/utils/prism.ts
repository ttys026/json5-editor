/* eslint-disable */
import Prism from 'prismjs';

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

export function registerPlugin() {
  let bracesCounter = 0;
  let parenthesesCounter = 0;
  let bracketsCounter = 0;
  let cache: string[] = [];

  Prism.hooks.add('after-tokenize', function(env) {
    let lastProperty = 'root';
    let prefix = [];
    for (let i = 0; i < (env.tokens?.length || 0); i++) {
      if (env.tokens[i].content === '{') {
        prefix.push(lastProperty);
      }
      if (env.tokens[i].content === '}') {
        prefix.pop();
      }
      if (env.tokens[i].type === 'property') {
        lastProperty = getInnerContent(env.tokens[i].content);
        env.tokens[i].alias = `${env.tokens[i].alias || ''} ${prefix.join(
          '-',
        )}`.trim();
      }
    }
  });

  Prism.hooks.add('before-insert', () => {
    bracesCounter = 0;
    parenthesesCounter = 0;
    bracketsCounter = 0;
    cache = [];
  });

  Prism.hooks.add('wrap', env => {
    if (env.type === 'property') {
      const extraClassList = env.classes[2].split(' ');
      const objectPath = extraClassList[extraClassList.length - 1];
      if (cache.includes(`${getInnerContent(env.content)}-${objectPath}`)) {
        env.classes.push('exist-property');
      } else {
        cache.push(`${getInnerContent(env.content)}-${objectPath}`);
      }
    }

    if (env.content === '{') {
      env.classes.length === 3 && env.classes.pop();
      env.classes.push(`braces-start-${bracesCounter}`);
      bracesCounter += 1;
    }
    if (env.content === '(') {
      env.classes.length === 3 && env.classes.pop();
      env.classes.push(`parentheses-start-${parenthesesCounter++}`);
    }
    if (env.content === '[') {
      env.classes.length === 3 && env.classes.pop();
      env.classes.push(`brackets-start-${bracketsCounter++}`);
    }
    if (env.content === '}') {
      env.classes.length === 3 && env.classes.pop();
      bracesCounter -= 1;
      env.classes.push(`braces-end-${bracesCounter}`);
    }
    if (env.content === ')') {
      env.classes.length === 3 && env.classes.pop();
      env.classes.push(`parentheses-end-${--parenthesesCounter}`);
    }
    if (env.content === ']') {
      env.classes.length === 3 && env.classes.pop();
      env.classes.push(`brackets-end-${--bracketsCounter}`);
    }
  });
}
