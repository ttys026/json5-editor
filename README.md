# json5-editor

A lite JSON5 editor with smart autoComplete and zero configuration

[NPM](https://www.npmjs.com/package/json5-editor) | [Github](https://github.com/ttys026/json5-editor) | [Playground](https://ttys026.github.io/json5-editor/json5-editor)

![demo](https://github.com/ttys026/json5-editor/blob/master/demo.gif?raw=true)

### usage

```
import { Editor } from 'json5-editor'

export default () => {
  return (
    <Editor {...props} />
  )
}
```

### feature

- Syntax highlight
- Auto formatting & error correcting
- Duplicate property name checking
- Brace matching
- code ruler

**Not optimized for big JSON, use at your own risk**

> more about how it works and limitations, please refer to https://github.com/satya164/react-simple-code-editor#how-it-works

### API

| prop         | description                                                 | type                | default |
| ------------ | ----------------------------------------------------------- | ------------------- | ------- |
| initialValue | default value of textarea                                   | string              | ''      |
| value        | value in the textarea, required in controlled mode          | string              | -       |
| onChange     | textarea value change callback, required in controlled mode | (v: string) => void | -       |
| placeholder  | placeholder of textarea                                     | string              | ''      |
| style        | className of textarea and pre tag                           | React.CSSProperties | -       |
| className    | className of outer container                                | string              | -       |
| disabled     | whether the editor is disbled                               | boolean             | false   |
| readOnly     | whether the editor is readonly                              | boolean             | false   |
