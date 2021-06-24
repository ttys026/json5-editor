import type { Token, TokenStream } from 'prismjs';

export class Traverse {
  private tokens: Array<Token & { index: number }>;
  private leadingSpace = 0;
  private currentIndex = 0;
  private output = '';
  private indentSize = 2;

  constructor(tokens: (Token | string)[]) {
    // remove whitespace and transform unknown string to tokens
    this.tokens = tokens
      .filter(
        (ele) =>
          !(typeof ele === 'string' && !ele.trim()) &&
          (ele as Token).type !== 'indent' &&
          // filter out commas, we will add it back later
          (ele as Token).content !== ',',
      )
      .map((ele, index) => {
        if (typeof ele === 'string') {
          return {
            content: ele,
            length: ele.length,
            type: 'unknown',
            index,
          };
        }
        return { ...ele, index };
      }) as Array<Token & { index: number }>;

    console.log('this.tokens', this.tokens);
  }

  protected getLeadingSpace() {
    return Array(this.leadingSpace + 1).join(' ');
  }

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

  protected addNewLine(indent?: 'increase' | 'decrease') {
    if (indent === 'increase') {
      this.leadingSpace += this.indentSize;
    } else if (indent === 'decrease') {
      this.leadingSpace -= this.indentSize;
    }
    this.output += '\n';
    this.output += this.getLeadingSpace();
  }

  // find the next token
  protected lookAhead(skipWhitespace?: boolean) {
    if (this.currentIndex >= this.tokens.length - 1) {
      return undefined;
    }
    if (skipWhitespace) {
      return this.tokens.slice(this.currentIndex + 1).find((tok) => {
        return tok.type !== 'linebreak';
      });
    }
    return this.tokens[this.currentIndex + 1];
  }

  // find the previous token
  protected lookBehind(skipWhitespace?: boolean) {
    if (this.currentIndex <= 0) {
      return undefined;
    }
    if (skipWhitespace) {
      for (let i = this.currentIndex - 1; i >= 0; i--) {
        if (this.tokens[i].type !== 'linebreak') {
          return this.tokens[i];
        }
      }
      return undefined;
    }
    return this.tokens[this.currentIndex - 1];
  }

  // look several tokens ahead
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

  // look several tokens behind
  protected lookBehindDeep(param: {
    skipWhitespace?: boolean;
    deepth: number;
  }) {
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

  // get string value of previous line, ** currently not used **
  protected getOnelineBehind() {
    const endIndex = this.output.lastIndexOf('\n');
    const lineStartIndex = this.output.lastIndexOf('\n', endIndex - 1);
    const startIndex = ~lineStartIndex ? lineStartIndex : 0;
    if (~endIndex && ~startIndex) {
      return this.output.slice(startIndex, endIndex);
    }
    return '';
  }

  // only append comma if necessary
  protected appendComma() {
    // get one token ahead of comma
    const ahead = this.lookAhead(true);

    if (ahead) {
      if (
        !['}', ']', '|', '(', ')'].includes(
          this.resolveTokenContent(ahead.content),
        )
      ) {
        this.output += ',';
      }
      if (ahead.content === '[' || ahead.content === '{') {
        this.addNewLine();
      }
    }
  }

  public format() {
    this.tokens.forEach((token, index) => {
      this.currentIndex = index;
      switch (true) {
        case token.content === '{': {
          this.output += this.resolveTokenContent(token.content);
          this.addNewLine('increase');
          break;
        }
        case token.content === '}': {
          this.addNewLine('decrease');
          this.output += this.resolveTokenContent(token.content);
          this.appendComma();
          break;
        }
        case token.content === ':': {
          this.output += ': ';
          break;
        }
        case token.content === '[': {
          this.output += this.resolveTokenContent(token.content);
          this.addNewLine('increase');
          break;
        }
        case token.content === ']': {
          this.addNewLine('decrease');
          this.output += this.resolveTokenContent(token.content);
          this.appendComma();
          break;
        }
        case token.content === '|': {
          this.output += ` ${this.resolveTokenContent(token.content)} `;
          break;
        }
        case token.content === '(': {
          this.output += this.resolveTokenContent(token.content);
          break;
        }
        case token.type === 'comment': {
          const tokenBehind = this.lookBehind();
          const nonWhiteSpaceTokenBehind = this.lookBehind(true);
          const nonWhiteSpaceTokenAhead = this.lookAhead(true);
          if (
            tokenBehind?.type === 'linebreak' &&
            nonWhiteSpaceTokenBehind?.content !== '{'
          ) {
            this.addNewLine();
          } else if (
            tokenBehind &&
            // tokenBehind.content !== ',' &&
            nonWhiteSpaceTokenBehind?.content !== '{'
          ) {
            this.output += ' ';
          }
          this.output += this.resolveTokenContent(token.content);
          if (
            nonWhiteSpaceTokenAhead &&
            nonWhiteSpaceTokenAhead.content !== '}' &&
            nonWhiteSpaceTokenAhead.type !== 'comment'
          ) {
            this.addNewLine();
          }
          break;
        }
        case token.type === 'property': {
          const nonWhiteSpaceTokenBehind = this.lookBehind(true);
          const abc = this.lookAheadDeep({ skipWhitespace: true, deepth: 3 });
          console.log('hihi', abc);

          if (
            nonWhiteSpaceTokenBehind &&
            nonWhiteSpaceTokenBehind?.content !== '{' &&
            nonWhiteSpaceTokenBehind?.type !== 'comment'
          ) {
            this.addNewLine();
          }
          this.output += this.resolveTokenContent(token.content);
          break;
        }
        case token.type === 'linebreak': {
          // do nothing, cause we handle line break ourselves,
          // however unlike commas, we need to keep linebreak token to correctly format comments
          break;
        }
        case token.type === 'unknown': {
          // adjutant number will merge with ahead unknown string ;
          const behind = this.lookBehind();
          if (behind && behind.type === 'number') {
            this.output = this.output.slice(
              0,
              this.output.length - behind.length,
            );
            this.output += `"${this.resolveTokenContent(
              behind.content,
            )}${this.resolveTokenContent(token.content).trim()}"`;
          } else {
            // transformregular unknown part to string;
            this.output += `"${this.resolveTokenContent(
              token.content,
            ).trim()}"`;
          }
          this.appendComma();
          break;
        }
        default: {
          this.output += this.resolveTokenContent(token.content);
          this.appendComma();
        }
      }
    });
  }

  public getString() {
    return this.output;
  }
}
