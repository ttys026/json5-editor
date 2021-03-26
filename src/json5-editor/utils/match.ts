// helper function that cast childNode as span;
const getSpan = (list: NodeListOf<ChildNode>, index: number) => {
  return list[index] as HTMLSpanElement;
};

const isStart = (ele: HTMLSpanElement) => {
  return ele.className.includes('brace-start');
};

const getBraceType = (brace: string) => {
  switch (brace) {
    case '{':
    case '}':
      return 'brace';
    case '[':
    case ']':
      return 'bracket';
    case '(':
    case ')':
      return 'parentheses';
    default:
      return '';
  }
};

export const activePairs = (
  preElement: HTMLPreElement,
  currentIndex: number,
) => {
  setTimeout(() => {
    let accCount = 0;
    const children = preElement.childNodes || [];
    const punctuations = preElement.querySelectorAll('.brace');
    let pair: HTMLSpanElement[] = [];
    let pairIndex = 0;

    outer: for (let i = 0; i < children.length; i++) {
      const ele = getSpan(children, i);
      if (ele.innerText) {
        accCount += ele.innerText.length;
      } else if (((ele as unknown) as { data: string }).data) {
        accCount += ((ele as unknown) as { data: string }).data.length;
      }
      if (accCount >= currentIndex) {
        try {
          for (let j = 0; j < punctuations.length; j++) {
            if (ele.isSameNode(punctuations[j])) {
              if (isStart(ele)) {
                pair[0] = ele;
              } else {
                pair[1] = ele;
              }
              pairIndex = j;
              break outer;
            }
          }
        } catch (e) {
          // do nothing
        }
      }
    }

    let level = 0;
    // 选中了 start
    if (pair[0]) {
      for (let i = pairIndex; i < punctuations.length; i++) {
        const currentElement = getSpan(punctuations, i);
        if (
          getBraceType(currentElement.innerText) !==
          getBraceType(pair[0].innerText)
        ) {
          continue;
        }
        if (isStart(currentElement)) {
          level += 1;
        } else {
          level -= 1;
        }

        if (level === 0) {
          pair[1] = currentElement;
          break;
        }
      }
    }
    // 选中了 end
    else if (pair[1]) {
      for (let i = pairIndex; i >= 0; i--) {
        const currentElement = getSpan(punctuations, i);
        if (
          getBraceType(currentElement.innerText) !==
          getBraceType(pair[1].innerText)
        ) {
          continue;
        }
        if (isStart(currentElement)) {
          level += 1;
        } else {
          level -= 1;
        }

        if (level === 0) {
          pair[0] = currentElement;
          break;
        }
      }
    }

    pair.forEach(ele => ele.classList.add('active'));
  });
};

export const clearPairs = (preElement: HTMLPreElement) => {
  setTimeout(() => {
    const children = preElement.childNodes || [];
    children.forEach((ele: any) => {
      if (
        (ele as HTMLDivElement).className &&
        (ele as HTMLDivElement).classList.contains('active')
      ) {
        (ele as HTMLDivElement).classList.remove('active');
      }
    });
  });
};
