export const startList: (Prism.TokenStream | undefined)[] = ['{', '[', '('];
export const endList: (Prism.TokenStream | undefined)[] = ['}', ']', ')'];
// include undefined just for nonstandard JSON, even though it's not a valid primitive types
export const keywords = ['true', 'false', 'null', 'undefined'];
export const arrayCollapse = '[┉]';
export const objectCollapse = '{┉}';
