import { escapeAttrValue, escapeText, sortByLoc } from './util';
export const voidMap = Object.create(null);
let voidTagNames = 'area base br col command embed hr img input keygen link meta param source track wbr';
voidTagNames.split(' ').forEach(tagName => {
  voidMap[tagName] = true;
});
const NON_WHITESPACE = /\S/;
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

export default class Printer {
  constructor(options) {
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


  handledByOverride(node, ensureLeadingWhitespace = false) {
    if (this.options.override !== undefined) {
      let result = this.options.override(node, this.options);

      if (typeof result === 'string') {
        if (ensureLeadingWhitespace && result !== '' && NON_WHITESPACE.test(result[0])) {
          result = ` ${result}`;
        }

        this.buffer += result;
        return true;
      }
    }

    return false;
  }

  Node(node) {
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
  }

  Expression(expression) {
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
  }

  Literal(literal) {
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
  }

  TopLevelStatement(statement) {
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
  }

  Block(block) {
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
      let firstChild = block.body[0];
      firstChild.chained = true;
    }

    if (this.handledByOverride(block)) {
      return;
    }

    this.TopLevelStatements(block.body);
  }

  TopLevelStatements(statements) {
    statements.forEach(statement => this.TopLevelStatement(statement));
  }

  ElementNode(el) {
    if (this.handledByOverride(el)) {
      return;
    }

    this.OpenElementNode(el);
    this.TopLevelStatements(el.children);
    this.CloseElementNode(el);
  }

  OpenElementNode(el) {
    this.buffer += `<${el.tag}`;
    const parts = [...el.attributes, ...el.modifiers, ...el.comments].sort(sortByLoc);

    for (const part of parts) {
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
  }

  CloseElementNode(el) {
    if (el.selfClosing || isVoidTag(el.tag)) {
      return;
    }

    this.buffer += `</${el.tag}>`;
  }

  AttrNode(attr) {
    if (this.handledByOverride(attr)) {
      return;
    }

    let {
      name,
      value
    } = attr;
    this.buffer += name;

    if (value.type !== 'TextNode' || value.chars.length > 0) {
      this.buffer += '=';
      this.AttrNodeValue(value);
    }
  }

  AttrNodeValue(value) {
    if (value.type === 'TextNode') {
      this.buffer += '"';
      this.TextNode(value, true);
      this.buffer += '"';
    } else {
      this.Node(value);
    }
  }

  TextNode(text, isAttr) {
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
  }

  MustacheStatement(mustache) {
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
  }

  BlockStatement(block) {
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
  }

  BlockParams(blockParams) {
    this.buffer += ` as |${blockParams.join(' ')}|`;
  }

  PartialStatement(partial) {
    if (this.handledByOverride(partial)) {
      return;
    }

    this.buffer += '{{>';
    this.Expression(partial.name);
    this.Params(partial.params);
    this.Hash(partial.hash);
    this.buffer += '}}';
  }

  ConcatStatement(concat) {
    if (this.handledByOverride(concat)) {
      return;
    }

    this.buffer += '"';
    concat.parts.forEach(part => {
      if (part.type === 'TextNode') {
        this.TextNode(part, true);
      } else {
        this.Node(part);
      }
    });
    this.buffer += '"';
  }

  MustacheCommentStatement(comment) {
    if (this.handledByOverride(comment)) {
      return;
    }

    this.buffer += `{{!--${comment.value}--}}`;
  }

  ElementModifierStatement(mod) {
    if (this.handledByOverride(mod)) {
      return;
    }

    this.buffer += '{{';
    this.Expression(mod.path);
    this.Params(mod.params);
    this.Hash(mod.hash);
    this.buffer += '}}';
  }

  CommentStatement(comment) {
    if (this.handledByOverride(comment)) {
      return;
    }

    this.buffer += `<!--${comment.value}-->`;
  }

  PathExpression(path) {
    if (this.handledByOverride(path)) {
      return;
    }

    this.buffer += path.original;
  }

  SubExpression(sexp) {
    if (this.handledByOverride(sexp)) {
      return;
    }

    this.buffer += '(';
    this.Expression(sexp.path);
    this.Params(sexp.params);
    this.Hash(sexp.hash);
    this.buffer += ')';
  }

  Params(params) {
    // TODO: implement a top level Params AST node (just like the Hash object)
    // so that this can also be overridden
    if (params.length) {
      params.forEach(param => {
        this.buffer += ' ';
        this.Expression(param);
      });
    }
  }

  Hash(hash) {
    if (this.handledByOverride(hash, true)) {
      return;
    }

    hash.pairs.forEach(pair => {
      this.buffer += ' ';
      this.HashPair(pair);
    });
  }

  HashPair(pair) {
    if (this.handledByOverride(pair)) {
      return;
    }

    this.buffer += pair.key;
    this.buffer += '=';
    this.Node(pair.value);
  }

  StringLiteral(str) {
    if (this.handledByOverride(str)) {
      return;
    }

    this.buffer += JSON.stringify(str.value);
  }

  BooleanLiteral(bool) {
    if (this.handledByOverride(bool)) {
      return;
    }

    this.buffer += bool.value;
  }

  NumberLiteral(number) {
    if (this.handledByOverride(number)) {
      return;
    }

    this.buffer += number.value;
  }

  UndefinedLiteral(node) {
    if (this.handledByOverride(node)) {
      return;
    }

    this.buffer += 'undefined';
  }

  NullLiteral(node) {
    if (this.handledByOverride(node)) {
      return;
    }

    this.buffer += 'null';
  }

  print(node) {
    let {
      options
    } = this;

    if (options.override) {
      let result = options.override(node, options);

      if (result !== undefined) {
        return result;
      }
    }

    this.buffer = '';
    this.Node(node);
    return this.buffer;
  }

}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvZ2VuZXJhdGlvbi9wcmludGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLFNBQVMsZUFBVCxFQUEwQixVQUExQixFQUFzQyxTQUF0QyxRQUF1RCxRQUF2RDtBQUVBLE9BQU8sTUFBTSxPQUFPLEdBRWhCLE1BQU0sQ0FBQyxNQUFQLENBQWMsSUFBZCxDQUZHO0FBSVAsSUFBSSxZQUFZLEdBQ2QscUZBREY7QUFFQSxZQUFZLENBQUMsS0FBYixDQUFtQixHQUFuQixFQUF3QixPQUF4QixDQUFpQyxPQUFELElBQVk7QUFDMUMsRUFBQSxPQUFPLENBQUMsT0FBRCxDQUFQLEdBQW1CLElBQW5CO0FBQ0QsQ0FGRDtBQUlBLE1BQU0sY0FBYyxHQUFHLElBQXZCO0FBc0JBOzs7Ozs7Ozs7QUFRQSxTQUFTLFNBQVQsQ0FBbUIsR0FBbkIsRUFBOEI7QUFDNUIsU0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQUosRUFBRCxDQUFQLElBQThCLEdBQUcsQ0FBQyxDQUFELENBQUgsQ0FBTyxXQUFQLE9BQXlCLEdBQUcsQ0FBQyxDQUFELENBQWpFO0FBQ0Q7O0FBRUQsZUFBYyxNQUFPLE9BQVAsQ0FBYztBQUkxQixFQUFBLFdBQUEsQ0FBWSxPQUFaLEVBQW1DO0FBSDNCLFNBQUEsTUFBQSxHQUFTLEVBQVQ7QUFJTixTQUFLLE9BQUwsR0FBZSxPQUFmO0FBQ0Q7QUFFRDs7Ozs7Ozs7OztBQVNBLEVBQUEsaUJBQWlCLENBQUMsSUFBRCxFQUFtQix1QkFBdUIsR0FBRyxLQUE3QyxFQUFrRDtBQUNqRSxRQUFJLEtBQUssT0FBTCxDQUFhLFFBQWIsS0FBMEIsU0FBOUIsRUFBeUM7QUFDdkMsVUFBSSxNQUFNLEdBQUcsS0FBSyxPQUFMLENBQWEsUUFBYixDQUFzQixJQUF0QixFQUE0QixLQUFLLE9BQWpDLENBQWI7O0FBQ0EsVUFBSSxPQUFPLE1BQVAsS0FBa0IsUUFBdEIsRUFBZ0M7QUFD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LE1BQUE7QUFBRixRQUFjLElBQWxCOztBQUVBLFFBQUksT0FBTyxDQUFDLFFBQVosRUFBc0I7QUFDcEIsVUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLFFBQVIsQ0FBaUIsSUFBakIsRUFBdUIsT0FBdkIsQ0FBYjs7QUFFQSxVQUFJLE1BQU0sS0FBSyxTQUFmLEVBQTBCO0FBQ3hCLGVBQU8sTUFBUDtBQUNEO0FBQ0Y7O0FBRUQsU0FBSyxNQUFMLEdBQWMsRUFBZDtBQUNBLFNBQUssSUFBTCxDQUFVLElBQVY7QUFDQSxXQUFPLEtBQUssTUFBWjtBQUNEOztBQXhleUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuLi92MS9hcGknO1xuaW1wb3J0IHsgZXNjYXBlQXR0clZhbHVlLCBlc2NhcGVUZXh0LCBzb3J0QnlMb2MgfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgY29uc3Qgdm9pZE1hcDoge1xuICBbdGFnTmFtZTogc3RyaW5nXTogYm9vbGVhbjtcbn0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG5sZXQgdm9pZFRhZ05hbWVzID1cbiAgJ2FyZWEgYmFzZSBiciBjb2wgY29tbWFuZCBlbWJlZCBociBpbWcgaW5wdXQga2V5Z2VuIGxpbmsgbWV0YSBwYXJhbSBzb3VyY2UgdHJhY2sgd2JyJztcbnZvaWRUYWdOYW1lcy5zcGxpdCgnICcpLmZvckVhY2goKHRhZ05hbWUpID0+IHtcbiAgdm9pZE1hcFt0YWdOYW1lXSA9IHRydWU7XG59KTtcblxuY29uc3QgTk9OX1dISVRFU1BBQ0UgPSAvXFxTLztcblxuZXhwb3J0IGludGVyZmFjZSBQcmludGVyT3B0aW9ucyB7XG4gIGVudGl0eUVuY29kaW5nOiAndHJhbnNmb3JtZWQnIHwgJ3Jhdyc7XG5cbiAgLyoqXG4gICAqIFVzZWQgdG8gb3ZlcnJpZGUgdGhlIG1lY2hhbmlzbSBvZiBwcmludGluZyBhIGdpdmVuIEFTVC5Ob2RlLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgZ2VuZXJhbGx5IG9ubHkgYmUgdXNlZnVsIHRvIHNvdXJjZSAtPiBzb3VyY2UgY29kZW1vZHNcbiAgICogd2hlcmUgeW91IHdvdWxkIGxpa2UgdG8gc3BlY2lhbGl6ZS9vdmVycmlkZSB0aGUgd2F5IGEgZ2l2ZW4gbm9kZSBpc1xuICAgKiBwcmludGVkIChlLmcuIHlvdSB3b3VsZCBsaWtlIHRvIHByZXNlcnZlIGFzIG11Y2ggb2YgdGhlIG9yaWdpbmFsXG4gICAqIGZvcm1hdHRpbmcgYXMgcG9zc2libGUpLlxuICAgKlxuICAgKiBXaGVuIHRoZSBwcm92aWRlZCBvdmVycmlkZSByZXR1cm5zIHVuZGVmaW5lZCwgdGhlIGRlZmF1bHQgYnVpbHQgaW4gcHJpbnRpbmdcbiAgICogd2lsbCBiZSBkb25lIGZvciB0aGUgQVNULk5vZGUuXG4gICAqXG4gICAqIEBwYXJhbSBhc3QgdGhlIGFzdCBub2RlIHRvIGJlIHByaW50ZWRcbiAgICogQHBhcmFtIG9wdGlvbnMgdGhlIG9wdGlvbnMgc3BlY2lmaWVkIGR1cmluZyB0aGUgcHJpbnQoKSBpbnZvY2F0aW9uXG4gICAqL1xuICBvdmVycmlkZT8oYXN0OiBBU1R2MS5Ob2RlLCBvcHRpb25zOiBQcmludGVyT3B0aW9ucyk6IHZvaWQgfCBzdHJpbmc7XG59XG5cbi8qKlxuICogRXhhbXBsZXMgd2hlbiB0cnVlOlxuICogIC0gbGlua1xuICogIC0gbGlOS1xuICpcbiAqIEV4YW1wbGVzIHdoZW4gZmFsc2U6XG4gKiAgLSBMaW5rIChjb21wb25lbnQpXG4gKi9cbmZ1bmN0aW9uIGlzVm9pZFRhZyh0YWc6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gdm9pZE1hcFt0YWcudG9Mb3dlckNhc2UoKV0gJiYgdGFnWzBdLnRvTG93ZXJDYXNlKCkgPT09IHRhZ1swXTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUHJpbnRlciB7XG4gIHByaXZhdGUgYnVmZmVyID0gJyc7XG4gIHByaXZhdGUgb3B0aW9uczogUHJpbnRlck9wdGlvbnM7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9uczogUHJpbnRlck9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICB9XG5cbiAgLypcbiAgICBUaGlzIGlzIHVzZWQgYnkgX2FsbF8gbWV0aG9kcyBvbiB0aGlzIFByaW50ZXIgY2xhc3MgdGhhdCBhZGQgdG8gYHRoaXMuYnVmZmVyYCxcbiAgICBpdCBhbGxvd3MgY29uc3VtZXJzIG9mIHRoZSBwcmludGVyIHRvIHVzZSBhbHRlcm5hdGUgc3RyaW5nIHJlcHJlc2VudGF0aW9ucyBmb3JcbiAgICBhIGdpdmVuIG5vZGUuXG5cbiAgICBUaGUgcHJpbWFyeSB1c2UgY2FzZSBmb3IgdGhpcyBhcmUgdGhpbmdzIGxpa2Ugc291cmNlIC0+IHNvdXJjZSBjb2RlbW9kIHV0aWxpdGllcy5cbiAgICBGb3IgZXhhbXBsZSwgZW1iZXItdGVtcGxhdGUtcmVjYXN0IGF0dGVtcHRzIHRvIGFsd2F5cyBwcmVzZXJ2ZSB0aGUgb3JpZ2luYWwgc3RyaW5nXG4gICAgZm9ybWF0dGluZyBpbiBlYWNoIEFTVCBub2RlIGlmIG5vIG1vZGlmaWNhdGlvbnMgYXJlIG1hZGUgdG8gaXQuXG4gICovXG4gIGhhbmRsZWRCeU92ZXJyaWRlKG5vZGU6IEFTVHYxLk5vZGUsIGVuc3VyZUxlYWRpbmdXaGl0ZXNwYWNlID0gZmFsc2UpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLm92ZXJyaWRlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxldCByZXN1bHQgPSB0aGlzLm9wdGlvbnMub3ZlcnJpZGUobm9kZSwgdGhpcy5vcHRpb25zKTtcbiAgICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoZW5zdXJlTGVhZGluZ1doaXRlc3BhY2UgJiYgcmVzdWx0ICE9PSAnJyAmJiBOT05fV0hJVEVTUEFDRS50ZXN0KHJlc3VsdFswXSkpIHtcbiAgICAgICAgICByZXN1bHQgPSBgICR7cmVzdWx0fWA7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmJ1ZmZlciArPSByZXN1bHQ7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIE5vZGUobm9kZTogQVNUdjEuTm9kZSk6IHZvaWQge1xuICAgIHN3aXRjaCAobm9kZS50eXBlKSB7XG4gICAgICBjYXNlICdNdXN0YWNoZVN0YXRlbWVudCc6XG4gICAgICBjYXNlICdCbG9ja1N0YXRlbWVudCc6XG4gICAgICBjYXNlICdQYXJ0aWFsU3RhdGVtZW50JzpcbiAgICAgIGNhc2UgJ011c3RhY2hlQ29tbWVudFN0YXRlbWVudCc6XG4gICAgICBjYXNlICdDb21tZW50U3RhdGVtZW50JzpcbiAgICAgIGNhc2UgJ1RleHROb2RlJzpcbiAgICAgIGNhc2UgJ0VsZW1lbnROb2RlJzpcbiAgICAgIGNhc2UgJ0F0dHJOb2RlJzpcbiAgICAgIGNhc2UgJ0Jsb2NrJzpcbiAgICAgIGNhc2UgJ1RlbXBsYXRlJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuVG9wTGV2ZWxTdGF0ZW1lbnQobm9kZSk7XG4gICAgICBjYXNlICdTdHJpbmdMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ0Jvb2xlYW5MaXRlcmFsJzpcbiAgICAgIGNhc2UgJ051bWJlckxpdGVyYWwnOlxuICAgICAgY2FzZSAnVW5kZWZpbmVkTGl0ZXJhbCc6XG4gICAgICBjYXNlICdOdWxsTGl0ZXJhbCc6XG4gICAgICBjYXNlICdQYXRoRXhwcmVzc2lvbic6XG4gICAgICBjYXNlICdTdWJFeHByZXNzaW9uJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuRXhwcmVzc2lvbihub2RlKTtcbiAgICAgIGNhc2UgJ1Byb2dyYW0nOlxuICAgICAgICByZXR1cm4gdGhpcy5CbG9jayhub2RlKTtcbiAgICAgIGNhc2UgJ0NvbmNhdFN0YXRlbWVudCc6XG4gICAgICAgIC8vIHNob3VsZCBoYXZlIGFuIEF0dHJOb2RlIHBhcmVudFxuICAgICAgICByZXR1cm4gdGhpcy5Db25jYXRTdGF0ZW1lbnQobm9kZSk7XG4gICAgICBjYXNlICdIYXNoJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuSGFzaChub2RlKTtcbiAgICAgIGNhc2UgJ0hhc2hQYWlyJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuSGFzaFBhaXIobm9kZSk7XG4gICAgICBjYXNlICdFbGVtZW50TW9kaWZpZXJTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5FbGVtZW50TW9kaWZpZXJTdGF0ZW1lbnQobm9kZSk7XG4gICAgfVxuICB9XG5cbiAgRXhwcmVzc2lvbihleHByZXNzaW9uOiBBU1R2MS5FeHByZXNzaW9uKTogdm9pZCB7XG4gICAgc3dpdGNoIChleHByZXNzaW9uLnR5cGUpIHtcbiAgICAgIGNhc2UgJ1N0cmluZ0xpdGVyYWwnOlxuICAgICAgY2FzZSAnQm9vbGVhbkxpdGVyYWwnOlxuICAgICAgY2FzZSAnTnVtYmVyTGl0ZXJhbCc6XG4gICAgICBjYXNlICdVbmRlZmluZWRMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ051bGxMaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuTGl0ZXJhbChleHByZXNzaW9uKTtcbiAgICAgIGNhc2UgJ1BhdGhFeHByZXNzaW9uJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuUGF0aEV4cHJlc3Npb24oZXhwcmVzc2lvbik7XG4gICAgICBjYXNlICdTdWJFeHByZXNzaW9uJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuU3ViRXhwcmVzc2lvbihleHByZXNzaW9uKTtcbiAgICB9XG4gIH1cblxuICBMaXRlcmFsKGxpdGVyYWw6IEFTVHYxLkxpdGVyYWwpOiB2b2lkIHtcbiAgICBzd2l0Y2ggKGxpdGVyYWwudHlwZSkge1xuICAgICAgY2FzZSAnU3RyaW5nTGl0ZXJhbCc6XG4gICAgICAgIHJldHVybiB0aGlzLlN0cmluZ0xpdGVyYWwobGl0ZXJhbCk7XG4gICAgICBjYXNlICdCb29sZWFuTGl0ZXJhbCc6XG4gICAgICAgIHJldHVybiB0aGlzLkJvb2xlYW5MaXRlcmFsKGxpdGVyYWwpO1xuICAgICAgY2FzZSAnTnVtYmVyTGl0ZXJhbCc6XG4gICAgICAgIHJldHVybiB0aGlzLk51bWJlckxpdGVyYWwobGl0ZXJhbCk7XG4gICAgICBjYXNlICdVbmRlZmluZWRMaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuVW5kZWZpbmVkTGl0ZXJhbChsaXRlcmFsKTtcbiAgICAgIGNhc2UgJ051bGxMaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuTnVsbExpdGVyYWwobGl0ZXJhbCk7XG4gICAgfVxuICB9XG5cbiAgVG9wTGV2ZWxTdGF0ZW1lbnQoc3RhdGVtZW50OiBBU1R2MS5Ub3BMZXZlbFN0YXRlbWVudCB8IEFTVHYxLlRlbXBsYXRlIHwgQVNUdjEuQXR0ck5vZGUpOiB2b2lkIHtcbiAgICBzd2l0Y2ggKHN0YXRlbWVudC50eXBlKSB7XG4gICAgICBjYXNlICdNdXN0YWNoZVN0YXRlbWVudCc6XG4gICAgICAgIHJldHVybiB0aGlzLk11c3RhY2hlU3RhdGVtZW50KHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdCbG9ja1N0YXRlbWVudCc6XG4gICAgICAgIHJldHVybiB0aGlzLkJsb2NrU3RhdGVtZW50KHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdQYXJ0aWFsU3RhdGVtZW50JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuUGFydGlhbFN0YXRlbWVudChzdGF0ZW1lbnQpO1xuICAgICAgY2FzZSAnTXVzdGFjaGVDb21tZW50U3RhdGVtZW50JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuTXVzdGFjaGVDb21tZW50U3RhdGVtZW50KHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdDb21tZW50U3RhdGVtZW50JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuQ29tbWVudFN0YXRlbWVudChzdGF0ZW1lbnQpO1xuICAgICAgY2FzZSAnVGV4dE5vZGUnOlxuICAgICAgICByZXR1cm4gdGhpcy5UZXh0Tm9kZShzdGF0ZW1lbnQpO1xuICAgICAgY2FzZSAnRWxlbWVudE5vZGUnOlxuICAgICAgICByZXR1cm4gdGhpcy5FbGVtZW50Tm9kZShzdGF0ZW1lbnQpO1xuICAgICAgY2FzZSAnQmxvY2snOlxuICAgICAgY2FzZSAnVGVtcGxhdGUnOlxuICAgICAgICByZXR1cm4gdGhpcy5CbG9jayhzdGF0ZW1lbnQpO1xuICAgICAgY2FzZSAnQXR0ck5vZGUnOlxuICAgICAgICAvLyBzaG91bGQgaGF2ZSBlbGVtZW50XG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJOb2RlKHN0YXRlbWVudCk7XG4gICAgfVxuICB9XG5cbiAgQmxvY2soYmxvY2s6IEFTVHYxLkJsb2NrIHwgQVNUdjEuUHJvZ3JhbSB8IEFTVHYxLlRlbXBsYXRlKTogdm9pZCB7XG4gICAgLypcbiAgICAgIFdoZW4gcHJvY2Vzc2luZyBhIHRlbXBsYXRlIGxpa2U6XG5cbiAgICAgIGBgYGhic1xuICAgICAge3sjaWYgd2hhdGV2ZXJ9fVxuICAgICAgICB3aGF0ZXZlclxuICAgICAge3tlbHNlIGlmIHNvbWV0aGluZ0Vsc2V9fVxuICAgICAgICBzb21ldGhpbmcgZWxzZVxuICAgICAge3tlbHNlfX1cbiAgICAgICAgZmFsbGJhY2tcbiAgICAgIHt7L2lmfX1cbiAgICAgIGBgYFxuXG4gICAgICBUaGUgQVNUIHN0aWxsIF9lZmZlY3RpdmVseV8gbG9va3MgbGlrZTpcblxuICAgICAgYGBgaGJzXG4gICAgICB7eyNpZiB3aGF0ZXZlcn19XG4gICAgICAgIHdoYXRldmVyXG4gICAgICB7e2Vsc2V9fXt7I2lmIHNvbWV0aGluZ0Vsc2V9fVxuICAgICAgICBzb21ldGhpbmcgZWxzZVxuICAgICAge3tlbHNlfX1cbiAgICAgICAgZmFsbGJhY2tcbiAgICAgIHt7L2lmfX17ey9pZn19XG4gICAgICBgYGBcblxuICAgICAgVGhlIG9ubHkgd2F5IHdlIGNhbiB0ZWxsIGlmIHRoYXQgaXMgdGhlIGNhc2UgaXMgYnkgY2hlY2tpbmcgZm9yXG4gICAgICBgYmxvY2suY2hhaW5lZGAsIGJ1dCB1bmZvcnR1bmF0ZWx5IHdoZW4gdGhlIGFjdHVhbCBzdGF0ZW1lbnRzIGFyZVxuICAgICAgcHJvY2Vzc2VkIHRoZSBgYmxvY2suYm9keVswXWAgbm9kZSAod2hpY2ggd2lsbCBhbHdheXMgYmUgYVxuICAgICAgYEJsb2NrU3RhdGVtZW50YCkgaGFzIG5vIGNsdWUgdGhhdCBpdHMgYW5jZXN0b3IgYEJsb2NrYCBub2RlIHdhc1xuICAgICAgY2hhaW5lZC5cblxuICAgICAgVGhpcyBcImZvcndhcmRzXCIgdGhlIGBjaGFpbmVkYCBzZXR0aW5nIHNvIHRoYXQgd2UgY2FuIGNoZWNrXG4gICAgICBpdCBsYXRlciB3aGVuIHByb2Nlc3NpbmcgdGhlIGBCbG9ja1N0YXRlbWVudGAuXG4gICAgKi9cbiAgICBpZiAoYmxvY2suY2hhaW5lZCkge1xuICAgICAgbGV0IGZpcnN0Q2hpbGQgPSBibG9jay5ib2R5WzBdIGFzIEFTVHYxLkJsb2NrU3RhdGVtZW50O1xuICAgICAgZmlyc3RDaGlsZC5jaGFpbmVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShibG9jaykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLlRvcExldmVsU3RhdGVtZW50cyhibG9jay5ib2R5KTtcbiAgfVxuXG4gIFRvcExldmVsU3RhdGVtZW50cyhzdGF0ZW1lbnRzOiBBU1R2MS5Ub3BMZXZlbFN0YXRlbWVudFtdKTogdm9pZCB7XG4gICAgc3RhdGVtZW50cy5mb3JFYWNoKChzdGF0ZW1lbnQpID0+IHRoaXMuVG9wTGV2ZWxTdGF0ZW1lbnQoc3RhdGVtZW50KSk7XG4gIH1cblxuICBFbGVtZW50Tm9kZShlbDogQVNUdjEuRWxlbWVudE5vZGUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShlbCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLk9wZW5FbGVtZW50Tm9kZShlbCk7XG4gICAgdGhpcy5Ub3BMZXZlbFN0YXRlbWVudHMoZWwuY2hpbGRyZW4pO1xuICAgIHRoaXMuQ2xvc2VFbGVtZW50Tm9kZShlbCk7XG4gIH1cblxuICBPcGVuRWxlbWVudE5vZGUoZWw6IEFTVHYxLkVsZW1lbnROb2RlKTogdm9pZCB7XG4gICAgdGhpcy5idWZmZXIgKz0gYDwke2VsLnRhZ31gO1xuICAgIGNvbnN0IHBhcnRzID0gWy4uLmVsLmF0dHJpYnV0ZXMsIC4uLmVsLm1vZGlmaWVycywgLi4uZWwuY29tbWVudHNdLnNvcnQoc29ydEJ5TG9jKTtcblxuICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgdGhpcy5idWZmZXIgKz0gJyAnO1xuICAgICAgc3dpdGNoIChwYXJ0LnR5cGUpIHtcbiAgICAgICAgY2FzZSAnQXR0ck5vZGUnOlxuICAgICAgICAgIHRoaXMuQXR0ck5vZGUocGFydCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0VsZW1lbnRNb2RpZmllclN0YXRlbWVudCc6XG4gICAgICAgICAgdGhpcy5FbGVtZW50TW9kaWZpZXJTdGF0ZW1lbnQocGFydCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ011c3RhY2hlQ29tbWVudFN0YXRlbWVudCc6XG4gICAgICAgICAgdGhpcy5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQocGFydCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChlbC5ibG9ja1BhcmFtcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuQmxvY2tQYXJhbXMoZWwuYmxvY2tQYXJhbXMpO1xuICAgIH1cbiAgICBpZiAoZWwuc2VsZkNsb3NpbmcpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICcgLyc7XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyICs9ICc+JztcbiAgfVxuXG4gIENsb3NlRWxlbWVudE5vZGUoZWw6IEFTVHYxLkVsZW1lbnROb2RlKTogdm9pZCB7XG4gICAgaWYgKGVsLnNlbGZDbG9zaW5nIHx8IGlzVm9pZFRhZyhlbC50YWcpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyICs9IGA8LyR7ZWwudGFnfT5gO1xuICB9XG5cbiAgQXR0ck5vZGUoYXR0cjogQVNUdjEuQXR0ck5vZGUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShhdHRyKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCB7IG5hbWUsIHZhbHVlIH0gPSBhdHRyO1xuXG4gICAgdGhpcy5idWZmZXIgKz0gbmFtZTtcbiAgICBpZiAodmFsdWUudHlwZSAhPT0gJ1RleHROb2RlJyB8fCB2YWx1ZS5jaGFycy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnPSc7XG4gICAgICB0aGlzLkF0dHJOb2RlVmFsdWUodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIEF0dHJOb2RlVmFsdWUodmFsdWU6IEFTVHYxLkF0dHJOb2RlWyd2YWx1ZSddKTogdm9pZCB7XG4gICAgaWYgKHZhbHVlLnR5cGUgPT09ICdUZXh0Tm9kZScpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICdcIic7XG4gICAgICB0aGlzLlRleHROb2RlKHZhbHVlLCB0cnVlKTtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICdcIic7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuTm9kZSh2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgVGV4dE5vZGUodGV4dDogQVNUdjEuVGV4dE5vZGUsIGlzQXR0cj86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZSh0ZXh0KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuZW50aXR5RW5jb2RpbmcgPT09ICdyYXcnKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSB0ZXh0LmNoYXJzO1xuICAgIH0gZWxzZSBpZiAoaXNBdHRyKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSBlc2NhcGVBdHRyVmFsdWUodGV4dC5jaGFycyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGVzY2FwZVRleHQodGV4dC5jaGFycyk7XG4gICAgfVxuICB9XG5cbiAgTXVzdGFjaGVTdGF0ZW1lbnQobXVzdGFjaGU6IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUobXVzdGFjaGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gbXVzdGFjaGUuZXNjYXBlZCA/ICd7eycgOiAne3t7JztcblxuICAgIGlmIChtdXN0YWNoZS5zdHJpcC5vcGVuKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnfic7XG4gICAgfVxuXG4gICAgdGhpcy5FeHByZXNzaW9uKG11c3RhY2hlLnBhdGgpO1xuICAgIHRoaXMuUGFyYW1zKG11c3RhY2hlLnBhcmFtcyk7XG4gICAgdGhpcy5IYXNoKG11c3RhY2hlLmhhc2gpO1xuXG4gICAgaWYgKG11c3RhY2hlLnN0cmlwLmNsb3NlKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnfic7XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gbXVzdGFjaGUuZXNjYXBlZCA/ICd9fScgOiAnfX19JztcbiAgfVxuXG4gIEJsb2NrU3RhdGVtZW50KGJsb2NrOiBBU1R2MS5CbG9ja1N0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGJsb2NrKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChibG9jay5jaGFpbmVkKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSBibG9jay5pbnZlcnNlU3RyaXAub3BlbiA/ICd7e34nIDogJ3t7JztcbiAgICAgIHRoaXMuYnVmZmVyICs9ICdlbHNlICc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLm9wZW5TdHJpcC5vcGVuID8gJ3t7fiMnIDogJ3t7Iyc7XG4gICAgfVxuXG4gICAgdGhpcy5FeHByZXNzaW9uKGJsb2NrLnBhdGgpO1xuICAgIHRoaXMuUGFyYW1zKGJsb2NrLnBhcmFtcyk7XG4gICAgdGhpcy5IYXNoKGJsb2NrLmhhc2gpO1xuICAgIGlmIChibG9jay5wcm9ncmFtLmJsb2NrUGFyYW1zLmxlbmd0aCkge1xuICAgICAgdGhpcy5CbG9ja1BhcmFtcyhibG9jay5wcm9ncmFtLmJsb2NrUGFyYW1zKTtcbiAgICB9XG5cbiAgICBpZiAoYmxvY2suY2hhaW5lZCkge1xuICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2suaW52ZXJzZVN0cmlwLmNsb3NlID8gJ359fScgOiAnfX0nO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSBibG9jay5vcGVuU3RyaXAuY2xvc2UgPyAnfn19JyA6ICd9fSc7XG4gICAgfVxuXG4gICAgdGhpcy5CbG9jayhibG9jay5wcm9ncmFtKTtcblxuICAgIGlmIChibG9jay5pbnZlcnNlKSB7XG4gICAgICBpZiAoIWJsb2NrLmludmVyc2UuY2hhaW5lZCkge1xuICAgICAgICB0aGlzLmJ1ZmZlciArPSBibG9jay5pbnZlcnNlU3RyaXAub3BlbiA/ICd7e34nIDogJ3t7JztcbiAgICAgICAgdGhpcy5idWZmZXIgKz0gJ2Vsc2UnO1xuICAgICAgICB0aGlzLmJ1ZmZlciArPSBibG9jay5pbnZlcnNlU3RyaXAuY2xvc2UgPyAnfn19JyA6ICd9fSc7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuQmxvY2soYmxvY2suaW52ZXJzZSk7XG4gICAgfVxuXG4gICAgaWYgKCFibG9jay5jaGFpbmVkKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSBibG9jay5jbG9zZVN0cmlwLm9wZW4gPyAne3t+LycgOiAne3svJztcbiAgICAgIHRoaXMuRXhwcmVzc2lvbihibG9jay5wYXRoKTtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmNsb3NlU3RyaXAuY2xvc2UgPyAnfn19JyA6ICd9fSc7XG4gICAgfVxuICB9XG5cbiAgQmxvY2tQYXJhbXMoYmxvY2tQYXJhbXM6IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgdGhpcy5idWZmZXIgKz0gYCBhcyB8JHtibG9ja1BhcmFtcy5qb2luKCcgJyl9fGA7XG4gIH1cblxuICBQYXJ0aWFsU3RhdGVtZW50KHBhcnRpYWw6IEFTVHYxLlBhcnRpYWxTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShwYXJ0aWFsKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9ICd7ez4nO1xuICAgIHRoaXMuRXhwcmVzc2lvbihwYXJ0aWFsLm5hbWUpO1xuICAgIHRoaXMuUGFyYW1zKHBhcnRpYWwucGFyYW1zKTtcbiAgICB0aGlzLkhhc2gocGFydGlhbC5oYXNoKTtcbiAgICB0aGlzLmJ1ZmZlciArPSAnfX0nO1xuICB9XG5cbiAgQ29uY2F0U3RhdGVtZW50KGNvbmNhdDogQVNUdjEuQ29uY2F0U3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoY29uY2F0KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9ICdcIic7XG4gICAgY29uY2F0LnBhcnRzLmZvckVhY2goKHBhcnQpID0+IHtcbiAgICAgIGlmIChwYXJ0LnR5cGUgPT09ICdUZXh0Tm9kZScpIHtcbiAgICAgICAgdGhpcy5UZXh0Tm9kZShwYXJ0LCB0cnVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuTm9kZShwYXJ0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmJ1ZmZlciArPSAnXCInO1xuICB9XG5cbiAgTXVzdGFjaGVDb21tZW50U3RhdGVtZW50KGNvbW1lbnQ6IEFTVHYxLk11c3RhY2hlQ29tbWVudFN0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGNvbW1lbnQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gYHt7IS0tJHtjb21tZW50LnZhbHVlfS0tfX1gO1xuICB9XG5cbiAgRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50KG1vZDogQVNUdjEuRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUobW9kKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9ICd7eyc7XG4gICAgdGhpcy5FeHByZXNzaW9uKG1vZC5wYXRoKTtcbiAgICB0aGlzLlBhcmFtcyhtb2QucGFyYW1zKTtcbiAgICB0aGlzLkhhc2gobW9kLmhhc2gpO1xuICAgIHRoaXMuYnVmZmVyICs9ICd9fSc7XG4gIH1cblxuICBDb21tZW50U3RhdGVtZW50KGNvbW1lbnQ6IEFTVHYxLkNvbW1lbnRTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShjb21tZW50KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IGA8IS0tJHtjb21tZW50LnZhbHVlfS0tPmA7XG4gIH1cblxuICBQYXRoRXhwcmVzc2lvbihwYXRoOiBBU1R2MS5QYXRoRXhwcmVzc2lvbik6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKHBhdGgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gcGF0aC5vcmlnaW5hbDtcbiAgfVxuXG4gIFN1YkV4cHJlc3Npb24oc2V4cDogQVNUdjEuU3ViRXhwcmVzc2lvbik6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKHNleHApKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gJygnO1xuICAgIHRoaXMuRXhwcmVzc2lvbihzZXhwLnBhdGgpO1xuICAgIHRoaXMuUGFyYW1zKHNleHAucGFyYW1zKTtcbiAgICB0aGlzLkhhc2goc2V4cC5oYXNoKTtcbiAgICB0aGlzLmJ1ZmZlciArPSAnKSc7XG4gIH1cblxuICBQYXJhbXMocGFyYW1zOiBBU1R2MS5FeHByZXNzaW9uW10pOiB2b2lkIHtcbiAgICAvLyBUT0RPOiBpbXBsZW1lbnQgYSB0b3AgbGV2ZWwgUGFyYW1zIEFTVCBub2RlIChqdXN0IGxpa2UgdGhlIEhhc2ggb2JqZWN0KVxuICAgIC8vIHNvIHRoYXQgdGhpcyBjYW4gYWxzbyBiZSBvdmVycmlkZGVuXG4gICAgaWYgKHBhcmFtcy5sZW5ndGgpIHtcbiAgICAgIHBhcmFtcy5mb3JFYWNoKChwYXJhbSkgPT4ge1xuICAgICAgICB0aGlzLmJ1ZmZlciArPSAnICc7XG4gICAgICAgIHRoaXMuRXhwcmVzc2lvbihwYXJhbSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBIYXNoKGhhc2g6IEFTVHYxLkhhc2gpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShoYXNoLCB0cnVlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGhhc2gucGFpcnMuZm9yRWFjaCgocGFpcikgPT4ge1xuICAgICAgdGhpcy5idWZmZXIgKz0gJyAnO1xuICAgICAgdGhpcy5IYXNoUGFpcihwYWlyKTtcbiAgICB9KTtcbiAgfVxuXG4gIEhhc2hQYWlyKHBhaXI6IEFTVHYxLkhhc2hQYWlyKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUocGFpcikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBwYWlyLmtleTtcbiAgICB0aGlzLmJ1ZmZlciArPSAnPSc7XG4gICAgdGhpcy5Ob2RlKHBhaXIudmFsdWUpO1xuICB9XG5cbiAgU3RyaW5nTGl0ZXJhbChzdHI6IEFTVHYxLlN0cmluZ0xpdGVyYWwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShzdHIpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gSlNPTi5zdHJpbmdpZnkoc3RyLnZhbHVlKTtcbiAgfVxuXG4gIEJvb2xlYW5MaXRlcmFsKGJvb2w6IEFTVHYxLkJvb2xlYW5MaXRlcmFsKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoYm9vbCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBib29sLnZhbHVlO1xuICB9XG5cbiAgTnVtYmVyTGl0ZXJhbChudW1iZXI6IEFTVHYxLk51bWJlckxpdGVyYWwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShudW1iZXIpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gbnVtYmVyLnZhbHVlO1xuICB9XG5cbiAgVW5kZWZpbmVkTGl0ZXJhbChub2RlOiBBU1R2MS5VbmRlZmluZWRMaXRlcmFsKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUobm9kZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSAndW5kZWZpbmVkJztcbiAgfVxuXG4gIE51bGxMaXRlcmFsKG5vZGU6IEFTVHYxLk51bGxMaXRlcmFsKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUobm9kZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSAnbnVsbCc7XG4gIH1cblxuICBwcmludChub2RlOiBBU1R2MS5Ob2RlKTogc3RyaW5nIHtcbiAgICBsZXQgeyBvcHRpb25zIH0gPSB0aGlzO1xuXG4gICAgaWYgKG9wdGlvbnMub3ZlcnJpZGUpIHtcbiAgICAgIGxldCByZXN1bHQgPSBvcHRpb25zLm92ZXJyaWRlKG5vZGUsIG9wdGlvbnMpO1xuXG4gICAgICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciA9ICcnO1xuICAgIHRoaXMuTm9kZShub2RlKTtcbiAgICByZXR1cm4gdGhpcy5idWZmZXI7XG4gIH1cbn1cbiJdLCJzb3VyY2VSb290IjoiIn0=