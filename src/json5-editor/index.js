import React, { useState, useEffect, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import './style.less';
import { highlight, languages } from 'prismjs';
// import 'prismjs/components/prism-clike';
// import 'prismjs/components/prism-javascript';
import { fillIndent, fillAfter } from './utils/fillPairs';
export default props => {
  const textAreaRef = useRef(null);
  const [code, setCode] = useState(props.initialValue || '');
  const codeRef = useRef(code);
  codeRef.current = code;
  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  useEffect(() => {
    const textArea = textAreaRef.current;
    const handler = ev => {
      if (ev.code === 'Enter' && !ev.isComposing) {
        fillIndent(textArea, '{', '}', codeRef.current, setCode, ev);
        fillIndent(textArea, '[', ']', codeRef.current, setCode, ev);
        const startPos = textArea?.selectionStart || 0;
        const endPos = textArea?.selectionEnd || 0;
        if (startPos !== endPos) {
          return;
        }
        const prefix = codeRef.current.slice(0, startPos);
        const newLineStartIndex = prefix.lastIndexOf('\n') + 1;
        const currentLine = prefix.slice(newLineStartIndex);
        const currentIndexInLine = startPos - newLineStartIndex;
        // 存在冒号，可认为是一个 property 独占的一行
        if (currentLine.indexOf(':') !== -1) {
          if (currentLine.indexOf('//') !== -1) {
            // 粗略的认为存在注释
            if (currentIndexInLine > currentLine.indexOf('//')) {
              // 存在注释，在注释前一个字符的位置加逗号, 并换行
              ev.preventDefault();
              setCode(c => {
                let beforeComma = c.slice(
                  0,
                  currentLine.indexOf('//') + newLineStartIndex,
                );
                const leadingWhiteSpace =
                  currentLine.split('').findIndex(ele => ele !== ' ') || 0;
                const afterComma = c.slice(
                  currentLine.indexOf('//') + newLineStartIndex,
                  startPos,
                );
                const rest = c.slice(startPos);
                const beforeNewLine = [
                  beforeComma,
                  beforeComma.trim().endsWith(',') ? '' : ', ',
                  afterComma,
                  `\n${Array(leadingWhiteSpace + 1).join(' ')}`,
                ].join('');
                window.requestAnimationFrame(() => {
                  textArea?.setSelectionRange(
                    beforeNewLine.length,
                    beforeNewLine.length,
                  );
                });
                return [beforeNewLine, rest].join('');
              });
            }
          } else {
            if (!currentLine.trim().endsWith(',')) {
              document.execCommand('insertText', false, ',');
            }
          }
        }
      }
      if (ev.code === 'Slash') {
        const startPos = textArea?.selectionStart || 0;
        const endPos = textArea?.selectionEnd || 0;
        if (
          startPos === endPos &&
          (codeRef.current || '')[startPos - 1] === '/'
        ) {
          if ((codeRef.current || '')[startPos - 2] === ',') {
            ev.preventDefault();
            setCode(c => {
              window.requestAnimationFrame(() => {
                textArea?.setSelectionRange(startPos + 3, startPos + 3);
              });
              return [
                c.slice(0, startPos - 2),
                ', ',
                '// ',
                c.slice(startPos),
              ].join('');
            });
          } else {
            window.requestAnimationFrame(() => {
              document.execCommand('insertText', false, ' ');
            });
          }
        }
      }
      if (ev.key === ':') {
        window.requestAnimationFrame(() => {
          document.execCommand('insertText', false, ' ');
        });
      }
      if (ev.key === '"') {
        fillAfter(textArea, '"');
      }
      if (ev.key === "'") {
        fillAfter(textArea, "'");
      }
    };
    textArea?.addEventListener('keydown', handler);
    return () => {
      textArea?.removeEventListener('keydown', handler);
    };
  }, []);
  return React.createElement(
    'div',
    { className: 'json5-editor-wrapper' },
    React.createElement(Editor, {
      ref: r => (textAreaRef.current = r?._input),
      value: code,
      placeholder: 'hello',
      onValueChange: code => setCode(code),
      highlight: code => highlight(code, languages.js, 'JavaScript'),
      padding: 10,
      style: {
        fontFamily: 'SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace',
        fontSize: 14,
      },
    }),
  );
};
//# sourceMappingURL=index.js.map
