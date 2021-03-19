---
group:
  title: JSON5-editor
---

# json5-editor

A lite JSON5 editor with smart autoComplete and zero configuration

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

> about how it works and limitations, please refer to https://github.com/satya164/react-simple-code-editor

### API

| prop         | description                                                 | type                | default |
| ------------ | ----------------------------------------------------------- | ------------------- | ------- |
| initialValue | default value of textarea                                   | string              | ''      |
| value        | value in the textarea, required in controlled mode          | string              | -       |
| onChange     | textarea value change callback, required in controlled mode | (v: string) => void | -       |
| placeholder  | placeholder of textarea                                     | string              | ''      |
| style        | className of textarea and pre tag                           | React.CSSProperties | -       |
| className    | className of outer container                                | string              | -       |
