import React, { forwardRef, memo, Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { tokenize, util } from 'prismjs/components/prism-core';
import classNames from 'classnames';
// TODO: need fork react-simple-code-editor's code to disable auto complete
// @ts-expect-error
import Editor from './Editor';
import { endList, startList } from './constant';
import {
  getLinesByPos,
  insertText,
  generateWhiteSpace,
  getTokensOfCurrentLine,
  getCurrentTokenIndex,
  isToken,
  getTokenContent,
  tokenContentEquals,
  getLengthOfToken,
  markErrorToken,
} from './utils/autoComplete';
import { activePairs, clearPairs } from './utils/match';
import { lex, afterTokenizeHook, tokenStreamToHtml } from './utils/prism';
import { addLineNumber } from './utils/lineNumber';
import { Traverse, ValidateError } from './utils/format';
import useControllableValue from './hooks/useControllableValue';
import './style.less';
export interface Props {
  initialValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  showLineNumber?: boolean;
}

export interface RefProps {
  editorRef: HTMLTextAreaElement | null;
  preRef: HTMLPreElement | null;
  value: string;
  onChange: React.Dispatch<React.SetStateAction<string>>;
  format: () => void;
}

export type RootEnv = Prism.Environment & { tokens: (Prism.Token | string)[]; code: string; element: HTMLDivElement };

export const formatJSON5 = (code: string) => {
  const tokens = tokenize(code, lex);
  const traverse = new Traverse(tokens);
  traverse.format();
  return traverse.getString();
};

export default memo(
  forwardRef((props: Props, ref: Ref<RefProps>) => {
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const preElementRef = useRef<HTMLPreElement | null>(null);
    const [formatError, setFormatError] = useState<ValidateError | null>(null);
    const [code = '', setCode] = useControllableValue<string>(props);
    const shouldForbiddenEdit = props.disabled || props.readOnly || ('value' in props && !('onChange' in props));
    const tokensRef = useRef<(Prism.Token | string)[]>([]);
    const previousKeyboardEvent = useRef<KeyboardEvent | null>(null);
    const container = useRef<HTMLDivElement>(null);
    const isFirstMount = useRef(true);

    const codeRef = useRef(code);
    codeRef.current = code;

    useEffect(() => {
      if (shouldForbiddenEdit) {
        textAreaRef.current!.style.pointerEvents = 'none';
        textAreaRef.current!.style.userSelect = 'none';
        textAreaRef.current?.setAttribute('tabIndex', '-1');

        preElementRef.current!.style.removeProperty('user-select');
        preElementRef.current!.style.removeProperty('pointer-events');
      } else {
        preElementRef.current!.style.userSelect = 'none';
        preElementRef.current!.style.pointerEvents = 'none';

        textAreaRef.current!.style.removeProperty('pointer-events');
        textAreaRef.current!.style.removeProperty('user-select');
        textAreaRef.current?.removeAttribute('tabIndex');
      }
    }, [shouldForbiddenEdit]);

    const format = useCallback(() => {
      textAreaRef.current?.dispatchEvent(new Event('blur'));
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        editorRef: textAreaRef.current,
        preRef: preElementRef.current,
        value: codeRef.current,
        onChange: setCode,
        format,
      }),
      [],
    );

    useEffect(() => {
      const textArea = textAreaRef.current!;
      // special char key down
      const keyDownHandler = (ev: KeyboardEvent) => {
        previousKeyboardEvent.current = ev;
      };
      // format on blur
      const blurHandler = (ev: FocusEvent) => {
        clearPairs(preElementRef.current!);
        const prevTokens = tokensRef.current;
        const traverse = new Traverse(prevTokens);
        traverse.format();
        const str = traverse.getString();
        setCode(str);
        try {
          traverse.validate({ mode: 'loose' });
          setFormatError(null);
        } catch (e) {
          setFormatError(e);
          if (process.env.NODE_ENV === 'development') {
            console.log(e);
          }
        }
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
            .filter((ele) => ele === '"').length %
            2 ===
          1
        ) {
          return;
        }
        if (
          codeRef.current
            .slice(startPos)
            .split('')
            .filter((ele) => ele === "'").length %
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

      const focusHandler = () => {
        setFormatError(null);
      };

      textArea?.addEventListener('keydown', keyDownHandler);
      textArea?.addEventListener('blur', blurHandler);
      textArea?.addEventListener('focus', focusHandler);
      textArea?.addEventListener('keyup', cursorChangeHanlder);
      textArea?.addEventListener('click', cursorChangeHanlder);
      return () => {
        // 卸载 hook
        textArea?.removeEventListener('keydown', keyDownHandler);
        textArea?.removeEventListener('blur', blurHandler);
        textArea?.removeEventListener('focus', focusHandler);
        textArea?.removeEventListener('keyup', cursorChangeHanlder);
        textArea?.removeEventListener('click', cursorChangeHanlder);
      };
    }, []);

    const autoFill = (env: RootEnv) => {
      const textArea = textAreaRef.current!;
      const startPos = textArea?.selectionStart || 0;
      const endPos = textArea?.selectionEnd || 0;
      if (startPos !== endPos) {
        return;
      }
      const ev = previousKeyboardEvent.current;
      previousKeyboardEvent.current = null;
      const tokenIndex = getCurrentTokenIndex(env.tokens, startPos);
      const current = env.tokens[tokenIndex];

      outer: switch (true) {
        case ev?.code === 'Enter' && !ev?.isComposing: {
          const pairs = [
            ['{', '}'],
            ['[', ']'],
            ['(', ')'],
          ];
          inner: for (let [start, end] of pairs) {
            let previousList = getTokensOfCurrentLine(env.tokens, startPos - 1);
            previousList = previousList.filter((tok) => getTokenContent(tok).trim() && isToken(tok) && tok.type !== 'comment');
            const lastToken = previousList.pop();
            if (tokenContentEquals(lastToken, start)) {
              requestAnimationFrame(() => {
                const { leadingWhiteSpace } = getLinesByPos(codeRef.current, startPos);
                const codeArray = codeRef.current.split('');
                // start count !== end count, then append
                const needFill = codeArray.filter((ele) => ele === start).length !== codeArray.filter((ele) => ele === end).length;
                if (needFill) {
                  insertText(`${generateWhiteSpace(leadingWhiteSpace + 2)}\n${generateWhiteSpace(leadingWhiteSpace)}${end}`);
                  textArea?.setSelectionRange(startPos + leadingWhiteSpace + 2, startPos + leadingWhiteSpace + 2);
                } else {
                  const currentStr = codeRef.current.split('')[startPos];
                  const nextStr = codeRef.current.split('')[startPos + 1];
                  if (currentStr === end && [undefined, '\n'].includes(nextStr)) {
                    insertText(`${generateWhiteSpace(leadingWhiteSpace + 2)}\n${generateWhiteSpace(leadingWhiteSpace)}`);
                    textArea?.setSelectionRange(textArea?.selectionStart - 1 - leadingWhiteSpace, textArea?.selectionStart - 1 - leadingWhiteSpace);
                  } else {
                    insertText(`${generateWhiteSpace(leadingWhiteSpace + 2)}`);
                  }
                }
              });
              break outer;
            }
          }

          // general case, add same indent space as previous line
          requestAnimationFrame(() => {
            const { leadingWhiteSpace } = getLinesByPos(codeRef.current, startPos);
            const fullList = getTokensOfCurrentLine(env.tokens, startPos - 1);

            const tokenList = fullList.filter((ele) => isToken(ele) && ele.type !== 'comment' && getTokenContent(ele).trim());
            const whiteSpace = generateWhiteSpace(leadingWhiteSpace);

            if (tokenList.length === 0) {
              insertText(whiteSpace);
              return;
            }

            const fullListLength = getLengthOfToken(fullList);
            const formatted = new Traverse(fullList, { type: 'segment' }).format();

            textArea?.setSelectionRange(startPos - fullListLength - 1, startPos);

            const lines = formatted.split('\n');
            const insert = lines.map((line) => `${whiteSpace}${line}`).join('\n');
            insertText(`${insert}\n${whiteSpace}`);
          });
          break;
        }
        case ev?.key === ':' && tokenContentEquals(current, ':'): {
          requestAnimationFrame(() => {
            const line = getTokensOfCurrentLine(tokensRef.current, startPos).filter((tok) => getTokenContent(tok).trim());
            if (line.length === 2 && isToken(line[0]) && line[0].type === 'property') {
              insertText(' ');
            }
            return;
          });
          break;
        }
        case ev?.key === '/' && isToken(current) && current.type === 'comment' && tokenContentEquals(current, '//'): {
          requestAnimationFrame(() => {
            let { leadingWhiteSpace } = getLinesByPos(codeRef.current, startPos);
            const fullList = getTokensOfCurrentLine(env.tokens, startPos);
            const fullListLength = getLengthOfToken(fullList);
            const previousList = getTokensOfCurrentLine(env.tokens, startPos - fullListLength - 1);
            leadingWhiteSpace = previousList.some((tok) => isToken(tok) && tokenContentEquals(tok, '{')) && startPos !== fullListLength ? leadingWhiteSpace + 2 : leadingWhiteSpace;
            const formatted = new Traverse(fullList, { type: 'segment' }).format();
            textArea?.setSelectionRange(startPos - fullListLength, startPos);
            const whiteSpace = generateWhiteSpace(leadingWhiteSpace);
            insertText(`${whiteSpace}${formatted} `);
          });
          break;
        }
        case ev?.key === '|' && isToken(current) && tokenContentEquals(current, '|'): {
          requestAnimationFrame(() => {
            textArea?.setSelectionRange(startPos - 1, startPos);
            insertText(' | ');
          });
          break;
        }
        default: {
          // do nothing, your code is perfect and has nothing to format
        }
      }

      if (props.showLineNumber) {
        setTimeout(() => {
          addLineNumber({
            ...env,
            code: codeRef.current!,
            tokens: tokensRef.current!,
          });
        }, 32);
      }
    };

    const highlight = (code: string) => {
      const env: RootEnv = {
        code,
        grammar: lex,
        language: 'json5',
        tokens: [],
        element: container.current!,
        error: formatError,
      };
      env.tokens = tokenize(code, lex);
      afterTokenizeHook(env);
      markErrorToken(env.tokens, formatError);
      const htmlString = tokenStreamToHtml(env.tokens, env.language!);
      autoFill(env);
      if (props.showLineNumber) {
        addLineNumber(env);
      }
      tokensRef.current = env.tokens;
      return htmlString;
    };

    return (
      <div
        ref={container}
        style={{ maxHeight: 600 }}
        className={classNames('json5-editor-wrapper', Boolean(formatError) ? 'json5-editor-wrapper-has-error' : '', props.className, props.disabled ? 'json5-editor-wrapper-disabled' : '')}
      >
        <div className="line-numbers-rows" />
        <Editor
          ref={(r: any) => {
            textAreaRef.current = r?._input;
            preElementRef.current = textAreaRef.current?.nextElementSibling as HTMLPreElement;
          }}
          value={code}
          disabled={shouldForbiddenEdit}
          placeholder={props.placeholder}
          onValueChange={setCode}
          highlight={(code: string) => {
            if (isFirstMount.current) {
              isFirstMount.current = false;
              requestAnimationFrame(() => highlight(code));
            }
            return highlight(code);
          }}
          padding={8}
          style={{
            flex: 1,
            height: '100%',
            fontFamily: 'SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace',
            fontSize: 14,
            lineHeight: 1.5,
            ...props.style,
          }}
        />
      </div>
    );
  }),
);
