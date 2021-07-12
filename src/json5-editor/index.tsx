import React, { forwardRef, memo, Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { tokenize } from 'prismjs/components/prism-core';
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
import copy from 'copy-to-clipboard';
import { lex, afterTokenizeHook, tokenStreamToHtml } from './utils/prism';
import { addLineNumber, getCollapsedContent } from './utils/lineNumber';
import { Traverse, ValidateError } from './utils/format';
import './style.less';
import useWidth from './hooks/useWidth';
import useUpdateEffect from './hooks/useUpdateEffect';
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
    const [code = '', setCode] = useState<string>(props.value || props.initialValue || '');
    const shouldForbiddenEdit = props.disabled || props.readOnly || ('value' in props && !('onChange' in props));
    const tokensRef = useRef<(Prism.Token | string)[]>([]);
    const tokenLinesRef = useRef<(Prism.Token | string)[][]>([]);
    const previousKeyboardEvent = useRef<KeyboardEvent | null>(null);
    const container = useRef<HTMLDivElement>(null);
    const width = useWidth(container);
    const collapsedList = useRef<string[]>([]);
    const lock = useRef(false);
    const onChangeRef = useRef(props.onChange);
    onChangeRef.current = props.onChange;

    const codeRef = useRef(code);
    codeRef.current = code;

    const onCollapse = (newCode: string, collapsedCode: string, uuid: number) => {
      collapsedList.current[uuid] = collapsedCode;

      const tokens = tokenize(newCode, lex);
      const traverse = new Traverse(tokens);
      try {
        const fullTokens = tokenize(getExpandedCode(), lex);
        const fullTraverse = new Traverse(fullTokens);
        fullTraverse.validate({ mode: 'loose' });
        setFormatError(null);
      } catch (e) {
        setFormatError(e);
      }

      setCode(traverse.format());
    };

    useUpdateEffect(() => {
      if (onChangeRef.current) {
        const formatted = getExpandedCode();
        onChangeRef.current(formatted);
      }
    }, [code]);

    const getExpandedCode = (code: string = codeRef.current) => {
      let newCode = code.replace(/(\{┉\}\u200c*)|(\[┉\]\u200c*)/g, (match) => {
        const count = match.length - 3;
        return collapsedList.current[count] || match;
      });
      if (/(\{┉\}\u200c*)|(\[┉\]\u200c*)/g.test(newCode)) {
        newCode = getExpandedCode(newCode);
      }
      return newCode;
    };

    const onExpand = (uuid: number) => {
      const newCode = codeRef.current.replace(/(\{┉\}\u200c*)|(\[┉\]\u200c*)/g, (match) => {
        const count = match.length - 3;
        return count === uuid ? collapsedList.current[uuid] : match;
      });

      const tokens = tokenize(newCode, lex);
      const traverse = new Traverse(tokens);
      try {
        const fullTokens = tokenize(getExpandedCode(), lex);
        const fullTraverse = new Traverse(fullTokens);
        fullTraverse.validate({ mode: 'loose' });
        setFormatError(null);
      } catch (e) {
        setFormatError(e);
      }

      setCode(traverse.format());
    };

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
        value: getExpandedCode(),
        onChange: setCode,
        format,
      }),
      [],
    );

    useEffect(() => {
      const textArea = textAreaRef.current!;

      const onPaste = (e: ClipboardEvent) => {
        e.preventDefault();
        const clipboardData = e.clipboardData;
        let pastedData = clipboardData?.getData('Text') || '';
        const startPos = textArea?.selectionStart || 0;
        const { leadingWhiteSpace } = getLinesByPos(codeRef.current, startPos);
        pastedData = pastedData
          .split('\n')
          .map((line, index) => {
            if (index === 0) {
              return line;
            }
            return `${generateWhiteSpace(leadingWhiteSpace)}${line}`;
          })
          .join('\n');
        insertText(pastedData);
      };

      const onCopy = (e: ClipboardEvent) => {
        const startPos = textArea?.selectionStart || 0;
        const endPos = textArea?.selectionEnd || 0;
        const selected = codeRef.current.slice(startPos, endPos);
        const content = getCollapsedContent(collapsedList.current, selected);
        if (/(\{┉\}\u200c*)|(\[┉\]\u200c*)/g.test(content)) {
          e.preventDefault();
          copy(new Traverse(tokenize(content, lex)).format());
        }
      };

      const onCut = (e: ClipboardEvent) => {
        const startPos = textArea?.selectionStart || 0;
        const endPos = textArea?.selectionEnd || 0;
        const newText = codeRef.current.slice(0, startPos).concat(codeRef.current.slice(endPos));
        const selected = codeRef.current.slice(startPos, endPos);
        const content = getCollapsedContent(collapsedList.current, selected);
        if (/(\{┉\}\u200c*)|(\[┉\]\u200c*)/g.test(content)) {
          e.preventDefault();
          copy(new Traverse(tokenize(content, lex)).format());
          setCode(newText);
          textArea?.setSelectionRange(startPos, startPos);
        }
      };

      const onMouseDown = () => {
        lock.current = true;
      };

      const onMouseUp = () => {
        lock.current = false;
      };

      // special char key down
      const keyDownHandler = (ev: KeyboardEvent) => {
        if (lock.current) {
          ev.preventDefault();
          return;
        }

        const textArea = textAreaRef.current!;
        const startPos = textArea?.selectionStart || 0;
        const endPos = textArea?.selectionEnd || 0;
        if (ev.code === 'Backspace') {
          const index = getCurrentTokenIndex(tokensRef.current, startPos);
          const currentToken = tokensRef.current[index];
          if (isToken(currentToken) && currentToken.type === 'collapse') {
            ev.preventDefault();
            const tokens = getTokensOfCurrentLine(tokensRef.current, startPos);
            const collapse = tokens.find((tok) => isToken(tok) && tok.type === 'collapse');
            const uuid = (collapse?.length || 3) - 3;
            onExpand(uuid);
            textArea.setSelectionRange(startPos - collapsedList.current.length, endPos - collapsedList.current.length);
          }
        }
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
          const fullTokens = tokenize(getExpandedCode(), lex);
          const fullTraverse = new Traverse(fullTokens);
          fullTraverse.validate({ mode: 'loose' });
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
        let startPos = textArea?.selectionStart || 0;
        let endPos = textArea?.selectionEnd || 0;
        lock.current = false;
        requestAnimationFrame(() => {
          startPos = textArea?.selectionStart || 0;
          endPos = textArea?.selectionEnd || 0;
          if (codeRef.current[startPos] === '┉' && codeRef.current[endPos] === '┉') {
            const tokens = getTokensOfCurrentLine(tokensRef.current, startPos);
            const collapse = tokens.find((tok) => isToken(tok) && tok.type === 'collapse');
            const uuid = (collapse?.length || 3) - 3;
            onExpand(uuid);
            textArea.setSelectionRange(startPos, endPos);
          }
          if (['}', ']'].includes(codeRef.current[startPos]) && ['}', ']'].includes(codeRef.current[endPos]) && codeRef.current[startPos - 1] === '┉') {
            const tokens = getTokensOfCurrentLine(tokensRef.current, startPos);
            const collapse = tokens.find((tok) => isToken(tok) && tok.type === 'collapse');
            const uuid = (collapse?.length || 3) - 3;
            onExpand(uuid);
            textArea.setSelectionRange(startPos, endPos);
          }

          if (startPos !== endPos) {
            const startIndex = getCurrentTokenIndex(tokensRef.current, startPos);
            const endIndex = getCurrentTokenIndex(tokensRef.current, endPos);
            const startToken = tokensRef.current[startIndex];
            const endToken = tokensRef.current[endIndex];
            if ((isToken(startToken) && startToken.type === 'collapse') || (isToken(endToken) && endToken.type === 'collapse')) {
              if (endPos - startPos >= endToken.length && !['}', ']', '┉'].includes(codeRef.current[endPos])) {
                return;
              }
              const collapse = isToken(startToken) && startToken.type === 'collapse' ? startToken : endToken;
              const uuid = (collapse?.length || 3) - 3;
              onExpand(uuid);
              textArea.setSelectionRange(startPos, startPos);
            }
          }
        });

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

      textArea?.addEventListener('paste', onPaste);
      textArea?.addEventListener('copy', onCopy);
      textArea?.addEventListener('cut', onCut);
      textArea?.addEventListener('mousedown', onMouseDown);
      textArea?.addEventListener('mouseup', onMouseUp);
      textArea?.addEventListener('keydown', keyDownHandler);
      textArea?.addEventListener('blur', blurHandler);
      textArea?.addEventListener('focus', focusHandler);
      textArea?.addEventListener('select', cursorChangeHanlder);
      textArea?.addEventListener('keyup', cursorChangeHanlder);
      textArea?.addEventListener('click', cursorChangeHanlder);
      return () => {
        // 卸载 hook
        textArea?.removeEventListener('paste', onPaste);
        textArea?.removeEventListener('copy', onCopy);
        textArea?.removeEventListener('cut', onCut);
        textArea?.removeEventListener('mousedown', onMouseDown);
        textArea?.removeEventListener('mouseup', onMouseUp);
        textArea?.removeEventListener('keydown', keyDownHandler);
        textArea?.removeEventListener('blur', blurHandler);
        textArea?.removeEventListener('focus', focusHandler);
        textArea?.removeEventListener('select', cursorChangeHanlder);
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
          addLineNumber(
            {
              ...env,
              code: codeRef.current!,
              collapsedList: collapsedList.current,
              tokens: tokensRef.current!,
            },
            onCollapse,
            onExpand,
          );
        }, 32);
      }
    };

    const highlight = (code: string) => {
      const env: RootEnv = {
        code,
        collapsedList: collapsedList.current,
        grammar: lex,
        language: 'json5',
        tokens: [],
        element: container.current!,
        error: formatError,
      };
      env.tokens = tokenize(code, lex);
      afterTokenizeHook(env);
      env.tokenLines = markErrorToken(env.tokens, formatError);
      tokenLinesRef.current = env.tokenLines;
      env.fullTokens = getExpandedCode();
      const htmlString = tokenStreamToHtml(env.tokens, env.language!);
      autoFill(env);
      if (props.showLineNumber) {
        addLineNumber(env, onCollapse, onExpand);
      }
      tokensRef.current = env.tokens;
      return htmlString;
    };

    useEffect(() => {
      highlight(codeRef.current);
    }, [width]);

    return (
      <div
        ref={container}
        style={{ maxHeight: 600 }}
        className={classNames('json5-editor-wrapper', Boolean(formatError) ? 'json5-editor-wrapper-has-error' : '', props.className, props.disabled ? 'json5-editor-wrapper-disabled' : '')}
      >
        {props.showLineNumber && <div className="line-numbers-rows" />}
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
