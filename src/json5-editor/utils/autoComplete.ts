export const fillWithIndent = (
  textArea: HTMLTextAreaElement,
  needle: string,
  fill: string,
  code: string,
  setCode: React.Dispatch<React.SetStateAction<string>>,
  event: KeyboardEvent,
) => {
  const startPos = textArea?.selectionStart || 0;
  const endPos = textArea?.selectionEnd || 0;
  const condition =
    startPos === endPos && (code || '')[startPos - 1] === needle;
  // 没有选中任何文本，且前一个字符是可以被配对时：
  if (condition) {
    // if() {
    //   //
    // }
    console.log();
    event.preventDefault();
    setCode(c => {
      const prefix = c.slice(0, startPos);
      const suffix = c.slice(startPos);
      const currentLine = prefix.slice(prefix.lastIndexOf('\n') + 1);
      const leadingWhiteSpace =
        (currentLine.split('').findIndex(ele => ele !== ' ') || 0) + 2;

      // 下一帧时跳转指针位置
      window.requestAnimationFrame(() => {
        textArea?.setSelectionRange(
          startPos + leadingWhiteSpace + 1,
          startPos + leadingWhiteSpace + 1,
        );
      });

      // 避免重复填充 matching char
      const codeArray = code.split('');
      const needFill =
        codeArray.filter(ele => ele === needle).length !==
        codeArray.filter(ele => ele === fill).length;

      const needExtraSpace = (code || '')[startPos] === fill;

      if (!needFill) {
        return [
          prefix,
          `\n${Array(leadingWhiteSpace + 1).join(' ')}${
            needExtraSpace ? '\n' : ''
          }`,
          suffix,
        ].join('');
      } else {
        return [
          prefix,
          `\n${Array(leadingWhiteSpace + 1).join(' ')}\n${Array(
            leadingWhiteSpace - 1,
          ).join(' ')}${fill}${leadingWhiteSpace === 2 ? '' : ','}`,
          suffix,
        ].join('');
      }
    });
  }
  return condition;
};

export const fillAfter = (textArea: HTMLTextAreaElement, needle: string) => {
  const startPos = textArea?.selectionStart || 0;
  const endPos = textArea?.selectionEnd || 0;
  if (startPos === endPos) {
    document.execCommand('insertText', false, needle);
    window.requestAnimationFrame(() => {
      textArea?.setSelectionRange(startPos + 1, startPos + 1);
    });
  }
};
