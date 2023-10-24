function _createForOfIteratorHelperLoose(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; return function () { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } it = o[Symbol.iterator](); return it.next.bind(it); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

import { escapeAttrValue, escapeText, sortByLoc } from './util';
export var voidMap = Object.create(null);
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
    var parts = [].concat(el.attributes, el.modifiers, el.comments).sort(sortByLoc);

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
      this.buffer += escapeAttrValue(text.chars);
    } else {
      this.buffer += escapeText(text.chars);
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
    var _this3 = this;

    // TODO: implement a top level Params AST node (just like the Hash object)
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

export { Printer as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvZ2VuZXJhdGlvbi9wcmludGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUNBLFNBQUEsZUFBQSxFQUFBLFVBQUEsRUFBQSxTQUFBLFFBQUEsUUFBQTtBQUVBLE9BQU8sSUFBTSxPQUFPLEdBRWhCLE1BQU0sQ0FBTixNQUFBLENBRkcsSUFFSCxDQUZHO0FBSVAsSUFBSSxZQUFZLEdBQWhCLHFGQUFBO0FBRUEsWUFBWSxDQUFaLEtBQUEsQ0FBQSxHQUFBLEVBQUEsT0FBQSxDQUFpQyxVQUFBLE9BQUQsRUFBWTtBQUMxQyxFQUFBLE9BQU8sQ0FBUCxPQUFPLENBQVAsR0FBQSxJQUFBO0FBREYsQ0FBQTtBQUlBLElBQU0sY0FBYyxHQUFwQixJQUFBO0FBc0JBOzs7Ozs7Ozs7QUFRQSxTQUFBLFNBQUEsQ0FBQSxHQUFBLEVBQThCO0FBQzVCLFNBQU8sT0FBTyxDQUFDLEdBQUcsQ0FBWCxXQUFRLEVBQUQsQ0FBUCxJQUE4QixHQUFHLENBQUgsQ0FBRyxDQUFILENBQUEsV0FBQSxPQUF5QixHQUFHLENBQWpFLENBQWlFLENBQWpFO0FBQ0Q7O0lBRWEsTztBQUlaLG1CQUFBLE9BQUEsRUFBbUM7QUFIM0IsU0FBQSxNQUFBLEdBQUEsRUFBQTtBQUlOLFNBQUEsT0FBQSxHQUFBLE9BQUE7QUFDRDtBQUVEOzs7Ozs7Ozs7Ozs7U0FTQSxpQixHQUFBLDJCQUFpQixJQUFqQixFQUFvQyx1QkFBcEMsRUFBbUU7QUFBQSxRQUEvQix1QkFBK0I7QUFBL0IsTUFBQSx1QkFBK0IsR0FBbEQsS0FBa0Q7QUFBQTs7QUFDakUsUUFBSSxLQUFBLE9BQUEsQ0FBQSxRQUFBLEtBQUosU0FBQSxFQUF5QztBQUN2QyxVQUFJLE1BQU0sR0FBRyxLQUFBLE9BQUEsQ0FBQSxRQUFBLENBQUEsSUFBQSxFQUE0QixLQUF6QyxPQUFhLENBQWI7O0FBQ0EsVUFBSSxPQUFBLE1BQUEsS0FBSixRQUFB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VUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFQLFFBQUEsQ0FBQSxJQUFBLEVBQWIsT0FBYSxDQUFiOztBQUVBLFVBQUksTUFBTSxLQUFWLFNBQUEsRUFBMEI7QUFDeEIsZUFBQSxNQUFBO0FBQ0Q7QUFDRjs7QUFFRCxTQUFBLE1BQUEsR0FBQSxFQUFBO0FBQ0EsU0FBQSxJQUFBLENBQUEsSUFBQTtBQUNBLFdBQU8sS0FBUCxNQUFBO0FBQ0QsRzs7Ozs7U0F4ZVcsTyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEFTVHYxIGZyb20gJy4uL3YxL2FwaSc7XG5pbXBvcnQgeyBlc2NhcGVBdHRyVmFsdWUsIGVzY2FwZVRleHQsIHNvcnRCeUxvYyB9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBjb25zdCB2b2lkTWFwOiB7XG4gIFt0YWdOYW1lOiBzdHJpbmddOiBib29sZWFuO1xufSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbmxldCB2b2lkVGFnTmFtZXMgPVxuICAnYXJlYSBiYXNlIGJyIGNvbCBjb21tYW5kIGVtYmVkIGhyIGltZyBpbnB1dCBrZXlnZW4gbGluayBtZXRhIHBhcmFtIHNvdXJjZSB0cmFjayB3YnInO1xudm9pZFRhZ05hbWVzLnNwbGl0KCcgJykuZm9yRWFjaCgodGFnTmFtZSkgPT4ge1xuICB2b2lkTWFwW3RhZ05hbWVdID0gdHJ1ZTtcbn0pO1xuXG5jb25zdCBOT05fV0hJVEVTUEFDRSA9IC9cXFMvO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByaW50ZXJPcHRpb25zIHtcbiAgZW50aXR5RW5jb2Rpbmc6ICd0cmFuc2Zvcm1lZCcgfCAncmF3JztcblxuICAvKipcbiAgICogVXNlZCB0byBvdmVycmlkZSB0aGUgbWVjaGFuaXNtIG9mIHByaW50aW5nIGEgZ2l2ZW4gQVNULk5vZGUuXG4gICAqXG4gICAqIFRoaXMgd2lsbCBnZW5lcmFsbHkgb25seSBiZSB1c2VmdWwgdG8gc291cmNlIC0+IHNvdXJjZSBjb2RlbW9kc1xuICAgKiB3aGVyZSB5b3Ugd291bGQgbGlrZSB0byBzcGVjaWFsaXplL292ZXJyaWRlIHRoZSB3YXkgYSBnaXZlbiBub2RlIGlzXG4gICAqIHByaW50ZWQgKGUuZy4geW91IHdvdWxkIGxpa2UgdG8gcHJlc2VydmUgYXMgbXVjaCBvZiB0aGUgb3JpZ2luYWxcbiAgICogZm9ybWF0dGluZyBhcyBwb3NzaWJsZSkuXG4gICAqXG4gICAqIFdoZW4gdGhlIHByb3ZpZGVkIG92ZXJyaWRlIHJldHVybnMgdW5kZWZpbmVkLCB0aGUgZGVmYXVsdCBidWlsdCBpbiBwcmludGluZ1xuICAgKiB3aWxsIGJlIGRvbmUgZm9yIHRoZSBBU1QuTm9kZS5cbiAgICpcbiAgICogQHBhcmFtIGFzdCB0aGUgYXN0IG5vZGUgdG8gYmUgcHJpbnRlZFxuICAgKiBAcGFyYW0gb3B0aW9ucyB0aGUgb3B0aW9ucyBzcGVjaWZpZWQgZHVyaW5nIHRoZSBwcmludCgpIGludm9jYXRpb25cbiAgICovXG4gIG92ZXJyaWRlPyhhc3Q6IEFTVHYxLk5vZGUsIG9wdGlvbnM6IFByaW50ZXJPcHRpb25zKTogdm9pZCB8IHN0cmluZztcbn1cblxuLyoqXG4gKiBFeGFtcGxlcyB3aGVuIHRydWU6XG4gKiAgLSBsaW5rXG4gKiAgLSBsaU5LXG4gKlxuICogRXhhbXBsZXMgd2hlbiBmYWxzZTpcbiAqICAtIExpbmsgKGNvbXBvbmVudClcbiAqL1xuZnVuY3Rpb24gaXNWb2lkVGFnKHRhZzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB2b2lkTWFwW3RhZy50b0xvd2VyQ2FzZSgpXSAmJiB0YWdbMF0udG9Mb3dlckNhc2UoKSA9PT0gdGFnWzBdO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBQcmludGVyIHtcbiAgcHJpdmF0ZSBidWZmZXIgPSAnJztcbiAgcHJpdmF0ZSBvcHRpb25zOiBQcmludGVyT3B0aW9ucztcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBQcmludGVyT3B0aW9ucykge1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gIH1cblxuICAvKlxuICAgIFRoaXMgaXMgdXNlZCBieSBfYWxsXyBtZXRob2RzIG9uIHRoaXMgUHJpbnRlciBjbGFzcyB0aGF0IGFkZCB0byBgdGhpcy5idWZmZXJgLFxuICAgIGl0IGFsbG93cyBjb25zdW1lcnMgb2YgdGhlIHByaW50ZXIgdG8gdXNlIGFsdGVybmF0ZSBzdHJpbmcgcmVwcmVzZW50YXRpb25zIGZvclxuICAgIGEgZ2l2ZW4gbm9kZS5cblxuICAgIFRoZSBwcmltYXJ5IHVzZSBjYXNlIGZvciB0aGlzIGFyZSB0aGluZ3MgbGlrZSBzb3VyY2UgLT4gc291cmNlIGNvZGVtb2QgdXRpbGl0aWVzLlxuICAgIEZvciBleGFtcGxlLCBlbWJlci10ZW1wbGF0ZS1yZWNhc3QgYXR0ZW1wdHMgdG8gYWx3YXlzIHByZXNlcnZlIHRoZSBvcmlnaW5hbCBzdHJpbmdcbiAgICBmb3JtYXR0aW5nIGluIGVhY2ggQVNUIG5vZGUgaWYgbm8gbW9kaWZpY2F0aW9ucyBhcmUgbWFkZSB0byBpdC5cbiAgKi9cbiAgaGFuZGxlZEJ5T3ZlcnJpZGUobm9kZTogQVNUdjEuTm9kZSwgZW5zdXJlTGVhZGluZ1doaXRlc3BhY2UgPSBmYWxzZSk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm9wdGlvbnMub3ZlcnJpZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV0IHJlc3VsdCA9IHRoaXMub3B0aW9ucy5vdmVycmlkZShub2RlLCB0aGlzLm9wdGlvbnMpO1xuICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmIChlbnN1cmVMZWFkaW5nV2hpdGVzcGFjZSAmJiByZXN1bHQgIT09ICcnICYmIE5PTl9XSElURVNQQUNFLnRlc3QocmVzdWx0WzBdKSkge1xuICAgICAgICAgIHJlc3VsdCA9IGAgJHtyZXN1bHR9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYnVmZmVyICs9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgTm9kZShub2RlOiBBU1R2MS5Ob2RlKTogdm9pZCB7XG4gICAgc3dpdGNoIChub2RlLnR5cGUpIHtcbiAgICAgIGNhc2UgJ011c3RhY2hlU3RhdGVtZW50JzpcbiAgICAgIGNhc2UgJ0Jsb2NrU3RhdGVtZW50JzpcbiAgICAgIGNhc2UgJ1BhcnRpYWxTdGF0ZW1lbnQnOlxuICAgICAgY2FzZSAnTXVzdGFjaGVDb21tZW50U3RhdGVtZW50JzpcbiAgICAgIGNhc2UgJ0NvbW1lbnRTdGF0ZW1lbnQnOlxuICAgICAgY2FzZSAnVGV4dE5vZGUnOlxuICAgICAgY2FzZSAnRWxlbWVudE5vZGUnOlxuICAgICAgY2FzZSAnQXR0ck5vZGUnOlxuICAgICAgY2FzZSAnQmxvY2snOlxuICAgICAgY2FzZSAnVGVtcGxhdGUnOlxuICAgICAgICByZXR1cm4gdGhpcy5Ub3BMZXZlbFN0YXRlbWVudChub2RlKTtcbiAgICAgIGNhc2UgJ1N0cmluZ0xpdGVyYWwnOlxuICAgICAgY2FzZSAnQm9vbGVhbkxpdGVyYWwnOlxuICAgICAgY2FzZSAnTnVtYmVyTGl0ZXJhbCc6XG4gICAgICBjYXNlICdVbmRlZmluZWRMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ051bGxMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ1BhdGhFeHByZXNzaW9uJzpcbiAgICAgIGNhc2UgJ1N1YkV4cHJlc3Npb24nOlxuICAgICAgICByZXR1cm4gdGhpcy5FeHByZXNzaW9uKG5vZGUpO1xuICAgICAgY2FzZSAnUHJvZ3JhbSc6XG4gICAgICAgIHJldHVybiB0aGlzLkJsb2NrKG5vZGUpO1xuICAgICAgY2FzZSAnQ29uY2F0U3RhdGVtZW50JzpcbiAgICAgICAgLy8gc2hvdWxkIGhhdmUgYW4gQXR0ck5vZGUgcGFyZW50XG4gICAgICAgIHJldHVybiB0aGlzLkNvbmNhdFN0YXRlbWVudChub2RlKTtcbiAgICAgIGNhc2UgJ0hhc2gnOlxuICAgICAgICByZXR1cm4gdGhpcy5IYXNoKG5vZGUpO1xuICAgICAgY2FzZSAnSGFzaFBhaXInOlxuICAgICAgICByZXR1cm4gdGhpcy5IYXNoUGFpcihub2RlKTtcbiAgICAgIGNhc2UgJ0VsZW1lbnRNb2RpZmllclN0YXRlbWVudCc6XG4gICAgICAgIHJldHVybiB0aGlzLkVsZW1lbnRNb2RpZmllclN0YXRlbWVudChub2RlKTtcbiAgICB9XG4gIH1cblxuICBFeHByZXNzaW9uKGV4cHJlc3Npb246IEFTVHYxLkV4cHJlc3Npb24pOiB2b2lkIHtcbiAgICBzd2l0Y2ggKGV4cHJlc3Npb24udHlwZSkge1xuICAgICAgY2FzZSAnU3RyaW5nTGl0ZXJhbCc6XG4gICAgICBjYXNlICdCb29sZWFuTGl0ZXJhbCc6XG4gICAgICBjYXNlICdOdW1iZXJMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ1VuZGVmaW5lZExpdGVyYWwnOlxuICAgICAgY2FzZSAnTnVsbExpdGVyYWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5MaXRlcmFsKGV4cHJlc3Npb24pO1xuICAgICAgY2FzZSAnUGF0aEV4cHJlc3Npb24nOlxuICAgICAgICByZXR1cm4gdGhpcy5QYXRoRXhwcmVzc2lvbihleHByZXNzaW9uKTtcbiAgICAgIGNhc2UgJ1N1YkV4cHJlc3Npb24nOlxuICAgICAgICByZXR1cm4gdGhpcy5TdWJFeHByZXNzaW9uKGV4cHJlc3Npb24pO1xuICAgIH1cbiAgfVxuXG4gIExpdGVyYWwobGl0ZXJhbDogQVNUdjEuTGl0ZXJhbCk6IHZvaWQge1xuICAgIHN3aXRjaCAobGl0ZXJhbC50eXBlKSB7XG4gICAgICBjYXNlICdTdHJpbmdMaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuU3RyaW5nTGl0ZXJhbChsaXRlcmFsKTtcbiAgICAgIGNhc2UgJ0Jvb2xlYW5MaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuQm9vbGVhbkxpdGVyYWwobGl0ZXJhbCk7XG4gICAgICBjYXNlICdOdW1iZXJMaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuTnVtYmVyTGl0ZXJhbChsaXRlcmFsKTtcbiAgICAgIGNhc2UgJ1VuZGVmaW5lZExpdGVyYWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5VbmRlZmluZWRMaXRlcmFsKGxpdGVyYWwpO1xuICAgICAgY2FzZSAnTnVsbExpdGVyYWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5OdWxsTGl0ZXJhbChsaXRlcmFsKTtcbiAgICB9XG4gIH1cblxuICBUb3BMZXZlbFN0YXRlbWVudChzdGF0ZW1lbnQ6IEFTVHYxLlRvcExldmVsU3RhdGVtZW50IHwgQVNUdjEuVGVtcGxhdGUgfCBBU1R2MS5BdHRyTm9kZSk6IHZvaWQge1xuICAgIHN3aXRjaCAoc3RhdGVtZW50LnR5cGUpIHtcbiAgICAgIGNhc2UgJ011c3RhY2hlU3RhdGVtZW50JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuTXVzdGFjaGVTdGF0ZW1lbnQoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ0Jsb2NrU3RhdGVtZW50JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuQmxvY2tTdGF0ZW1lbnQoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ1BhcnRpYWxTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5QYXJ0aWFsU3RhdGVtZW50KHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ0NvbW1lbnRTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5Db21tZW50U3RhdGVtZW50KHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdUZXh0Tm9kZSc6XG4gICAgICAgIHJldHVybiB0aGlzLlRleHROb2RlKHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdFbGVtZW50Tm9kZSc6XG4gICAgICAgIHJldHVybiB0aGlzLkVsZW1lbnROb2RlKHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdCbG9jayc6XG4gICAgICBjYXNlICdUZW1wbGF0ZSc6XG4gICAgICAgIHJldHVybiB0aGlzLkJsb2NrKHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdBdHRyTm9kZSc6XG4gICAgICAgIC8vIHNob3VsZCBoYXZlIGVsZW1lbnRcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0ck5vZGUoc3RhdGVtZW50KTtcbiAgICB9XG4gIH1cblxuICBCbG9jayhibG9jazogQVNUdjEuQmxvY2sgfCBBU1R2MS5Qcm9ncmFtIHwgQVNUdjEuVGVtcGxhdGUpOiB2b2lkIHtcbiAgICAvKlxuICAgICAgV2hlbiBwcm9jZXNzaW5nIGEgdGVtcGxhdGUgbGlrZTpcblxuICAgICAgYGBgaGJzXG4gICAgICB7eyNpZiB3aGF0ZXZlcn19XG4gICAgICAgIHdoYXRldmVyXG4gICAgICB7e2Vsc2UgaWYgc29tZXRoaW5nRWxzZX19XG4gICAgICAgIHNvbWV0aGluZyBlbHNlXG4gICAgICB7e2Vsc2V9fVxuICAgICAgICBmYWxsYmFja1xuICAgICAge3svaWZ9fVxuICAgICAgYGBgXG5cbiAgICAgIFRoZSBBU1Qgc3RpbGwgX2VmZmVjdGl2ZWx5XyBsb29rcyBsaWtlOlxuXG4gICAgICBgYGBoYnNcbiAgICAgIHt7I2lmIHdoYXRldmVyfX1cbiAgICAgICAgd2hhdGV2ZXJcbiAgICAgIHt7ZWxzZX19e3sjaWYgc29tZXRoaW5nRWxzZX19XG4gICAgICAgIHNvbWV0aGluZyBlbHNlXG4gICAgICB7e2Vsc2V9fVxuICAgICAgICBmYWxsYmFja1xuICAgICAge3svaWZ9fXt7L2lmfX1cbiAgICAgIGBgYFxuXG4gICAgICBUaGUgb25seSB3YXkgd2UgY2FuIHRlbGwgaWYgdGhhdCBpcyB0aGUgY2FzZSBpcyBieSBjaGVja2luZyBmb3JcbiAgICAgIGBibG9jay5jaGFpbmVkYCwgYnV0IHVuZm9ydHVuYXRlbHkgd2hlbiB0aGUgYWN0dWFsIHN0YXRlbWVudHMgYXJlXG4gICAgICBwcm9jZXNzZWQgdGhlIGBibG9jay5ib2R5WzBdYCBub2RlICh3aGljaCB3aWxsIGFsd2F5cyBiZSBhXG4gICAgICBgQmxvY2tTdGF0ZW1lbnRgKSBoYXMgbm8gY2x1ZSB0aGF0IGl0cyBhbmNlc3RvciBgQmxvY2tgIG5vZGUgd2FzXG4gICAgICBjaGFpbmVkLlxuXG4gICAgICBUaGlzIFwiZm9yd2FyZHNcIiB0aGUgYGNoYWluZWRgIHNldHRpbmcgc28gdGhhdCB3ZSBjYW4gY2hlY2tcbiAgICAgIGl0IGxhdGVyIHdoZW4gcHJvY2Vzc2luZyB0aGUgYEJsb2NrU3RhdGVtZW50YC5cbiAgICAqL1xuICAgIGlmIChibG9jay5jaGFpbmVkKSB7XG4gICAgICBsZXQgZmlyc3RDaGlsZCA9IGJsb2NrLmJvZHlbMF0gYXMgQVNUdjEuQmxvY2tTdGF0ZW1lbnQ7XG4gICAgICBmaXJzdENoaWxkLmNoYWluZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGJsb2NrKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuVG9wTGV2ZWxTdGF0ZW1lbnRzKGJsb2NrLmJvZHkpO1xuICB9XG5cbiAgVG9wTGV2ZWxTdGF0ZW1lbnRzKHN0YXRlbWVudHM6IEFTVHYxLlRvcExldmVsU3RhdGVtZW50W10pOiB2b2lkIHtcbiAgICBzdGF0ZW1lbnRzLmZvckVhY2goKHN0YXRlbWVudCkgPT4gdGhpcy5Ub3BMZXZlbFN0YXRlbWVudChzdGF0ZW1lbnQpKTtcbiAgfVxuXG4gIEVsZW1lbnROb2RlKGVsOiBBU1R2MS5FbGVtZW50Tm9kZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGVsKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuT3BlbkVsZW1lbnROb2RlKGVsKTtcbiAgICB0aGlzLlRvcExldmVsU3RhdGVtZW50cyhlbC5jaGlsZHJlbik7XG4gICAgdGhpcy5DbG9zZUVsZW1lbnROb2RlKGVsKTtcbiAgfVxuXG4gIE9wZW5FbGVtZW50Tm9kZShlbDogQVNUdjEuRWxlbWVudE5vZGUpOiB2b2lkIHtcbiAgICB0aGlzLmJ1ZmZlciArPSBgPCR7ZWwudGFnfWA7XG4gICAgY29uc3QgcGFydHMgPSBbLi4uZWwuYXR0cmlidXRlcywgLi4uZWwubW9kaWZpZXJzLCAuLi5lbC5jb21tZW50c10uc29ydChzb3J0QnlMb2MpO1xuXG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnICc7XG4gICAgICBzd2l0Y2ggKHBhcnQudHlwZSkge1xuICAgICAgICBjYXNlICdBdHRyTm9kZSc6XG4gICAgICAgICAgdGhpcy5BdHRyTm9kZShwYXJ0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50JzpcbiAgICAgICAgICB0aGlzLkVsZW1lbnRNb2RpZmllclN0YXRlbWVudChwYXJ0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnTXVzdGFjaGVDb21tZW50U3RhdGVtZW50JzpcbiAgICAgICAgICB0aGlzLk11c3RhY2hlQ29tbWVudFN0YXRlbWVudChwYXJ0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGVsLmJsb2NrUGFyYW1zLmxlbmd0aCkge1xuICAgICAgdGhpcy5CbG9ja1BhcmFtcyhlbC5ibG9ja1BhcmFtcyk7XG4gICAgfVxuICAgIGlmIChlbC5zZWxmQ2xvc2luZykge1xuICAgICAgdGhpcy5idWZmZXIgKz0gJyAvJztcbiAgICB9XG4gICAgdGhpcy5idWZmZXIgKz0gJz4nO1xuICB9XG5cbiAgQ2xvc2VFbGVtZW50Tm9kZShlbDogQVNUdjEuRWxlbWVudE5vZGUpOiB2b2lkIHtcbiAgICBpZiAoZWwuc2VsZkNsb3NpbmcgfHwgaXNWb2lkVGFnKGVsLnRhZykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5idWZmZXIgKz0gYDwvJHtlbC50YWd9PmA7XG4gIH1cblxuICBBdHRyTm9kZShhdHRyOiBBU1R2MS5BdHRyTm9kZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGF0dHIpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHsgbmFtZSwgdmFsdWUgfSA9IGF0dHI7XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBuYW1lO1xuICAgIGlmICh2YWx1ZS50eXBlICE9PSAnVGV4dE5vZGUnIHx8IHZhbHVlLmNoYXJzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICc9JztcbiAgICAgIHRoaXMuQXR0ck5vZGVWYWx1ZSh2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgQXR0ck5vZGVWYWx1ZSh2YWx1ZTogQVNUdjEuQXR0ck5vZGVbJ3ZhbHVlJ10pOiB2b2lkIHtcbiAgICBpZiAodmFsdWUudHlwZSA9PT0gJ1RleHROb2RlJykge1xuICAgICAgdGhpcy5idWZmZXIgKz0gJ1wiJztcbiAgICAgIHRoaXMuVGV4dE5vZGUodmFsdWUsIHRydWUpO1xuICAgICAgdGhpcy5idWZmZXIgKz0gJ1wiJztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5Ob2RlKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBUZXh0Tm9kZSh0ZXh0OiBBU1R2MS5UZXh0Tm9kZSwgaXNBdHRyPzogYm9vbGVhbik6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKHRleHQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5lbnRpdHlFbmNvZGluZyA9PT0gJ3JhdycpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IHRleHQuY2hhcnM7XG4gICAgfSBlbHNlIGlmIChpc0F0dHIpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGVzY2FwZUF0dHJWYWx1ZSh0ZXh0LmNoYXJzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5idWZmZXIgKz0gZXNjYXBlVGV4dCh0ZXh0LmNoYXJzKTtcbiAgICB9XG4gIH1cblxuICBNdXN0YWNoZVN0YXRlbWVudChtdXN0YWNoZTogQVNUdjEuTXVzdGFjaGVTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShtdXN0YWNoZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBtdXN0YWNoZS5lc2NhcGVkID8gJ3t7JyA6ICd7e3snO1xuXG4gICAgaWYgKG11c3RhY2hlLnN0cmlwLm9wZW4pIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICd+JztcbiAgICB9XG5cbiAgICB0aGlzLkV4cHJlc3Npb24obXVzdGFjaGUucGF0aCk7XG4gICAgdGhpcy5QYXJhbXMobXVzdGFjaGUucGFyYW1zKTtcbiAgICB0aGlzLkhhc2gobXVzdGFjaGUuaGFzaCk7XG5cbiAgICBpZiAobXVzdGFjaGUuc3RyaXAuY2xvc2UpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICd+JztcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBtdXN0YWNoZS5lc2NhcGVkID8gJ319JyA6ICd9fX0nO1xuICB9XG5cbiAgQmxvY2tTdGF0ZW1lbnQoYmxvY2s6IEFTVHYxLkJsb2NrU3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoYmxvY2spKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGJsb2NrLmNoYWluZWQpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmludmVyc2VTdHJpcC5vcGVuID8gJ3t7ficgOiAne3snO1xuICAgICAgdGhpcy5idWZmZXIgKz0gJ2Vsc2UgJztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2sub3BlblN0cmlwLm9wZW4gPyAne3t+IycgOiAne3sjJztcbiAgICB9XG5cbiAgICB0aGlzLkV4cHJlc3Npb24oYmxvY2sucGF0aCk7XG4gICAgdGhpcy5QYXJhbXMoYmxvY2sucGFyYW1zKTtcbiAgICB0aGlzLkhhc2goYmxvY2suaGFzaCk7XG4gICAgaWYgKGJsb2NrLnByb2dyYW0uYmxvY2tQYXJhbXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLkJsb2NrUGFyYW1zKGJsb2NrLnByb2dyYW0uYmxvY2tQYXJhbXMpO1xuICAgIH1cblxuICAgIGlmIChibG9jay5jaGFpbmVkKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSBibG9jay5pbnZlcnNlU3RyaXAuY2xvc2UgPyAnfn19JyA6ICd9fSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLm9wZW5TdHJpcC5jbG9zZSA/ICd+fX0nIDogJ319JztcbiAgICB9XG5cbiAgICB0aGlzLkJsb2NrKGJsb2NrLnByb2dyYW0pO1xuXG4gICAgaWYgKGJsb2NrLmludmVyc2UpIHtcbiAgICAgIGlmICghYmxvY2suaW52ZXJzZS5jaGFpbmVkKSB7XG4gICAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmludmVyc2VTdHJpcC5vcGVuID8gJ3t7ficgOiAne3snO1xuICAgICAgICB0aGlzLmJ1ZmZlciArPSAnZWxzZSc7XG4gICAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmludmVyc2VTdHJpcC5jbG9zZSA/ICd+fX0nIDogJ319JztcbiAgICAgIH1cblxuICAgICAgdGhpcy5CbG9jayhibG9jay5pbnZlcnNlKTtcbiAgICB9XG5cbiAgICBpZiAoIWJsb2NrLmNoYWluZWQpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmNsb3NlU3RyaXAub3BlbiA/ICd7e34vJyA6ICd7ey8nO1xuICAgICAgdGhpcy5FeHByZXNzaW9uKGJsb2NrLnBhdGgpO1xuICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2suY2xvc2VTdHJpcC5jbG9zZSA/ICd+fX0nIDogJ319JztcbiAgICB9XG4gIH1cblxuICBCbG9ja1BhcmFtcyhibG9ja1BhcmFtczogc3RyaW5nW10pOiB2b2lkIHtcbiAgICB0aGlzLmJ1ZmZlciArPSBgIGFzIHwke2Jsb2NrUGFyYW1zLmpvaW4oJyAnKX18YDtcbiAgfVxuXG4gIFBhcnRpYWxTdGF0ZW1lbnQocGFydGlhbDogQVNUdjEuUGFydGlhbFN0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKHBhcnRpYWwpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gJ3t7Pic7XG4gICAgdGhpcy5FeHByZXNzaW9uKHBhcnRpYWwubmFtZSk7XG4gICAgdGhpcy5QYXJhbXMocGFydGlhbC5wYXJhbXMpO1xuICAgIHRoaXMuSGFzaChwYXJ0aWFsLmhhc2gpO1xuICAgIHRoaXMuYnVmZmVyICs9ICd9fSc7XG4gIH1cblxuICBDb25jYXRTdGF0ZW1lbnQoY29uY2F0OiBBU1R2MS5Db25jYXRTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShjb25jYXQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gJ1wiJztcbiAgICBjb25jYXQucGFydHMuZm9yRWFjaCgocGFydCkgPT4ge1xuICAgICAgaWYgKHBhcnQudHlwZSA9PT0gJ1RleHROb2RlJykge1xuICAgICAgICB0aGlzLlRleHROb2RlKHBhcnQsIHRydWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5Ob2RlKHBhcnQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYnVmZmVyICs9ICdcIic7XG4gIH1cblxuICBNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQoY29tbWVudDogQVNUdjEuTXVzdGFjaGVDb21tZW50U3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoY29tbWVudCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBge3shLS0ke2NvbW1lbnQudmFsdWV9LS19fWA7XG4gIH1cblxuICBFbGVtZW50TW9kaWZpZXJTdGF0ZW1lbnQobW9kOiBBU1R2MS5FbGVtZW50TW9kaWZpZXJTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShtb2QpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gJ3t7JztcbiAgICB0aGlzLkV4cHJlc3Npb24obW9kLnBhdGgpO1xuICAgIHRoaXMuUGFyYW1zKG1vZC5wYXJhbXMpO1xuICAgIHRoaXMuSGFzaChtb2QuaGFzaCk7XG4gICAgdGhpcy5idWZmZXIgKz0gJ319JztcbiAgfVxuXG4gIENvbW1lbnRTdGF0ZW1lbnQoY29tbWVudDogQVNUdjEuQ29tbWVudFN0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGNvbW1lbnQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gYDwhLS0ke2NvbW1lbnQudmFsdWV9LS0+YDtcbiAgfVxuXG4gIFBhdGhFeHByZXNzaW9uKHBhdGg6IEFTVHYxLlBhdGhFeHByZXNzaW9uKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUocGF0aCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBwYXRoLm9yaWdpbmFsO1xuICB9XG5cbiAgU3ViRXhwcmVzc2lvbihzZXhwOiBBU1R2MS5TdWJFeHByZXNzaW9uKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoc2V4cCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSAnKCc7XG4gICAgdGhpcy5FeHByZXNzaW9uKHNleHAucGF0aCk7XG4gICAgdGhpcy5QYXJhbXMoc2V4cC5wYXJhbXMpO1xuICAgIHRoaXMuSGFzaChzZXhwLmhhc2gpO1xuICAgIHRoaXMuYnVmZmVyICs9ICcpJztcbiAgfVxuXG4gIFBhcmFtcyhwYXJhbXM6IEFTVHYxLkV4cHJlc3Npb25bXSk6IHZvaWQge1xuICAgIC8vIFRPRE86IGltcGxlbWVudCBhIHRvcCBsZXZlbCBQYXJhbXMgQVNUIG5vZGUgKGp1c3QgbGlrZSB0aGUgSGFzaCBvYmplY3QpXG4gICAgLy8gc28gdGhhdCB0aGlzIGNhbiBhbHNvIGJlIG92ZXJyaWRkZW5cbiAgICBpZiAocGFyYW1zLmxlbmd0aCkge1xuICAgICAgcGFyYW1zLmZvckVhY2goKHBhcmFtKSA9PiB7XG4gICAgICAgIHRoaXMuYnVmZmVyICs9ICcgJztcbiAgICAgICAgdGhpcy5FeHByZXNzaW9uKHBhcmFtKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIEhhc2goaGFzaDogQVNUdjEuSGFzaCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGhhc2gsIHRydWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaGFzaC5wYWlycy5mb3JFYWNoKChwYWlyKSA9PiB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnICc7XG4gICAgICB0aGlzLkhhc2hQYWlyKHBhaXIpO1xuICAgIH0pO1xuICB9XG5cbiAgSGFzaFBhaXIocGFpcjogQVNUdjEuSGFzaFBhaXIpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShwYWlyKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IHBhaXIua2V5O1xuICAgIHRoaXMuYnVmZmVyICs9ICc9JztcbiAgICB0aGlzLk5vZGUocGFpci52YWx1ZSk7XG4gIH1cblxuICBTdHJpbmdMaXRlcmFsKHN0cjogQVNUdjEuU3RyaW5nTGl0ZXJhbCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKHN0cikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBKU09OLnN0cmluZ2lmeShzdHIudmFsdWUpO1xuICB9XG5cbiAgQm9vbGVhbkxpdGVyYWwoYm9vbDogQVNUdjEuQm9vbGVhbkxpdGVyYWwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShib29sKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IGJvb2wudmFsdWU7XG4gIH1cblxuICBOdW1iZXJMaXRlcmFsKG51bWJlcjogQVNUdjEuTnVtYmVyTGl0ZXJhbCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKG51bWJlcikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBudW1iZXIudmFsdWU7XG4gIH1cblxuICBVbmRlZmluZWRMaXRlcmFsKG5vZGU6IEFTVHYxLlVuZGVmaW5lZExpdGVyYWwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShub2RlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9ICd1bmRlZmluZWQnO1xuICB9XG5cbiAgTnVsbExpdGVyYWwobm9kZTogQVNUdjEuTnVsbExpdGVyYWwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShub2RlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9ICdudWxsJztcbiAgfVxuXG4gIHByaW50KG5vZGU6IEFTVHYxLk5vZGUpOiBzdHJpbmcge1xuICAgIGxldCB7IG9wdGlvbnMgfSA9IHRoaXM7XG5cbiAgICBpZiAob3B0aW9ucy5vdmVycmlkZSkge1xuICAgICAgbGV0IHJlc3VsdCA9IG9wdGlvbnMub3ZlcnJpZGUobm9kZSwgb3B0aW9ucyk7XG5cbiAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyID0gJyc7XG4gICAgdGhpcy5Ob2RlKG5vZGUpO1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlcjtcbiAgfVxufVxuIl0sInNvdXJjZVJvb3QiOiIifQ==