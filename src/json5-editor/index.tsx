import React, {
  forwardRef,
  memo,
  Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import Editor from 'react-simple-code-editor';
import Prism, { highlight, languages, Token } from 'prismjs';

import { fillWithIndent, fillAfter } from './utils/autoComplete';
import { activePairs, clearPairs } from './utils/match';
import { getTokens, registerPlugin, unRegisterPlugin } from './utils/prism';
import { nextTick } from './utils/nextTick';
import useUpdateEffect from './hooks/useUpdateEffect';
import './style.less';
import prettier from 'prettier/standalone';
import parserBabel from './utils/parser-babel';
import { endList, startList } from './constant';

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

const clearObjPathCache = (uid: symbol) => {
  Prism.hooks.run('before-insert', {
    language: (uid as unknown) as string,
  });
};

export default memo(
  forwardRef((props: Props, ref: Ref<RefProps>) => {
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const preElementRef = useRef<HTMLPreElement | null>(null);
    const [code, setCode] = useState<string>(props.initialValue || '');
    const { value = '', onChange } = props;
    const skipNextOnchange = useRef(true);
    // 支持多例，隔离 prism hook 间影响
    const editorUid = useRef(Symbol());

    const codeRef = useRef(code);

    useImperativeHandle(ref, () => ({
      editorRef: textAreaRef.current,
      preRef: preElementRef.current,
      value: code,
      onChange: setCode,
    }));

    useMemo(() => {
      // 确保首次调用 highligh 时就能触发 hook
      registerPlugin(editorUid.current);
    }, []);

    useEffect(() => {
      if ('value' in props) {
        setCode(value || '');
        clearObjPathCache(editorUid.current);
      }
      skipNextOnchange.current = true;
    }, [value || '']);

    useUpdateEffect(() => {
      // cast to wrong type to keep each editor unique
      clearObjPathCache(editorUid.current);
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
      // special char key down
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
                !val.includes('|') &&
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

        if (ev.key === '|') {
          ev.preventDefault();
          window.requestAnimationFrame(() => {
            document.execCommand(
              'insertText',
              false,
              `${codeRef.current[startPos - 1] === ' ' ? '' : ' '}| `,
            );
          });
        }

        if (ev.key === '"') {
          fillAfter(textArea, '"');
        }
        if (ev.key === "'") {
          fillAfter(textArea, "'");
        }
      };
      // format on blue
      const blurHandler = () => {
        clearPairs(preElementRef.current!);

        const prevTokens = getTokens(editorUid.current);

        const getFormattedLine = (
          queue: Token[],
          value: string,
          index: number,
        ) => {
          if (index < 0) {
            return value;
          }
          const trimed = value.trim();
          const next = queue[index + 1];
          if (
            (next?.type === 'comment' ||
              next?.type === 'punctuation' ||
              (typeof next === 'string' && !(next as string).trim())) &&
            trimed
          ) {
            return `"${trimed}"`;
          }
          if (trimed) {
            return `"${trimed}",\n`;
          }
          return value;
        };

        const tokens =
          prevTokens?.reduce<Token[]>((acc, ele) => {
            const prev = acc[acc.length - 1];
            if (
              prev?.type === 'number' &&
              ((typeof ele === 'string' && (ele as string).trim()) ||
                ele.type === 'unknown')
            ) {
              return [
                ...acc.slice(0, acc.length - 1),
                (`${prev.content}${
                  typeof ele === 'string' ? ele : ele.content
                }` as unknown) as Token,
              ];
            }
            return [...acc, ele];
          }, []) || [];

        const getTokenStr = (tk: Token, index: number): string => {
          if (typeof tk === 'string') {
            return getFormattedLine(tokens, tk, index);
          }
          if (tk.type === 'unknown') {
            return getFormattedLine(tokens, tk.content as string, index);
          }
          if (Array.isArray(tk.content)) {
            return tk.content
              .map(ele => getTokenStr(ele as Token, -1))
              .join('');
          }
          return tk.content as string;
        };

        const tokenGeneratedCode = tokens
          .map((ele, index) => getTokenStr(ele, index))
          .join('');

        let formatted = tokenGeneratedCode;
        try {
          formatted = prettier.format(formatted!, {
            parser: 'json5',
            quoteProps: 'preserve',
            bracketSpacing: true,
            plugins: [parserBabel as any],
          });
        } catch (e) {
          // don't format
          if (process.env.NODE_ENV === 'development') {
            console.log(e);
          }
        }
        const emptyLinesRemoved = formatted!
          .split('\n')
          .filter(ele => !ele.split('').every(ele => ele === ' '))
          .join('\n');
        setCode(
          emptyLinesRemoved.endsWith(',')
            ? emptyLinesRemoved.slice(0, emptyLinesRemoved.length - 1)
            : emptyLinesRemoved,
        );
      };
      // highlight active braces
      const cursorChangeHanlder = () => {
        const startPos = textArea?.selectionStart || 0;
        const endPos = textArea?.selectionEnd || 0;
        clearPairs(preElementRef.current!);
        if (Math.abs(startPos - endPos) > 1) {
          return;
        }
        if (
          codeRef.current
            .slice(startPos)
            .split('')
            .filter(ele => ele === '"').length %
            2 ===
          1
        ) {
          return;
        }
        if (
          codeRef.current
            .slice(startPos)
            .split('')
            .filter(ele => ele === "'").length %
            2 ===
          1
        ) {
          return;
        }
        if (startList.includes(codeRef.current[startPos])) {
          activePairs(preElementRef.current!, startPos);
        } else if (startList.includes(codeRef.current[startPos - 1])) {
          activePairs(preElementRef.current!, startPos - 1);
        } else if (endList.includes(codeRef.current[endPos - 1])) {
          activePairs(preElementRef.current!, endPos - 1);
        } else if (endList.includes(codeRef.current[endPos])) {
          activePairs(preElementRef.current!, endPos);
        }
      };

      textArea?.addEventListener('keydown', keyDownHandler);
      textArea?.addEventListener('blur', blurHandler);
      textArea?.addEventListener('keyup', cursorChangeHanlder);
      textArea?.addEventListener('click', cursorChangeHanlder);
      return () => {
        // 卸载 hook
        unRegisterPlugin(editorUid.current);
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
              clearObjPathCache(editorUid.current);
            });
            // HACK: highlight 的 ts 类型是 string，但传递 symbol 作为 editor 的唯一 id，此处 cast 为一个错误类型，但是有意为之
            return highlight(
              code,
              languages.json5,
              (editorUid.current as unknown) as string,
            );
          }}
          padding={8}
          style={{
            fontFamily:
              'SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace',
            fontSize: 14,
            lineHeight: 1.5,
            ...props.style,
          }}
        />
      </div>
    );
  }),
);
