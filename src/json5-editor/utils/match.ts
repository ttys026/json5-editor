export const activePairs = (
  preElement: HTMLPreElement,
  currentIndex: number,
) => {
  setTimeout(() => {
    let accCount = 0;
    const children = preElement.childNodes || [];

    for (let i = 0; i < children.length; i++) {
      const ele = children[i];
      if ((ele as HTMLDivElement).innerText) {
        accCount += (ele as HTMLDivElement).innerText.length;
      } else if (((ele as unknown) as { data: string }).data) {
        accCount += ((ele as unknown) as { data: string }).data.length;
      }
      if (accCount >= currentIndex) {
        try {
          if ((ele as HTMLDivElement).className) {
            const classNameList = (ele as HTMLDivElement).className.split(' ');
            const lastClassName = classNameList[classNameList.length - 1];
            const list = lastClassName.split('-');
            preElement
              .querySelector(`.${list[0]}-start-${list[2]}`)
              ?.classList.add('active');
            preElement
              .querySelector(`.${list[0]}-end-${list[2]}`)
              ?.classList.add('active');
            break;
          }
        } catch (e) {
          // do nothing
        }
      }
    }
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
