import React, { memo, useEffect, useRef, useState } from 'react';
import Editor from 'react-simple-code-editor';
import Prism, { highlight, languages } from 'prismjs';

import { fillWithIndent, fillAfter } from './utils/autoComplete';
import { registerPlugin } from './utils/prism';
import { nextTick } from './utils/nextTick';
import useUpdateEffect from './hooks/useUpdateEffect';
import './style.less';

registerPlugin();
interface Props {
  initialValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}

export default memo((props: Props) => {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [code, setCode] = useState<string>(props.initialValue || '');
  const { value = '', onChange } = props;
  const skipNextOnchange = useRef(true);

  const codeRef = useRef(code);

  useEffect(() => {
    if ('value' in props) {
      setCode(value || '');
    }
    skipNextOnchange.current = true;
  }, [value || '']);

  useUpdateEffect(() => {
    skipNextOnchange.current = false;
    Prism.hooks.run('before-insert', {});
  }, [code || '']);

  useEffect(() => {
    if (onChange && !skipNextOnchange.current && code !== codeRef.current) {
      onChange(code);
    }
    codeRef.current = code;
  }, [code, onChange]);

  useEffect(() => {
    const textArea = textAreaRef.current!;
    const keyHandler = (ev: KeyboardEvent) => {
      const startPos = textArea?.selectionStart || 0;
      const endPos = textArea?.selectionEnd || 0;
      if (ev.code === 'Enter' && !ev.isComposing) {
        // 如果选中了文字，则不做特殊处理
        if (startPos !== endPos) {
          return;
        }
        const filled = [
          fillWithIndent(textArea, '{', '}', codeRef.current, setCode, ev),
          fillWithIndent(textArea, '[', ']', codeRef.current, setCode, ev),
        ];
        const prefixOfCursor = codeRef.current.slice(0, startPos);
        const newLineStartIndex = prefixOfCursor.lastIndexOf('\n') + 1;
        const currentLine = prefixOfCursor.slice(newLineStartIndex);
        const prefixOfLine = prefixOfCursor.slice(0, newLineStartIndex);
        const leadingWhiteSpace =
          currentLine.split('').findIndex(ele => ele !== ' ') || 0;

        if (filled.some(Boolean)) {
          return;
        }

        try {
          // 浏览器兼容性考虑，不使用 lookbehind
          // const regexRet = /(.*):((?:(?!\/\/).)+)(\/\/.*)?/.exec(currentLine);
          const regexRet = /(.*):(.+)/.exec(currentLine);
          const [, rowKey = '', rowValue = ''] = regexRet || [];
          const commentSplitIndex = rowValue.lastIndexOf('//');
          const [key, value, comments] = [
            rowKey,
            commentSplitIndex !== -1
              ? rowValue.slice(0, commentSplitIndex)
              : rowValue,
            commentSplitIndex !== -1 ? rowValue.slice(commentSplitIndex) : '',
          ].map(ele => ele.trim());
          if (!key) {
            // 缺少 key，则此行不是合法 property，不做处理
            return;
          }
          if (!value) {
            // 缺少 value property，不做处理
            return;
          }
          ev.preventDefault();
          const valueWithoutTrailingComma = value.endsWith(',')
            ? value.slice(0, value.length - 1)
            : value;
          const needConvertValue = (val: string) => {
            return (
              isNaN(Number(val)) &&
              !val.includes('[') &&
              !val.includes('{') &&
              !val.includes('"') &&
              !val.includes("'") &&
              val !== 'true' &&
              val !== 'false' &&
              val !== 'null' &&
              val !== 'undefined'
            );
          };
          const formattedValue = needConvertValue(valueWithoutTrailingComma)
            ? `"${valueWithoutTrailingComma}"`
            : valueWithoutTrailingComma;
          const formattedProperty =
            `${rowKey}: ${formattedValue},${comments ? ` ${comments}` : ''}` +
            `\n${Array(leadingWhiteSpace + 1).join(' ')}`;
          setCode(c => {
            nextTick(() => {
              textArea?.setSelectionRange(
                startPos + formattedProperty.length - currentLine.length,
                startPos + formattedProperty.length - currentLine.length,
              );
            });
            return [
              prefixOfLine,
              formattedProperty,
              c.slice(newLineStartIndex + currentLine.length),
            ].join('');
          });
        } catch (e) {
          // do nothing
        }
      }

      if (ev.code === 'Slash') {
        if (
          startPos === endPos &&
          (codeRef.current || '')[startPos - 1] === '/'
        ) {
          if ((codeRef.current || '')[startPos - 2] === ',') {
            ev.preventDefault();
            setCode(c => {
              nextTick(() => {
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
            nextTick(() => {
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
    const blurHandler = (ev: FocusEvent) => {
      // ev.persist();
      // const startPos = textArea?.selectionStart || 0;
      // const endPos = textArea?.selectionEnd || 0;
      // console.log('ev', ev, startPos, endPos)
      setCode(c =>
        c
          .split('\n')
          .filter(ele => !ele.split('').every(ele => ele === ' '))
          .join('\n'),
      );
    };
    textArea?.addEventListener('keydown', keyHandler);
    textArea?.addEventListener('blur', blurHandler);
    return () => {
      textArea?.removeEventListener('keydown', keyHandler);
      textArea?.removeEventListener('blur', blurHandler);
    };
  }, []);

  return (
    <div className={`json5-editor-wrapper ${props.className || ''}`.trim()}>
      <Editor
        ref={(r: any) => (textAreaRef.current = r?._input)}
        value={code}
        placeholder={props.placeholder}
        onValueChange={setCode}
        highlight={code => highlight(code, languages.json5, 'json5')}
        padding={8}
        style={{
          fontFamily: 'SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace',
          fontSize: 14,
          ...props.style,
        }}
      />
    </div>
  );
});
