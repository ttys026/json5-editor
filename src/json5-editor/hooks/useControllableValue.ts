import { useCallback, useState } from 'react';
import useUpdateEffect from './useUpdateEffect';

export interface Options<T> {
  initialValue?: T;
  initialValuePropName?: string;
  valuePropName?: string;
  trigger?: string;
}

export interface Props {
  [key: string]: any;
}

interface StandardProps<T> {
  value: T;
  initialValue?: T;
  onChange: (val: T) => void;
}
function useControllableValue<T extends string = string>(props: StandardProps<T>): [T, (val: T) => void];
function useControllableValue<T extends string = string>(props?: Props, options?: Options<T>): [T, React.Dispatch<React.SetStateAction<T>>];
function useControllableValue<T = any>(props: Props = {}, options: Options<T> = {}) {
  const { initialValue, initialValuePropName = 'initialValue', valuePropName = 'value', trigger = 'onChange' } = options;

  const value = props[valuePropName] as T;

  const [state, _setState] = useState<T>(() => {
    if (valuePropName in props) {
      return value;
    }
    if (initialValuePropName in props) {
      return props[initialValuePropName];
    }
    return initialValue;
  });

  /* init 的时候不用执行了 */
  useUpdateEffect(() => {
    if (valuePropName in props) {
      _setState(value);
    }
  }, [value, valuePropName]);

  const setState: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (v) => {
      if (!(valuePropName in props)) {
        _setState(v);
      }
      if (props[trigger]) {
        props[trigger](v);
      }
    },
    [props, valuePropName, trigger],
  );

  return [valuePropName in props ? value : state, setState] as const;
}

export default useControllableValue;
