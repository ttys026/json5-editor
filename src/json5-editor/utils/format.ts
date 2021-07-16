import type { Token, TokenStream } from 'prismjs';
import { FormatConfig } from '..';
import { startList, endList, defaultConfig } from '../constant';

type CookedToken = Token & { index: number; lineNo?: number; columnNo?: number };

export class ValidateError extends Error {
  public lineNo: string;
  public columnNo: string;
  public token: Token;
  private extraMessage: string;

  constructor({ token, message }: { token: CookedToken; message?: string }) {
    super();
    this.lineNo = String(token.lineNo || 'unknown');
    this.columnNo = String(token.columnNo || 'unknown');
    this.token = token;
    this.extraMessage = message || '';
    this.message = this.toString();
  }
  toString() {
    return `Invalid JSON5: @ line: ${this.lineNo}, column: ${this.columnNo}, invalid token: ${this.token.content}${this.extraMessage ? `, ${this.extraMessage}` : ''}`;
  }
}

export class Traverse {
  private rawTokens: (Token | string)[];
  private cookedTokens: Array<CookedToken> = [];
  private lineNo = 0;
  private columnNo = 0;
  // 2d array of tokens in each line;
  private lines: Array<Array<CookedToken>> = [];
  private leadingSpace = 0;
  private currentIndex = 0;
  private output = '';
  private indentSize = 2;
  private valueTypes = ['string', 'number', 'boolean', 'null', 'unknown', 'collapse'];
  private config: FormatConfig = defaultConfig;

  constructor(tokens: (Token | string)[], config?: FormatConfig) {
    if (config) {
      this.config = { ...defaultConfig, ...config };
    }
    this.rawTokens = tokens;
    this.cookTokens();
  }

  /**
   * transform raw tokens to intermediate tokens that can generate the formatted code
   */
  protected cookTokens() {
    // transform unknown string to token, and then save raw tokens just in case we may need it.
    const tokens = this.rawTokens
      .map((ele) => {
        if (typeof ele === 'string') {
          const content = ele.trim();
          return {
            content,
            length: content.length,
            type: 'unknown',
          } as Token;
        }
        if (ele.type === 'property') {
          const needWrap = typeof ele.content === 'string' && !ele.content.startsWith('"') && !ele.content.startsWith("'");
          const needReplace = typeof ele.content === 'string' && ele.content.startsWith("'");
          let newContent = ele.content as string;
          switch (this.config.propertyQuotes) {
            case 'double': {
              if (needWrap) {
                newContent = `"${newContent}"`;
              }
              if (needReplace) {
                newContent = `"${newContent.slice(1, newContent.length - 1)}"`;
              }
              return { ...ele, content: newContent, length: newContent.length };
            }
            case 'single': {
              if (needWrap) {
                newContent = `'${newContent}'`;
              }
              if (needReplace) {
                newContent = `'${newContent.slice(1, newContent.length - 1)}'`;
              }
              return { ...ele, content: newContent, length: newContent.length };
            }
            default: {
              return ele;
            }
          }
        }
        return ele;
      })
      .filter((ele) => ele.length !== 0);

    // combine adjutant number and unknown token to string
    const raw: Token[] = [];
    let skipNext = false;
    tokens.forEach((tok, index) => {
      const next = tokens[index + 1];
      if (tok.type === 'number' && next && next.type === 'unknown') {
        raw.push({
          ...tok,
          type: 'string',
          content: `"${tok.content}${next.content}"`,
          length: tok.content.length + next.content.length + 2,
        });
        skipNext = true;
      } else {
        if (skipNext) {
          skipNext = false;
        } else {
          raw.push(tok);
        }
      }
    });

    // filter empty spaces and commas to do better format
    this.cookedTokens = raw
      .filter(
        (ele) =>
          // filter out empty space
          !(ele.type === 'unknown' && this.resolveTokenContent(ele.content).trim() === '') &&
          // consequential space will become indent
          (ele as Token).type !== 'indent' &&
          (ele as Token).type !== 'leading' &&
          // filter out commas, we will add it back later
          (ele as Token).content !== ',',
      )
      // add index for each token
      .map((ele, index) => ({ ...ele, index }));
  }

  /**
   * check if this is an object property line
   * @param line tokens in that line
   * @returns whether this line is a valid object property
   */
  protected isPropertyLine(line: Token[]) {
    return line[0]?.type === 'property' && line[1].content === ':';
  }

  /**
   * generate leading spce of current line
   * @returns leading space string
   */
  protected getLeadingSpace() {
    const space = Math.max(this.leadingSpace + 1, 1);
    return Array(space).join(' ');
  }

  /**
   * resolve possibly nested token content
   * @param content the TokenStream type of content
   * @returns the string type of content
   */
  protected resolveTokenContent(content: TokenStream): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((ele) => {
          this.resolveTokenContent(ele);
        })
        .join('');
    }
    return this.resolveTokenContent(content.content);
  }

  /**
   * add tokens into their lines one by one
   */
  protected addTokenToCurrentLine() {
    const currentToken = this.cookedTokens[this.currentIndex];
    try {
      this.lines[this.lineNo].push(currentToken);
    } catch (e) {
      this.lines[this.lineNo] = [currentToken];
    }
  }

  /**
   * start a new line with appropriate indent size
   * @param indent
   * - increase for 'add indent size',
   * - decrease for 'minus indent size',
   * - undefined for 'keep the same indent size'
   */
  protected addNewLine(indent?: 'increase' | 'decrease') {
    if (indent === 'increase') {
      this.leadingSpace += this.indentSize;
    } else if (indent === 'decrease') {
      this.leadingSpace -= this.indentSize;
    }
    this.lineNo += 1;
    this.output += '\n';
    // clear columnNo
    this.columnNo = this.leadingSpace;
    this.output += this.getLeadingSpace();
  }

  /**
   * find the next token
   * @param skipWhitespace whether linebreaks count as tokens
   * @returns next token
   */
  protected lookAhead(skipWhitespace?: boolean) {
    if (this.currentIndex >= this.cookedTokens.length - 1) {
      return undefined;
    }
    if (skipWhitespace) {
      return this.cookedTokens.slice(this.currentIndex + 1).find((tok) => {
        return tok.type !== 'linebreak';
      });
    }
    return this.cookedTokens[this.currentIndex + 1];
  }

  /**
   * find the previous token
   * @param skipWhitespace whether linebreaks count as tokens
   * @returns previous token
   */
  protected lookBehind(skipWhitespace?: boolean) {
    if (this.currentIndex <= 0) {
      return undefined;
    }
    if (skipWhitespace) {
      for (let i = this.currentIndex - 1; i >= 0; i--) {
        if (this.cookedTokens[i].type !== 'linebreak') {
          return this.cookedTokens[i];
        }
      }
      return undefined;
    }
    return this.cookedTokens[this.currentIndex - 1];
  }

  /**
   * look several tokens ahead
   * @param param
   * @returns array of tokens ahead
   */
  protected lookAheadDeep(param: { skipWhitespace?: boolean; deepth: number }) {
    let remain = param.deepth || 1;
    const ret = [];
    const currentIndex = this.currentIndex;
    while (remain > 0) {
      const behind = this.lookAhead(param.skipWhitespace);
      if (behind) {
        ret.push(behind);
        this.currentIndex = behind?.index;
        remain -= 1;
      } else {
        remain = 0;
      }
    }
    this.currentIndex = currentIndex;
    return ret;
  }

  /**
   * look several tokens behind (currently not used)
   * @param param
   * @returns array of tokens behind
   */
  protected lookBehindDeep(param: { skipWhitespace?: boolean; deepth: number }) {
    let remain = param.deepth || 1;
    const ret = [];
    const currentIndex = this.currentIndex;
    while (remain > 0) {
      const behind = this.lookBehind(param.skipWhitespace);
      if (behind) {
        ret.unshift(behind);
        this.currentIndex = behind?.index;
        remain -= 1;
      } else {
        remain = 0;
      }
    }
    this.currentIndex = currentIndex;
    return ret;
  }

  /**
   * get string value of previous line (currently not used)
   * @returns string value of previous line
   */
  protected getOnelineBehind() {
    const endIndex = this.output.lastIndexOf('\n');
    const lineStartIndex = this.output.lastIndexOf('\n', endIndex - 1);
    const startIndex = ~lineStartIndex ? lineStartIndex : 0;
    if (~endIndex && ~startIndex) {
      return this.output.slice(startIndex, endIndex);
    }
    return '';
  }

  /**
   * only append comma if necessary
   */
  protected appendComma() {
    // get 2 tokens ahead of comma
    const [ahead, ahead2] = this.lookAheadDeep({ deepth: 2, skipWhitespace: true });
    if (ahead) {
      let next = this.resolveTokenContent(ahead.content);
      if (ahead.type === 'comment' && ahead2) {
        next = this.resolveTokenContent(ahead2.content);
      }
      // remove comma of last item in object and array.
      if (!['}', ']', '|', '(', ')'].includes(next)) {
        this.output += ',';
      }
      // add new line when start a new property/item in object/array,
      if (['{', '['].includes(ahead.content as string) || this.valueTypes.includes(ahead.type)) {
        this.addNewLine();
      }
    }
    if (this.config.type === 'segment' && !ahead) {
      this.output += ',';
    }
  }

  /**
   * write columnNo and lineNo back to each token
   */
  protected updateToken() {
    this.cookedTokens[this.currentIndex].lineNo = this.lineNo + 1;
    this.cookedTokens[this.currentIndex].columnNo = this.columnNo + 1;
  }

  /**
   * commit the string concatenation inside the function to correctly calculate appended string length
   * @param fn the action
   */
  protected commitOutputTransaction(fn: () => void) {
    const tempLength = this.output.length;
    const tempLineNo = this.lineNo;
    this.updateToken();
    fn();
    const deltaLength = this.output.length - tempLength;
    if (this.lineNo === tempLineNo) {
      this.columnNo += deltaLength;
    }
  }

  /**
   * validate JSON5
   * @param param.mode 'strict' | 'loose'
   * default value 'strict'.
   * in 'loose' mode, values of "enum" type are supported, it is not a primative type in standard JSON5 format.
   */
  public validate(param?: { mode: 'strict' | 'loose' }) {
    if (!this.output) {
      this.format();
    }
    const { mode = 'strict' } = param || {};
    const { lines } = this;
    let deepth = 0;
    let parentPunctuations: typeof lines[0] = [];
    outer: for (let i = 0; i < lines.length; i++) {
      const line = this.lines[i] || [];
      // valid line
      inner: for (let column = 0; column < line.length; column++) {
        const token = line[column];
        // const columnNo = token +
        condition: switch (true) {
          case this.resolveTokenContent(token.content) === '{': {
            deepth += 1;
            const previousPunctuation = parentPunctuations[parentPunctuations.length - 1];
            if (previousPunctuation?.content === '{' && this.isPropertyLine(line) && column === 2) {
              parentPunctuations.push(token);
            } else if (!previousPunctuation || (previousPunctuation.content === '[' && column === 0)) {
              parentPunctuations.push(token);
            } else {
              throw new ValidateError({ token });
            }
            break;
          }
          case this.resolveTokenContent(token.content) === '}': {
            deepth -= 1;
            if (deepth < 0 && (i !== lines.length - 1 || column !== line.length - 1)) {
              throw new ValidateError({ token });
            }
            const last = parentPunctuations.pop();
            if (last?.content !== '{' || column !== 0) {
              throw new ValidateError({ token });
            }
            break;
          }
          case this.resolveTokenContent(token.content) === '[': {
            deepth += 1;
            const previousPunctuation = parentPunctuations[parentPunctuations.length - 1];
            if (previousPunctuation?.content === '{' && this.isPropertyLine(line) && column === 2) {
              parentPunctuations.push(token);
            } else if (!previousPunctuation || (previousPunctuation.content === '[' && column === 0)) {
              parentPunctuations.push(token);
            } else {
              throw new ValidateError({ token });
            }
            break;
          }
          case this.resolveTokenContent(token.content) === ']': {
            deepth -= 1;
            if (deepth < 0 && (i !== lines.length - 1 || column !== line.length - 1)) {
              throw new ValidateError({ token });
            }
            const last = parentPunctuations.pop();
            if (last?.content !== '[' || column !== 0) {
              throw new ValidateError({ token });
            }
            break;
          }
          case this.resolveTokenContent(token.content) === ':': {
            const previousToken = line[column - 1];
            const nextToken = line[column + 1];

            const previousTokenIsValid = previousToken?.type === 'property';
            const nextTokenIsValid = Boolean(nextToken);

            if (!previousTokenIsValid || !nextTokenIsValid) {
              throw new ValidateError({ token });
            }
            break;
          }
          case this.resolveTokenContent(token.content) === '|': {
            if (mode === 'strict') {
              throw new ValidateError({ token });
            }
            const previousToken = line[column - 1];
            const nextToken = line[column + 1];
            const previousTokenIsValid = this.valueTypes.includes(previousToken?.type) || previousToken?.content === ')';
            const nextTokenIsValid = this.valueTypes.includes(nextToken?.type) || nextToken?.content === '(';
            if (!previousToken || !previousTokenIsValid || !nextTokenIsValid) {
              throw new ValidateError({ token });
            }
            break;
          }
          case this.resolveTokenContent(token.content) === '(': {
            if (mode === 'strict') {
              throw new ValidateError({ token });
            } else {
              parentPunctuations.push(token);
            }
            break;
          }
          case this.resolveTokenContent(token.content) === ')': {
            if (mode === 'strict') {
              throw new ValidateError({ token });
            } else {
              const last = parentPunctuations.pop();
              if (last?.content !== '(' || last.lineNo !== token.lineNo) {
                throw new ValidateError({ token });
              }
            }
            break;
          }
          case this.valueTypes.includes(token.type): {
            const previousPunctuation = parentPunctuations[parentPunctuations.length - 1];
            const inObject = previousPunctuation?.content === '{' && this.isPropertyLine(line) && column === 2;
            const inArray = previousPunctuation?.content === '[' && column === 0;
            const pure = parentPunctuations.length === 0 && this.lines.length === 1 && column == 0;
            const inEnum = line[column - 1]?.content === '(' || line[column - 1]?.content === '|';
            if (inEnum && mode === 'strict') {
              break;
            }
            if (!inObject && !inArray && !pure && !inEnum) {
              throw new ValidateError({ token });
            }
            break;
          }
          case token.type === 'property': {
            break;
          }
          case token.type === 'comment': {
            break;
          }
          default: {
            throw new ValidateError({ token });
          }
        }
        continue;
      }
    }
    if (parentPunctuations.length) {
      throw new ValidateError({ token: parentPunctuations[0] });
    }
  }

  /**
   * do the JSON formatting with auto error recovery
   * @returns the formatted JSON string
   */
  public format() {
    // the code is formatted
    if (this.output) {
      return this.output;
    }
    this.cookedTokens.forEach((token, index) => {
      this.currentIndex = index;
      switch (true) {
        case token.content === '{': {
          this.commitOutputTransaction(() => {
            this.addTokenToCurrentLine();
            this.output += this.resolveTokenContent(token.content);
          });
          this.addNewLine('increase');
          break;
        }
        case token.content === '}': {
          const behind = this.lookBehind(true);
          if (behind) {
            this.addNewLine('decrease');
          }
          this.commitOutputTransaction(() => {
            const content = this.resolveTokenContent(token.content);
            this.output += content;
            this.columnNo += content.length;
            this.addTokenToCurrentLine();
            this.appendComma();
          });
          break;
        }
        case token.content === ':': {
          this.commitOutputTransaction(() => {
            this.output += ': ';
            this.addTokenToCurrentLine();
          });
          break;
        }
        case token.content === '[': {
          const ahead = this.lookAhead(true);
          this.commitOutputTransaction(() => {
            this.output += this.resolveTokenContent(token.content);
            this.addTokenToCurrentLine();
          });
          this.addNewLine('increase');
          break;
        }
        case token.content === ']': {
          const behind = this.lookBehind(true);
          if (behind) {
            this.addNewLine('decrease');
          }
          this.commitOutputTransaction(() => {
            this.output += this.resolveTokenContent(token.content);
            this.addTokenToCurrentLine();
            this.appendComma();
          });
          break;
        }
        case token.content === '|': {
          this.commitOutputTransaction(() => {
            this.output += ` ${this.resolveTokenContent(token.content)} `;
            this.addTokenToCurrentLine();
          });
          break;
        }
        case token.content === '(': {
          this.commitOutputTransaction(() => {
            this.output += this.resolveTokenContent(token.content);
            this.addTokenToCurrentLine();
          });
          break;
        }
        // TODO: may have problem
        case token.type === 'comment': {
          const tokenBehind = this.lookBehind();
          const nonWhiteSpaceTokenBehind = this.lookBehind(true);
          const nonWhiteSpaceTokenAhead = this.lookAhead(true);

          const shouldAddlineBreak = tokenBehind?.type === 'linebreak' && !startList.includes(nonWhiteSpaceTokenBehind?.content);

          if (shouldAddlineBreak) {
            this.addNewLine();
          }

          this.commitOutputTransaction(() => {
            if (!shouldAddlineBreak && tokenBehind && !startList.includes(nonWhiteSpaceTokenBehind?.content)) {
              this.output += ' ';
            }
            this.addTokenToCurrentLine();
            this.output += this.resolveTokenContent(token.content);
          });

          if (nonWhiteSpaceTokenAhead && !endList.includes(nonWhiteSpaceTokenAhead.content) && nonWhiteSpaceTokenAhead.type !== 'comment') {
            this.addNewLine();
          }
          break;
        }
        case token.type === 'property': {
          const nonWhiteSpaceTokenBehind = this.lookBehind(true);
          if (nonWhiteSpaceTokenBehind && nonWhiteSpaceTokenBehind?.content !== '{' && nonWhiteSpaceTokenBehind?.type !== 'comment') {
            this.addNewLine();
          }

          this.commitOutputTransaction(() => {
            this.addTokenToCurrentLine();
            this.output += this.resolveTokenContent(token.content);
          });

          break;
        }
        case token.type === 'linebreak': {
          // do nothing, cause we handle line break ourselves,
          // however unlike commas, we need to keep linebreak token to correctly format comments
          break;
        }
        case token.type === 'unknown': {
          this.commitOutputTransaction(() => {
            this.addTokenToCurrentLine();
            this.output += `"${this.resolveTokenContent(token.content).trim()}"`;
            this.appendComma();
          });
          break;
        }
        default: {
          this.commitOutputTransaction(() => {
            this.addTokenToCurrentLine();
            this.output += this.resolveTokenContent(token.content);
            this.appendComma();
          });
        }
      }
    });
    return this.output;
  }

  /**
   * get the JSON string
   * @returns the formatted JSON string
   */
  public getString() {
    return this.output;
  }
}
