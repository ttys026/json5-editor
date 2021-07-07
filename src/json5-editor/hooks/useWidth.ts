import { useState, useLayoutEffect } from 'react';

function useWidth(target: React.RefObject<HTMLDivElement>): number {
  const [state, setState] = useState<number>(() => {
    const el = target.current;
    return (el || {}).clientWidth || 0;
  });

  useLayoutEffect(() => {
    const el = target.current;
    if (!el) {
      return () => {};
    }

    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        setState(entry.target.clientWidth || 0);
      });
    });

    resizeObserver.observe(el as HTMLElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [target]);

  return state;
}

export default useWidth;
