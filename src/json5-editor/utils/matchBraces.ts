/* eslint-disable */
import Prism from 'prismjs';

export function registerPlugin() {
  let bracesCounter = 0;
  let parenthesesCounter = 0;
  let bracketsCounter = 0;

  Prism.hooks.add('before-insert', function() {
    bracesCounter = 0;
    parenthesesCounter = 0;
    bracketsCounter = 0;
  });

  Prism.hooks.add('wrap', function(env) {
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
