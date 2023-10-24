import { Parser } from '../parser';
import { NON_EXISTENT_LOCATION } from '../source/location';
import { generateSyntaxError } from '../syntax-error';
import { appendChild, isHBSLiteral, printLiteral } from '../utils';
import { PathExpressionImplV1 } from '../v1/legacy-interop';
import b from '../v1/parser-builders';
export class HandlebarsNodeVisitors extends Parser {
  get isTopLevel() {
    return this.elementStack.length === 0;
  }

  Program(program) {
    let body = [];
    let node;

    if (this.isTopLevel) {
      node = b.template({
        body,
        blockParams: program.blockParams,
        loc: this.source.spanFor(program.loc)
      });
    } else {
      node = b.blockItself({
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
      throw generateSyntaxError(`Unclosed element \`${elementNode.tag}\``, elementNode.loc);
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
        throw generateSyntaxError('A block may only be used inside an HTML element or another block.', this.source.spanFor(block.loc));
      }

    let {
      path,
      params,
      hash
    } = acceptCallNodes(this, block); // These are bugs in Handlebars upstream

    if (!block.program.loc) {
      block.program.loc = NON_EXISTENT_LOCATION;
    }

    if (block.inverse && !block.inverse.loc) {
      block.inverse.loc = NON_EXISTENT_LOCATION;
    }

    let program = this.Program(block.program);
    let inverse = block.inverse ? this.Program(block.inverse) : null;
    let node = b.block({
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
    appendChild(parentProgram, node);
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

    if (isHBSLiteral(rawMustache.path)) {
      mustache = b.mustache({
        path: this.acceptNode(rawMustache.path),
        params: [],
        hash: b.hash([], this.source.spanFor(rawMustache.path.loc).collapse('end')),
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
      mustache = b.mustache({
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
        throw generateSyntaxError(`Cannot use mustaches in an elements tagname`, mustache.loc);

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
        appendChild(this.currentElement(), mustache);
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
    let comment = b.mustacheComment(value, this.source.spanFor(loc));

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
        appendChild(this.currentElement(), comment);
        break;

      default:
        throw generateSyntaxError(`Using a Handlebars comment when in the \`${tokenizer['state']}\` state is not supported`, this.source.spanFor(rawComment.loc));
    }

    return comment;
  }

  PartialStatement(partial) {
    throw generateSyntaxError(`Handlebars partials are not supported`, this.source.spanFor(partial.loc));
  }

  PartialBlockStatement(partialBlock) {
    throw generateSyntaxError(`Handlebars partial blocks are not supported`, this.source.spanFor(partialBlock.loc));
  }

  Decorator(decorator) {
    throw generateSyntaxError(`Handlebars decorators are not supported`, this.source.spanFor(decorator.loc));
  }

  DecoratorBlock(decoratorBlock) {
    throw generateSyntaxError(`Handlebars decorator blocks are not supported`, this.source.spanFor(decoratorBlock.loc));
  }

  SubExpression(sexpr) {
    let {
      path,
      params,
      hash
    } = acceptCallNodes(this, sexpr);
    return b.sexpr({
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
        throw generateSyntaxError(`Using "./" is not supported in Glimmer and unnecessary`, this.source.spanFor(path.loc));
      }

      if (original.slice(0, 3) === '../') {
        throw generateSyntaxError(`Changing context using "../" is not supported in Glimmer`, this.source.spanFor(path.loc));
      }

      if (original.indexOf('.') !== -1) {
        throw generateSyntaxError(`Mixing '.' and '/' in paths is not supported in Glimmer; use only '.' to separate property paths`, this.source.spanFor(path.loc));
      }

      parts = [path.parts.join('/')];
    } else if (original === '.') {
      throw generateSyntaxError(`'.' is not a supported path in Glimmer; check for a path with a trailing '.'`, this.source.spanFor(path.loc));
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
        throw generateSyntaxError(`Attempted to parse a path expression, but it was not valid. Paths beginning with @ must start with a-z.`, this.source.spanFor(path.loc));
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
        throw generateSyntaxError(`Attempted to parse a path expression, but it was not valid. Paths must start with a-z or A-Z.`, this.source.spanFor(path.loc));
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

    return new PathExpressionImplV1(path.original, pathHead, parts, this.source.spanFor(path.loc));
  }

  Hash(hash) {
    let pairs = [];

    for (let i = 0; i < hash.pairs.length; i++) {
      let pair = hash.pairs[i];
      pairs.push(b.pair({
        key: pair.key,
        value: this.acceptNode(pair.value),
        loc: this.source.spanFor(pair.loc)
      }));
    }

    return b.hash(pairs, this.source.spanFor(hash.loc));
  }

  StringLiteral(string) {
    return b.literal({
      type: 'StringLiteral',
      value: string.value,
      loc: string.loc
    });
  }

  BooleanLiteral(boolean) {
    return b.literal({
      type: 'BooleanLiteral',
      value: boolean.value,
      loc: boolean.loc
    });
  }

  NumberLiteral(number) {
    return b.literal({
      type: 'NumberLiteral',
      value: number.value,
      loc: number.loc
    });
  }

  UndefinedLiteral(undef) {
    return b.literal({
      type: 'UndefinedLiteral',
      value: undefined,
      loc: undef.loc
    });
  }

  NullLiteral(nul) {
    return b.literal({
      type: 'NullLiteral',
      value: null,
      loc: nul.loc
    });
  }

}

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

    throw generateSyntaxError(`${path.type} "${path.type === 'StringLiteral' ? path.original : value}" cannot be called as a sub-expression, replace (${value}) with ${value}`, compiler.source.spanFor(path.loc));
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

  if (isHBSLiteral(path)) {
    let modifier = `{{${printLiteral(path)}}}`;
    let tag = `<${element.name} ... ${modifier} ...`;
    throw generateSyntaxError(`In ${tag}, ${modifier} is not a valid modifier`, mustache.loc);
  }

  let modifier = b.elementModifier({
    path,
    params,
    hash,
    loc
  });
  element.modifiers.push(modifier);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvcGFyc2VyL2hhbmRsZWJhcnMtbm9kZS12aXNpdG9ycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFHQSxTQUFTLE1BQVQsUUFBK0MsV0FBL0M7QUFDQSxTQUFTLHFCQUFULFFBQXNDLG9CQUF0QztBQUNBLFNBQVMsbUJBQVQsUUFBb0MsaUJBQXBDO0FBQ0EsU0FBUyxXQUFULEVBQXNCLFlBQXRCLEVBQW9DLFlBQXBDLFFBQXdELFVBQXhEO0FBR0EsU0FBUyxvQkFBVCxRQUFxQyxzQkFBckM7QUFDQSxPQUFPLENBQVAsTUFBYyx1QkFBZDtBQUVBLE9BQU0sTUFBZ0Isc0JBQWhCLFNBQStDLE1BQS9DLENBQXFEO0FBS3pELE1BQVksVUFBWixHQUFzQjtBQUNwQixXQUFPLEtBQUssWUFBTCxDQUFrQixNQUFsQixLQUE2QixDQUFwQztBQUNEOztBQUtELEVBQUEsT0FBTyxDQUFDLE9BQUQsRUFBcUI7QUFDMUIsUUFBSSxJQUFJLEdBQXNCLEVBQTlCO0FBQ0EsUUFBSSxJQUFKOztBQUVBLFFBQUksS0FBSyxVQUFULEVBQXFCO0FBQ25CLE1BQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFGLENBQVc7QUFDaEIsUUFBQSxJQURnQjtBQUVoQixRQUFBLFdBQVcsRUFBRSxPQUFPLENBQUMsV0FGTDtBQUdoQixRQUFBLEdBQUcsRUFBRSxLQUFLLE1BQUwsQ0FBWSxPQUFaLENBQW9CLE9BQU8sQ0FBQyxHQUE1QjtBQUhXLE9BQVgsQ0FBUDtBQUtELEtBTkQsTUFNTztBQUNMLE1BQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxXQUFGLENBQWM7QUFDbkIsUUFBQSxJQURtQjtBQUVuQixRQUFBLFdBQVcsRUFBRSxPQUFPLENBQUMsV0FGRjtBQUduQixRQUFBLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FIRTtBQUluQixRQUFBLEdBQUcsRUFBRSxLQUFLLE1BQUwsQ0FBWSxPQUFaLENBQW9CLE9B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QUEsTUFBUjtBQUFnQixJQUFBLElBQWhCO0FBQXNCLElBQUE7QUFBdEIsR0FBbEIsQ0FBZjtBQUNBLEVBQUEsT0FBTyxDQUFDLFNBQVIsQ0FBa0IsSUFBbEIsQ0FBdUIsUUFBdkI7QUFDRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE9wdGlvbiwgUmVjYXN0IH0gZnJvbSAnQGdsaW1tZXIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBUb2tlbml6ZXJTdGF0ZSB9IGZyb20gJ3NpbXBsZS1odG1sLXRva2VuaXplcic7XG5cbmltcG9ydCB7IFBhcnNlciwgUGFyc2VyTm9kZUJ1aWxkZXIsIFRhZyB9IGZyb20gJy4uL3BhcnNlcic7XG5pbXBvcnQgeyBOT05fRVhJU1RFTlRfTE9DQVRJT04gfSBmcm9tICcuLi9zb3VyY2UvbG9jYXRpb24nO1xuaW1wb3J0IHsgZ2VuZXJhdGVTeW50YXhFcnJvciB9IGZyb20gJy4uL3N5bnRheC1lcnJvcic7XG5pbXBvcnQgeyBhcHBlbmRDaGlsZCwgaXNIQlNMaXRlcmFsLCBwcmludExpdGVyYWwgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuLi92MS9hcGknO1xuaW1wb3J0ICogYXMgSEJTIGZyb20gJy4uL3YxL2hhbmRsZWJhcnMtYXN0JztcbmltcG9ydCB7IFBhdGhFeHByZXNzaW9uSW1wbFYxIH0gZnJvbSAnLi4vdjEvbGVnYWN5LWludGVyb3AnO1xuaW1wb3J0IGIgZnJvbSAnLi4vdjEvcGFyc2VyLWJ1aWxkZXJzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEhhbmRsZWJhcnNOb2RlVmlzaXRvcnMgZXh0ZW5kcyBQYXJzZXIge1xuICBhYnN0cmFjdCBhcHBlbmRUb0NvbW1lbnREYXRhKHM6IHN0cmluZyk6IHZvaWQ7XG4gIGFic3RyYWN0IGJlZ2luQXR0cmlidXRlVmFsdWUocXVvdGVkOiBib29sZWFuKTogdm9pZDtcbiAgYWJzdHJhY3QgZmluaXNoQXR0cmlidXRlVmFsdWUoKTogdm9pZDtcblxuICBwcml2YXRlIGdldCBpc1RvcExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmVsZW1lbnRTdGFjay5sZW5ndGggPT09IDA7XG4gIH1cblxuICBQcm9ncmFtKHByb2dyYW06IEhCUy5Qcm9ncmFtKTogQVNUdjEuQmxvY2s7XG4gIFByb2dyYW0ocHJvZ3JhbTogSEJTLlByb2dyYW0pOiBBU1R2MS5UZW1wbGF0ZTtcbiAgUHJvZ3JhbShwcm9ncmFtOiBIQlMuUHJvZ3JhbSk6IEFTVHYxLlRlbXBsYXRlIHwgQVNUdjEuQmxvY2s7XG4gIFByb2dyYW0ocHJvZ3JhbTogSEJTLlByb2dyYW0pOiBBU1R2MS5CbG9jayB8IEFTVHYxLlRlbXBsYXRlIHtcbiAgICBsZXQgYm9keTogQVNUdjEuU3RhdGVtZW50W10gPSBbXTtcbiAgICBsZXQgbm9kZTtcblxuICAgIGlmICh0aGlzLmlzVG9wTGV2ZWwpIHtcbiAgICAgIG5vZGUgPSBiLnRlbXBsYXRlKHtcbiAgICAgICAgYm9keSxcbiAgICAgICAgYmxvY2tQYXJhbXM6IHByb2dyYW0uYmxvY2tQYXJhbXMsXG4gICAgICAgIGxvYzogdGhpcy5zb3VyY2Uuc3BhbkZvcihwcm9ncmFtLmxvYyksXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZSA9IGIuYmxvY2tJdHNlbGYoe1xuICAgICAgICBib2R5LFxuICAgICAgICBibG9ja1BhcmFtczogcHJvZ3JhbS5ibG9ja1BhcmFtcyxcbiAgICAgICAgY2hhaW5lZDogcHJvZ3JhbS5jaGFpbmVkLFxuICAgICAgICBsb2M6IHRoaXMuc291cmNlLnNwYW5Gb3IocHJvZ3JhbS5sb2MpLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbGV0IGksXG4gICAgICBsID0gcHJvZ3JhbS5ib2R5Lmxlbmd0aDtcblxuICAgIHRoaXMuZWxlbWVudFN0YWNrLnB1c2gobm9kZSk7XG5cbiAgICBpZiAobCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuZWxlbWVudFN0YWNrLnBvcCgpIGFzIEFTVHYxLkJsb2NrIHwgQVNUdjEuVGVtcGxhdGU7XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgdGhpcy5hY2NlcHROb2RlKHByb2dyYW0uYm9keVtpXSk7XG4gICAgfVxuXG4gICAgLy8gRW5zdXJlIHRoYXQgdGhhdCB0aGUgZWxlbWVudCBzdGFjayBpcyBiYWxhbmNlZCBwcm9wZXJseS5cbiAgICBsZXQgcG9wcGVkTm9kZSA9IHRoaXMuZWxlbWVudFN0YWNrLnBvcCgpO1xuICAgIGlmIChwb3BwZWROb2RlICE9PSBub2RlKSB7XG4gICAgICBsZXQgZWxlbWVudE5vZGUgPSBwb3BwZWROb2RlIGFzIEFTVHYxLkVsZW1lbnROb2RlO1xuXG4gICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKGBVbmNsb3NlZCBlbGVtZW50IFxcYCR7ZWxlbWVudE5vZGUudGFnfVxcYGAsIGVsZW1lbnROb2RlLmxvYyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBCbG9ja1N0YXRlbWVudChibG9jazogSEJTLkJsb2NrU3RhdGVtZW50KTogQVNUdjEuQmxvY2tTdGF0ZW1lbnQgfCB2b2lkIHtcbiAgICBpZiAodGhpcy50b2tlbml6ZXIuc3RhdGUgPT09IFRva2VuaXplclN0YXRlLmNvbW1lbnQpIHtcbiAgICAgIHRoaXMuYXBwZW5kVG9Db21tZW50RGF0YSh0aGlzLnNvdXJjZUZvck5vZGUoYmxvY2spKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnRva2VuaXplci5zdGF0ZSAhPT0gVG9rZW5pemVyU3RhdGUuZGF0YSAmJlxuICAgICAgdGhpcy50b2tlbml6ZXIuc3RhdGUgIT09IFRva2VuaXplclN0YXRlLmJlZm9yZURhdGFcbiAgICApIHtcbiAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICdBIGJsb2NrIG1heSBvbmx5IGJlIHVzZWQgaW5zaWRlIGFuIEhUTUwgZWxlbWVudCBvciBhbm90aGVyIGJsb2NrLicsXG4gICAgICAgIHRoaXMuc291cmNlLnNwYW5Gb3IoYmxvY2subG9jKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBsZXQgeyBwYXRoLCBwYXJhbXMsIGhhc2ggfSA9IGFjY2VwdENhbGxOb2Rlcyh0aGlzLCBibG9jayk7XG5cbiAgICAvLyBUaGVzZSBhcmUgYnVncyBpbiBIYW5kbGViYXJzIHVwc3RyZWFtXG4gICAgaWYgKCFibG9jay5wcm9ncmFtLmxvYykge1xuICAgICAgYmxvY2sucHJvZ3JhbS5sb2MgPSBOT05fRVhJU1RFTlRfTE9DQVRJT047XG4gICAgfVxuXG4gICAgaWYgKGJsb2NrLmludmVyc2UgJiYgIWJsb2NrLmludmVyc2UubG9jKSB7XG4gICAgICBibG9jay5pbnZlcnNlLmxvYyA9IE5PTl9FWElTVEVOVF9MT0NBVElPTjtcbiAgICB9XG5cbiAgICBsZXQgcHJvZ3JhbSA9IHRoaXMuUHJvZ3JhbShibG9jay5wcm9ncmFtKTtcbiAgICBsZXQgaW52ZXJzZSA9IGJsb2NrLmludmVyc2UgPyB0aGlzLlByb2dyYW0oYmxvY2suaW52ZXJzZSkgOiBudWxsO1xuXG4gICAgbGV0IG5vZGUgPSBiLmJsb2NrKHtcbiAgICAgIHBhdGgsXG4gICAgICBwYXJhbXMsXG4gICAgICBoYXNoLFxuICAgICAgZGVmYXVsdEJsb2NrOiBwcm9ncmFtLFxuICAgICAgZWxzZUJsb2NrOiBpbnZlcnNlLFxuICAgICAgbG9jOiB0aGlzLnNvdXJjZS5zcGFuRm9yKGJsb2NrLmxvYyksXG4gICAgICBvcGVuU3RyaXA6IGJsb2NrLm9wZW5TdHJpcCxcbiAgICAgIGludmVyc2VTdHJpcDogYmxvY2suaW52ZXJzZVN0cmlwLFxuICAgICAgY2xvc2VTdHJpcDogYmxvY2suY2xvc2VTdHJpcCxcbiAgICB9KTtcblxuICAgIGxldCBwYXJlbnRQcm9ncmFtID0gdGhpcy5jdXJyZW50RWxlbWVudCgpO1xuXG4gICAgYXBwZW5kQ2hpbGQocGFyZW50UHJvZ3JhbSwgbm9kZSk7XG4gIH1cblxuICBNdXN0YWNoZVN0YXRlbWVudChyYXdNdXN0YWNoZTogSEJTLk11c3RhY2hlU3RhdGVtZW50KTogQVNUdjEuTXVzdGFjaGVTdGF0ZW1lbnQgfCB2b2lkIHtcbiAgICBsZXQgeyB0b2tlbml6ZXIgfSA9IHRoaXM7XG5cbiAgICBpZiAodG9rZW5pemVyLnN0YXRlID09PSAnY29tbWVudCcpIHtcbiAgICAgIHRoaXMuYXBwZW5kVG9Db21tZW50RGF0YSh0aGlzLnNvdXJjZUZvck5vZGUocmF3TXVzdGFjaGUpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgbXVzdGFjaGU6IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50O1xuICAgIGxldCB7IGVzY2FwZWQsIGxvYywgc3RyaXAgfSA9IHJhd011c3RhY2hlO1xuXG4gICAgaWYgKGlzSEJTTGl0ZXJhbChyYXdNdXN0YWNoZS5wYXRoKSkge1xuICAgICAgbXVzdGFjaGUgPSBiLm11c3RhY2hlKHtcbiAgICAgICAgcGF0aDogdGhpcy5hY2NlcHROb2RlPEFTVHYxLkxpdGVyYWw+KHJhd011c3RhY2hlLnBhdGgpLFxuICAgICAgICBwYXJhbXM6IFtdLFxuICAgICAgICBoYXNoOiBiLmhhc2goW10sIHRoaXMuc291cmNlLnNwYW5Gb3IocmF3TXVzdGFjaGUucGF0aC5sb2MpLmNvbGxhcHNlKCdlbmQnKSksXG4gICAgICAgIHRydXN0aW5nOiAhZXNjYXBlZCxcbiAgICAgICAgbG9jOiB0aGlzLnNvdXJjZS5zcGFuRm9yKGxvYyksXG4gICAgICAgIHN0cmlwLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCB7IHBhdGgsIHBhcmFtcywgaGFzaCB9ID0gYWNjZXB0Q2FsbE5vZGVzKFxuICAgICAgICB0aGlzLFxuICAgICAgICByYXdNdXN0YWNoZSBhcyBIQlMuTXVzdGFjaGVTdGF0ZW1lbnQgJiB7XG4gICAgICAgICAgcGF0aDogSEJTLlBhdGhFeHByZXNzaW9uIHwgSEJTLlN1YkV4cHJlc3Npb247XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgICBtdXN0YWNoZSA9IGIubXVzdGFjaGUoe1xuICAgICAgICBwYXRoLFxuICAgICAgICBwYXJhbXMsXG4gICAgICAgIGhhc2gsXG4gICAgICAgIHRydXN0aW5nOiAhZXNjYXBlZCxcbiAgICAgICAgbG9jOiB0aGlzLnNvdXJjZS5zcGFuRm9yKGxvYyksXG4gICAgICAgIHN0cmlwLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3dpdGNoICh0b2tlbml6ZXIuc3RhdGUpIHtcbiAgICAgIC8vIFRhZyBoZWxwZXJzXG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLnRhZ09wZW46XG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLnRhZ05hbWU6XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoYENhbm5vdCB1c2UgbXVzdGFjaGVzIGluIGFuIGVsZW1lbnRzIHRhZ25hbWVgLCBtdXN0YWNoZS5sb2MpO1xuXG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWU6XG4gICAgICAgIGFkZEVsZW1lbnRNb2RpZmllcih0aGlzLmN1cnJlbnRTdGFydFRhZywgbXVzdGFjaGUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYXR0cmlidXRlTmFtZTpcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVOYW1lOlxuICAgICAgICB0aGlzLmJlZ2luQXR0cmlidXRlVmFsdWUoZmFsc2UpO1xuICAgICAgICB0aGlzLmZpbmlzaEF0dHJpYnV0ZVZhbHVlKCk7XG4gICAgICAgIGFkZEVsZW1lbnRNb2RpZmllcih0aGlzLmN1cnJlbnRTdGFydFRhZywgbXVzdGFjaGUpO1xuICAgICAgICB0b2tlbml6ZXIudHJhbnNpdGlvblRvKFRva2VuaXplclN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVWYWx1ZVF1b3RlZDpcbiAgICAgICAgYWRkRWxlbWVudE1vZGlmaWVyKHRoaXMuY3VycmVudFN0YXJ0VGFnLCBtdXN0YWNoZSk7XG4gICAgICAgIHRva2VuaXplci50cmFuc2l0aW9uVG8oVG9rZW5pemVyU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBBdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmJlZm9yZUF0dHJpYnV0ZVZhbHVlOlxuICAgICAgICB0aGlzLmJlZ2luQXR0cmlidXRlVmFsdWUoZmFsc2UpO1xuICAgICAgICB0aGlzLmFwcGVuZER5bmFtaWNBdHRyaWJ1dGVWYWx1ZVBhcnQobXVzdGFjaGUpO1xuICAgICAgICB0b2tlbml6ZXIudHJhbnNpdGlvblRvKFRva2VuaXplclN0YXRlLmF0dHJpYnV0ZVZhbHVlVW5xdW90ZWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYXR0cmlidXRlVmFsdWVEb3VibGVRdW90ZWQ6XG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmF0dHJpYnV0ZVZhbHVlU2luZ2xlUXVvdGVkOlxuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5hdHRyaWJ1dGVWYWx1ZVVucXVvdGVkOlxuICAgICAgICB0aGlzLmFwcGVuZER5bmFtaWNBdHRyaWJ1dGVWYWx1ZVBhcnQobXVzdGFjaGUpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gVE9ETzogT25seSBhcHBlbmQgY2hpbGQgd2hlbiB0aGUgdG9rZW5pemVyIHN0YXRlIG1ha2VzXG4gICAgICAvLyBzZW5zZSB0byBkbyBzbywgb3RoZXJ3aXNlIHRocm93IGFuIGVycm9yLlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXBwZW5kQ2hpbGQodGhpcy5jdXJyZW50RWxlbWVudCgpLCBtdXN0YWNoZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG11c3RhY2hlO1xuICB9XG5cbiAgYXBwZW5kRHluYW1pY0F0dHJpYnV0ZVZhbHVlUGFydChwYXJ0OiBBU1R2MS5NdXN0YWNoZVN0YXRlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuZmluYWxpemVUZXh0UGFydCgpO1xuICAgIGxldCBhdHRyID0gdGhpcy5jdXJyZW50QXR0cjtcbiAgICBhdHRyLmlzRHluYW1pYyA9IHRydWU7XG4gICAgYXR0ci5wYXJ0cy5wdXNoKHBhcnQpO1xuICB9XG5cbiAgZmluYWxpemVUZXh0UGFydCgpOiB2b2lkIHtcbiAgICBsZXQgYXR0ciA9IHRoaXMuY3VycmVudEF0dHI7XG4gICAgbGV0IHRleHQgPSBhdHRyLmN1cnJlbnRQYXJ0O1xuICAgIGlmICh0ZXh0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmN1cnJlbnRBdHRyLnBhcnRzLnB1c2godGV4dCk7XG4gICAgICB0aGlzLnN0YXJ0VGV4dFBhcnQoKTtcbiAgICB9XG4gIH1cblxuICBzdGFydFRleHRQYXJ0KCk6IHZvaWQge1xuICAgIHRoaXMuY3VycmVudEF0dHIuY3VycmVudFBhcnQgPSBudWxsO1xuICB9XG5cbiAgQ29udGVudFN0YXRlbWVudChjb250ZW50OiBIQlMuQ29udGVudFN0YXRlbWVudCk6IHZvaWQge1xuICAgIHVwZGF0ZVRva2VuaXplckxvY2F0aW9uKHRoaXMudG9rZW5pemVyLCBjb250ZW50KTtcblxuICAgIHRoaXMudG9rZW5pemVyLnRva2VuaXplUGFydChjb250ZW50LnZhbHVlKTtcbiAgICB0aGlzLnRva2VuaXplci5mbHVzaERhdGEoKTtcbiAgfVxuXG4gIENvbW1lbnRTdGF0ZW1lbnQocmF3Q29tbWVudDogSEJTLkNvbW1lbnRTdGF0ZW1lbnQpOiBPcHRpb248QVNUdjEuTXVzdGFjaGVDb21tZW50U3RhdGVtZW50PiB7XG4gICAgbGV0IHsgdG9rZW5pemVyIH0gPSB0aGlzO1xuXG4gICAgaWYgKHRva2VuaXplci5zdGF0ZSA9PT0gVG9rZW5pemVyU3RhdGUuY29tbWVudCkge1xuICAgICAgdGhpcy5hcHBlbmRUb0NvbW1lbnREYXRhKHRoaXMuc291cmNlRm9yTm9kZShyYXdDb21tZW50KSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgeyB2YWx1ZSwgbG9jIH0gPSByYXdDb21tZW50O1xuICAgIGxldCBjb21tZW50ID0gYi5tdXN0YWNoZUNvbW1lbnQodmFsdWUsIHRoaXMuc291cmNlLnNwYW5Gb3IobG9jKSk7XG5cbiAgICBzd2l0Y2ggKHRva2VuaXplci5zdGF0ZSkge1xuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lOlxuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5hZnRlckF0dHJpYnV0ZU5hbWU6XG4gICAgICAgIHRoaXMuY3VycmVudFN0YXJ0VGFnLmNvbW1lbnRzLnB1c2goY29tbWVudCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmJlZm9yZURhdGE6XG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmRhdGE6XG4gICAgICAgIGFwcGVuZENoaWxkKHRoaXMuY3VycmVudEVsZW1lbnQoKSwgY29tbWVudCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgICAgIGBVc2luZyBhIEhhbmRsZWJhcnMgY29tbWVudCB3aGVuIGluIHRoZSBcXGAke3Rva2VuaXplclsnc3RhdGUnXX1cXGAgc3RhdGUgaXMgbm90IHN1cHBvcnRlZGAsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihyYXdDb21tZW50LmxvYylcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29tbWVudDtcbiAgfVxuXG4gIFBhcnRpYWxTdGF0ZW1lbnQocGFydGlhbDogSEJTLlBhcnRpYWxTdGF0ZW1lbnQpOiBuZXZlciB7XG4gICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgIGBIYW5kbGViYXJzIHBhcnRpYWxzIGFyZSBub3Qgc3VwcG9ydGVkYCxcbiAgICAgIHRoaXMuc291cmNlLnNwYW5Gb3IocGFydGlhbC5sb2MpXG4gICAgKTtcbiAgfVxuXG4gIFBhcnRpYWxCbG9ja1N0YXRlbWVudChwYXJ0aWFsQmxvY2s6IEhCUy5QYXJ0aWFsQmxvY2tTdGF0ZW1lbnQpOiBuZXZlciB7XG4gICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgIGBIYW5kbGViYXJzIHBhcnRpYWwgYmxvY2tzIGFyZSBub3Qgc3VwcG9ydGVkYCxcbiAgICAgIHRoaXMuc291cmNlLnNwYW5Gb3IocGFydGlhbEJsb2NrLmxvYylcbiAgICApO1xuICB9XG5cbiAgRGVjb3JhdG9yKGRlY29yYXRvcjogSEJTLkRlY29yYXRvcik6IG5ldmVyIHtcbiAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgYEhhbmRsZWJhcnMgZGVjb3JhdG9ycyBhcmUgbm90IHN1cHBvcnRlZGAsXG4gICAgICB0aGlzLnNvdXJjZS5zcGFuRm9yKGRlY29yYXRvci5sb2MpXG4gICAgKTtcbiAgfVxuXG4gIERlY29yYXRvckJsb2NrKGRlY29yYXRvckJsb2NrOiBIQlMuRGVjb3JhdG9yQmxvY2spOiBuZXZlciB7XG4gICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgIGBIYW5kbGViYXJzIGRlY29yYXRvciBibG9ja3MgYXJlIG5vdCBzdXBwb3J0ZWRgLFxuICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihkZWNvcmF0b3JCbG9jay5sb2MpXG4gICAgKTtcbiAgfVxuXG4gIFN1YkV4cHJlc3Npb24oc2V4cHI6IEhCUy5TdWJFeHByZXNzaW9uKTogQVNUdjEuU3ViRXhwcmVzc2lvbiB7XG4gICAgbGV0IHsgcGF0aCwgcGFyYW1zLCBoYXNoIH0gPSBhY2NlcHRDYWxsTm9kZXModGhpcywgc2V4cHIpO1xuICAgIHJldHVybiBiLnNleHByKHsgcGF0aCwgcGFyYW1zLCBoYXNoLCBsb2M6IHRoaXMuc291cmNlLnNwYW5Gb3Ioc2V4cHIubG9jKSB9KTtcbiAgfVxuXG4gIFBhdGhFeHByZXNzaW9uKHBhdGg6IEhCUy5QYXRoRXhwcmVzc2lvbik6IEFTVHYxLlBhdGhFeHByZXNzaW9uIHtcbiAgICBsZXQgeyBvcmlnaW5hbCB9ID0gcGF0aDtcbiAgICBsZXQgcGFydHM6IHN0cmluZ1tdO1xuXG4gICAgaWYgKG9yaWdpbmFsLmluZGV4T2YoJy8nKSAhPT0gLTEpIHtcbiAgICAgIGlmIChvcmlnaW5hbC5zbGljZSgwLCAyKSA9PT0gJy4vJykge1xuICAgICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgICAgIGBVc2luZyBcIi4vXCIgaXMgbm90IHN1cHBvcnRlZCBpbiBHbGltbWVyIGFuZCB1bm5lY2Vzc2FyeWAsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcmlnaW5hbC5zbGljZSgwLCAzKSA9PT0gJy4uLycpIHtcbiAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICBgQ2hhbmdpbmcgY29udGV4dCB1c2luZyBcIi4uL1wiIGlzIG5vdCBzdXBwb3J0ZWQgaW4gR2xpbW1lcmAsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcmlnaW5hbC5pbmRleE9mKCcuJykgIT09IC0xKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYE1peGluZyAnLicgYW5kICcvJyBpbiBwYXRocyBpcyBub3Qgc3VwcG9ydGVkIGluIEdsaW1tZXI7IHVzZSBvbmx5ICcuJyB0byBzZXBhcmF0ZSBwcm9wZXJ0eSBwYXRoc2AsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHBhcnRzID0gW3BhdGgucGFydHMuam9pbignLycpXTtcbiAgICB9IGVsc2UgaWYgKG9yaWdpbmFsID09PSAnLicpIHtcbiAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgIGAnLicgaXMgbm90IGEgc3VwcG9ydGVkIHBhdGggaW4gR2xpbW1lcjsgY2hlY2sgZm9yIGEgcGF0aCB3aXRoIGEgdHJhaWxpbmcgJy4nYCxcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcnRzID0gcGF0aC5wYXJ0cztcbiAgICB9XG5cbiAgICBsZXQgdGhpc0hlYWQgPSBmYWxzZTtcblxuICAgIC8vIFRoaXMgaXMgdG8gZml4IGEgYnVnIGluIHRoZSBIYW5kbGViYXJzIEFTVCB3aGVyZSB0aGUgcGF0aCBleHByZXNzaW9ucyBpblxuICAgIC8vIGB7e3RoaXMuZm9vfX1gIChhbmQgc2ltaWxhcmx5IGB7e2Zvby1iYXIgdGhpcy5mb28gbmFtZWQ9dGhpcy5mb299fWAgZXRjKVxuICAgIC8vIGFyZSBzaW1wbHkgdHVybmVkIGludG8gYHt7Zm9vfX1gLiBUaGUgZml4IGlzIHRvIHB1c2ggaXQgYmFjayBvbnRvIHRoZVxuICAgIC8vIHBhcnRzIGFycmF5IGFuZCBsZXQgdGhlIHJ1bnRpbWUgc2VlIHRoZSBkaWZmZXJlbmNlLiBIb3dldmVyLCB3ZSBjYW5ub3RcbiAgICAvLyBzaW1wbHkgdXNlIHRoZSBzdHJpbmcgYHRoaXNgIGFzIGl0IG1lYW5zIGxpdGVyYWxseSB0aGUgcHJvcGVydHkgY2FsbGVkXG4gICAgLy8gXCJ0aGlzXCIgaW4gdGhlIGN1cnJlbnQgY29udGV4dCAoaXQgY2FuIGJlIGV4cHJlc3NlZCBpbiB0aGUgc3ludGF4IGFzXG4gICAgLy8gYHt7W3RoaXNdfX1gLCB3aGVyZSB0aGUgc3F1YXJlIGJyYWNrZXQgYXJlIGdlbmVyYWxseSBmb3IgdGhpcyBraW5kIG9mXG4gICAgLy8gZXNjYXBpbmcg4oCTIHN1Y2ggYXMgYHt7Zm9vLltcImJhci5iYXpcIl19fWAgd291bGQgbWVhbiBsb29rdXAgYSBwcm9wZXJ0eVxuICAgIC8vIG5hbWVkIGxpdGVyYWxseSBcImJhci5iYXpcIiBvbiBgdGhpcy5mb29gKS4gQnkgY29udmVudGlvbiwgd2UgdXNlIGBudWxsYFxuICAgIC8vIGZvciB0aGlzIHB1cnBvc2UuXG4gICAgaWYgKG9yaWdpbmFsLm1hdGNoKC9edGhpcyhcXC4uKyk/JC8pKSB7XG4gICAgICB0aGlzSGVhZCA9IHRydWU7XG4gICAgfVxuXG4gICAgbGV0IHBhdGhIZWFkOiBBU1R2MS5QYXRoSGVhZDtcbiAgICBpZiAodGhpc0hlYWQpIHtcbiAgICAgIHBhdGhIZWFkID0ge1xuICAgICAgICB0eXBlOiAnVGhpc0hlYWQnLFxuICAgICAgICBsb2M6IHtcbiAgICAgICAgICBzdGFydDogcGF0aC5sb2Muc3RhcnQsXG4gICAgICAgICAgZW5kOiB7IGxpbmU6IHBhdGgubG9jLnN0YXJ0LmxpbmUsIGNvbHVtbjogcGF0aC5sb2Muc3RhcnQuY29sdW1uICsgNCB9LFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHBhdGguZGF0YSkge1xuICAgICAgbGV0IGhlYWQgPSBwYXJ0cy5zaGlmdCgpO1xuXG4gICAgICBpZiAoaGVhZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYEF0dGVtcHRlZCB0byBwYXJzZSBhIHBhdGggZXhwcmVzc2lvbiwgYnV0IGl0IHdhcyBub3QgdmFsaWQuIFBhdGhzIGJlZ2lubmluZyB3aXRoIEAgbXVzdCBzdGFydCB3aXRoIGEtei5gLFxuICAgICAgICAgIHRoaXMuc291cmNlLnNwYW5Gb3IocGF0aC5sb2MpXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHBhdGhIZWFkID0ge1xuICAgICAgICB0eXBlOiAnQXRIZWFkJyxcbiAgICAgICAgbmFtZTogYEAke2hlYWR9YCxcbiAgICAgICAgbG9jOiB7XG4gICAgICAgICAgc3RhcnQ6IHBhdGgubG9jLnN0YXJ0LFxuICAgICAgICAgIGVuZDogeyBsaW5lOiBwYXRoLmxvYy5zdGFydC5saW5lLCBjb2x1bW46IHBhdGgubG9jLnN0YXJ0LmNvbHVtbiArIGhlYWQubGVuZ3RoICsgMSB9LFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGhlYWQgPSBwYXJ0cy5zaGlmdCgpO1xuXG4gICAgICBpZiAoaGVhZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYEF0dGVtcHRlZCB0byBwYXJzZSBhIHBhdGggZXhwcmVzc2lvbiwgYnV0IGl0IHdhcyBub3QgdmFsaWQuIFBhdGhzIG11c3Qgc3RhcnQgd2l0aCBhLXogb3IgQS1aLmAsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcGF0aEhlYWQgPSB7XG4gICAgICAgIHR5cGU6ICdWYXJIZWFkJyxcbiAgICAgICAgbmFtZTogaGVhZCxcbiAgICAgICAgbG9jOiB7XG4gICAgICAgICAgc3RhcnQ6IHBhdGgubG9jLnN0YXJ0LFxuICAgICAgICAgIGVuZDogeyBsaW5lOiBwYXRoLmxvYy5zdGFydC5saW5lLCBjb2x1bW46IHBhdGgubG9jLnN0YXJ0LmNvbHVtbiArIGhlYWQubGVuZ3RoIH0sXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUGF0aEV4cHJlc3Npb25JbXBsVjEocGF0aC5vcmlnaW5hbCwgcGF0aEhlYWQsIHBhcnRzLCB0aGlzLnNvdXJjZS5zcGFuRm9yKHBhdGgubG9jKSk7XG4gIH1cblxuICBIYXNoKGhhc2g6IEhCUy5IYXNoKTogQVNUdjEuSGFzaCB7XG4gICAgbGV0IHBhaXJzOiBBU1R2MS5IYXNoUGFpcltdID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGhhc2gucGFpcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBwYWlyID0gaGFzaC5wYWlyc1tpXTtcbiAgICAgIHBhaXJzLnB1c2goXG4gICAgICAgIGIucGFpcih7XG4gICAgICAgICAga2V5OiBwYWlyLmtleSxcbiAgICAgICAgICB2YWx1ZTogdGhpcy5hY2NlcHROb2RlKHBhaXIudmFsdWUpLFxuICAgICAgICAgIGxvYzogdGhpcy5zb3VyY2Uuc3BhbkZvcihwYWlyLmxvYyksXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBiLmhhc2gocGFpcnMsIHRoaXMuc291cmNlLnNwYW5Gb3IoaGFzaC5sb2MpKTtcbiAgfVxuXG4gIFN0cmluZ0xpdGVyYWwoc3RyaW5nOiBIQlMuU3RyaW5nTGl0ZXJhbCk6IEFTVHYxLlN0cmluZ0xpdGVyYWwge1xuICAgIHJldHVybiBiLmxpdGVyYWwoeyB0eXBlOiAnU3RyaW5nTGl0ZXJhbCcsIHZhbHVlOiBzdHJpbmcudmFsdWUsIGxvYzogc3RyaW5nLmxvYyB9KTtcbiAgfVxuXG4gIEJvb2xlYW5MaXRlcmFsKGJvb2xlYW46IEhCUy5Cb29sZWFuTGl0ZXJhbCk6IEFTVHYxLkJvb2xlYW5MaXRlcmFsIHtcbiAgICByZXR1cm4gYi5saXRlcmFsKHsgdHlwZTogJ0Jvb2xlYW5MaXRlcmFsJywgdmFsdWU6IGJvb2xlYW4udmFsdWUsIGxvYzogYm9vbGVhbi5sb2MgfSk7XG4gIH1cblxuICBOdW1iZXJMaXRlcmFsKG51bWJlcjogSEJTLk51bWJlckxpdGVyYWwpOiBBU1R2MS5OdW1iZXJMaXRlcmFsIHtcbiAgICByZXR1cm4gYi5saXRlcmFsKHsgdHlwZTogJ051bWJlckxpdGVyYWwnLCB2YWx1ZTogbnVtYmVyLnZhbHVlLCBsb2M6IG51bWJlci5sb2MgfSk7XG4gIH1cblxuICBVbmRlZmluZWRMaXRlcmFsKHVuZGVmOiBIQlMuVW5kZWZpbmVkTGl0ZXJhbCk6IEFTVHYxLlVuZGVmaW5lZExpdGVyYWwge1xuICAgIHJldHVybiBiLmxpdGVyYWwoeyB0eXBlOiAnVW5kZWZpbmVkTGl0ZXJhbCcsIHZhbHVlOiB1bmRlZmluZWQsIGxvYzogdW5kZWYubG9jIH0pO1xuICB9XG5cbiAgTnVsbExpdGVyYWwobnVsOiBIQlMuTnVsbExpdGVyYWwpOiBBU1R2MS5OdWxsTGl0ZXJhbCB7XG4gICAgcmV0dXJuIGIubGl0ZXJhbCh7IHR5cGU6ICdOdWxsTGl0ZXJhbCcsIHZhbHVlOiBudWxsLCBsb2M6IG51bC5sb2MgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlUmlnaHRTdHJpcHBlZE9mZnNldHMob3JpZ2luYWw6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuICBpZiAodmFsdWUgPT09ICcnKSB7XG4gICAgLy8gaWYgaXQgaXMgZW1wdHksIGp1c3QgcmV0dXJuIHRoZSBjb3VudCBvZiBuZXdsaW5lc1xuICAgIC8vIGluIG9yaWdpbmFsXG4gICAgcmV0dXJuIHtcbiAgICAgIGxpbmVzOiBvcmlnaW5hbC5zcGxpdCgnXFxuJykubGVuZ3RoIC0gMSxcbiAgICAgIGNvbHVtbnM6IDAsXG4gICAgfTtcbiAgfVxuXG4gIC8vIG90aGVyd2lzZSwgcmV0dXJuIHRoZSBudW1iZXIgb2YgbmV3bGluZXMgcHJpb3IgdG9cbiAgLy8gYHZhbHVlYFxuICBsZXQgZGlmZmVyZW5jZSA9IG9yaWdpbmFsLnNwbGl0KHZhbHVlKVswXTtcbiAgbGV0IGxpbmVzID0gZGlmZmVyZW5jZS5zcGxpdCgvXFxuLyk7XG4gIGxldCBsaW5lQ291bnQgPSBsaW5lcy5sZW5ndGggLSAxO1xuXG4gIHJldHVybiB7XG4gICAgbGluZXM6IGxpbmVDb3VudCxcbiAgICBjb2x1bW5zOiBsaW5lc1tsaW5lQ291bnRdLmxlbmd0aCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlVG9rZW5pemVyTG9jYXRpb24odG9rZW5pemVyOiBQYXJzZXJbJ3Rva2VuaXplciddLCBjb250ZW50OiBIQlMuQ29udGVudFN0YXRlbWVudCkge1xuICBsZXQgbGluZSA9IGNvbnRlbnQubG9jLnN0YXJ0LmxpbmU7XG4gIGxldCBjb2x1bW4gPSBjb250ZW50LmxvYy5zdGFydC5jb2x1bW47XG5cbiAgbGV0IG9mZnNldHMgPSBjYWxjdWxhdGVSaWdodFN0cmlwcGVkT2Zmc2V0cyhcbiAgICBjb250ZW50Lm9yaWdpbmFsIGFzIFJlY2FzdDxIQlMuU3RyaXBGbGFncywgc3RyaW5nPixcbiAgICBjb250ZW50LnZhbHVlXG4gICk7XG5cbiAgbGluZSA9IGxpbmUgKyBvZmZzZXRzLmxpbmVzO1xuICBpZiAob2Zmc2V0cy5saW5lcykge1xuICAgIGNvbHVtbiA9IG9mZnNldHMuY29sdW1ucztcbiAgfSBlbHNlIHtcbiAgICBjb2x1bW4gPSBjb2x1bW4gKyBvZmZzZXRzLmNvbHVtbnM7XG4gIH1cblxuICB0b2tlbml6ZXIubGluZSA9IGxpbmU7XG4gIHRva2VuaXplci5jb2x1bW4gPSBjb2x1bW47XG59XG5cbmZ1bmN0aW9uIGFjY2VwdENhbGxOb2RlcyhcbiAgY29tcGlsZXI6IEhhbmRsZWJhcnNOb2RlVmlzaXRvcnMsXG4gIG5vZGU6IHtcbiAgICBwYXRoOlxuICAgICAgfCBIQlMuUGF0aEV4cHJlc3Npb25cbiAgICAgIHwgSEJTLlN1YkV4cHJlc3Npb25cbiAgICAgIHwgSEJTLlN0cmluZ0xpdGVyYWxcbiAgICAgIHwgSEJTLlVuZGVmaW5lZExpdGVyYWxcbiAgICAgIHwgSEJTLk51bGxMaXRlcmFsXG4gICAgICB8IEhCUy5OdW1iZXJMaXRlcmFsXG4gICAgICB8IEhCUy5Cb29sZWFuTGl0ZXJhbDtcbiAgICBwYXJhbXM6IEhCUy5FeHByZXNzaW9uW107XG4gICAgaGFzaDogSEJTLkhhc2g7XG4gIH1cbik6IHtcbiAgcGF0aDogQVNUdjEuUGF0aEV4cHJlc3Npb24gfCBBU1R2MS5TdWJFeHByZXNzaW9uO1xuICBwYXJhbXM6IEFTVHYxLkV4cHJlc3Npb25bXTtcbiAgaGFzaDogQVNUdjEuSGFzaDtcbn0ge1xuICBpZiAobm9kZS5wYXRoLnR5cGUuZW5kc1dpdGgoJ0xpdGVyYWwnKSkge1xuICAgIGNvbnN0IHBhdGggPSAobm9kZS5wYXRoIGFzIHVua25vd24pIGFzXG4gICAgICB8IEhCUy5TdHJpbmdMaXRlcmFsXG4gICAgICB8IEhCUy5VbmRlZmluZWRMaXRlcmFsXG4gICAgICB8IEhCUy5OdWxsTGl0ZXJhbFxuICAgICAgfCBIQlMuTnVtYmVyTGl0ZXJhbFxuICAgICAgfCBIQlMuQm9vbGVhbkxpdGVyYWw7XG5cbiAgICBsZXQgdmFsdWUgPSAnJztcbiAgICBpZiAocGF0aC50eXBlID09PSAnQm9vbGVhbkxpdGVyYWwnKSB7XG4gICAgICB2YWx1ZSA9IHBhdGgub3JpZ2luYWwudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKHBhdGgudHlwZSA9PT0gJ1N0cmluZ0xpdGVyYWwnKSB7XG4gICAgICB2YWx1ZSA9IGBcIiR7cGF0aC5vcmlnaW5hbH1cImA7XG4gICAgfSBlbHNlIGlmIChwYXRoLnR5cGUgPT09ICdOdWxsTGl0ZXJhbCcpIHtcbiAgICAgIHZhbHVlID0gJ251bGwnO1xuICAgIH0gZWxzZSBpZiAocGF0aC50eXBlID09PSAnTnVtYmVyTGl0ZXJhbCcpIHtcbiAgICAgIHZhbHVlID0gcGF0aC52YWx1ZS50b1N0cmluZygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9ICd1bmRlZmluZWQnO1xuICAgIH1cbiAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgYCR7cGF0aC50eXBlfSBcIiR7XG4gICAgICAgIHBhdGgudHlwZSA9PT0gJ1N0cmluZ0xpdGVyYWwnID8gcGF0aC5vcmlnaW5hbCA6IHZhbHVlXG4gICAgICB9XCIgY2Fubm90IGJlIGNhbGxlZCBhcyBhIHN1Yi1leHByZXNzaW9uLCByZXBsYWNlICgke3ZhbHVlfSkgd2l0aCAke3ZhbHVlfWAsXG4gICAgICBjb21waWxlci5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICApO1xuICB9XG5cbiAgbGV0IHBhdGggPVxuICAgIG5vZGUucGF0aC50eXBlID09PSAnUGF0aEV4cHJlc3Npb24nXG4gICAgICA/IGNvbXBpbGVyLlBhdGhFeHByZXNzaW9uKG5vZGUucGF0aClcbiAgICAgIDogY29tcGlsZXIuU3ViRXhwcmVzc2lvbigobm9kZS5wYXRoIGFzIHVua25vd24pIGFzIEhCUy5TdWJFeHByZXNzaW9uKTtcbiAgbGV0IHBhcmFtcyA9IG5vZGUucGFyYW1zID8gbm9kZS5wYXJhbXMubWFwKChlKSA9PiBjb21waWxlci5hY2NlcHROb2RlPEFTVHYxLkV4cHJlc3Npb24+KGUpKSA6IFtdO1xuXG4gIC8vIGlmIHRoZXJlIGlzIG5vIGhhc2gsIHBvc2l0aW9uIGl0IGFzIGEgY29sbGFwc2VkIG5vZGUgaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIGxhc3QgcGFyYW0gKG9yIHRoZVxuICAvLyBwYXRoLCBpZiB0aGVyZSBhcmUgYWxzbyBubyBwYXJhbXMpXG4gIGxldCBlbmQgPSBwYXJhbXMubGVuZ3RoID4gMCA/IHBhcmFtc1twYXJhbXMubGVuZ3RoIC0gMV0ubG9jIDogcGF0aC5sb2M7XG5cbiAgbGV0IGhhc2ggPSBub2RlLmhhc2hcbiAgICA/IGNvbXBpbGVyLkhhc2gobm9kZS5oYXNoKVxuICAgIDogKHtcbiAgICAgICAgdHlwZTogJ0hhc2gnLFxuICAgICAgICBwYWlyczogW10gYXMgQVNUdjEuSGFzaFBhaXJbXSxcbiAgICAgICAgbG9jOiBjb21waWxlci5zb3VyY2Uuc3BhbkZvcihlbmQpLmNvbGxhcHNlKCdlbmQnKSxcbiAgICAgIH0gYXMgY29uc3QpO1xuXG4gIHJldHVybiB7IHBhdGgsIHBhcmFtcywgaGFzaCB9O1xufVxuXG5mdW5jdGlvbiBhZGRFbGVtZW50TW9kaWZpZXIoXG4gIGVsZW1lbnQ6IFBhcnNlck5vZGVCdWlsZGVyPFRhZzwnU3RhcnRUYWcnPj4sXG4gIG11c3RhY2hlOiBBU1R2MS5NdXN0YWNoZVN0YXRlbWVudFxuKSB7XG4gIGxldCB7IHBhdGgsIHBhcmFtcywgaGFzaCwgbG9jIH0gPSBtdXN0YWNoZTtcblxuICBpZiAoaXNIQlNMaXRlcmFsKHBhdGgpKSB7XG4gICAgbGV0IG1vZGlmaWVyID0gYHt7JHtwcmludExpdGVyYWwocGF0aCl9fX1gO1xuICAgIGxldCB0YWcgPSBgPCR7ZWxlbWVudC5uYW1lfSAuLi4gJHttb2RpZmllcn0gLi4uYDtcblxuICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoYEluICR7dGFnfSwgJHttb2RpZmllcn0gaXMgbm90IGEgdmFsaWQgbW9kaWZpZXJgLCBtdXN0YWNoZS5sb2MpO1xuICB9XG5cbiAgbGV0IG1vZGlmaWVyID0gYi5lbGVtZW50TW9kaWZpZXIoeyBwYXRoLCBwYXJhbXMsIGhhc2gsIGxvYyB9KTtcbiAgZWxlbWVudC5tb2RpZmllcnMucHVzaChtb2RpZmllcik7XG59XG4iXSwic291cmNlUm9vdCI6IiJ9