import type { RootEnv } from '..';

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

export function addLineNumber(env: RootEnv) {
  requestAnimationFrame(() => {
    if (!env.element) {
      return;
    }
    const pre = env.element.querySelector('pre');
    const gutter = env.element.querySelector('.line-numbers-rows')!;
    var lines = env.code.split('\n');
    var linesNum = lines.length;
    const errorLineNo = 'lineNo' in (env.error || {}) ? env.error.lineNo : -1;

    var linesStr = new Array(linesNum)
      .fill('')
      .map((ele, i) => {
        if (i === errorLineNo - 1) {
          return '<span style="background: rgb(255, 77, 79); color: #ffffff;"></span>';
        }
        return '<span></span>';
      })
      .join('');
    gutter.innerHTML = linesStr;
    resizeElements([env.element]);
  });
}
