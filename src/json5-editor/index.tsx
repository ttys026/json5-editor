import React, {
  forwardRef,
  memo,
  Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Editor from 'react-simple-code-editor';
import Prism, { highlight, languages } from 'prismjs';

import { fillWithIndent, fillAfter } from './utils/autoComplete';
import { activePairs, clearPairs } from './utils/match';
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

interface RefProps {
  editorRef: HTMLTextAreaElement | null;
  preRef: HTMLPreElement | null;
  value: string;
  onChange: React.Dispatch<React.SetStateAction<string>>;
}

export default memo(
  forwardRef((props: Props, ref: Ref<RefProps>) => {
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const preElementRef = useRef<HTMLPreElement | null>(null);
    const [code, setCode] = useState<string>(props.initialValue || '');
    const { value = '', onChange } = props;
    const skipNextOnchange = useRef(true);

    const codeRef = useRef(code);

    useImperativeHandle(ref, () => ({
      editorRef: textAreaRef.current,
      preRef: preElementRef.current,
      value: code,
      onChange: setCode,
    }));

    useEffect(() => {
      if ('value' in props) {
        setCode(value || '');
      }
      skipNextOnchange.current = true;
    }, [value || '']);

    useUpdateEffect(() => {
      Prism.hooks.run('before-insert', {});
      skipNextOnchange.current = false;
    }, [code || '']);

    useEffect(() => {
      if (onChange && !skipNextOnchange.current && code !== codeRef.current) {
        onChange(code);
      }
      codeRef.current = code;
    }, [code, onChange]);

    useEffect(() => {
      const textArea = textAreaRef.current!;
      const keyDownHandler = (ev: KeyboardEvent) => {
        const startPos = textArea?.selectionStart || 0;
        const endPos = textArea?.selectionEnd || 0;
        if (startPos !== endPos) {
          return;
        }

        if (ev.code === 'Enter' && !ev.isComposing) {
          // 如果选中了文字，则不做特殊处理
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
          if ((codeRef.current || '')[startPos - 1] === '/') {
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
        setCode(c =>
          c
            .split('\n')
            .filter(ele => !ele.split('').every(ele => ele === ' '))
            .join('\n'),
        );
      };
      const cursorChangeHanlder = () => {
        const startPos = textArea?.selectionStart || 0;
        const endPos = textArea?.selectionEnd || 0;
        if (Math.abs(startPos - endPos) > 1) {
          return;
        }
        clearPairs(preElementRef.current!);
        if (
          codeRef.current[startPos] === '{' ||
          codeRef.current[startPos] === '}' ||
          codeRef.current[startPos] === ']' ||
          codeRef.current[startPos] === '[' ||
          codeRef.current[startPos] === '(' ||
          codeRef.current[startPos] === ')'
        ) {
          activePairs(preElementRef.current!, startPos);
        } else if (
          codeRef.current[startPos - 1] === '{' ||
          codeRef.current[startPos - 1] === '}' ||
          codeRef.current[startPos - 1] === ']' ||
          codeRef.current[startPos - 1] === '[' ||
          codeRef.current[startPos - 1] === ')' ||
          codeRef.current[startPos - 1] === '('
        ) {
          activePairs(preElementRef.current!, startPos - 1);
        }
      };

      textArea?.addEventListener('keydown', keyDownHandler);
      textArea?.addEventListener('blur', blurHandler);
      textArea?.addEventListener('keyup', cursorChangeHanlder);
      textArea?.addEventListener('click', cursorChangeHanlder);
      return () => {
        textArea?.removeEventListener('keydown', keyDownHandler);
        textArea?.removeEventListener('blur', blurHandler);
        textArea?.removeEventListener('keyup', cursorChangeHanlder);
        textArea?.removeEventListener('click', cursorChangeHanlder);
      };
    }, []);

    return (
      <div className={`json5-editor-wrapper ${props.className || ''}`.trim()}>
        <Editor
          ref={(r: any) => {
            textAreaRef.current = r?._input;
            preElementRef.current = textAreaRef.current
              ?.nextElementSibling as HTMLPreElement;
          }}
          value={code}
          placeholder={props.placeholder}
          onValueChange={setCode}
          highlight={code => {
            setTimeout(() => {
              Prism.hooks.run('before-insert', {});
            });
            return highlight(code, languages.json5, 'json5');
          }}
          padding={8}
          style={{
            fontFamily:
              'SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace',
            fontSize: 14,
            ...props.style,
          }}
        />
      </div>
    );
  }),
);
