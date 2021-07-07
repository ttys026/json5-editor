declare module '*.css';
declare module '*.less';
declare module 'prismjs/components/prism-core' {
  const Prism = await import('prismjs');
  export = Prism;
}
