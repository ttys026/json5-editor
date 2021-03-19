# json5-editor

A lite JSON5 editor with smart autoComplete and zero configuration

## usage

```
import { Editor } from 'json5-editor'

export default () => {
  return (
    <Editor {...props} />
  )
}
```

### API

initialValue?: string;
value?: string;
onChange?: (v: string) => void;
placeholder?: string;
style?: React.CSSProperties;
className?: string;
