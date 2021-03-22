export const nextTick = (cb: () => void) => {
  window.requestAnimationFrame(() => {
    cb();
  });
};
