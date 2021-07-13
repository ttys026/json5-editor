import React from 'react';
import ReactDOM from 'react-dom';
import type { RootEnv } from '..';
import { arrayCollapse, objectCollapse } from '../constant';

export const getCollapsedContent = (collapsedList: string[], collapsedContent: string) => {
  let newContent = collapsedContent.replace(/(\{┉\}\u200c*)|(\[┉\]\u200c*)/g, (match) => {
    const count = match.length - 3;
    return collapsedList[count] || match;
  });

  if (/(\{┉\}\u200c*)|(\[┉\]\u200c*)/g.test(newContent)) {
    newContent = getCollapsedContent(collapsedList, newContent);
  }

  return newContent;
};

const getErrorContent = (input: string) => {
  let content: string = input || '';
  if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'"))) {
    content = content.slice(1, content.length - 1);
  }
  if (content.length > 5) {
    content = `${content.slice(0, 5)}...`;
  }
  return content;
};

const resizeElements = (elements: HTMLDivElement[]) => {
  if (elements.length == 0) {
    return;
  }

  const infos = elements
    .map((element) => {
      const codeElement = element.querySelector('pre');
      const lineNumbersWrapper = element.querySelector('.line-numbers-rows')!;
      if (!codeElement || !lineNumbersWrapper) {
        return undefined;
      }

      let lineNumberSizer: HTMLSpanElement = element.querySelector('.line-numbers-sizer')!;
      const codeLines = (codeElement.textContent || '').split('\n');

      if (!lineNumberSizer) {
        lineNumberSizer = document.createElement('span');
        lineNumberSizer.className = 'line-numbers-sizer';

        codeElement.appendChild(lineNumberSizer);
      }

      lineNumberSizer.innerHTML = '0';
      lineNumberSizer.style.display = 'block';

      var oneLinerHeight = lineNumberSizer.getBoundingClientRect().height;
      lineNumberSizer.innerHTML = '';

      return {
        element: element,
        lines: codeLines,
        lineHeights: [] as (number | undefined)[],
        oneLinerHeight: oneLinerHeight,
        sizer: lineNumberSizer,
      };
    })
    .filter(Boolean);

  infos.forEach((info) => {
    const lineNumberSizer = info?.sizer!;
    const lines = info?.lines || [];
    const lineHeights = info?.lineHeights || [];
    const oneLinerHeight = info?.oneLinerHeight;

    lineHeights[lines.length - 1] = undefined;
    lines.forEach(function (line, index) {
      if (line && line.length > 1) {
        var e = lineNumberSizer.appendChild(document.createElement('span'));
        e.style.display = 'block';
        e.textContent = line;
      } else {
        lineHeights[index] = oneLinerHeight;
      }
    });
  });

  infos.forEach((info) => {
    const lineNumberSizer = info?.sizer!;
    const lineHeights = info?.lineHeights || [];

    var childIndex = 0;
    for (var i = 0; i < lineHeights.length; i++) {
      if (lineHeights[i] === undefined) {
        lineHeights[i] = lineNumberSizer.children[childIndex++].getBoundingClientRect().height;
      }
    }
  });

  infos.forEach((info) => {
    var lineNumberSizer = info?.sizer!;
    var wrapper: HTMLDivElement & { children: HTMLDivElement[] } = info?.element.querySelector('.line-numbers-rows')!;

    lineNumberSizer.style.display = 'none';
    lineNumberSizer.innerHTML = '';

    (info?.lineHeights || []).forEach((height, lineNumber) => {
      if (wrapper.children[lineNumber]) {
        // wrapper.children[lineNumber].innerHTML = '<span onclick="alert(1)" style="margin-left: 4px">&#9662;</span>';
        wrapper.children[lineNumber].style.height = height + 'px';
      }
    });
  });
};

export function addLineNumber(env: RootEnv, onCollapse: (newCode: string, collapsedCode: string, uuid: number) => void, onExpand: (uuid: number) => void) {
  requestAnimationFrame(() => {
    if (!env.element) {
      return;
    }
    const gutter = env.element.querySelector('.line-numbers-rows')!;
    let lines = env.tokenLines as Prism.Token[][];
    if (lines.length === 0) {
      lines = [[]];
    }
    const errorLineNo = Number('lineNo' in (env.error || {}) ? env.error.lineNo : -1);

    ReactDOM.unmountComponentAtNode(gutter);

    const Gutter: React.FC = () => {
      let collapsedLineCount = 0;

      return (
        <>
          {lines.map((currentLine, i) => {
            let start = '';
            let startColumnNo = 0;
            let endColumnNo = 0;

            const getCode = () => {
              if (!start) {
                return {};
              }
              const end = start === '{' ? '}' : ']';
              const rest = lines.slice(i);
              let endLineIndex = i;
              const startLineIndex = i;
              let deepth = 0;
              const [firstLine] = rest;
              startColumnNo = firstLine
                .slice(
                  0,
                  firstLine.findIndex((ele) => ele.content === start),
                )
                .reduce((acc, ele) => acc + ele.length, 0);
              rest.some((line, e) => {
                if (line.some((ele) => ele.content === start)) {
                  deepth += 1;
                }
                if (line.some((ele) => ele.content === end)) {
                  deepth -= 1;
                }
                if (deepth === 0) {
                  endColumnNo = line
                    .slice(
                      0,
                      line.findIndex((ele) => ele.content === end),
                    )
                    .reduce((acc, ele) => acc + ele.length, 0);
                  endLineIndex = i + e;
                  return true;
                }
              });
              const codeLines = env.code.split('\n');
              const collapsedCode = codeLines
                .slice(startLineIndex, endLineIndex + 1)
                .map((ln, index, arr) => {
                  if (index === 0) {
                    return ln.slice(startColumnNo);
                  }
                  if (index === arr.length - 1) {
                    return ln.slice(endColumnNo);
                  }
                  return ln;
                })
                .join('\n');
              const prePart = codeLines.slice(0, Math.max(startLineIndex, 0));
              const endPart = codeLines.slice(endLineIndex + 1);
              const cacheLength = env.collapsedList.length;
              const uuid = Array(cacheLength + 1).join('\u200c');
              const newCode = prePart
                .concat(
                  `${codeLines[startLineIndex].slice(0, startColumnNo)}${start === '{' ? `${objectCollapse}${uuid}` : `${arrayCollapse}${uuid}`}${codeLines[endLineIndex].slice(endColumnNo + 1)}`,
                )
                .concat(endPart)
                .join('\n');

              return {
                newCode,
                collapsedCode,
              };
            };

            // error line
            if (i + collapsedLineCount === errorLineNo - 1) {
              const content = getErrorContent(env.error.token.content || '');
              return (
                <span key={i} className="errorLine">
                  <code>{i + collapsedLineCount + 1}</code>
                  <span className="errorMessage">
                    <span>非法字符："{content}"</span>
                  </span>
                </span>
              );
            }
            // collapsable line
            if (
              currentLine.some((tok) => {
                if (typeof tok === 'string') {
                  return false;
                }
                if (tok.content === '{') {
                  start = '{';
                  return true;
                }
                if (tok.content === '[') {
                  start = '[';
                  return true;
                }
                return false;
              })
            ) {
              return (
                <span
                  onClick={() => {
                    const { newCode, collapsedCode } = getCode();
                    if (newCode && collapsedCode) {
                      onCollapse(newCode, collapsedCode, env.collapsedList.length);
                    }
                  }}
                  key={i}
                >
                  <code>{i + collapsedLineCount + 1}</code>
                  <span>&#9662;</span>
                </span>
              );
            }
            // expandable line
            if (currentLine.some((tok) => typeof tok !== 'string' && tok.type === 'collapse')) {
              const collapsedToken = currentLine.find((tok) => typeof tok !== 'string' && tok.type === 'collapse');
              const uuid = (collapsedToken?.content.length || 3) - 3;
              const collapsedContent = env.collapsedList[uuid] || '';
              const fullCollapsedContent = getCollapsedContent(env.collapsedList, collapsedContent);
              const currentLineNo = i + collapsedLineCount + 1;
              const collapsedContentLength = fullCollapsedContent.split('\n').length - 1;
              collapsedLineCount += collapsedContentLength;

              if (errorLineNo !== -1 && currentLineNo + collapsedContentLength > errorLineNo - 1) {
                const content = getErrorContent(env.error.token.content || '');
                // has Error;
                return (
                  <span className="errorLine" onClick={() => onExpand(uuid)} key={i}>
                    <code>{currentLineNo}</code>
                    <span>&#9656;</span>
                    <span className="errorMessage">
                      <span>
                        非法字符："{content}" @line {errorLineNo}
                      </span>
                    </span>
                  </span>
                );
              }

              return (
                <span onClick={() => onExpand(uuid)} key={i}>
                  <code>{currentLineNo}</code>
                  <span>&#9656;</span>
                </span>
              );
            }
            // normal line
            return (
              <span key={i}>
                <code>{i + collapsedLineCount + 1}</code>
                <span>&nbsp;</span>
              </span>
            );
          })}
        </>
      );
    };

    ReactDOM.render(<Gutter />, gutter);

    resizeElements([env.element]);
  });
}
