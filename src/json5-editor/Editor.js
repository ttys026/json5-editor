'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

var _extends =
  Object.assign ||
  function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };

var _createClass = (function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ('value' in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }
  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
})();

var _react = require('react');

var React = _interopRequireWildcard(_react);

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  } else {
    var newObj = {};
    if (obj != null) {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
      }
    }
    newObj.default = obj;
    return newObj;
  }
}

function _objectWithoutProperties(obj, keys) {
  var target = {};
  for (var i in obj) {
    if (keys.indexOf(i) >= 0) continue;
    if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
    target[i] = obj[i];
  }
  return target;
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError('Cannot call a class as a function');
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  return call && (typeof call === 'object' || typeof call === 'function') ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== 'function' && superClass !== null) {
    throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : (subClass.__proto__ = superClass);
}
/* global global */

var KEYCODE_ENTER = 13;
var KEYCODE_TAB = 9;
var KEYCODE_BACKSPACE = 8;
var KEYCODE_Y = 89;
var KEYCODE_Z = 90;
var KEYCODE_M = 77;
var KEYCODE_PARENS = 57;
var KEYCODE_BRACKETS = 219;
var KEYCODE_QUOTE = 222;
var KEYCODE_BACK_QUOTE = 192;
var KEYCODE_ESCAPE = 27;

var HISTORY_LIMIT = 100;
var HISTORY_TIME_GAP = 3000;

var isWindows = 'navigator' in global && /Win/i.test(navigator.platform);
var isMacLike = 'navigator' in global && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);

var className = 'npm__react-simple-code-editor__textarea';

var cssText =
  /* CSS */ '\n/**\n * Reset the text fill color so that placeholder is visible\n */\n.' +
  className +
  ":empty {\n  -webkit-text-fill-color: inherit !important;\n}\n\n/**\n * Hack to apply on some CSS on IE10 and IE11\n */\n@media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {\n  /**\n    * IE doesn't support '-webkit-text-fill-color'\n    * So we use 'color: transparent' to make the text transparent on IE\n    * Unlike other browsers, it doesn't affect caret color in IE\n    */\n  ." +
  className +
  ' {\n    color: transparent !important;\n  }\n\n  .' +
  className +
  '::selection {\n    background-color: #accef7 !important;\n    color: transparent !important;\n  }\n}\n';

var Editor = (function (_React$Component) {
  _inherits(Editor, _React$Component);

  function Editor() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, Editor);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return (
      (_ret =
        ((_temp = ((_this = _possibleConstructorReturn(this, (_ref = Editor.__proto__ || Object.getPrototypeOf(Editor)).call.apply(_ref, [this].concat(args)))), _this)),
        (_this.state = {
          capture: true,
        }),
        (_this._recordCurrentState = function () {
          var input = _this._input;

          if (!input) return;

          // Save current state of the input
          var value = input.value,
            selectionStart = input.selectionStart,
            selectionEnd = input.selectionEnd;

          _this._recordChange({
            value: value,
            selectionStart: selectionStart,
            selectionEnd: selectionEnd,
          });
        }),
        (_this._getLines = function (text, position) {
          return text.substring(0, position).split('\n');
        }),
        (_this._recordChange = function (record) {
          var overwrite = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
          var _this$_history = _this._history,
            stack = _this$_history.stack,
            offset = _this$_history.offset;

          if (stack.length && offset > -1) {
            // When something updates, drop the redo operations
            _this._history.stack = stack.slice(0, offset + 1);

            // Limit the number of operations to 100
            var count = _this._history.stack.length;

            if (count > HISTORY_LIMIT) {
              var extras = count - HISTORY_LIMIT;

              _this._history.stack = stack.slice(extras, count);
              _this._history.offset = Math.max(_this._history.offset - extras, 0);
            }
          }

          var timestamp = Date.now();

          if (overwrite) {
            var last = _this._history.stack[_this._history.offset];

            if (last && timestamp - last.timestamp < HISTORY_TIME_GAP) {
              // A previous entry exists and was in short interval

              // Match the last word in the line
              var re = /[^a-z0-9]([a-z0-9]+)$/i;

              // Get the previous line
              var previous = _this._getLines(last.value, last.selectionStart).pop().match(re);

              // Get the current line
              var current = _this._getLines(record.value, record.selectionStart).pop().match(re);

              if (previous && current && current[1].startsWith(previous[1])) {
                // The last word of the previous line and current line match
                // Overwrite previous entry so that undo will remove whole word
                _this._history.stack[_this._history.offset] = _extends({}, record, { timestamp: timestamp });

                return;
              }
            }
          }

          // Add the new operation to the stack
          _this._history.stack.push(_extends({}, record, { timestamp: timestamp }));
          _this._history.offset++;
        }),
        (_this._updateInput = function (record) {
          var input = _this._input;

          if (!input) return;

          // Update values and selection state
          input.value = record.value;
          input.selectionStart = record.selectionStart;
          input.selectionEnd = record.selectionEnd;

          _this.props.onValueChange(record.value);
        }),
        (_this._applyEdits = function (record) {
          // Save last selection state
          var input = _this._input;
          var last = _this._history.stack[_this._history.offset];

          if (last && input) {
            _this._history.stack[_this._history.offset] = _extends({}, last, {
              selectionStart: input.selectionStart,
              selectionEnd: input.selectionEnd,
            });
          }

          // Save the changes
          _this._recordChange(record);
          _this._updateInput(record);
        }),
        (_this._undoEdit = function () {
          var _this$_history2 = _this._history,
            stack = _this$_history2.stack,
            offset = _this$_history2.offset;

          // Get the previous edit

          var record = stack[offset - 1];

          if (record) {
            // Apply the changes and update the offset
            _this._updateInput(record);
            _this._history.offset = Math.max(offset - 1, 0);
          }
        }),
        (_this._redoEdit = function () {
          var _this$_history3 = _this._history,
            stack = _this$_history3.stack,
            offset = _this$_history3.offset;

          // Get the next edit

          var record = stack[offset + 1];

          if (record) {
            // Apply the changes and update the offset
            _this._updateInput(record);
            _this._history.offset = Math.min(offset + 1, stack.length - 1);
          }
        }),
        (_this._handleChange = function (e) {
          var _e$target2 = e.target,
            value = _e$target2.value,
            selectionStart = _e$target2.selectionStart,
            selectionEnd = _e$target2.selectionEnd;

          _this._recordChange(
            {
              value: value,
              selectionStart: selectionStart,
              selectionEnd: selectionEnd,
            },
            true,
          );

          _this.props.onValueChange(value);
        }),
        (_this._history = {
          stack: [],
          offset: -1,
        }),
        _temp)),
      _possibleConstructorReturn(_this, _ret)
    );
  }

  _createClass(Editor, [
    {
      key: 'componentDidMount',
      value: function componentDidMount() {
        this._recordCurrentState();
      },
    },
    {
      key: 'render',
      value: function render() {
        var _this2 = this;

        var _props = this.props,
          value = _props.value,
          style = _props.style,
          padding = _props.padding,
          highlight = _props.highlight,
          textareaId = _props.textareaId,
          textareaClassName = _props.textareaClassName,
          autoFocus = _props.autoFocus,
          disabled = _props.disabled,
          form = _props.form,
          maxLength = _props.maxLength,
          minLength = _props.minLength,
          name = _props.name,
          placeholder = _props.placeholder,
          readOnly = _props.readOnly,
          required = _props.required,
          onClick = _props.onClick,
          onFocus = _props.onFocus,
          onBlur = _props.onBlur,
          onKeyUp = _props.onKeyUp,
          onKeyDown = _props.onKeyDown,
          onValueChange = _props.onValueChange,
          tabSize = _props.tabSize,
          insertSpaces = _props.insertSpaces,
          ignoreTabKey = _props.ignoreTabKey,
          preClassName = _props.preClassName,
          rest = _objectWithoutProperties(_props, [
            'value',
            'style',
            'padding',
            'highlight',
            'textareaId',
            'textareaClassName',
            'autoFocus',
            'disabled',
            'form',
            'maxLength',
            'minLength',
            'name',
            'placeholder',
            'readOnly',
            'required',
            'onClick',
            'onFocus',
            'onBlur',
            'onKeyUp',
            'onKeyDown',
            'onValueChange',
            'tabSize',
            'insertSpaces',
            'ignoreTabKey',
            'preClassName',
          ]);

        var contentStyle = {
          paddingTop: padding,
          paddingRight: padding,
          paddingBottom: padding,
          paddingLeft: padding,
        };

        var highlighted = highlight(value);

        return React.createElement(
          'div',
          _extends({}, rest, { style: _extends({}, styles.container, style) }),
          React.createElement('textarea', {
            ref: function ref(c) {
              return (_this2._input = c);
            },
            style: _extends({}, styles.editor, styles.textarea, contentStyle),
            className: className + (textareaClassName ? ' ' + textareaClassName : ''),
            id: textareaId,
            value: value,
            onChange: this._handleChange,
            onClick: onClick,
            onKeyUp: onKeyUp,
            onFocus: onFocus,
            onBlur: onBlur,
            disabled: disabled,
            form: form,
            maxLength: maxLength,
            minLength: minLength,
            name: name,
            placeholder: placeholder,
            readOnly: readOnly,
            required: required,
            autoFocus: autoFocus,
            autoCapitalize: 'off',
            autoComplete: 'off',
            autoCorrect: 'off',
            spellCheck: false,
            'data-gramm': false,
          }),
          React.createElement(
            'pre',
            _extends(
              {
                className: preClassName,
                'aria-hidden': 'true',
                style: _extends({}, styles.editor, styles.highlight, contentStyle),
              },
              typeof highlighted === 'string' ? { dangerouslySetInnerHTML: { __html: highlighted + '<br />' } } : { children: highlighted },
            ),
          ),
          React.createElement('style', { type: 'text/css', dangerouslySetInnerHTML: { __html: cssText } }),
        );
      },
    },
    {
      key: 'session',
      get: function get() {
        return {
          history: this._history,
        };
      },
      set: function set(session) {
        this._history = session.history;
      },
    },
  ]);

  return Editor;
})(React.Component);

Editor.defaultProps = {
  tabSize: 2,
  insertSpaces: true,
  ignoreTabKey: false,
  padding: 0,
};
exports.default = Editor;

var styles = {
  container: {
    position: 'relative',
    textAlign: 'left',
    boxSizing: 'border-box',
    padding: 0,
    overflow: 'hidden',
  },
  textarea: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    resize: 'none',
    color: 'inherit',
    overflow: 'hidden',
    MozOsxFontSmoothing: 'grayscale',
    WebkitFontSmoothing: 'antialiased',
    WebkitTextFillColor: 'transparent',
  },
  highlight: {
    position: 'relative',
    pointerEvents: 'none',
  },
  editor: {
    margin: 0,
    border: 0,
    background: 'none',
    boxSizing: 'inherit',
    display: 'inherit',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontStyle: 'inherit',
    fontVariantLigatures: 'inherit',
    fontWeight: 'inherit',
    letterSpacing: 'inherit',
    lineHeight: 'inherit',
    tabSize: 'inherit',
    textIndent: 'inherit',
    textRendering: 'inherit',
    textTransform: 'inherit',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflowWrap: 'break-word',
  },
};
//# sourceMappingURL=index.js.map
