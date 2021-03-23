---
group:
  title: Demo
---

## Demo

```tsx
import React from 'react';
import { Editor } from 'json5-editor';

export default () => <Editor initialValue={`{\n  \n}`} />;
```

```tsx
/**
 * debug: true
 * title: work with antd form
 */

import React from 'react';
import { Form } from 'antd';
import { Editor } from 'json5-editor';

export default () => {
  const [form] = Form.useForm();
  return (
    <Form
      onValuesChange={console.log}
      initialValues={{ code: `{\n  name: 1,\n  name: 2\n}` }}
      form={form}
    >
      <Form.Item name="code">
        <Editor />
      </Form.Item>
      <button onClick={() => console.log(form.getFieldsValue())}>
        getFieldsValue
      </button>
      <button onClick={() => form.setFieldsValue({ code: '123' })}>
        setFieldsValue
      </button>
    </Form>
  );
};
```
