"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.voidMap = void 0;

var _util = require("./util");

function _createForOfIteratorHelperLoose(o, allowArrayLike) {
  var it;

  if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) {
    if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
      if (it) o = it;
      var i = 0;
      return function () {
        if (i >= o.length) return {
          done: true
        };
        return {
          done: false,
          value: o[i++]
        };
      };
    }

    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  it = o[Symbol.iterator]();
  return it.next.bind(it);
}

function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}

function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;

  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }

  return arr2;
}

var voidMap = Object.create(null);
exports.voidMap = voidMap;
var voidTagNames = 'area base br col command embed hr img input keygen link meta param source track wbr';
voidTagNames.split(' ').forEach(function (tagName) {
  voidMap[tagName] = true;
});
var NON_WHITESPACE = /\S/;
/**
 * Examples when true:
 *  - link
 *  - liNK
 *
 * Examples when false:
 *  - Link (component)
 */

function isVoidTag(tag) {
  return voidMap[tag.toLowerCase()] && tag[0].toLowerCase() === tag[0];
}

var Printer = /*#__PURE__*/function () {
  function Printer(options) {
    this.buffer = '';
    this.options = options;
  }
  /*
    This is used by _all_ methods on this Printer class that add to `this.buffer`,
    it allows consumers of the printer to use alternate string representations for
    a given node.
       The primary use case for this are things like source -> source codemod utilities.
    For example, ember-template-recast attempts to always preserve the original string
    formatting in each AST node if no modifications are made to it.
  */


  var _proto = Printer.prototype;

  _proto.handledByOverride = function handledByOverride(node, ensureLeadingWhitespace) {
    if (ensureLeadingWhitespace === void 0) {
      ensureLeadingWhitespace = false;
    }

    if (this.options.override !== undefined) {
      var result = this.options.override(node, this.options);

      if (typeof result === 'string') {
        if (ensureLeadingWhitespace && result !== '' && NON_WHITESPACE.test(result[0])) {
          result = " " + result;
        }

        this.buffer += result;
        return true;
      }
    }

    return false;
  };

  _proto.Node = function Node(node) {
    switch (node.type) {
      case 'MustacheStatement':
      case 'BlockStatement':
      case 'PartialStatement':
      case 'MustacheCommentStatement':
      case 'CommentStatement':
      case 'TextNode':
      case 'ElementNode':
      case 'AttrNode':
      case 'Block':
      case 'Template':
        return this.TopLevelStatement(node);

      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'UndefinedLiteral':
      case 'NullLiteral':
      case 'PathExpression':
      case 'SubExpression':
        return this.Expression(node);

      case 'Program':
        return this.Block(node);

      case 'ConcatStatement':
        // should have an AttrNode parent
        return this.ConcatStatement(node);

      case 'Hash':
        return this.Hash(node);

      case 'HashPair':
        return this.HashPair(node);

      case 'ElementModifierStatement':
        return this.ElementModifierStatement(node);
    }
  };

  _proto.Expression = function Expression(expression) {
    switch (expression.type) {
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NumberLiteral':
      case 'UndefinedLiteral':
      case 'NullLiteral':
        return this.Literal(expression);

      case 'PathExpression':
        return this.PathExpression(expression);

      case 'SubExpression':
        return this.SubExpression(expression);
    }
  };

  _proto.Literal = function Literal(literal) {
    switch (literal.type) {
      case 'StringLiteral':
        return this.StringLiteral(literal);

      case 'BooleanLiteral':
        return this.BooleanLiteral(literal);

      case 'NumberLiteral':
        return this.NumberLiteral(literal);

      case 'UndefinedLiteral':
        return this.UndefinedLiteral(literal);

      case 'NullLiteral':
        return this.NullLiteral(literal);
    }
  };

  _proto.TopLevelStatement = function TopLevelStatement(statement) {
    switch (statement.type) {
      case 'MustacheStatement':
        return this.MustacheStatement(statement);

      case 'BlockStatement':
        return this.BlockStatement(statement);

      case 'PartialStatement':
        return this.PartialStatement(statement);

      case 'MustacheCommentStatement':
        return this.MustacheCommentStatement(statement);

      case 'CommentStatement':
        return this.CommentStatement(statement);

      case 'TextNode':
        return this.TextNode(statement);

      case 'ElementNode':
        return this.ElementNode(statement);

      case 'Block':
      case 'Template':
        return this.Block(statement);

      case 'AttrNode':
        // should have element
        return this.AttrNode(statement);
    }
  };

  _proto.Block = function Block(block) {
    /*
      When processing a template like:
           ```hbs
      {{#if whatever}}
        whatever
      {{else if somethingElse}}
        something else
      {{else}}
        fallback
      {{/if}}
      ```
           The AST still _effectively_ looks like:
           ```hbs
      {{#if whatever}}
        whatever
      {{else}}{{#if somethingElse}}
        something else
      {{else}}
        fallback
      {{/if}}{{/if}}
      ```
           The only way we can tell if that is the case is by checking for
      `block.chained`, but unfortunately when the actual statements are
      processed the `block.body[0]` node (which will always be a
      `BlockStatement`) has no clue that its ancestor `Block` node was
      chained.
           This "forwards" the `chained` setting so that we can check
      it later when processing the `BlockStatement`.
    */
    if (block.chained) {
      var firstChild = block.body[0];
      firstChild.chained = true;
    }

    if (this.handledByOverride(block)) {
      return;
    }

    this.TopLevelStatements(block.body);
  };

  _proto.TopLevelStatements = function TopLevelStatements(statements) {
    var _this = this;

    statements.forEach(function (statement) {
      return _this.TopLevelStatement(statement);
    });
  };

  _proto.ElementNode = function ElementNode(el) {
    if (this.handledByOverride(el)) {
      return;
    }

    this.OpenElementNode(el);
    this.TopLevelStatements(el.children);
    this.CloseElementNode(el);
  };

  _proto.OpenElementNode = function OpenElementNode(el) {
    this.buffer += "<" + el.tag;
    var parts = [].concat(el.attributes, el.modifiers, el.comments).sort(_util.sortByLoc);

    for (var _iterator = _createForOfIteratorHelperLoose(parts), _step; !(_step = _iterator()).done;) {
      var part = _step.value;
      this.buffer += ' ';

      switch (part.type) {
        case 'AttrNode':
          this.AttrNode(part);
          break;

        case 'ElementModifierStatement':
          this.ElementModifierStatement(part);
          break;

        case 'MustacheCommentStatement':
          this.MustacheCommentStatement(part);
          break;
      }
    }

    if (el.blockParams.length) {
      this.BlockParams(el.blockParams);
    }

    if (el.selfClosing) {
      this.buffer += ' /';
    }

    this.buffer += '>';
  };

  _proto.CloseElementNode = function CloseElementNode(el) {
    if (el.selfClosing || isVoidTag(el.tag)) {
      return;
    }

    this.buffer += "</" + el.tag + ">";
  };

  _proto.AttrNode = function AttrNode(attr) {
    if (this.handledByOverride(attr)) {
      return;
    }

    var name = attr.name,
        value = attr.value;
    this.buffer += name;

    if (value.type !== 'TextNode' || value.chars.length > 0) {
      this.buffer += '=';
      this.AttrNodeValue(value);
    }
  };

  _proto.AttrNodeValue = function AttrNodeValue(value) {
    if (value.type === 'TextNode') {
      this.buffer += '"';
      this.TextNode(value, true);
      this.buffer += '"';
    } else {
      this.Node(value);
    }
  };

  _proto.TextNode = function TextNode(text, isAttr) {
    if (this.handledByOverride(text)) {
      return;
    }

    if (this.options.entityEncoding === 'raw') {
      this.buffer += text.chars;
    } else if (isAttr) {
      this.buffer += (0, _util.escapeAttrValue)(text.chars);
    } else {
      this.buffer += (0, _util.escapeText)(text.chars);
    }
  };

  _proto.MustacheStatement = function MustacheStatement(mustache) {
    if (this.handledByOverride(mustache)) {
      return;
    }

    this.buffer += mustache.escaped ? '{{' : '{{{';

    if (mustache.strip.open) {
      this.buffer += '~';
    }

    this.Expression(mustache.path);
    this.Params(mustache.params);
    this.Hash(mustache.hash);

    if (mustache.strip.close) {
      this.buffer += '~';
    }

    this.buffer += mustache.escaped ? '}}' : '}}}';
  };

  _proto.BlockStatement = function BlockStatement(block) {
    if (this.handledByOverride(block)) {
      return;
    }

    if (block.chained) {
      this.buffer += block.inverseStrip.open ? '{{~' : '{{';
      this.buffer += 'else ';
    } else {
      this.buffer += block.openStrip.open ? '{{~#' : '{{#';
    }

    this.Expression(block.path);
    this.Params(block.params);
    this.Hash(block.hash);

    if (block.program.blockParams.length) {
      this.BlockParams(block.program.blockParams);
    }

    if (block.chained) {
      this.buffer += block.inverseStrip.close ? '~}}' : '}}';
    } else {
      this.buffer += block.openStrip.close ? '~}}' : '}}';
    }

    this.Block(block.program);

    if (block.inverse) {
      if (!block.inverse.chained) {
        this.buffer += block.inverseStrip.open ? '{{~' : '{{';
        this.buffer += 'else';
        this.buffer += block.inverseStrip.close ? '~}}' : '}}';
      }

      this.Block(block.inverse);
    }

    if (!block.chained) {
      this.buffer += block.closeStrip.open ? '{{~/' : '{{/';
      this.Expression(block.path);
      this.buffer += block.closeStrip.close ? '~}}' : '}}';
    }
  };

  _proto.BlockParams = function BlockParams(blockParams) {
    this.buffer += " as |" + blockParams.join(' ') + "|";
  };

  _proto.PartialStatement = function PartialStatement(partial) {
    if (this.handledByOverride(partial)) {
      return;
    }

    this.buffer += '{{>';
    this.Expression(partial.name);
    this.Params(partial.params);
    this.Hash(partial.hash);
    this.buffer += '}}';
  };

  _proto.ConcatStatement = function ConcatStatement(concat) {
    var _this2 = this;

    if (this.handledByOverride(concat)) {
      return;
    }

    this.buffer += '"';
    concat.parts.forEach(function (part) {
      if (part.type === 'TextNode') {
        _this2.TextNode(part, true);
      } else {
        _this2.Node(part);
      }
    });
    this.buffer += '"';
  };

  _proto.MustacheCommentStatement = function MustacheCommentStatement(comment) {
    if (this.handledByOverride(comment)) {
      return;
    }

    this.buffer += "{{!--" + comment.value + "--}}";
  };

  _proto.ElementModifierStatement = function ElementModifierStatement(mod) {
    if (this.handledByOverride(mod)) {
      return;
    }

    this.buffer += '{{';
    this.Expression(mod.path);
    this.Params(mod.params);
    this.Hash(mod.hash);
    this.buffer += '}}';
  };

  _proto.CommentStatement = function CommentStatement(comment) {
    if (this.handledByOverride(comment)) {
      return;
    }

    this.buffer += "<!--" + comment.value + "-->";
  };

  _proto.PathExpression = function PathExpression(path) {
    if (this.handledByOverride(path)) {
      return;
    }

    this.buffer += path.original;
  };

  _proto.SubExpression = function SubExpression(sexp) {
    if (this.handledByOverride(sexp)) {
      return;
    }

    this.buffer += '(';
    this.Expression(sexp.path);
    this.Params(sexp.params);
    this.Hash(sexp.hash);
    this.buffer += ')';
  };

  _proto.Params = function Params(params) {
    var _this3 = this; // TODO: implement a top level Params AST node (just like the Hash object)
    // so that this can also be overridden


    if (params.length) {
      params.forEach(function (param) {
        _this3.buffer += ' ';

        _this3.Expression(param);
      });
    }
  };

  _proto.Hash = function Hash(hash) {
    var _this4 = this;

    if (this.handledByOverride(hash, true)) {
      return;
    }

    hash.pairs.forEach(function (pair) {
      _this4.buffer += ' ';

      _this4.HashPair(pair);
    });
  };

  _proto.HashPair = function HashPair(pair) {
    if (this.handledByOverride(pair)) {
      return;
    }

    this.buffer += pair.key;
    this.buffer += '=';
    this.Node(pair.value);
  };

  _proto.StringLiteral = function StringLiteral(str) {
    if (this.handledByOverride(str)) {
      return;
    }

    this.buffer += JSON.stringify(str.value);
  };

  _proto.BooleanLiteral = function BooleanLiteral(bool) {
    if (this.handledByOverride(bool)) {
      return;
    }

    this.buffer += bool.value;
  };

  _proto.NumberLiteral = function NumberLiteral(number) {
    if (this.handledByOverride(number)) {
      return;
    }

    this.buffer += number.value;
  };

  _proto.UndefinedLiteral = function UndefinedLiteral(node) {
    if (this.handledByOverride(node)) {
      return;
    }

    this.buffer += 'undefined';
  };

  _proto.NullLiteral = function NullLiteral(node) {
    if (this.handledByOverride(node)) {
      return;
    }

    this.buffer += 'null';
  };

  _proto.print = function print(node) {
    var options = this.options;

    if (options.override) {
      var result = options.override(node, options);

      if (result !== undefined) {
        return result;
      }
    }

    this.buffer = '';
    this.Node(node);
    return this.buffer;
  };

  return Printer;
}();

exports.default = Printer;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvZ2VuZXJhdGlvbi9wcmludGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVPLElBQU0sT0FBTyxHQUVoQixNQUFNLENBQU4sTUFBQSxDQUZHLElBRUgsQ0FGRzs7QUFJUCxJQUFJLFlBQVksR0FBaEIscUZBQUE7QUFFQSxZQUFZLENBQVosS0FBQSxDQUFBLEdBQUEsRUFBQSxPQUFBLENBQWlDLFVBQUQsT0FBQyxFQUFXO0FBQzFDLEVBQUEsT0FBTyxDQUFQLE9BQU8sQ0FBUCxHQUFBLElBQUE7QUFERixDQUFBO0FBSUEsSUFBTSxjQUFjLEdBQXBCLElBQUE7QUFzQkE7Ozs7Ozs7OztBQVFBLFNBQUEsU0FBQSxDQUFBLEdBQUEsRUFBOEI7QUFDNUIsU0FBTyxPQUFPLENBQUMsR0FBRyxDQUFYLFdBQVEsRUFBRCxDQUFQLElBQThCLEdBQUcsQ0FBSCxDQUFHLENBQUgsQ0FBQSxXQUFBLE9BQXlCLEdBQUcsQ0FBakUsQ0FBaUUsQ0FBakU7QUFDRDs7SUFFYSxPO0FBSVosV0FBQSxPQUFBLENBQUEsT0FBQSxFQUFtQztBQUgzQixTQUFBLE1BQUEsR0FBQSxFQUFBO0FBSU4sU0FBQSxPQUFBLEdBQUEsT0FBQTtBQUNEO0FBRUQ7Ozs7Ozs7Ozs7OztTQVNBLGlCLEdBQUEsU0FBQSxpQkFBQSxDQUFBLElBQUEsRUFBQSx1QkFBQSxFQUFtRTtBQUFBLFFBQS9CLHVCQUErQixLQUFBLEtBQUEsQ0FBQSxFQUFBO0FBQS9CLE1BQUEsdUJBQStCLEdBQWxELEtBQW1CO0FBQStCOztBQUNqRSxRQUFJLEtBQUEsT0FBQSxDQUFBLFFBQUEsS0FBSixTQUFBLEVBQXlDO0FBQ3ZDLFVBQUksTUFBTSxHQUFHLEtBQUEsT0FBQSxDQUFBLFFBQUEsQ0FBQSxJQUFBLEVBQTRCLEtBQXpDLE9B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QUFBLE1BQUEsSUFBZSxNQUFNLENBQXJCLEtBQUE7OztTQUdGLGdCLEdBQUEsU0FBQSxnQkFBQSxDQUFBLElBQUEsRUFBNkM7QUFDM0MsUUFBSSxLQUFBLGlCQUFBLENBQUosSUFBSSxDQUFKLEVBQWtDO0FBQ2hDO0FBQ0Q7O0FBRUQsU0FBQSxNQUFBLElBQUEsV0FBQTs7O1NBR0YsVyxHQUFBLFNBQUEsV0FBQSxDQUFBLElBQUEsRUFBbUM7QUFDakMsUUFBSSxLQUFBLGlCQUFBLENBQUosSUFBSSxDQUFKLEVBQWtDO0FBQ2hDO0FBQ0Q7O0FBRUQsU0FBQSxNQUFBLElBQUEsTUFBQTs7O1NBR0YsSyxHQUFBLFNBQUEsS0FBQSxDQUFBLElBQUEsRUFBc0I7QUFBQSxRQUNkLE9BRGMsR0FBQSxLQUFBLE9BQUE7O0FBR3BCLFFBQUksT0FBTyxDQUFYLFFBQUEsRUFBc0I7QUFDcEIsVUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFQLFFBQUEsQ0FBQSxJQUFBLEVBQWIsT0FBYSxDQUFiOztBQUVBLFVBQUksTUFBTSxLQUFWLFNBQUEsRUFBMEI7QUFDeEIsZUFBQSxNQUFBO0FBQ0Q7QUFDRjs7QUFFRCxTQUFBLE1BQUEsR0FBQSxFQUFBO0FBQ0EsU0FBQSxJQUFBLENBQUEsSUFBQTtBQUNBLFdBQU8sS0FBUCxNQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQVNUdjEgZnJvbSAnLi4vdjEvYXBpJztcbmltcG9ydCB7IGVzY2FwZUF0dHJWYWx1ZSwgZXNjYXBlVGV4dCwgc29ydEJ5TG9jIH0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGNvbnN0IHZvaWRNYXA6IHtcbiAgW3RhZ05hbWU6IHN0cmluZ106IGJvb2xlYW47XG59ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxubGV0IHZvaWRUYWdOYW1lcyA9XG4gICdhcmVhIGJhc2UgYnIgY29sIGNvbW1hbmQgZW1iZWQgaHIgaW1nIGlucHV0IGtleWdlbiBsaW5rIG1ldGEgcGFyYW0gc291cmNlIHRyYWNrIHdicic7XG52b2lkVGFnTmFtZXMuc3BsaXQoJyAnKS5mb3JFYWNoKCh0YWdOYW1lKSA9PiB7XG4gIHZvaWRNYXBbdGFnTmFtZV0gPSB0cnVlO1xufSk7XG5cbmNvbnN0IE5PTl9XSElURVNQQUNFID0gL1xcUy87XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpbnRlck9wdGlvbnMge1xuICBlbnRpdHlFbmNvZGluZzogJ3RyYW5zZm9ybWVkJyB8ICdyYXcnO1xuXG4gIC8qKlxuICAgKiBVc2VkIHRvIG92ZXJyaWRlIHRoZSBtZWNoYW5pc20gb2YgcHJpbnRpbmcgYSBnaXZlbiBBU1QuTm9kZS5cbiAgICpcbiAgICogVGhpcyB3aWxsIGdlbmVyYWxseSBvbmx5IGJlIHVzZWZ1bCB0byBzb3VyY2UgLT4gc291cmNlIGNvZGVtb2RzXG4gICAqIHdoZXJlIHlvdSB3b3VsZCBsaWtlIHRvIHNwZWNpYWxpemUvb3ZlcnJpZGUgdGhlIHdheSBhIGdpdmVuIG5vZGUgaXNcbiAgICogcHJpbnRlZCAoZS5nLiB5b3Ugd291bGQgbGlrZSB0byBwcmVzZXJ2ZSBhcyBtdWNoIG9mIHRoZSBvcmlnaW5hbFxuICAgKiBmb3JtYXR0aW5nIGFzIHBvc3NpYmxlKS5cbiAgICpcbiAgICogV2hlbiB0aGUgcHJvdmlkZWQgb3ZlcnJpZGUgcmV0dXJucyB1bmRlZmluZWQsIHRoZSBkZWZhdWx0IGJ1aWx0IGluIHByaW50aW5nXG4gICAqIHdpbGwgYmUgZG9uZSBmb3IgdGhlIEFTVC5Ob2RlLlxuICAgKlxuICAgKiBAcGFyYW0gYXN0IHRoZSBhc3Qgbm9kZSB0byBiZSBwcmludGVkXG4gICAqIEBwYXJhbSBvcHRpb25zIHRoZSBvcHRpb25zIHNwZWNpZmllZCBkdXJpbmcgdGhlIHByaW50KCkgaW52b2NhdGlvblxuICAgKi9cbiAgb3ZlcnJpZGU/KGFzdDogQVNUdjEuTm9kZSwgb3B0aW9uczogUHJpbnRlck9wdGlvbnMpOiB2b2lkIHwgc3RyaW5nO1xufVxuXG4vKipcbiAqIEV4YW1wbGVzIHdoZW4gdHJ1ZTpcbiAqICAtIGxpbmtcbiAqICAtIGxpTktcbiAqXG4gKiBFeGFtcGxlcyB3aGVuIGZhbHNlOlxuICogIC0gTGluayAoY29tcG9uZW50KVxuICovXG5mdW5jdGlvbiBpc1ZvaWRUYWcodGFnOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZvaWRNYXBbdGFnLnRvTG93ZXJDYXNlKCldICYmIHRhZ1swXS50b0xvd2VyQ2FzZSgpID09PSB0YWdbMF07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFByaW50ZXIge1xuICBwcml2YXRlIGJ1ZmZlciA9ICcnO1xuICBwcml2YXRlIG9wdGlvbnM6IFByaW50ZXJPcHRpb25zO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IFByaW50ZXJPcHRpb25zKSB7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgfVxuXG4gIC8qXG4gICAgVGhpcyBpcyB1c2VkIGJ5IF9hbGxfIG1ldGhvZHMgb24gdGhpcyBQcmludGVyIGNsYXNzIHRoYXQgYWRkIHRvIGB0aGlzLmJ1ZmZlcmAsXG4gICAgaXQgYWxsb3dzIGNvbnN1bWVycyBvZiB0aGUgcHJpbnRlciB0byB1c2UgYWx0ZXJuYXRlIHN0cmluZyByZXByZXNlbnRhdGlvbnMgZm9yXG4gICAgYSBnaXZlbiBub2RlLlxuXG4gICAgVGhlIHByaW1hcnkgdXNlIGNhc2UgZm9yIHRoaXMgYXJlIHRoaW5ncyBsaWtlIHNvdXJjZSAtPiBzb3VyY2UgY29kZW1vZCB1dGlsaXRpZXMuXG4gICAgRm9yIGV4YW1wbGUsIGVtYmVyLXRlbXBsYXRlLXJlY2FzdCBhdHRlbXB0cyB0byBhbHdheXMgcHJlc2VydmUgdGhlIG9yaWdpbmFsIHN0cmluZ1xuICAgIGZvcm1hdHRpbmcgaW4gZWFjaCBBU1Qgbm9kZSBpZiBubyBtb2RpZmljYXRpb25zIGFyZSBtYWRlIHRvIGl0LlxuICAqL1xuICBoYW5kbGVkQnlPdmVycmlkZShub2RlOiBBU1R2MS5Ob2RlLCBlbnN1cmVMZWFkaW5nV2hpdGVzcGFjZSA9IGZhbHNlKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vdmVycmlkZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gdGhpcy5vcHRpb25zLm92ZXJyaWRlKG5vZGUsIHRoaXMub3B0aW9ucyk7XG4gICAgICBpZiAodHlwZW9mIHJlc3VsdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKGVuc3VyZUxlYWRpbmdXaGl0ZXNwYWNlICYmIHJlc3VsdCAhPT0gJycgJiYgTk9OX1dISVRFU1BBQ0UudGVzdChyZXN1bHRbMF0pKSB7XG4gICAgICAgICAgcmVzdWx0ID0gYCAke3Jlc3VsdH1gO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5idWZmZXIgKz0gcmVzdWx0O1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBOb2RlKG5vZGU6IEFTVHYxLk5vZGUpOiB2b2lkIHtcbiAgICBzd2l0Y2ggKG5vZGUudHlwZSkge1xuICAgICAgY2FzZSAnTXVzdGFjaGVTdGF0ZW1lbnQnOlxuICAgICAgY2FzZSAnQmxvY2tTdGF0ZW1lbnQnOlxuICAgICAgY2FzZSAnUGFydGlhbFN0YXRlbWVudCc6XG4gICAgICBjYXNlICdNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQnOlxuICAgICAgY2FzZSAnQ29tbWVudFN0YXRlbWVudCc6XG4gICAgICBjYXNlICdUZXh0Tm9kZSc6XG4gICAgICBjYXNlICdFbGVtZW50Tm9kZSc6XG4gICAgICBjYXNlICdBdHRyTm9kZSc6XG4gICAgICBjYXNlICdCbG9jayc6XG4gICAgICBjYXNlICdUZW1wbGF0ZSc6XG4gICAgICAgIHJldHVybiB0aGlzLlRvcExldmVsU3RhdGVtZW50KG5vZGUpO1xuICAgICAgY2FzZSAnU3RyaW5nTGl0ZXJhbCc6XG4gICAgICBjYXNlICdCb29sZWFuTGl0ZXJhbCc6XG4gICAgICBjYXNlICdOdW1iZXJMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ1VuZGVmaW5lZExpdGVyYWwnOlxuICAgICAgY2FzZSAnTnVsbExpdGVyYWwnOlxuICAgICAgY2FzZSAnUGF0aEV4cHJlc3Npb24nOlxuICAgICAgY2FzZSAnU3ViRXhwcmVzc2lvbic6XG4gICAgICAgIHJldHVybiB0aGlzLkV4cHJlc3Npb24obm9kZSk7XG4gICAgICBjYXNlICdQcm9ncmFtJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuQmxvY2sobm9kZSk7XG4gICAgICBjYXNlICdDb25jYXRTdGF0ZW1lbnQnOlxuICAgICAgICAvLyBzaG91bGQgaGF2ZSBhbiBBdHRyTm9kZSBwYXJlbnRcbiAgICAgICAgcmV0dXJuIHRoaXMuQ29uY2F0U3RhdGVtZW50KG5vZGUpO1xuICAgICAgY2FzZSAnSGFzaCc6XG4gICAgICAgIHJldHVybiB0aGlzLkhhc2gobm9kZSk7XG4gICAgICBjYXNlICdIYXNoUGFpcic6XG4gICAgICAgIHJldHVybiB0aGlzLkhhc2hQYWlyKG5vZGUpO1xuICAgICAgY2FzZSAnRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50KG5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIEV4cHJlc3Npb24oZXhwcmVzc2lvbjogQVNUdjEuRXhwcmVzc2lvbik6IHZvaWQge1xuICAgIHN3aXRjaCAoZXhwcmVzc2lvbi50eXBlKSB7XG4gICAgICBjYXNlICdTdHJpbmdMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ0Jvb2xlYW5MaXRlcmFsJzpcbiAgICAgIGNhc2UgJ051bWJlckxpdGVyYWwnOlxuICAgICAgY2FzZSAnVW5kZWZpbmVkTGl0ZXJhbCc6XG4gICAgICBjYXNlICdOdWxsTGl0ZXJhbCc6XG4gICAgICAgIHJldHVybiB0aGlzLkxpdGVyYWwoZXhwcmVzc2lvbik7XG4gICAgICBjYXNlICdQYXRoRXhwcmVzc2lvbic6XG4gICAgICAgIHJldHVybiB0aGlzLlBhdGhFeHByZXNzaW9uKGV4cHJlc3Npb24pO1xuICAgICAgY2FzZSAnU3ViRXhwcmVzc2lvbic6XG4gICAgICAgIHJldHVybiB0aGlzLlN1YkV4cHJlc3Npb24oZXhwcmVzc2lvbik7XG4gICAgfVxuICB9XG5cbiAgTGl0ZXJhbChsaXRlcmFsOiBBU1R2MS5MaXRlcmFsKTogdm9pZCB7XG4gICAgc3dpdGNoIChsaXRlcmFsLnR5cGUpIHtcbiAgICAgIGNhc2UgJ1N0cmluZ0xpdGVyYWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5TdHJpbmdMaXRlcmFsKGxpdGVyYWwpO1xuICAgICAgY2FzZSAnQm9vbGVhbkxpdGVyYWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5Cb29sZWFuTGl0ZXJhbChsaXRlcmFsKTtcbiAgICAgIGNhc2UgJ051bWJlckxpdGVyYWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5OdW1iZXJMaXRlcmFsKGxpdGVyYWwpO1xuICAgICAgY2FzZSAnVW5kZWZpbmVkTGl0ZXJhbCc6XG4gICAgICAgIHJldHVybiB0aGlzLlVuZGVmaW5lZExpdGVyYWwobGl0ZXJhbCk7XG4gICAgICBjYXNlICdOdWxsTGl0ZXJhbCc6XG4gICAgICAgIHJldHVybiB0aGlzLk51bGxMaXRlcmFsKGxpdGVyYWwpO1xuICAgIH1cbiAgfVxuXG4gIFRvcExldmVsU3RhdGVtZW50KHN0YXRlbWVudDogQVNUdjEuVG9wTGV2ZWxTdGF0ZW1lbnQgfCBBU1R2MS5UZW1wbGF0ZSB8IEFTVHYxLkF0dHJOb2RlKTogdm9pZCB7XG4gICAgc3dpdGNoIChzdGF0ZW1lbnQudHlwZSkge1xuICAgICAgY2FzZSAnTXVzdGFjaGVTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5NdXN0YWNoZVN0YXRlbWVudChzdGF0ZW1lbnQpO1xuICAgICAgY2FzZSAnQmxvY2tTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5CbG9ja1N0YXRlbWVudChzdGF0ZW1lbnQpO1xuICAgICAgY2FzZSAnUGFydGlhbFN0YXRlbWVudCc6XG4gICAgICAgIHJldHVybiB0aGlzLlBhcnRpYWxTdGF0ZW1lbnQoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ011c3RhY2hlQ29tbWVudFN0YXRlbWVudCc6XG4gICAgICAgIHJldHVybiB0aGlzLk11c3RhY2hlQ29tbWVudFN0YXRlbWVudChzdGF0ZW1lbnQpO1xuICAgICAgY2FzZSAnQ29tbWVudFN0YXRlbWVudCc6XG4gICAgICAgIHJldHVybiB0aGlzLkNvbW1lbnRTdGF0ZW1lbnQoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ1RleHROb2RlJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuVGV4dE5vZGUoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ0VsZW1lbnROb2RlJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuRWxlbWVudE5vZGUoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ0Jsb2NrJzpcbiAgICAgIGNhc2UgJ1RlbXBsYXRlJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuQmxvY2soc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ0F0dHJOb2RlJzpcbiAgICAgICAgLy8gc2hvdWxkIGhhdmUgZWxlbWVudFxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyTm9kZShzdGF0ZW1lbnQpO1xuICAgIH1cbiAgfVxuXG4gIEJsb2NrKGJsb2NrOiBBU1R2MS5CbG9jayB8IEFTVHYxLlByb2dyYW0gfCBBU1R2MS5UZW1wbGF0ZSk6IHZvaWQge1xuICAgIC8qXG4gICAgICBXaGVuIHByb2Nlc3NpbmcgYSB0ZW1wbGF0ZSBsaWtlOlxuXG4gICAgICBgYGBoYnNcbiAgICAgIHt7I2lmIHdoYXRldmVyfX1cbiAgICAgICAgd2hhdGV2ZXJcbiAgICAgIHt7ZWxzZSBpZiBzb21ldGhpbmdFbHNlfX1cbiAgICAgICAgc29tZXRoaW5nIGVsc2VcbiAgICAgIHt7ZWxzZX19XG4gICAgICAgIGZhbGxiYWNrXG4gICAgICB7ey9pZn19XG4gICAgICBgYGBcblxuICAgICAgVGhlIEFTVCBzdGlsbCBfZWZmZWN0aXZlbHlfIGxvb2tzIGxpa2U6XG5cbiAgICAgIGBgYGhic1xuICAgICAge3sjaWYgd2hhdGV2ZXJ9fVxuICAgICAgICB3aGF0ZXZlclxuICAgICAge3tlbHNlfX17eyNpZiBzb21ldGhpbmdFbHNlfX1cbiAgICAgICAgc29tZXRoaW5nIGVsc2VcbiAgICAgIHt7ZWxzZX19XG4gICAgICAgIGZhbGxiYWNrXG4gICAgICB7ey9pZn19e3svaWZ9fVxuICAgICAgYGBgXG5cbiAgICAgIFRoZSBvbmx5IHdheSB3ZSBjYW4gdGVsbCBpZiB0aGF0IGlzIHRoZSBjYXNlIGlzIGJ5IGNoZWNraW5nIGZvclxuICAgICAgYGJsb2NrLmNoYWluZWRgLCBidXQgdW5mb3J0dW5hdGVseSB3aGVuIHRoZSBhY3R1YWwgc3RhdGVtZW50cyBhcmVcbiAgICAgIHByb2Nlc3NlZCB0aGUgYGJsb2NrLmJvZHlbMF1gIG5vZGUgKHdoaWNoIHdpbGwgYWx3YXlzIGJlIGFcbiAgICAgIGBCbG9ja1N0YXRlbWVudGApIGhhcyBubyBjbHVlIHRoYXQgaXRzIGFuY2VzdG9yIGBCbG9ja2Agbm9kZSB3YXNcbiAgICAgIGNoYWluZWQuXG5cbiAgICAgIFRoaXMgXCJmb3J3YXJkc1wiIHRoZSBgY2hhaW5lZGAgc2V0dGluZyBzbyB0aGF0IHdlIGNhbiBjaGVja1xuICAgICAgaXQgbGF0ZXIgd2hlbiBwcm9jZXNzaW5nIHRoZSBgQmxvY2tTdGF0ZW1lbnRgLlxuICAgICovXG4gICAgaWYgKGJsb2NrLmNoYWluZWQpIHtcbiAgICAgIGxldCBmaXJzdENoaWxkID0gYmxvY2suYm9keVswXSBhcyBBU1R2MS5CbG9ja1N0YXRlbWVudDtcbiAgICAgIGZpcnN0Q2hpbGQuY2hhaW5lZCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoYmxvY2spKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5Ub3BMZXZlbFN0YXRlbWVudHMoYmxvY2suYm9keSk7XG4gIH1cblxuICBUb3BMZXZlbFN0YXRlbWVudHMoc3RhdGVtZW50czogQVNUdjEuVG9wTGV2ZWxTdGF0ZW1lbnRbXSk6IHZvaWQge1xuICAgIHN0YXRlbWVudHMuZm9yRWFjaCgoc3RhdGVtZW50KSA9PiB0aGlzLlRvcExldmVsU3RhdGVtZW50KHN0YXRlbWVudCkpO1xuICB9XG5cbiAgRWxlbWVudE5vZGUoZWw6IEFTVHYxLkVsZW1lbnROb2RlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoZWwpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5PcGVuRWxlbWVudE5vZGUoZWwpO1xuICAgIHRoaXMuVG9wTGV2ZWxTdGF0ZW1lbnRzKGVsLmNoaWxkcmVuKTtcbiAgICB0aGlzLkNsb3NlRWxlbWVudE5vZGUoZWwpO1xuICB9XG5cbiAgT3BlbkVsZW1lbnROb2RlKGVsOiBBU1R2MS5FbGVtZW50Tm9kZSk6IHZvaWQge1xuICAgIHRoaXMuYnVmZmVyICs9IGA8JHtlbC50YWd9YDtcbiAgICBjb25zdCBwYXJ0cyA9IFsuLi5lbC5hdHRyaWJ1dGVzLCAuLi5lbC5tb2RpZmllcnMsIC4uLmVsLmNvbW1lbnRzXS5zb3J0KHNvcnRCeUxvYyk7XG5cbiAgICBmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHMpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICcgJztcbiAgICAgIHN3aXRjaCAocGFydC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ0F0dHJOb2RlJzpcbiAgICAgICAgICB0aGlzLkF0dHJOb2RlKHBhcnQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFbGVtZW50TW9kaWZpZXJTdGF0ZW1lbnQnOlxuICAgICAgICAgIHRoaXMuRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50KHBhcnQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQnOlxuICAgICAgICAgIHRoaXMuTXVzdGFjaGVDb21tZW50U3RhdGVtZW50KHBhcnQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZWwuYmxvY2tQYXJhbXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLkJsb2NrUGFyYW1zKGVsLmJsb2NrUGFyYW1zKTtcbiAgICB9XG4gICAgaWYgKGVsLnNlbGZDbG9zaW5nKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnIC8nO1xuICAgIH1cbiAgICB0aGlzLmJ1ZmZlciArPSAnPic7XG4gIH1cblxuICBDbG9zZUVsZW1lbnROb2RlKGVsOiBBU1R2MS5FbGVtZW50Tm9kZSk6IHZvaWQge1xuICAgIGlmIChlbC5zZWxmQ2xvc2luZyB8fCBpc1ZvaWRUYWcoZWwudGFnKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmJ1ZmZlciArPSBgPC8ke2VsLnRhZ30+YDtcbiAgfVxuXG4gIEF0dHJOb2RlKGF0dHI6IEFTVHYxLkF0dHJOb2RlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoYXR0cikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgeyBuYW1lLCB2YWx1ZSB9ID0gYXR0cjtcblxuICAgIHRoaXMuYnVmZmVyICs9IG5hbWU7XG4gICAgaWYgKHZhbHVlLnR5cGUgIT09ICdUZXh0Tm9kZScgfHwgdmFsdWUuY2hhcnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5idWZmZXIgKz0gJz0nO1xuICAgICAgdGhpcy5BdHRyTm9kZVZhbHVlKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBBdHRyTm9kZVZhbHVlKHZhbHVlOiBBU1R2MS5BdHRyTm9kZVsndmFsdWUnXSk6IHZvaWQge1xuICAgIGlmICh2YWx1ZS50eXBlID09PSAnVGV4dE5vZGUnKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnXCInO1xuICAgICAgdGhpcy5UZXh0Tm9kZSh2YWx1ZSwgdHJ1ZSk7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnXCInO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLk5vZGUodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIFRleHROb2RlKHRleHQ6IEFTVHYxLlRleHROb2RlLCBpc0F0dHI/OiBib29sZWFuKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUodGV4dCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmVudGl0eUVuY29kaW5nID09PSAncmF3Jykge1xuICAgICAgdGhpcy5idWZmZXIgKz0gdGV4dC5jaGFycztcbiAgICB9IGVsc2UgaWYgKGlzQXR0cikge1xuICAgICAgdGhpcy5idWZmZXIgKz0gZXNjYXBlQXR0clZhbHVlKHRleHQuY2hhcnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSBlc2NhcGVUZXh0KHRleHQuY2hhcnMpO1xuICAgIH1cbiAgfVxuXG4gIE11c3RhY2hlU3RhdGVtZW50KG11c3RhY2hlOiBBU1R2MS5NdXN0YWNoZVN0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKG11c3RhY2hlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IG11c3RhY2hlLmVzY2FwZWQgPyAne3snIDogJ3t7eyc7XG5cbiAgICBpZiAobXVzdGFjaGUuc3RyaXAub3Blbikge1xuICAgICAgdGhpcy5idWZmZXIgKz0gJ34nO1xuICAgIH1cblxuICAgIHRoaXMuRXhwcmVzc2lvbihtdXN0YWNoZS5wYXRoKTtcbiAgICB0aGlzLlBhcmFtcyhtdXN0YWNoZS5wYXJhbXMpO1xuICAgIHRoaXMuSGFzaChtdXN0YWNoZS5oYXNoKTtcblxuICAgIGlmIChtdXN0YWNoZS5zdHJpcC5jbG9zZSkge1xuICAgICAgdGhpcy5idWZmZXIgKz0gJ34nO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IG11c3RhY2hlLmVzY2FwZWQgPyAnfX0nIDogJ319fSc7XG4gIH1cblxuICBCbG9ja1N0YXRlbWVudChibG9jazogQVNUdjEuQmxvY2tTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShibG9jaykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoYmxvY2suY2hhaW5lZCkge1xuICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2suaW52ZXJzZVN0cmlwLm9wZW4gPyAne3t+JyA6ICd7eyc7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnZWxzZSAnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSBibG9jay5vcGVuU3RyaXAub3BlbiA/ICd7e34jJyA6ICd7eyMnO1xuICAgIH1cblxuICAgIHRoaXMuRXhwcmVzc2lvbihibG9jay5wYXRoKTtcbiAgICB0aGlzLlBhcmFtcyhibG9jay5wYXJhbXMpO1xuICAgIHRoaXMuSGFzaChibG9jay5oYXNoKTtcbiAgICBpZiAoYmxvY2sucHJvZ3JhbS5ibG9ja1BhcmFtcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuQmxvY2tQYXJhbXMoYmxvY2sucHJvZ3JhbS5ibG9ja1BhcmFtcyk7XG4gICAgfVxuXG4gICAgaWYgKGJsb2NrLmNoYWluZWQpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmludmVyc2VTdHJpcC5jbG9zZSA/ICd+fX0nIDogJ319JztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2sub3BlblN0cmlwLmNsb3NlID8gJ359fScgOiAnfX0nO1xuICAgIH1cblxuICAgIHRoaXMuQmxvY2soYmxvY2sucHJvZ3JhbSk7XG5cbiAgICBpZiAoYmxvY2suaW52ZXJzZSkge1xuICAgICAgaWYgKCFibG9jay5pbnZlcnNlLmNoYWluZWQpIHtcbiAgICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2suaW52ZXJzZVN0cmlwLm9wZW4gPyAne3t+JyA6ICd7eyc7XG4gICAgICAgIHRoaXMuYnVmZmVyICs9ICdlbHNlJztcbiAgICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2suaW52ZXJzZVN0cmlwLmNsb3NlID8gJ359fScgOiAnfX0nO1xuICAgICAgfVxuXG4gICAgICB0aGlzLkJsb2NrKGJsb2NrLmludmVyc2UpO1xuICAgIH1cblxuICAgIGlmICghYmxvY2suY2hhaW5lZCkge1xuICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2suY2xvc2VTdHJpcC5vcGVuID8gJ3t7fi8nIDogJ3t7Lyc7XG4gICAgICB0aGlzLkV4cHJlc3Npb24oYmxvY2sucGF0aCk7XG4gICAgICB0aGlzLmJ1ZmZlciArPSBibG9jay5jbG9zZVN0cmlwLmNsb3NlID8gJ359fScgOiAnfX0nO1xuICAgIH1cbiAgfVxuXG4gIEJsb2NrUGFyYW1zKGJsb2NrUGFyYW1zOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgIHRoaXMuYnVmZmVyICs9IGAgYXMgfCR7YmxvY2tQYXJhbXMuam9pbignICcpfXxgO1xuICB9XG5cbiAgUGFydGlhbFN0YXRlbWVudChwYXJ0aWFsOiBBU1R2MS5QYXJ0aWFsU3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUocGFydGlhbCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSAne3s+JztcbiAgICB0aGlzLkV4cHJlc3Npb24ocGFydGlhbC5uYW1lKTtcbiAgICB0aGlzLlBhcmFtcyhwYXJ0aWFsLnBhcmFtcyk7XG4gICAgdGhpcy5IYXNoKHBhcnRpYWwuaGFzaCk7XG4gICAgdGhpcy5idWZmZXIgKz0gJ319JztcbiAgfVxuXG4gIENvbmNhdFN0YXRlbWVudChjb25jYXQ6IEFTVHYxLkNvbmNhdFN0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGNvbmNhdCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSAnXCInO1xuICAgIGNvbmNhdC5wYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgICBpZiAocGFydC50eXBlID09PSAnVGV4dE5vZGUnKSB7XG4gICAgICAgIHRoaXMuVGV4dE5vZGUocGFydCwgdHJ1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLk5vZGUocGFydCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5idWZmZXIgKz0gJ1wiJztcbiAgfVxuXG4gIE11c3RhY2hlQ29tbWVudFN0YXRlbWVudChjb21tZW50OiBBU1R2MS5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShjb21tZW50KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IGB7eyEtLSR7Y29tbWVudC52YWx1ZX0tLX19YDtcbiAgfVxuXG4gIEVsZW1lbnRNb2RpZmllclN0YXRlbWVudChtb2Q6IEFTVHYxLkVsZW1lbnRNb2RpZmllclN0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKG1vZCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSAne3snO1xuICAgIHRoaXMuRXhwcmVzc2lvbihtb2QucGF0aCk7XG4gICAgdGhpcy5QYXJhbXMobW9kLnBhcmFtcyk7XG4gICAgdGhpcy5IYXNoKG1vZC5oYXNoKTtcbiAgICB0aGlzLmJ1ZmZlciArPSAnfX0nO1xuICB9XG5cbiAgQ29tbWVudFN0YXRlbWVudChjb21tZW50OiBBU1R2MS5Db21tZW50U3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoY29tbWVudCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBgPCEtLSR7Y29tbWVudC52YWx1ZX0tLT5gO1xuICB9XG5cbiAgUGF0aEV4cHJlc3Npb24ocGF0aDogQVNUdjEuUGF0aEV4cHJlc3Npb24pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShwYXRoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IHBhdGgub3JpZ2luYWw7XG4gIH1cblxuICBTdWJFeHByZXNzaW9uKHNleHA6IEFTVHYxLlN1YkV4cHJlc3Npb24pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShzZXhwKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9ICcoJztcbiAgICB0aGlzLkV4cHJlc3Npb24oc2V4cC5wYXRoKTtcbiAgICB0aGlzLlBhcmFtcyhzZXhwLnBhcmFtcyk7XG4gICAgdGhpcy5IYXNoKHNleHAuaGFzaCk7XG4gICAgdGhpcy5idWZmZXIgKz0gJyknO1xuICB9XG5cbiAgUGFyYW1zKHBhcmFtczogQVNUdjEuRXhwcmVzc2lvbltdKTogdm9pZCB7XG4gICAgLy8gVE9ETzogaW1wbGVtZW50IGEgdG9wIGxldmVsIFBhcmFtcyBBU1Qgbm9kZSAoanVzdCBsaWtlIHRoZSBIYXNoIG9iamVjdClcbiAgICAvLyBzbyB0aGF0IHRoaXMgY2FuIGFsc28gYmUgb3ZlcnJpZGRlblxuICAgIGlmIChwYXJhbXMubGVuZ3RoKSB7XG4gICAgICBwYXJhbXMuZm9yRWFjaCgocGFyYW0pID0+IHtcbiAgICAgICAgdGhpcy5idWZmZXIgKz0gJyAnO1xuICAgICAgICB0aGlzLkV4cHJlc3Npb24ocGFyYW0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgSGFzaChoYXNoOiBBU1R2MS5IYXNoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoaGFzaCwgdHJ1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBoYXNoLnBhaXJzLmZvckVhY2goKHBhaXIpID0+IHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICcgJztcbiAgICAgIHRoaXMuSGFzaFBhaXIocGFpcik7XG4gICAgfSk7XG4gIH1cblxuICBIYXNoUGFpcihwYWlyOiBBU1R2MS5IYXNoUGFpcik6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKHBhaXIpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gcGFpci5rZXk7XG4gICAgdGhpcy5idWZmZXIgKz0gJz0nO1xuICAgIHRoaXMuTm9kZShwYWlyLnZhbHVlKTtcbiAgfVxuXG4gIFN0cmluZ0xpdGVyYWwoc3RyOiBBU1R2MS5TdHJpbmdMaXRlcmFsKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoc3RyKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IEpTT04uc3RyaW5naWZ5KHN0ci52YWx1ZSk7XG4gIH1cblxuICBCb29sZWFuTGl0ZXJhbChib29sOiBBU1R2MS5Cb29sZWFuTGl0ZXJhbCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGJvb2wpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gYm9vbC52YWx1ZTtcbiAgfVxuXG4gIE51bWJlckxpdGVyYWwobnVtYmVyOiBBU1R2MS5OdW1iZXJMaXRlcmFsKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUobnVtYmVyKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IG51bWJlci52YWx1ZTtcbiAgfVxuXG4gIFVuZGVmaW5lZExpdGVyYWwobm9kZTogQVNUdjEuVW5kZWZpbmVkTGl0ZXJhbCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKG5vZGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gJ3VuZGVmaW5lZCc7XG4gIH1cblxuICBOdWxsTGl0ZXJhbChub2RlOiBBU1R2MS5OdWxsTGl0ZXJhbCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKG5vZGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gJ251bGwnO1xuICB9XG5cbiAgcHJpbnQobm9kZTogQVNUdjEuTm9kZSk6IHN0cmluZyB7XG4gICAgbGV0IHsgb3B0aW9ucyB9ID0gdGhpcztcblxuICAgIGlmIChvcHRpb25zLm92ZXJyaWRlKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gb3B0aW9ucy5vdmVycmlkZShub2RlLCBvcHRpb25zKTtcblxuICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgPSAnJztcbiAgICB0aGlzLk5vZGUobm9kZSk7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyO1xuICB9XG59XG4iXSwic291cmNlUm9vdCI6IiJ9