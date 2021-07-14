---
group:
  title: Demo
---

## Demo

```tsx
import React from 'react';
import { Editor } from 'json5-editor';

export default () => <Editor ref={console.log} showLineNumber initialValue={`{\n  \n}`} />;
```

```tsx
/**
 * debug: true
 * title: work with antd form
 */

import React, { useState } from 'react';
import { Form } from 'antd';
import { Editor } from 'json5-editor';

export default () => {
  const [form] = Form.useForm();
  const [key, setKey] = useState(0);
  return (
    <Form
      key={key}
      onValuesChange={console.log}
      initialValues={{
        code: `{
  array: [
    [
      {
        name: 1
      },
      {
        name: 2
      },
    ],
    [
      {
        name: 3
      },
      {
        name: 4
      },
    ],
  ],
}`,
      }}
      form={form}
    >
      <Form.Item name="code">
        <Editor disabled />
      </Form.Item>
      <button onClick={() => setKey((k) => k + 1)}>rerender</button>
      <button onClick={() => console.log(form.getFieldsValue())}>getFieldsValue</button>
      <button onClick={() => form.setFieldsValue({ code: '123' })}>setFieldsValue</button>
    </Form>
  );
};
```

```tsx
/**
 * debug: true
 * title: multiple editor
 */

import React, { useState } from 'react';
import { Editor } from 'json5-editor';

export default () => {
  const [value, setValue] = useState(`{
  success: true,
  data: {
    user: {
      name: "Troy",
      age: 25, // born in 1996
      key: "value",
      phoneNumber: 13800000000 // 11 digits in number format
    },
  },
  success: false
}`);
  return (
    <>
      <Editor readOnly value={value} onChange={setValue} />
      <Editor value={value.slice(0)} />
    </>
  );
};
```
