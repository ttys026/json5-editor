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

```tsx
/**
 * debug: true
 * title: multiple editor
 */

import React from 'react';
import { Editor } from 'json5-editor';

export default () => {
  return (
    <>
      <Editor
        value={`{
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
}`}
      />
      <Editor
        value={`{
  "type": "object",
  "description": "",
  "properties": {
    "success": {
      "type": "boolean",
      "description": ""
    },
    "data": {
      "type": "object",
      "description": "",
      "properties": {
        "user": {
          "type": "object",
          "description": "",
          "properties": {
            "name": {
              "type": "string",
              "description": ""
            },
            "age": {
              "type": "number",
              "description": "born in 1996"
            },
            "key": {
              "type": "string",
              "description": ""
            },
            "phoneNumber": {
              "type": "number",
              "description": "11 digits in number format"
            }
          }
        }
      }
    }
  }
}`}
      />
    </>
  );
};
```
