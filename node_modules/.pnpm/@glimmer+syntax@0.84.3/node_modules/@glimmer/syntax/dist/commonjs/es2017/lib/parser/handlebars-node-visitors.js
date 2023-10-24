"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HandlebarsNodeVisitors = void 0;

var _parser = require("../parser");

var _location = require("../source/location");

var _syntaxError = require("../syntax-error");

var _utils = require("../utils");

var _legacyInterop = require("../v1/legacy-interop");

var _parserBuilders = _interopRequireDefault(require("../v1/parser-builders"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class HandlebarsNodeVisitors extends _parser.Parser {
  get isTopLevel() {
    return this.elementStack.length === 0;
  }

  Program(program) {
    let body = [];
    let node;

    if (this.isTopLevel) {
      node = _parserBuilders.default.template({
        body,
        blockParams: program.blockParams,
        loc: this.source.spanFor(program.loc)
      });
    } else {
      node = _parserBuilders.default.blockItself({
        body,
        blockParams: program.blockParams,
        chained: program.chained,
        loc: this.source.spanFor(program.loc)
      });
    }

    let i,
        l = program.body.length;
    this.elementStack.push(node);

    if (l === 0) {
      return this.elementStack.pop();
    }

    for (i = 0; i < l; i++) {
      this.acceptNode(program.body[i]);
    } // Ensure that that the element stack is balanced properly.


    let poppedNode = this.elementStack.pop();

    if (poppedNode !== node) {
      let elementNode = poppedNode;
      throw (0, _syntaxError.generateSyntaxError)(`Unclosed element \`${elementNode.tag}\``, elementNode.loc);
    }

    return node;
  }

  BlockStatement(block) {
    if (this.tokenizer.state === "comment"
    /* comment */
    ) {
        this.appendToCommentData(this.sourceForNode(block));
        return;
      }

    if (this.tokenizer.state !== "data"
    /* data */
    && this.tokenizer.state !== "beforeData"
    /* beforeData */
    ) {
        throw (0, _syntaxError.generateSyntaxError)('A block may only be used inside an HTML element or another block.', this.source.spanFor(block.loc));
      }

    let {
      path,
      params,
      hash
    } = acceptCallNodes(this, block); // These are bugs in Handlebars upstream

    if (!block.program.loc) {
      block.program.loc = _location.NON_EXISTENT_LOCATION;
    }

    if (block.inverse && !block.inverse.loc) {
      block.inverse.loc = _location.NON_EXISTENT_LOCATION;
    }

    let program = this.Program(block.program);
    let inverse = block.inverse ? this.Program(block.inverse) : null;

    let node = _parserBuilders.default.block({
      path,
      params,
      hash,
      defaultBlock: program,
      elseBlock: inverse,
      loc: this.source.spanFor(block.loc),
      openStrip: block.openStrip,
      inverseStrip: block.inverseStrip,
      closeStrip: block.closeStrip
    });

    let parentProgram = this.currentElement();
    (0, _utils.appendChild)(parentProgram, node);
  }

  MustacheStatement(rawMustache) {
    let {
      tokenizer
    } = this;

    if (tokenizer.state === 'comment') {
      this.appendToCommentData(this.sourceForNode(rawMustache));
      return;
    }

    let mustache;
    let {
      escaped,
      loc,
      strip
    } = rawMustache;

    if ((0, _utils.isHBSLiteral)(rawMustache.path)) {
      mustache = _parserBuilders.default.mustache({
        path: this.acceptNode(rawMustache.path),
        params: [],
        hash: _parserBuilders.default.hash([], this.source.spanFor(rawMustache.path.loc).collapse('end')),
        trusting: !escaped,
        loc: this.source.spanFor(loc),
        strip
      });
    } else {
      let {
        path,
        params,
        hash
      } = acceptCallNodes(this, rawMustache);
      mustache = _parserBuilders.default.mustache({
        path,
        params,
        hash,
        trusting: !escaped,
        loc: this.source.spanFor(loc),
        strip
      });
    }

    switch (tokenizer.state) {
      // Tag helpers
      case "tagOpen"
      /* tagOpen */
      :
      case "tagName"
      /* tagName */
      :
        throw (0, _syntaxError.generateSyntaxError)(`Cannot use mustaches in an elements tagname`, mustache.loc);

      case "beforeAttributeName"
      /* beforeAttributeName */
      :
        addElementModifier(this.currentStartTag, mustache);
        break;

      case "attributeName"
      /* attributeName */
      :
      case "afterAttributeName"
      /* afterAttributeName */
      :
        this.beginAttributeValue(false);
        this.finishAttributeValue();
        addElementModifier(this.currentStartTag, mustache);
        tokenizer.transitionTo("beforeAttributeName"
        /* beforeAttributeName */
        );
        break;

      case "afterAttributeValueQuoted"
      /* afterAttributeValueQuoted */
      :
        addElementModifier(this.currentStartTag, mustache);
        tokenizer.transitionTo("beforeAttributeName"
        /* beforeAttributeName */
        );
        break;
      // Attribute values

      case "beforeAttributeValue"
      /* beforeAttributeValue */
      :
        this.beginAttributeValue(false);
        this.appendDynamicAttributeValuePart(mustache);
        tokenizer.transitionTo("attributeValueUnquoted"
        /* attributeValueUnquoted */
        );
        break;

      case "attributeValueDoubleQuoted"
      /* attributeValueDoubleQuoted */
      :
      case "attributeValueSingleQuoted"
      /* attributeValueSingleQuoted */
      :
      case "attributeValueUnquoted"
      /* attributeValueUnquoted */
      :
        this.appendDynamicAttributeValuePart(mustache);
        break;
      // TODO: Only append child when the tokenizer state makes
      // sense to do so, otherwise throw an error.

      default:
        (0, _utils.appendChild)(this.currentElement(), mustache);
    }

    return mustache;
  }

  appendDynamicAttributeValuePart(part) {
    this.finalizeTextPart();
    let attr = this.currentAttr;
    attr.isDynamic = true;
    attr.parts.push(part);
  }

  finalizeTextPart() {
    let attr = this.currentAttr;
    let text = attr.currentPart;

    if (text !== null) {
      this.currentAttr.parts.push(text);
      this.startTextPart();
    }
  }

  startTextPart() {
    this.currentAttr.currentPart = null;
  }

  ContentStatement(content) {
    updateTokenizerLocation(this.tokenizer, content);
    this.tokenizer.tokenizePart(content.value);
    this.tokenizer.flushData();
  }

  CommentStatement(rawComment) {
    let {
      tokenizer
    } = this;

    if (tokenizer.state === "comment"
    /* comment */
    ) {
        this.appendToCommentData(this.sourceForNode(rawComment));
        return null;
      }

    let {
      value,
      loc
    } = rawComment;

    let comment = _parserBuilders.default.mustacheComment(value, this.source.spanFor(loc));

    switch (tokenizer.state) {
      case "beforeAttributeName"
      /* beforeAttributeName */
      :
      case "afterAttributeName"
      /* afterAttributeName */
      :
        this.currentStartTag.comments.push(comment);
        break;

      case "beforeData"
      /* beforeData */
      :
      case "data"
      /* data */
      :
        (0, _utils.appendChild)(this.currentElement(), comment);
        break;

      default:
        throw (0, _syntaxError.generateSyntaxError)(`Using a Handlebars comment when in the \`${tokenizer['state']}\` state is not supported`, this.source.spanFor(rawComment.loc));
    }

    return comment;
  }

  PartialStatement(partial) {
    throw (0, _syntaxError.generateSyntaxError)(`Handlebars partials are not supported`, this.source.spanFor(partial.loc));
  }

  PartialBlockStatement(partialBlock) {
    throw (0, _syntaxError.generateSyntaxError)(`Handlebars partial blocks are not supported`, this.source.spanFor(partialBlock.loc));
  }

  Decorator(decorator) {
    throw (0, _syntaxError.generateSyntaxError)(`Handlebars decorators are not supported`, this.source.spanFor(decorator.loc));
  }

  DecoratorBlock(decoratorBlock) {
    throw (0, _syntaxError.generateSyntaxError)(`Handlebars decorator blocks are not supported`, this.source.spanFor(decoratorBlock.loc));
  }

  SubExpression(sexpr) {
    let {
      path,
      params,
      hash
    } = acceptCallNodes(this, sexpr);
    return _parserBuilders.default.sexpr({
      path,
      params,
      hash,
      loc: this.source.spanFor(sexpr.loc)
    });
  }

  PathExpression(path) {
    let {
      original
    } = path;
    let parts;

    if (original.indexOf('/') !== -1) {
      if (original.slice(0, 2) === './') {
        throw (0, _syntaxError.generateSyntaxError)(`Using "./" is not supported in Glimmer and unnecessary`, this.source.spanFor(path.loc));
      }

      if (original.slice(0, 3) === '../') {
        throw (0, _syntaxError.generateSyntaxError)(`Changing context using "../" is not supported in Glimmer`, this.source.spanFor(path.loc));
      }

      if (original.indexOf('.') !== -1) {
        throw (0, _syntaxError.generateSyntaxError)(`Mixing '.' and '/' in paths is not supported in Glimmer; use only '.' to separate property paths`, this.source.spanFor(path.loc));
      }

      parts = [path.parts.join('/')];
    } else if (original === '.') {
      throw (0, _syntaxError.generateSyntaxError)(`'.' is not a supported path in Glimmer; check for a path with a trailing '.'`, this.source.spanFor(path.loc));
    } else {
      parts = path.parts;
    }

    let thisHead = false; // This is to fix a bug in the Handlebars AST where the path expressions in
    // `{{this.foo}}` (and similarly `{{foo-bar this.foo named=this.foo}}` etc)
    // are simply turned into `{{foo}}`. The fix is to push it back onto the
    // parts array and let the runtime see the difference. However, we cannot
    // simply use the string `this` as it means literally the property called
    // "this" in the current context (it can be expressed in the syntax as
    // `{{[this]}}`, where the square bracket are generally for this kind of
    // escaping – such as `{{foo.["bar.baz"]}}` would mean lookup a property
    // named literally "bar.baz" on `this.foo`). By convention, we use `null`
    // for this purpose.

    if (original.match(/^this(\..+)?$/)) {
      thisHead = true;
    }

    let pathHead;

    if (thisHead) {
      pathHead = {
        type: 'ThisHead',
        loc: {
          start: path.loc.start,
          end: {
            line: path.loc.start.line,
            column: path.loc.start.column + 4
          }
        }
      };
    } else if (path.data) {
      let head = parts.shift();

      if (head === undefined) {
        throw (0, _syntaxError.generateSyntaxError)(`Attempted to parse a path expression, but it was not valid. Paths beginning with @ must start with a-z.`, this.source.spanFor(path.loc));
      }

      pathHead = {
        type: 'AtHead',
        name: `@${head}`,
        loc: {
          start: path.loc.start,
          end: {
            line: path.loc.start.line,
            column: path.loc.start.column + head.length + 1
          }
        }
      };
    } else {
      let head = parts.shift();

      if (head === undefined) {
        throw (0, _syntaxError.generateSyntaxError)(`Attempted to parse a path expression, but it was not valid. Paths must start with a-z or A-Z.`, this.source.spanFor(path.loc));
      }

      pathHead = {
        type: 'VarHead',
        name: head,
        loc: {
          start: path.loc.start,
          end: {
            line: path.loc.start.line,
            column: path.loc.start.column + head.length
          }
        }
      };
    }

    return new _legacyInterop.PathExpressionImplV1(path.original, pathHead, parts, this.source.spanFor(path.loc));
  }

  Hash(hash) {
    let pairs = [];

    for (let i = 0; i < hash.pairs.length; i++) {
      let pair = hash.pairs[i];
      pairs.push(_parserBuilders.default.pair({
        key: pair.key,
        value: this.acceptNode(pair.value),
        loc: this.source.spanFor(pair.loc)
      }));
    }

    return _parserBuilders.default.hash(pairs, this.source.spanFor(hash.loc));
  }

  StringLiteral(string) {
    return _parserBuilders.default.literal({
      type: 'StringLiteral',
      value: string.value,
      loc: string.loc
    });
  }

  BooleanLiteral(boolean) {
    return _parserBuilders.default.literal({
      type: 'BooleanLiteral',
      value: boolean.value,
      loc: boolean.loc
    });
  }

  NumberLiteral(number) {
    return _parserBuilders.default.literal({
      type: 'NumberLiteral',
      value: number.value,
      loc: number.loc
    });
  }

  UndefinedLiteral(undef) {
    return _parserBuilders.default.literal({
      type: 'UndefinedLiteral',
      value: undefined,
      loc: undef.loc
    });
  }

  NullLiteral(nul) {
    return _parserBuilders.default.literal({
      type: 'NullLiteral',
      value: null,
      loc: nul.loc
    });
  }

}

exports.HandlebarsNodeVisitors = HandlebarsNodeVisitors;

function calculateRightStrippedOffsets(original, value) {
  if (value === '') {
    // if it is empty, just return the count of newlines
    // in original
    return {
      lines: original.split('\n').length - 1,
      columns: 0
    };
  } // otherwise, return the number of newlines prior to
  // `value`


  let difference = original.split(value)[0];
  let lines = difference.split(/\n/);
  let lineCount = lines.length - 1;
  return {
    lines: lineCount,
    columns: lines[lineCount].length
  };
}

function updateTokenizerLocation(tokenizer, content) {
  let line = content.loc.start.line;
  let column = content.loc.start.column;
  let offsets = calculateRightStrippedOffsets(content.original, content.value);
  line = line + offsets.lines;

  if (offsets.lines) {
    column = offsets.columns;
  } else {
    column = column + offsets.columns;
  }

  tokenizer.line = line;
  tokenizer.column = column;
}

function acceptCallNodes(compiler, node) {
  if (node.path.type.endsWith('Literal')) {
    const path = node.path;
    let value = '';

    if (path.type === 'BooleanLiteral') {
      value = path.original.toString();
    } else if (path.type === 'StringLiteral') {
      value = `"${path.original}"`;
    } else if (path.type === 'NullLiteral') {
      value = 'null';
    } else if (path.type === 'NumberLiteral') {
      value = path.value.toString();
    } else {
      value = 'undefined';
    }

    throw (0, _syntaxError.generateSyntaxError)(`${path.type} "${path.type === 'StringLiteral' ? path.original : value}" cannot be called as a sub-expression, replace (${value}) with ${value}`, compiler.source.spanFor(path.loc));
  }

  let path = node.path.type === 'PathExpression' ? compiler.PathExpression(node.path) : compiler.SubExpression(node.path);
  let params = node.params ? node.params.map(e => compiler.acceptNode(e)) : []; // if there is no hash, position it as a collapsed node immediately after the last param (or the
  // path, if there are also no params)

  let end = params.length > 0 ? params[params.length - 1].loc : path.loc;
  let hash = node.hash ? compiler.Hash(node.hash) : {
    type: 'Hash',
    pairs: [],
    loc: compiler.source.spanFor(end).collapse('end')
  };
  return {
    path,
    params,
    hash
  };
}

function addElementModifier(element, mustache) {
  let {
    path,
    params,
    hash,
    loc
  } = mustache;

  if ((0, _utils.isHBSLiteral)(path)) {
    let modifier = `{{${(0, _utils.printLiteral)(path)}}}`;
    let tag = `<${element.name} ... ${modifier} ...`;
    throw (0, _syntaxError.generateSyntaxError)(`In ${tag}, ${modifier} is not a valid modifier`, mustache.loc);
  }

  let modifier = _parserBuilders.default.elementModifier({
    path,
    params,
    hash,
    loc
  });

  element.modifiers.push(modifier);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvcGFyc2VyL2hhbmRsZWJhcnMtbm9kZS12aXNpdG9ycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBR0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBR0E7O0FBQ0E7Ozs7QUFFTSxNQUFBLHNCQUFBLFNBQUEsY0FBQSxDQUFxRDtBQUt6RCxNQUFBLFVBQUEsR0FBc0I7QUFDcEIsV0FBTyxLQUFBLFlBQUEsQ0FBQSxNQUFBLEtBQVAsQ0FBQTtBQUNEOztBQUtELEVBQUEsT0FBTyxDQUFBLE9BQUEsRUFBcUI7QUFDMUIsUUFBSSxJQUFJLEdBQVIsRUFBQTtBQUNBLFFBQUEsSUFBQTs7QUFFQSxRQUFJLEtBQUosVUFBQSxFQUFxQjtBQUNuQixNQUFBLElBQUksR0FBRyx3QkFBQSxRQUFBLENBQVc7QUFBQSxRQUFBLElBQUE7QUFFaEIsUUFBQSxXQUFXLEVBQUUsT0FBTyxDQUZKLFdBQUE7QUFHaEIsUUFBQSxHQUFHLEVBQUUsS0FBQSxNQUFBLENBQUEsT0FBQSxDQUFvQixPQUFPLENBQTNCLEdBQUE7QUFIVyxPQUFYLENBQVA7QUFERixLQUFBLE1BTU87QUFDTCxNQUFBLElBQUksR0FBRyx3QkFBQSxXQUFBLENBQWM7QUFBQSxRQUFBLElBQUE7QUFFbkIsUUFBQSxXQUFXLEVBQUUsT0FBTyxDQUZELFdBQUE7QUFHbkIsUUFBQSxPQUFPLEVBQUUsT0FBTyxDQUhHLE9BQUE7QUFJbkIsUUFBQSxHQUFHLEVBQUUsS0FBQSxNQUFBLENBQUEsT0FBQSxDQUFvQixPQUFPLENBQTNCLEdBQUE7QUFKYyxPQUFkLENBQVA7QUFNRDs7QUFFRCxRQUFBLENBQUE7QUFBQSxRQUNFLENBQUMsR0FBRyxPQUFPLENBQVAsSUFBQSxDQUROLE1BQUE7QUFHQSxTQUFBLFlBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQTs7QUFFQSxRQUFJLENBQUMsS0FBTCxDQUFBLEVBQWE7QUFDWCxhQUFPLEtB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QSxJQUFBO0FBQUEsSUFBQSxNQUFBO0FBQUEsSUFBQSxJQUFBO0FBQXNCLElBQUE7QUFBdEIsTUFBSixRQUFBOztBQUVBLE1BQUkseUJBQUosSUFBSSxDQUFKLEVBQXdCO0FBQ3RCLFFBQUksUUFBUSxHQUFHLEtBQUsseUJBQVksSUFBWixDQUFwQixJQUFBO0FBQ0EsUUFBSSxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFRLFFBQWxDLE1BQUE7QUFFQSxVQUFNLHNDQUFvQixNQUFNLEdBQUcsS0FBSyxRQUFmLDBCQUFuQixFQUFzRSxRQUFRLENBQXBGLEdBQU0sQ0FBTjtBQUNEOztBQUVELE1BQUksUUFBUSxHQUFHLHdCQUFBLGVBQUEsQ0FBa0I7QUFBQSxJQUFBLElBQUE7QUFBQSxJQUFBLE1BQUE7QUFBQSxJQUFBLElBQUE7QUFBc0IsSUFBQTtBQUF0QixHQUFsQixDQUFmOztBQUNBLEVBQUEsT0FBTyxDQUFQLFNBQUEsQ0FBQSxJQUFBLENBQUEsUUFBQTtBQUNEIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgT3B0aW9uLCBSZWNhc3QgfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcbmltcG9ydCB7IFRva2VuaXplclN0YXRlIH0gZnJvbSAnc2ltcGxlLWh0bWwtdG9rZW5pemVyJztcblxuaW1wb3J0IHsgUGFyc2VyLCBQYXJzZXJOb2RlQnVpbGRlciwgVGFnIH0gZnJvbSAnLi4vcGFyc2VyJztcbmltcG9ydCB7IE5PTl9FWElTVEVOVF9MT0NBVElPTiB9IGZyb20gJy4uL3NvdXJjZS9sb2NhdGlvbic7XG5pbXBvcnQgeyBnZW5lcmF0ZVN5bnRheEVycm9yIH0gZnJvbSAnLi4vc3ludGF4LWVycm9yJztcbmltcG9ydCB7IGFwcGVuZENoaWxkLCBpc0hCU0xpdGVyYWwsIHByaW50TGl0ZXJhbCB9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCAqIGFzIEFTVHYxIGZyb20gJy4uL3YxL2FwaSc7XG5pbXBvcnQgKiBhcyBIQlMgZnJvbSAnLi4vdjEvaGFuZGxlYmFycy1hc3QnO1xuaW1wb3J0IHsgUGF0aEV4cHJlc3Npb25JbXBsVjEgfSBmcm9tICcuLi92MS9sZWdhY3ktaW50ZXJvcCc7XG5pbXBvcnQgYiBmcm9tICcuLi92MS9wYXJzZXItYnVpbGRlcnMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSGFuZGxlYmFyc05vZGVWaXNpdG9ycyBleHRlbmRzIFBhcnNlciB7XG4gIGFic3RyYWN0IGFwcGVuZFRvQ29tbWVudERhdGEoczogc3RyaW5nKTogdm9pZDtcbiAgYWJzdHJhY3QgYmVnaW5BdHRyaWJ1dGVWYWx1ZShxdW90ZWQ6IGJvb2xlYW4pOiB2b2lkO1xuICBhYnN0cmFjdCBmaW5pc2hBdHRyaWJ1dGVWYWx1ZSgpOiB2b2lkO1xuXG4gIHByaXZhdGUgZ2V0IGlzVG9wTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuZWxlbWVudFN0YWNrLmxlbmd0aCA9PT0gMDtcbiAgfVxuXG4gIFByb2dyYW0ocHJvZ3JhbTogSEJTLlByb2dyYW0pOiBBU1R2MS5CbG9jaztcbiAgUHJvZ3JhbShwcm9ncmFtOiBIQlMuUHJvZ3JhbSk6IEFTVHYxLlRlbXBsYXRlO1xuICBQcm9ncmFtKHByb2dyYW06IEhCUy5Qcm9ncmFtKTogQVNUdjEuVGVtcGxhdGUgfCBBU1R2MS5CbG9jaztcbiAgUHJvZ3JhbShwcm9ncmFtOiBIQlMuUHJvZ3JhbSk6IEFTVHYxLkJsb2NrIHwgQVNUdjEuVGVtcGxhdGUge1xuICAgIGxldCBib2R5OiBBU1R2MS5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGxldCBub2RlO1xuXG4gICAgaWYgKHRoaXMuaXNUb3BMZXZlbCkge1xuICAgICAgbm9kZSA9IGIudGVtcGxhdGUoe1xuICAgICAgICBib2R5LFxuICAgICAgICBibG9ja1BhcmFtczogcHJvZ3JhbS5ibG9ja1BhcmFtcyxcbiAgICAgICAgbG9jOiB0aGlzLnNvdXJjZS5zcGFuRm9yKHByb2dyYW0ubG9jKSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBub2RlID0gYi5ibG9ja0l0c2VsZih7XG4gICAgICAgIGJvZHksXG4gICAgICAgIGJsb2NrUGFyYW1zOiBwcm9ncmFtLmJsb2NrUGFyYW1zLFxuICAgICAgICBjaGFpbmVkOiBwcm9ncmFtLmNoYWluZWQsXG4gICAgICAgIGxvYzogdGhpcy5zb3VyY2Uuc3BhbkZvcihwcm9ncmFtLmxvYyksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBsZXQgaSxcbiAgICAgIGwgPSBwcm9ncmFtLmJvZHkubGVuZ3RoO1xuXG4gICAgdGhpcy5lbGVtZW50U3RhY2sucHVzaChub2RlKTtcblxuICAgIGlmIChsID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbGVtZW50U3RhY2sucG9wKCkgYXMgQVNUdjEuQmxvY2sgfCBBU1R2MS5UZW1wbGF0ZTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICB0aGlzLmFjY2VwdE5vZGUocHJvZ3JhbS5ib2R5W2ldKTtcbiAgICB9XG5cbiAgICAvLyBFbnN1cmUgdGhhdCB0aGF0IHRoZSBlbGVtZW50IHN0YWNrIGlzIGJhbGFuY2VkIHByb3Blcmx5LlxuICAgIGxldCBwb3BwZWROb2RlID0gdGhpcy5lbGVtZW50U3RhY2sucG9wKCk7XG4gICAgaWYgKHBvcHBlZE5vZGUgIT09IG5vZGUpIHtcbiAgICAgIGxldCBlbGVtZW50Tm9kZSA9IHBvcHBlZE5vZGUgYXMgQVNUdjEuRWxlbWVudE5vZGU7XG5cbiAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoYFVuY2xvc2VkIGVsZW1lbnQgXFxgJHtlbGVtZW50Tm9kZS50YWd9XFxgYCwgZWxlbWVudE5vZGUubG9jKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIEJsb2NrU3RhdGVtZW50KGJsb2NrOiBIQlMuQmxvY2tTdGF0ZW1lbnQpOiBBU1R2MS5CbG9ja1N0YXRlbWVudCB8IHZvaWQge1xuICAgIGlmICh0aGlzLnRva2VuaXplci5zdGF0ZSA9PT0gVG9rZW5pemVyU3RhdGUuY29tbWVudCkge1xuICAgICAgdGhpcy5hcHBlbmRUb0NvbW1lbnREYXRhKHRoaXMuc291cmNlRm9yTm9kZShibG9jaykpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHRoaXMudG9rZW5pemVyLnN0YXRlICE9PSBUb2tlbml6ZXJTdGF0ZS5kYXRhICYmXG4gICAgICB0aGlzLnRva2VuaXplci5zdGF0ZSAhPT0gVG9rZW5pemVyU3RhdGUuYmVmb3JlRGF0YVxuICAgICkge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgJ0EgYmxvY2sgbWF5IG9ubHkgYmUgdXNlZCBpbnNpZGUgYW4gSFRNTCBlbGVtZW50IG9yIGFub3RoZXIgYmxvY2suJyxcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihibG9jay5sb2MpXG4gICAgICApO1xuICAgIH1cblxuICAgIGxldCB7IHBhdGgsIHBhcmFtcywgaGFzaCB9ID0gYWNjZXB0Q2FsbE5vZGVzKHRoaXMsIGJsb2NrKTtcblxuICAgIC8vIFRoZXNlIGFyZSBidWdzIGluIEhhbmRsZWJhcnMgdXBzdHJlYW1cbiAgICBpZiAoIWJsb2NrLnByb2dyYW0ubG9jKSB7XG4gICAgICBibG9jay5wcm9ncmFtLmxvYyA9IE5PTl9FWElTVEVOVF9MT0NBVElPTjtcbiAgICB9XG5cbiAgICBpZiAoYmxvY2suaW52ZXJzZSAmJiAhYmxvY2suaW52ZXJzZS5sb2MpIHtcbiAgICAgIGJsb2NrLmludmVyc2UubG9jID0gTk9OX0VYSVNURU5UX0xPQ0FUSU9OO1xuICAgIH1cblxuICAgIGxldCBwcm9ncmFtID0gdGhpcy5Qcm9ncmFtKGJsb2NrLnByb2dyYW0pO1xuICAgIGxldCBpbnZlcnNlID0gYmxvY2suaW52ZXJzZSA/IHRoaXMuUHJvZ3JhbShibG9jay5pbnZlcnNlKSA6IG51bGw7XG5cbiAgICBsZXQgbm9kZSA9IGIuYmxvY2soe1xuICAgICAgcGF0aCxcbiAgICAgIHBhcmFtcyxcbiAgICAgIGhhc2gsXG4gICAgICBkZWZhdWx0QmxvY2s6IHByb2dyYW0sXG4gICAgICBlbHNlQmxvY2s6IGludmVyc2UsXG4gICAgICBsb2M6IHRoaXMuc291cmNlLnNwYW5Gb3IoYmxvY2subG9jKSxcbiAgICAgIG9wZW5TdHJpcDogYmxvY2sub3BlblN0cmlwLFxuICAgICAgaW52ZXJzZVN0cmlwOiBibG9jay5pbnZlcnNlU3RyaXAsXG4gICAgICBjbG9zZVN0cmlwOiBibG9jay5jbG9zZVN0cmlwLFxuICAgIH0pO1xuXG4gICAgbGV0IHBhcmVudFByb2dyYW0gPSB0aGlzLmN1cnJlbnRFbGVtZW50KCk7XG5cbiAgICBhcHBlbmRDaGlsZChwYXJlbnRQcm9ncmFtLCBub2RlKTtcbiAgfVxuXG4gIE11c3RhY2hlU3RhdGVtZW50KHJhd011c3RhY2hlOiBIQlMuTXVzdGFjaGVTdGF0ZW1lbnQpOiBBU1R2MS5NdXN0YWNoZVN0YXRlbWVudCB8IHZvaWQge1xuICAgIGxldCB7IHRva2VuaXplciB9ID0gdGhpcztcblxuICAgIGlmICh0b2tlbml6ZXIuc3RhdGUgPT09ICdjb21tZW50Jykge1xuICAgICAgdGhpcy5hcHBlbmRUb0NvbW1lbnREYXRhKHRoaXMuc291cmNlRm9yTm9kZShyYXdNdXN0YWNoZSkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCBtdXN0YWNoZTogQVNUdjEuTXVzdGFjaGVTdGF0ZW1lbnQ7XG4gICAgbGV0IHsgZXNjYXBlZCwgbG9jLCBzdHJpcCB9ID0gcmF3TXVzdGFjaGU7XG5cbiAgICBpZiAoaXNIQlNMaXRlcmFsKHJhd011c3RhY2hlLnBhdGgpKSB7XG4gICAgICBtdXN0YWNoZSA9IGIubXVzdGFjaGUoe1xuICAgICAgICBwYXRoOiB0aGlzLmFjY2VwdE5vZGU8QVNUdjEuTGl0ZXJhbD4ocmF3TXVzdGFjaGUucGF0aCksXG4gICAgICAgIHBhcmFtczogW10sXG4gICAgICAgIGhhc2g6IGIuaGFzaChbXSwgdGhpcy5zb3VyY2Uuc3BhbkZvcihyYXdNdXN0YWNoZS5wYXRoLmxvYykuY29sbGFwc2UoJ2VuZCcpKSxcbiAgICAgICAgdHJ1c3Rpbmc6ICFlc2NhcGVkLFxuICAgICAgICBsb2M6IHRoaXMuc291cmNlLnNwYW5Gb3IobG9jKSxcbiAgICAgICAgc3RyaXAsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHsgcGF0aCwgcGFyYW1zLCBoYXNoIH0gPSBhY2NlcHRDYWxsTm9kZXMoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHJhd011c3RhY2hlIGFzIEhCUy5NdXN0YWNoZVN0YXRlbWVudCAmIHtcbiAgICAgICAgICBwYXRoOiBIQlMuUGF0aEV4cHJlc3Npb24gfCBIQlMuU3ViRXhwcmVzc2lvbjtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICAgIG11c3RhY2hlID0gYi5tdXN0YWNoZSh7XG4gICAgICAgIHBhdGgsXG4gICAgICAgIHBhcmFtcyxcbiAgICAgICAgaGFzaCxcbiAgICAgICAgdHJ1c3Rpbmc6ICFlc2NhcGVkLFxuICAgICAgICBsb2M6IHRoaXMuc291cmNlLnNwYW5Gb3IobG9jKSxcbiAgICAgICAgc3RyaXAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHRva2VuaXplci5zdGF0ZSkge1xuICAgICAgLy8gVGFnIGhlbHBlcnNcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUudGFnT3BlbjpcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUudGFnTmFtZTpcbiAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihgQ2Fubm90IHVzZSBtdXN0YWNoZXMgaW4gYW4gZWxlbWVudHMgdGFnbmFtZWAsIG11c3RhY2hlLmxvYyk7XG5cbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZTpcbiAgICAgICAgYWRkRWxlbWVudE1vZGlmaWVyKHRoaXMuY3VycmVudFN0YXJ0VGFnLCBtdXN0YWNoZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5hdHRyaWJ1dGVOYW1lOlxuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5hZnRlckF0dHJpYnV0ZU5hbWU6XG4gICAgICAgIHRoaXMuYmVnaW5BdHRyaWJ1dGVWYWx1ZShmYWxzZSk7XG4gICAgICAgIHRoaXMuZmluaXNoQXR0cmlidXRlVmFsdWUoKTtcbiAgICAgICAgYWRkRWxlbWVudE1vZGlmaWVyKHRoaXMuY3VycmVudFN0YXJ0VGFnLCBtdXN0YWNoZSk7XG4gICAgICAgIHRva2VuaXplci50cmFuc2l0aW9uVG8oVG9rZW5pemVyU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5hZnRlckF0dHJpYnV0ZVZhbHVlUXVvdGVkOlxuICAgICAgICBhZGRFbGVtZW50TW9kaWZpZXIodGhpcy5jdXJyZW50U3RhcnRUYWcsIG11c3RhY2hlKTtcbiAgICAgICAgdG9rZW5pemVyLnRyYW5zaXRpb25UbyhUb2tlbml6ZXJTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIEF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYmVmb3JlQXR0cmlidXRlVmFsdWU6XG4gICAgICAgIHRoaXMuYmVnaW5BdHRyaWJ1dGVWYWx1ZShmYWxzZSk7XG4gICAgICAgIHRoaXMuYXBwZW5kRHluYW1pY0F0dHJpYnV0ZVZhbHVlUGFydChtdXN0YWNoZSk7XG4gICAgICAgIHRva2VuaXplci50cmFuc2l0aW9uVG8oVG9rZW5pemVyU3RhdGUuYXR0cmlidXRlVmFsdWVVbnF1b3RlZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5hdHRyaWJ1dGVWYWx1ZURvdWJsZVF1b3RlZDpcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYXR0cmlidXRlVmFsdWVTaW5nbGVRdW90ZWQ6XG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmF0dHJpYnV0ZVZhbHVlVW5xdW90ZWQ6XG4gICAgICAgIHRoaXMuYXBwZW5kRHluYW1pY0F0dHJpYnV0ZVZhbHVlUGFydChtdXN0YWNoZSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBUT0RPOiBPbmx5IGFwcGVuZCBjaGlsZCB3aGVuIHRoZSB0b2tlbml6ZXIgc3RhdGUgbWFrZXNcbiAgICAgIC8vIHNlbnNlIHRvIGRvIHNvLCBvdGhlcndpc2UgdGhyb3cgYW4gZXJyb3IuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcHBlbmRDaGlsZCh0aGlzLmN1cnJlbnRFbGVtZW50KCksIG11c3RhY2hlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbXVzdGFjaGU7XG4gIH1cblxuICBhcHBlbmREeW5hbWljQXR0cmlidXRlVmFsdWVQYXJ0KHBhcnQ6IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy5maW5hbGl6ZVRleHRQYXJ0KCk7XG4gICAgbGV0IGF0dHIgPSB0aGlzLmN1cnJlbnRBdHRyO1xuICAgIGF0dHIuaXNEeW5hbWljID0gdHJ1ZTtcbiAgICBhdHRyLnBhcnRzLnB1c2gocGFydCk7XG4gIH1cblxuICBmaW5hbGl6ZVRleHRQYXJ0KCk6IHZvaWQge1xuICAgIGxldCBhdHRyID0gdGhpcy5jdXJyZW50QXR0cjtcbiAgICBsZXQgdGV4dCA9IGF0dHIuY3VycmVudFBhcnQ7XG4gICAgaWYgKHRleHQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuY3VycmVudEF0dHIucGFydHMucHVzaCh0ZXh0KTtcbiAgICAgIHRoaXMuc3RhcnRUZXh0UGFydCgpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXJ0VGV4dFBhcnQoKTogdm9pZCB7XG4gICAgdGhpcy5jdXJyZW50QXR0ci5jdXJyZW50UGFydCA9IG51bGw7XG4gIH1cblxuICBDb250ZW50U3RhdGVtZW50KGNvbnRlbnQ6IEhCUy5Db250ZW50U3RhdGVtZW50KTogdm9pZCB7XG4gICAgdXBkYXRlVG9rZW5pemVyTG9jYXRpb24odGhpcy50b2tlbml6ZXIsIGNvbnRlbnQpO1xuXG4gICAgdGhpcy50b2tlbml6ZXIudG9rZW5pemVQYXJ0KGNvbnRlbnQudmFsdWUpO1xuICAgIHRoaXMudG9rZW5pemVyLmZsdXNoRGF0YSgpO1xuICB9XG5cbiAgQ29tbWVudFN0YXRlbWVudChyYXdDb21tZW50OiBIQlMuQ29tbWVudFN0YXRlbWVudCk6IE9wdGlvbjxBU1R2MS5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQ+IHtcbiAgICBsZXQgeyB0b2tlbml6ZXIgfSA9IHRoaXM7XG5cbiAgICBpZiAodG9rZW5pemVyLnN0YXRlID09PSBUb2tlbml6ZXJTdGF0ZS5jb21tZW50KSB7XG4gICAgICB0aGlzLmFwcGVuZFRvQ29tbWVudERhdGEodGhpcy5zb3VyY2VGb3JOb2RlKHJhd0NvbW1lbnQpKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCB7IHZhbHVlLCBsb2MgfSA9IHJhd0NvbW1lbnQ7XG4gICAgbGV0IGNvbW1lbnQgPSBiLm11c3RhY2hlQ29tbWVudCh2YWx1ZSwgdGhpcy5zb3VyY2Uuc3BhbkZvcihsb2MpKTtcblxuICAgIHN3aXRjaCAodG9rZW5pemVyLnN0YXRlKSB7XG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWU6XG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmFmdGVyQXR0cmlidXRlTmFtZTpcbiAgICAgICAgdGhpcy5jdXJyZW50U3RhcnRUYWcuY29tbWVudHMucHVzaChjb21tZW50KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYmVmb3JlRGF0YTpcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuZGF0YTpcbiAgICAgICAgYXBwZW5kQ2hpbGQodGhpcy5jdXJyZW50RWxlbWVudCgpLCBjb21tZW50KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYFVzaW5nIGEgSGFuZGxlYmFycyBjb21tZW50IHdoZW4gaW4gdGhlIFxcYCR7dG9rZW5pemVyWydzdGF0ZSddfVxcYCBzdGF0ZSBpcyBub3Qgc3VwcG9ydGVkYCxcbiAgICAgICAgICB0aGlzLnNvdXJjZS5zcGFuRm9yKHJhd0NvbW1lbnQubG9jKVxuICAgICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBjb21tZW50O1xuICB9XG5cbiAgUGFydGlhbFN0YXRlbWVudChwYXJ0aWFsOiBIQlMuUGFydGlhbFN0YXRlbWVudCk6IG5ldmVyIHtcbiAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgYEhhbmRsZWJhcnMgcGFydGlhbHMgYXJlIG5vdCBzdXBwb3J0ZWRgLFxuICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXJ0aWFsLmxvYylcbiAgICApO1xuICB9XG5cbiAgUGFydGlhbEJsb2NrU3RhdGVtZW50KHBhcnRpYWxCbG9jazogSEJTLlBhcnRpYWxCbG9ja1N0YXRlbWVudCk6IG5ldmVyIHtcbiAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgYEhhbmRsZWJhcnMgcGFydGlhbCBibG9ja3MgYXJlIG5vdCBzdXBwb3J0ZWRgLFxuICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXJ0aWFsQmxvY2subG9jKVxuICAgICk7XG4gIH1cblxuICBEZWNvcmF0b3IoZGVjb3JhdG9yOiBIQlMuRGVjb3JhdG9yKTogbmV2ZXIge1xuICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICBgSGFuZGxlYmFycyBkZWNvcmF0b3JzIGFyZSBub3Qgc3VwcG9ydGVkYCxcbiAgICAgIHRoaXMuc291cmNlLnNwYW5Gb3IoZGVjb3JhdG9yLmxvYylcbiAgICApO1xuICB9XG5cbiAgRGVjb3JhdG9yQmxvY2soZGVjb3JhdG9yQmxvY2s6IEhCUy5EZWNvcmF0b3JCbG9jayk6IG5ldmVyIHtcbiAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgYEhhbmRsZWJhcnMgZGVjb3JhdG9yIGJsb2NrcyBhcmUgbm90IHN1cHBvcnRlZGAsXG4gICAgICB0aGlzLnNvdXJjZS5zcGFuRm9yKGRlY29yYXRvckJsb2NrLmxvYylcbiAgICApO1xuICB9XG5cbiAgU3ViRXhwcmVzc2lvbihzZXhwcjogSEJTLlN1YkV4cHJlc3Npb24pOiBBU1R2MS5TdWJFeHByZXNzaW9uIHtcbiAgICBsZXQgeyBwYXRoLCBwYXJhbXMsIGhhc2ggfSA9IGFjY2VwdENhbGxOb2Rlcyh0aGlzLCBzZXhwcik7XG4gICAgcmV0dXJuIGIuc2V4cHIoeyBwYXRoLCBwYXJhbXMsIGhhc2gsIGxvYzogdGhpcy5zb3VyY2Uuc3BhbkZvcihzZXhwci5sb2MpIH0pO1xuICB9XG5cbiAgUGF0aEV4cHJlc3Npb24ocGF0aDogSEJTLlBhdGhFeHByZXNzaW9uKTogQVNUdjEuUGF0aEV4cHJlc3Npb24ge1xuICAgIGxldCB7IG9yaWdpbmFsIH0gPSBwYXRoO1xuICAgIGxldCBwYXJ0czogc3RyaW5nW107XG5cbiAgICBpZiAob3JpZ2luYWwuaW5kZXhPZignLycpICE9PSAtMSkge1xuICAgICAgaWYgKG9yaWdpbmFsLnNsaWNlKDAsIDIpID09PSAnLi8nKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYFVzaW5nIFwiLi9cIiBpcyBub3Qgc3VwcG9ydGVkIGluIEdsaW1tZXIgYW5kIHVubmVjZXNzYXJ5YCxcbiAgICAgICAgICB0aGlzLnNvdXJjZS5zcGFuRm9yKHBhdGgubG9jKVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKG9yaWdpbmFsLnNsaWNlKDAsIDMpID09PSAnLi4vJykge1xuICAgICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgICAgIGBDaGFuZ2luZyBjb250ZXh0IHVzaW5nIFwiLi4vXCIgaXMgbm90IHN1cHBvcnRlZCBpbiBHbGltbWVyYCxcbiAgICAgICAgICB0aGlzLnNvdXJjZS5zcGFuRm9yKHBhdGgubG9jKVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKG9yaWdpbmFsLmluZGV4T2YoJy4nKSAhPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICBgTWl4aW5nICcuJyBhbmQgJy8nIGluIHBhdGhzIGlzIG5vdCBzdXBwb3J0ZWQgaW4gR2xpbW1lcjsgdXNlIG9ubHkgJy4nIHRvIHNlcGFyYXRlIHByb3BlcnR5IHBhdGhzYCxcbiAgICAgICAgICB0aGlzLnNvdXJjZS5zcGFuRm9yKHBhdGgubG9jKVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcGFydHMgPSBbcGF0aC5wYXJ0cy5qb2luKCcvJyldO1xuICAgIH0gZWxzZSBpZiAob3JpZ2luYWwgPT09ICcuJykge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgYCcuJyBpcyBub3QgYSBzdXBwb3J0ZWQgcGF0aCBpbiBHbGltbWVyOyBjaGVjayBmb3IgYSBwYXRoIHdpdGggYSB0cmFpbGluZyAnLidgLFxuICAgICAgICB0aGlzLnNvdXJjZS5zcGFuRm9yKHBhdGgubG9jKVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFydHMgPSBwYXRoLnBhcnRzO1xuICAgIH1cblxuICAgIGxldCB0aGlzSGVhZCA9IGZhbHNlO1xuXG4gICAgLy8gVGhpcyBpcyB0byBmaXggYSBidWcgaW4gdGhlIEhhbmRsZWJhcnMgQVNUIHdoZXJlIHRoZSBwYXRoIGV4cHJlc3Npb25zIGluXG4gICAgLy8gYHt7dGhpcy5mb299fWAgKGFuZCBzaW1pbGFybHkgYHt7Zm9vLWJhciB0aGlzLmZvbyBuYW1lZD10aGlzLmZvb319YCBldGMpXG4gICAgLy8gYXJlIHNpbXBseSB0dXJuZWQgaW50byBge3tmb299fWAuIFRoZSBmaXggaXMgdG8gcHVzaCBpdCBiYWNrIG9udG8gdGhlXG4gICAgLy8gcGFydHMgYXJyYXkgYW5kIGxldCB0aGUgcnVudGltZSBzZWUgdGhlIGRpZmZlcmVuY2UuIEhvd2V2ZXIsIHdlIGNhbm5vdFxuICAgIC8vIHNpbXBseSB1c2UgdGhlIHN0cmluZyBgdGhpc2AgYXMgaXQgbWVhbnMgbGl0ZXJhbGx5IHRoZSBwcm9wZXJ0eSBjYWxsZWRcbiAgICAvLyBcInRoaXNcIiBpbiB0aGUgY3VycmVudCBjb250ZXh0IChpdCBjYW4gYmUgZXhwcmVzc2VkIGluIHRoZSBzeW50YXggYXNcbiAgICAvLyBge3tbdGhpc119fWAsIHdoZXJlIHRoZSBzcXVhcmUgYnJhY2tldCBhcmUgZ2VuZXJhbGx5IGZvciB0aGlzIGtpbmQgb2ZcbiAgICAvLyBlc2NhcGluZyDigJMgc3VjaCBhcyBge3tmb28uW1wiYmFyLmJhelwiXX19YCB3b3VsZCBtZWFuIGxvb2t1cCBhIHByb3BlcnR5XG4gICAgLy8gbmFtZWQgbGl0ZXJhbGx5IFwiYmFyLmJhelwiIG9uIGB0aGlzLmZvb2ApLiBCeSBjb252ZW50aW9uLCB3ZSB1c2UgYG51bGxgXG4gICAgLy8gZm9yIHRoaXMgcHVycG9zZS5cbiAgICBpZiAob3JpZ2luYWwubWF0Y2goL150aGlzKFxcLi4rKT8kLykpIHtcbiAgICAgIHRoaXNIZWFkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBsZXQgcGF0aEhlYWQ6IEFTVHYxLlBhdGhIZWFkO1xuICAgIGlmICh0aGlzSGVhZCkge1xuICAgICAgcGF0aEhlYWQgPSB7XG4gICAgICAgIHR5cGU6ICdUaGlzSGVhZCcsXG4gICAgICAgIGxvYzoge1xuICAgICAgICAgIHN0YXJ0OiBwYXRoLmxvYy5zdGFydCxcbiAgICAgICAgICBlbmQ6IHsgbGluZTogcGF0aC5sb2Muc3RhcnQubGluZSwgY29sdW1uOiBwYXRoLmxvYy5zdGFydC5jb2x1bW4gKyA0IH0sXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAocGF0aC5kYXRhKSB7XG4gICAgICBsZXQgaGVhZCA9IHBhcnRzLnNoaWZ0KCk7XG5cbiAgICAgIGlmIChoZWFkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICBgQXR0ZW1wdGVkIHRvIHBhcnNlIGEgcGF0aCBleHByZXNzaW9uLCBidXQgaXQgd2FzIG5vdCB2YWxpZC4gUGF0aHMgYmVnaW5uaW5nIHdpdGggQCBtdXN0IHN0YXJ0IHdpdGggYS16LmAsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcGF0aEhlYWQgPSB7XG4gICAgICAgIHR5cGU6ICdBdEhlYWQnLFxuICAgICAgICBuYW1lOiBgQCR7aGVhZH1gLFxuICAgICAgICBsb2M6IHtcbiAgICAgICAgICBzdGFydDogcGF0aC5sb2Muc3RhcnQsXG4gICAgICAgICAgZW5kOiB7IGxpbmU6IHBhdGgubG9jLnN0YXJ0LmxpbmUsIGNvbHVtbjogcGF0aC5sb2Muc3RhcnQuY29sdW1uICsgaGVhZC5sZW5ndGggKyAxIH0sXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgaGVhZCA9IHBhcnRzLnNoaWZ0KCk7XG5cbiAgICAgIGlmIChoZWFkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICBgQXR0ZW1wdGVkIHRvIHBhcnNlIGEgcGF0aCBleHByZXNzaW9uLCBidXQgaXQgd2FzIG5vdCB2YWxpZC4gUGF0aHMgbXVzdCBzdGFydCB3aXRoIGEteiBvciBBLVouYCxcbiAgICAgICAgICB0aGlzLnNvdXJjZS5zcGFuRm9yKHBhdGgubG9jKVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBwYXRoSGVhZCA9IHtcbiAgICAgICAgdHlwZTogJ1ZhckhlYWQnLFxuICAgICAgICBuYW1lOiBoZWFkLFxuICAgICAgICBsb2M6IHtcbiAgICAgICAgICBzdGFydDogcGF0aC5sb2Muc3RhcnQsXG4gICAgICAgICAgZW5kOiB7IGxpbmU6IHBhdGgubG9jLnN0YXJ0LmxpbmUsIGNvbHVtbjogcGF0aC5sb2Muc3RhcnQuY29sdW1uICsgaGVhZC5sZW5ndGggfSxcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQYXRoRXhwcmVzc2lvbkltcGxWMShwYXRoLm9yaWdpbmFsLCBwYXRoSGVhZCwgcGFydHMsIHRoaXMuc291cmNlLnNwYW5Gb3IocGF0aC5sb2MpKTtcbiAgfVxuXG4gIEhhc2goaGFzaDogSEJTLkhhc2gpOiBBU1R2MS5IYXNoIHtcbiAgICBsZXQgcGFpcnM6IEFTVHYxLkhhc2hQYWlyW10gPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaGFzaC5wYWlycy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IHBhaXIgPSBoYXNoLnBhaXJzW2ldO1xuICAgICAgcGFpcnMucHVzaChcbiAgICAgICAgYi5wYWlyKHtcbiAgICAgICAgICBrZXk6IHBhaXIua2V5LFxuICAgICAgICAgIHZhbHVlOiB0aGlzLmFjY2VwdE5vZGUocGFpci52YWx1ZSksXG4gICAgICAgICAgbG9jOiB0aGlzLnNvdXJjZS5zcGFuRm9yKHBhaXIubG9jKSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGIuaGFzaChwYWlycywgdGhpcy5zb3VyY2Uuc3BhbkZvcihoYXNoLmxvYykpO1xuICB9XG5cbiAgU3RyaW5nTGl0ZXJhbChzdHJpbmc6IEhCUy5TdHJpbmdMaXRlcmFsKTogQVNUdjEuU3RyaW5nTGl0ZXJhbCB7XG4gICAgcmV0dXJuIGIubGl0ZXJhbCh7IHR5cGU6ICdTdHJpbmdMaXRlcmFsJywgdmFsdWU6IHN0cmluZy52YWx1ZSwgbG9jOiBzdHJpbmcubG9jIH0pO1xuICB9XG5cbiAgQm9vbGVhbkxpdGVyYWwoYm9vbGVhbjogSEJTLkJvb2xlYW5MaXRlcmFsKTogQVNUdjEuQm9vbGVhbkxpdGVyYWwge1xuICAgIHJldHVybiBiLmxpdGVyYWwoeyB0eXBlOiAnQm9vbGVhbkxpdGVyYWwnLCB2YWx1ZTogYm9vbGVhbi52YWx1ZSwgbG9jOiBib29sZWFuLmxvYyB9KTtcbiAgfVxuXG4gIE51bWJlckxpdGVyYWwobnVtYmVyOiBIQlMuTnVtYmVyTGl0ZXJhbCk6IEFTVHYxLk51bWJlckxpdGVyYWwge1xuICAgIHJldHVybiBiLmxpdGVyYWwoeyB0eXBlOiAnTnVtYmVyTGl0ZXJhbCcsIHZhbHVlOiBudW1iZXIudmFsdWUsIGxvYzogbnVtYmVyLmxvYyB9KTtcbiAgfVxuXG4gIFVuZGVmaW5lZExpdGVyYWwodW5kZWY6IEhCUy5VbmRlZmluZWRMaXRlcmFsKTogQVNUdjEuVW5kZWZpbmVkTGl0ZXJhbCB7XG4gICAgcmV0dXJuIGIubGl0ZXJhbCh7IHR5cGU6ICdVbmRlZmluZWRMaXRlcmFsJywgdmFsdWU6IHVuZGVmaW5lZCwgbG9jOiB1bmRlZi5sb2MgfSk7XG4gIH1cblxuICBOdWxsTGl0ZXJhbChudWw6IEhCUy5OdWxsTGl0ZXJhbCk6IEFTVHYxLk51bGxMaXRlcmFsIHtcbiAgICByZXR1cm4gYi5saXRlcmFsKHsgdHlwZTogJ051bGxMaXRlcmFsJywgdmFsdWU6IG51bGwsIGxvYzogbnVsLmxvYyB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVSaWdodFN0cmlwcGVkT2Zmc2V0cyhvcmlnaW5hbDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSB7XG4gIGlmICh2YWx1ZSA9PT0gJycpIHtcbiAgICAvLyBpZiBpdCBpcyBlbXB0eSwganVzdCByZXR1cm4gdGhlIGNvdW50IG9mIG5ld2xpbmVzXG4gICAgLy8gaW4gb3JpZ2luYWxcbiAgICByZXR1cm4ge1xuICAgICAgbGluZXM6IG9yaWdpbmFsLnNwbGl0KCdcXG4nKS5sZW5ndGggLSAxLFxuICAgICAgY29sdW1uczogMCxcbiAgICB9O1xuICB9XG5cbiAgLy8gb3RoZXJ3aXNlLCByZXR1cm4gdGhlIG51bWJlciBvZiBuZXdsaW5lcyBwcmlvciB0b1xuICAvLyBgdmFsdWVgXG4gIGxldCBkaWZmZXJlbmNlID0gb3JpZ2luYWwuc3BsaXQodmFsdWUpWzBdO1xuICBsZXQgbGluZXMgPSBkaWZmZXJlbmNlLnNwbGl0KC9cXG4vKTtcbiAgbGV0IGxpbmVDb3VudCA9IGxpbmVzLmxlbmd0aCAtIDE7XG5cbiAgcmV0dXJuIHtcbiAgICBsaW5lczogbGluZUNvdW50LFxuICAgIGNvbHVtbnM6IGxpbmVzW2xpbmVDb3VudF0ubGVuZ3RoLFxuICB9O1xufVxuXG5mdW5jdGlvbiB1cGRhdGVUb2tlbml6ZXJMb2NhdGlvbih0b2tlbml6ZXI6IFBhcnNlclsndG9rZW5pemVyJ10sIGNvbnRlbnQ6IEhCUy5Db250ZW50U3RhdGVtZW50KSB7XG4gIGxldCBsaW5lID0gY29udGVudC5sb2Muc3RhcnQubGluZTtcbiAgbGV0IGNvbHVtbiA9IGNvbnRlbnQubG9jLnN0YXJ0LmNvbHVtbjtcblxuICBsZXQgb2Zmc2V0cyA9IGNhbGN1bGF0ZVJpZ2h0U3RyaXBwZWRPZmZzZXRzKFxuICAgIGNvbnRlbnQub3JpZ2luYWwgYXMgUmVjYXN0PEhCUy5TdHJpcEZsYWdzLCBzdHJpbmc+LFxuICAgIGNvbnRlbnQudmFsdWVcbiAgKTtcblxuICBsaW5lID0gbGluZSArIG9mZnNldHMubGluZXM7XG4gIGlmIChvZmZzZXRzLmxpbmVzKSB7XG4gICAgY29sdW1uID0gb2Zmc2V0cy5jb2x1bW5zO1xuICB9IGVsc2Uge1xuICAgIGNvbHVtbiA9IGNvbHVtbiArIG9mZnNldHMuY29sdW1ucztcbiAgfVxuXG4gIHRva2VuaXplci5saW5lID0gbGluZTtcbiAgdG9rZW5pemVyLmNvbHVtbiA9IGNvbHVtbjtcbn1cblxuZnVuY3Rpb24gYWNjZXB0Q2FsbE5vZGVzKFxuICBjb21waWxlcjogSGFuZGxlYmFyc05vZGVWaXNpdG9ycyxcbiAgbm9kZToge1xuICAgIHBhdGg6XG4gICAgICB8IEhCUy5QYXRoRXhwcmVzc2lvblxuICAgICAgfCBIQlMuU3ViRXhwcmVzc2lvblxuICAgICAgfCBIQlMuU3RyaW5nTGl0ZXJhbFxuICAgICAgfCBIQlMuVW5kZWZpbmVkTGl0ZXJhbFxuICAgICAgfCBIQlMuTnVsbExpdGVyYWxcbiAgICAgIHwgSEJTLk51bWJlckxpdGVyYWxcbiAgICAgIHwgSEJTLkJvb2xlYW5MaXRlcmFsO1xuICAgIHBhcmFtczogSEJTLkV4cHJlc3Npb25bXTtcbiAgICBoYXNoOiBIQlMuSGFzaDtcbiAgfVxuKToge1xuICBwYXRoOiBBU1R2MS5QYXRoRXhwcmVzc2lvbiB8IEFTVHYxLlN1YkV4cHJlc3Npb247XG4gIHBhcmFtczogQVNUdjEuRXhwcmVzc2lvbltdO1xuICBoYXNoOiBBU1R2MS5IYXNoO1xufSB7XG4gIGlmIChub2RlLnBhdGgudHlwZS5lbmRzV2l0aCgnTGl0ZXJhbCcpKSB7XG4gICAgY29uc3QgcGF0aCA9IChub2RlLnBhdGggYXMgdW5rbm93bikgYXNcbiAgICAgIHwgSEJTLlN0cmluZ0xpdGVyYWxcbiAgICAgIHwgSEJTLlVuZGVmaW5lZExpdGVyYWxcbiAgICAgIHwgSEJTLk51bGxMaXRlcmFsXG4gICAgICB8IEhCUy5OdW1iZXJMaXRlcmFsXG4gICAgICB8IEhCUy5Cb29sZWFuTGl0ZXJhbDtcblxuICAgIGxldCB2YWx1ZSA9ICcnO1xuICAgIGlmIChwYXRoLnR5cGUgPT09ICdCb29sZWFuTGl0ZXJhbCcpIHtcbiAgICAgIHZhbHVlID0gcGF0aC5vcmlnaW5hbC50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAocGF0aC50eXBlID09PSAnU3RyaW5nTGl0ZXJhbCcpIHtcbiAgICAgIHZhbHVlID0gYFwiJHtwYXRoLm9yaWdpbmFsfVwiYDtcbiAgICB9IGVsc2UgaWYgKHBhdGgudHlwZSA9PT0gJ051bGxMaXRlcmFsJykge1xuICAgICAgdmFsdWUgPSAnbnVsbCc7XG4gICAgfSBlbHNlIGlmIChwYXRoLnR5cGUgPT09ICdOdW1iZXJMaXRlcmFsJykge1xuICAgICAgdmFsdWUgPSBwYXRoLnZhbHVlLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gJ3VuZGVmaW5lZCc7XG4gICAgfVxuICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICBgJHtwYXRoLnR5cGV9IFwiJHtcbiAgICAgICAgcGF0aC50eXBlID09PSAnU3RyaW5nTGl0ZXJhbCcgPyBwYXRoLm9yaWdpbmFsIDogdmFsdWVcbiAgICAgIH1cIiBjYW5ub3QgYmUgY2FsbGVkIGFzIGEgc3ViLWV4cHJlc3Npb24sIHJlcGxhY2UgKCR7dmFsdWV9KSB3aXRoICR7dmFsdWV9YCxcbiAgICAgIGNvbXBpbGVyLnNvdXJjZS5zcGFuRm9yKHBhdGgubG9jKVxuICAgICk7XG4gIH1cblxuICBsZXQgcGF0aCA9XG4gICAgbm9kZS5wYXRoLnR5cGUgPT09ICdQYXRoRXhwcmVzc2lvbidcbiAgICAgID8gY29tcGlsZXIuUGF0aEV4cHJlc3Npb24obm9kZS5wYXRoKVxuICAgICAgOiBjb21waWxlci5TdWJFeHByZXNzaW9uKChub2RlLnBhdGggYXMgdW5rbm93bikgYXMgSEJTLlN1YkV4cHJlc3Npb24pO1xuICBsZXQgcGFyYW1zID0gbm9kZS5wYXJhbXMgPyBub2RlLnBhcmFtcy5tYXAoKGUpID0+IGNvbXBpbGVyLmFjY2VwdE5vZGU8QVNUdjEuRXhwcmVzc2lvbj4oZSkpIDogW107XG5cbiAgLy8gaWYgdGhlcmUgaXMgbm8gaGFzaCwgcG9zaXRpb24gaXQgYXMgYSBjb2xsYXBzZWQgbm9kZSBpbW1lZGlhdGVseSBhZnRlciB0aGUgbGFzdCBwYXJhbSAob3IgdGhlXG4gIC8vIHBhdGgsIGlmIHRoZXJlIGFyZSBhbHNvIG5vIHBhcmFtcylcbiAgbGV0IGVuZCA9IHBhcmFtcy5sZW5ndGggPiAwID8gcGFyYW1zW3BhcmFtcy5sZW5ndGggLSAxXS5sb2MgOiBwYXRoLmxvYztcblxuICBsZXQgaGFzaCA9IG5vZGUuaGFzaFxuICAgID8gY29tcGlsZXIuSGFzaChub2RlLmhhc2gpXG4gICAgOiAoe1xuICAgICAgICB0eXBlOiAnSGFzaCcsXG4gICAgICAgIHBhaXJzOiBbXSBhcyBBU1R2MS5IYXNoUGFpcltdLFxuICAgICAgICBsb2M6IGNvbXBpbGVyLnNvdXJjZS5zcGFuRm9yKGVuZCkuY29sbGFwc2UoJ2VuZCcpLFxuICAgICAgfSBhcyBjb25zdCk7XG5cbiAgcmV0dXJuIHsgcGF0aCwgcGFyYW1zLCBoYXNoIH07XG59XG5cbmZ1bmN0aW9uIGFkZEVsZW1lbnRNb2RpZmllcihcbiAgZWxlbWVudDogUGFyc2VyTm9kZUJ1aWxkZXI8VGFnPCdTdGFydFRhZyc+PixcbiAgbXVzdGFjaGU6IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50XG4pIHtcbiAgbGV0IHsgcGF0aCwgcGFyYW1zLCBoYXNoLCBsb2MgfSA9IG11c3RhY2hlO1xuXG4gIGlmIChpc0hCU0xpdGVyYWwocGF0aCkpIHtcbiAgICBsZXQgbW9kaWZpZXIgPSBge3ske3ByaW50TGl0ZXJhbChwYXRoKX19fWA7XG4gICAgbGV0IHRhZyA9IGA8JHtlbGVtZW50Lm5hbWV9IC4uLiAke21vZGlmaWVyfSAuLi5gO1xuXG4gICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihgSW4gJHt0YWd9LCAke21vZGlmaWVyfSBpcyBub3QgYSB2YWxpZCBtb2RpZmllcmAsIG11c3RhY2hlLmxvYyk7XG4gIH1cblxuICBsZXQgbW9kaWZpZXIgPSBiLmVsZW1lbnRNb2RpZmllcih7IHBhdGgsIHBhcmFtcywgaGFzaCwgbG9jIH0pO1xuICBlbGVtZW50Lm1vZGlmaWVycy5wdXNoKG1vZGlmaWVyKTtcbn1cbiJdLCJzb3VyY2VSb290IjoiIn0=