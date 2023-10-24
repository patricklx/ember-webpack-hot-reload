define('@glimmer/syntax', ['exports', '@glimmer/env', '@glimmer/util', '@handlebars/parser', 'simple-html-tokenizer'], function (exports, env, util, parser, simpleHtmlTokenizer) { 'use strict';

  var UNKNOWN_POSITION = Object.freeze({
    line: 1,
    column: 0
  });
  var SYNTHETIC_LOCATION = Object.freeze({
    source: '(synthetic)',
    start: UNKNOWN_POSITION,
    end: UNKNOWN_POSITION
  });
  var TEMPORARY_LOCATION = Object.freeze({
    source: '(temporary)',
    start: UNKNOWN_POSITION,
    end: UNKNOWN_POSITION
  });
  var NON_EXISTENT_LOCATION = Object.freeze({
    source: '(nonexistent)',
    start: UNKNOWN_POSITION,
    end: UNKNOWN_POSITION
  });
  var BROKEN_LOCATION = Object.freeze({
    source: '(broken)',
    start: UNKNOWN_POSITION,
    end: UNKNOWN_POSITION
  });

  var SourceSlice = /*#__PURE__*/function () {
    function SourceSlice(options) {
      this.loc = options.loc;
      this.chars = options.chars;
    }

    SourceSlice.synthetic = function synthetic(chars) {
      var offsets = SourceSpan.synthetic(chars);
      return new SourceSlice({
        loc: offsets,
        chars: chars
      });
    };

    SourceSlice.load = function load(source, slice) {
      return new SourceSlice({
        loc: SourceSpan.load(source, slice[1]),
        chars: slice[0]
      });
    };

    var _proto = SourceSlice.prototype;

    _proto.getString = function getString() {
      return this.chars;
    };

    _proto.serialize = function serialize() {
      return [this.chars, this.loc.serialize()];
    };

    return SourceSlice;
  }();

  function _createForOfIteratorHelperLoose(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; return function () { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } it = o[Symbol.iterator](); return it.next.bind(it); }

  function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

  function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
  /**
   * This file implements the DSL used by span and offset in places where they need to exhaustively
   * consider all combinations of states (Handlebars offsets, character offsets and invisible/broken
   * offsets).
   *
   * It's probably overkill, but it makes the code that uses it clear. It could be refactored or
   * removed.
   */

  var MatchAny = 'MATCH_ANY';
  var IsInvisible = 'IS_INVISIBLE';

  var WhenList = /*#__PURE__*/function () {
    function WhenList(whens) {
      this._whens = whens;
    }

    var _proto = WhenList.prototype;

    _proto.first = function first(kind) {
      for (var _iterator = _createForOfIteratorHelperLoose(this._whens), _step; !(_step = _iterator()).done;) {
        var when = _step.value;
        var value = when.match(kind);

        if (util.isPresent(value)) {
          return value[0];
        }
      }

      return null;
    };

    return WhenList;
  }();

  var When = /*#__PURE__*/function () {
    function When() {
      this._map = new Map();
    }

    var _proto2 = When.prototype;

    _proto2.get = function get(pattern, or) {
      var value = this._map.get(pattern);

      if (value) {
        return value;
      }

      value = or();

      this._map.set(pattern, value);

      return value;
    };

    _proto2.add = function add(pattern, out) {
      this._map.set(pattern, out);
    };

    _proto2.match = function match(kind) {
      var pattern = patternFor(kind);
      var out = [];

      var exact = this._map.get(pattern);

      var fallback = this._map.get(MatchAny);

      if (exact) {
        out.push(exact);
      }

      if (fallback) {
        out.push(fallback);
      }

      return out;
    };

    return When;
  }();

  function match(callback) {
    return callback(new Matcher()).check();
  }

  var Matcher = /*#__PURE__*/function () {
    function Matcher() {
      this._whens = new When();
    }
    /**
     * You didn't exhaustively match all possibilities.
     */


    var _proto3 = Matcher.prototype;

    _proto3.check = function check() {
      var _this = this;

      return function (left, right) {
        return _this.matchFor(left.kind, right.kind)(left, right);
      };
    };

    _proto3.matchFor = function matchFor(left, right) {
      var nesteds = this._whens.match(left);
      var callback = new WhenList(nesteds).first(right);
      return callback;
    };

    _proto3.when = function when(left, right, // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback) {
      this._whens.get(left, function () {
        return new When();
      }).add(right, callback);

      return this;
    };

    return Matcher;
  }();

  function patternFor(kind) {
    switch (kind) {
      case "Broken"
      /* Broken */
      :
      case "InternalsSynthetic"
      /* InternalsSynthetic */
      :
      case "NonExistent"
      /* NonExistent */
      :
        return IsInvisible;

      default:
        return kind;
    }
  }

  function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }
  /**
   * Used to indicate that an attempt to convert a `SourcePosition` to a character offset failed. It
   * is separate from `null` so that `null` can be used to indicate that the computation wasn't yet
   * attempted (and therefore to cache the failure)
   */

  var BROKEN = 'BROKEN';
  /**
   * A `SourceOffset` represents a single position in the source.
   *
   * There are three kinds of backing data for `SourceOffset` objects:
   *
   * - `CharPosition`, which contains a character offset into the raw source string
   * - `HbsPosition`, which contains a `SourcePosition` from the Handlebars AST, which can be
   *   converted to a `CharPosition` on demand.
   * - `InvisiblePosition`, which represents a position not in source (@see {InvisiblePosition})
   */

  var SourceOffset = /*#__PURE__*/function () {
    function SourceOffset(data) {
      this.data = data;
    }
    /**
     * Create a `SourceOffset` from a Handlebars `SourcePosition`. It's stored as-is, and converted
     * into a character offset on demand, which avoids unnecessarily computing the offset of every
     * `SourceLocation`, but also means that broken `SourcePosition`s are not always detected.
     */


    SourceOffset.forHbsPos = function forHbsPos(source, pos) {
      return new HbsPosition(source, pos, null).wrap();
    }
    /**
     * Create a `SourceOffset` that corresponds to a broken `SourcePosition`. This means that the
     * calling code determined (or knows) that the `SourceLocation` doesn't correspond correctly to
     * any part of the source.
     */
    ;

    SourceOffset.broken = function broken(pos) {
      if (pos === void 0) {
        pos = UNKNOWN_POSITION;
      }

      return new InvisiblePosition("Broken"
      /* Broken */
      , pos).wrap();
    }
    /**
     * Get the character offset for this `SourceOffset`, if possible.
     */
    ;

    var _proto = SourceOffset.prototype;

    /**
     * Compare this offset with another one.
     *
     * If both offsets are `HbsPosition`s, they're equivalent as long as their lines and columns are
     * the same. This avoids computing offsets unnecessarily.
     *
     * Otherwise, two `SourceOffset`s are equivalent if their successfully computed character offsets
     * are the same.
     */
    _proto.eql = function eql(right) {
      return _eql(this.data, right.data);
    }
    /**
     * Create a span that starts from this source offset and ends with another source offset. Avoid
     * computing character offsets if both `SourceOffset`s are still lazy.
     */
    ;

    _proto.until = function until(other) {
      return span(this.data, other.data);
    }
    /**
     * Create a `SourceOffset` by moving the character position represented by this source offset
     * forward or backward (if `by` is negative), if possible.
     *
     * If this `SourceOffset` can't compute a valid character offset, `move` returns a broken offset.
     *
     * If the resulting character offset is less than 0 or greater than the size of the source, `move`
     * returns a broken offset.
     */
    ;

    _proto.move = function move(by) {
      var charPos = this.data.toCharPos();

      if (charPos === null) {
        return SourceOffset.broken();
      } else {
        var result = charPos.offset + by;

        if (charPos.source.check(result)) {
          return new CharPosition(charPos.source, result).wrap();
        } else {
          return SourceOffset.broken();
        }
      }
    }
    /**
     * Create a new `SourceSpan` that represents a collapsed range at this source offset. Avoid
     * computing the character offset if it has not already been computed.
     */
    ;

    _proto.collapsed = function collapsed() {
      return span(this.data, this.data);
    }
    /**
     * Convert this `SourceOffset` into a Handlebars {@see SourcePosition} for compatibility with
     * existing plugins.
     */
    ;

    _proto.toJSON = function toJSON() {
      return this.data.toJSON();
    };

    _createClass(SourceOffset, [{
      key: "offset",
      get: function get() {
        var charPos = this.data.toCharPos();
        return charPos === null ? null : charPos.offset;
      }
    }]);

    return SourceOffset;
  }();
  var CharPosition = /*#__PURE__*/function () {
    function CharPosition(source, charPos) {
      this.source = source;
      this.charPos = charPos;
      this.kind = "CharPosition"
      /* CharPosition */
      ;
      /** Computed from char offset */

      this._locPos = null;
    }
    /**
     * This is already a `CharPosition`.
     *
     * {@see HbsPosition} for the alternative.
     *
     * @implements {PositionData}
     */


    var _proto2 = CharPosition.prototype;

    _proto2.toCharPos = function toCharPos() {
      return this;
    }
    /**
     * Produce a Handlebars {@see SourcePosition} for this `CharPosition`. If this `CharPosition` was
     * computed using {@see SourceOffset#move}, this will compute the `SourcePosition` for the offset.
     *
     * @implements {PositionData}
     */
    ;

    _proto2.toJSON = function toJSON() {
      var hbs = this.toHbsPos();
      return hbs === null ? UNKNOWN_POSITION : hbs.toJSON();
    };

    _proto2.wrap = function wrap() {
      return new SourceOffset(this);
    }
    /**
     * A `CharPosition` always has an offset it can produce without any additional computation.
     */
    ;

    /**
     * Convert the current character offset to an `HbsPosition`, if it was not already computed. Once
     * a `CharPosition` has computed its `HbsPosition`, it will not need to do compute it again, and
     * the same `CharPosition` is retained when used as one of the ends of a `SourceSpan`, so
     * computing the `HbsPosition` should be a one-time operation.
     */
    _proto2.toHbsPos = function toHbsPos() {
      var locPos = this._locPos;

      if (locPos === null) {
        var hbsPos = this.source.hbsPosFor(this.charPos);

        if (hbsPos === null) {
          this._locPos = locPos = BROKEN;
        } else {
          this._locPos = locPos = new HbsPosition(this.source, hbsPos, this.charPos);
        }
      }

      return locPos === BROKEN ? null : locPos;
    };

    _createClass(CharPosition, [{
      key: "offset",
      get: function get() {
        return this.charPos;
      }
    }]);

    return CharPosition;
  }();
  var HbsPosition = /*#__PURE__*/function () {
    function HbsPosition(source, hbsPos, charPos) {
      if (charPos === void 0) {
        charPos = null;
      }

      this.source = source;
      this.hbsPos = hbsPos;
      this.kind = "HbsPosition"
      /* HbsPosition */
      ;
      this._charPos = charPos === null ? null : new CharPosition(source, charPos);
    }
    /**
     * Lazily compute the character offset from the {@see SourcePosition}. Once an `HbsPosition` has
     * computed its `CharPosition`, it will not need to do compute it again, and the same
     * `HbsPosition` is retained when used as one of the ends of a `SourceSpan`, so computing the
     * `CharPosition` should be a one-time operation.
     *
     * @implements {PositionData}
     */


    var _proto3 = HbsPosition.prototype;

    _proto3.toCharPos = function toCharPos() {
      var charPos = this._charPos;

      if (charPos === null) {
        var charPosNumber = this.source.charPosFor(this.hbsPos);

        if (charPosNumber === null) {
          this._charPos = charPos = BROKEN;
        } else {
          this._charPos = charPos = new CharPosition(this.source, charPosNumber);
        }
      }

      return charPos === BROKEN ? null : charPos;
    }
    /**
     * Return the {@see SourcePosition} that this `HbsPosition` was instantiated with. This operation
     * does not need to compute anything.
     *
     * @implements {PositionData}
     */
    ;

    _proto3.toJSON = function toJSON() {
      return this.hbsPos;
    };

    _proto3.wrap = function wrap() {
      return new SourceOffset(this);
    }
    /**
     * This is already an `HbsPosition`.
     *
     * {@see CharPosition} for the alternative.
     */
    ;

    _proto3.toHbsPos = function toHbsPos() {
      return this;
    };

    return HbsPosition;
  }();
  var InvisiblePosition = /*#__PURE__*/function () {
    function InvisiblePosition(kind, // whatever was provided, possibly broken
    pos) {
      this.kind = kind;
      this.pos = pos;
    }
    /**
     * A broken position cannot be turned into a {@see CharacterPosition}.
     */


    var _proto4 = InvisiblePosition.prototype;

    _proto4.toCharPos = function toCharPos() {
      return null;
    }
    /**
     * The serialization of an `InvisiblePosition is whatever Handlebars {@see SourcePosition} was
     * originally identified as broken, non-existent or synthetic.
     *
     * If an `InvisiblePosition` never had an source offset at all, this method returns
     * {@see UNKNOWN_POSITION} for compatibility.
     */
    ;

    _proto4.toJSON = function toJSON() {
      return this.pos;
    };

    _proto4.wrap = function wrap() {
      return new SourceOffset(this);
    };

    _createClass(InvisiblePosition, [{
      key: "offset",
      get: function get() {
        return null;
      }
    }]);

    return InvisiblePosition;
  }();
  /**
   * Compare two {@see AnyPosition} and determine whether they are equal.
   *
   * @see {SourceOffset#eql}
   */

  var _eql = match(function (m) {
    return m.when("HbsPosition"
    /* HbsPosition */
    , "HbsPosition"
    /* HbsPosition */
    , function (_ref, _ref2) {
      var left = _ref.hbsPos;
      var right = _ref2.hbsPos;
      return left.column === right.column && left.line === right.line;
    }).when("CharPosition"
    /* CharPosition */
    , "CharPosition"
    /* CharPosition */
    , function (_ref3, _ref4) {
      var left = _ref3.charPos;
      var right = _ref4.charPos;
      return left === right;
    }).when("CharPosition"
    /* CharPosition */
    , "HbsPosition"
    /* HbsPosition */
    , function (_ref5, right) {
      var left = _ref5.offset;

      var _a;

      return left === ((_a = right.toCharPos()) === null || _a === void 0 ? void 0 : _a.offset);
    }).when("HbsPosition"
    /* HbsPosition */
    , "CharPosition"
    /* CharPosition */
    , function (left, _ref6) {
      var right = _ref6.offset;

      var _a;

      return ((_a = left.toCharPos()) === null || _a === void 0 ? void 0 : _a.offset) === right;
    }).when(MatchAny, MatchAny, function () {
      return false;
    });
  });

  function _defineProperties$1(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$1(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$1(Constructor.prototype, protoProps); if (staticProps) _defineProperties$1(Constructor, staticProps); return Constructor; }
  /**
   * A `SourceSpan` object represents a span of characters inside of a template source.
   *
   * There are three kinds of `SourceSpan` objects:
   *
   * - `ConcreteSourceSpan`, which contains byte offsets
   * - `LazySourceSpan`, which contains `SourceLocation`s from the Handlebars AST, which can be
   *   converted to byte offsets on demand.
   * - `InvisibleSourceSpan`, which represent source strings that aren't present in the source,
   *   because:
   *     - they were created synthetically
   *     - their location is nonsensical (the span is broken)
   *     - they represent nothing in the source (this currently happens only when a bug in the
   *       upstream Handlebars parser fails to assign a location to empty blocks)
   *
   * At a high level, all `SourceSpan` objects provide:
   *
   * - byte offsets
   * - source in column and line format
   *
   * And you can do these operations on `SourceSpan`s:
   *
   * - collapse it to a `SourceSpan` representing its starting or ending position
   * - slice out some characters, optionally skipping some characters at the beginning or end
   * - create a new `SourceSpan` with a different starting or ending offset
   *
   * All SourceSpan objects implement `SourceLocation`, for compatibility. All SourceSpan
   * objects have a `toJSON` that emits `SourceLocation`, also for compatibility.
   *
   * For compatibility, subclasses of `AbstractSourceSpan` must implement `locDidUpdate`, which
   * happens when an AST plugin attempts to modify the `start` or `end` of a span directly.
   *
   * The goal is to avoid creating any problems for use-cases like AST Explorer.
   */

  var SourceSpan = /*#__PURE__*/function () {
    function SourceSpan(data) {
      this.data = data;
      this.isInvisible = data.kind !== "CharPosition"
      /* CharPosition */
      && data.kind !== "HbsPosition"
      /* HbsPosition */
      ;
    }

    SourceSpan.load = function load(source, serialized) {
      if (typeof serialized === 'number') {
        return SourceSpan.forCharPositions(source, serialized, serialized);
      } else if (typeof serialized === 'string') {
        return SourceSpan.synthetic(serialized);
      } else if (Array.isArray(serialized)) {
        return SourceSpan.forCharPositions(source, serialized[0], serialized[1]);
      } else if (serialized === "NonExistent"
      /* NonExistent */
      ) {
          return SourceSpan.NON_EXISTENT;
        } else if (serialized === "Broken"
      /* Broken */
      ) {
          return SourceSpan.broken(BROKEN_LOCATION);
        }

      util.assertNever(serialized);
    };

    SourceSpan.forHbsLoc = function forHbsLoc(source, loc) {
      var start = new HbsPosition(source, loc.start);
      var end = new HbsPosition(source, loc.end);
      return new HbsSpan(source, {
        start: start,
        end: end
      }, loc).wrap();
    };

    SourceSpan.forCharPositions = function forCharPositions(source, startPos, endPos) {
      var start = new CharPosition(source, startPos);
      var end = new CharPosition(source, endPos);
      return new CharPositionSpan(source, {
        start: start,
        end: end
      }).wrap();
    };

    SourceSpan.synthetic = function synthetic(chars) {
      return new InvisibleSpan("InternalsSynthetic"
      /* InternalsSynthetic */
      , NON_EXISTENT_LOCATION, chars).wrap();
    };

    SourceSpan.broken = function broken(pos) {
      if (pos === void 0) {
        pos = BROKEN_LOCATION;
      }

      return new InvisibleSpan("Broken"
      /* Broken */
      , pos).wrap();
    };

    var _proto = SourceSpan.prototype;

    _proto.getStart = function getStart() {
      return this.data.getStart().wrap();
    };

    _proto.getEnd = function getEnd() {
      return this.data.getEnd().wrap();
    };

    /**
     * Support converting ASTv1 nodes into a serialized format using JSON.stringify.
     */
    _proto.toJSON = function toJSON() {
      return this.loc;
    }
    /**
     * Create a new span with the current span's end and a new beginning.
     */
    ;

    _proto.withStart = function withStart(other) {
      return span(other.data, this.data.getEnd());
    }
    /**
     * Create a new span with the current span's beginning and a new ending.
     */
    ;

    _proto.withEnd = function withEnd(other) {
      return span(this.data.getStart(), other.data);
    };

    _proto.asString = function asString() {
      return this.data.asString();
    }
    /**
     * Convert this `SourceSpan` into a `SourceSlice`. In debug mode, this method optionally checks
     * that the byte offsets represented by this `SourceSpan` actually correspond to the expected
     * string.
     */
    ;

    _proto.toSlice = function toSlice(expected) {
      var chars = this.data.asString();

      if (env.DEBUG) {
        if (expected !== undefined && chars !== expected) {
          // eslint-disable-next-line no-console
          console.warn("unexpectedly found " + JSON.stringify(chars) + " when slicing source, but expected " + JSON.stringify(expected));
        }
      }

      return new SourceSlice({
        loc: this,
        chars: expected || chars
      });
    }
    /**
     * For compatibility with SourceLocation in AST plugins
     *
     * @deprecated use startPosition instead
     */
    ;

    _proto.collapse = function collapse(where) {
      switch (where) {
        case 'start':
          return this.getStart().collapsed();

        case 'end':
          return this.getEnd().collapsed();
      }
    };

    _proto.extend = function extend(other) {
      return span(this.data.getStart(), other.data.getEnd());
    };

    _proto.serialize = function serialize() {
      return this.data.serialize();
    };

    _proto.slice = function slice(_ref) {
      var _ref$skipStart = _ref.skipStart,
          skipStart = _ref$skipStart === void 0 ? 0 : _ref$skipStart,
          _ref$skipEnd = _ref.skipEnd,
          skipEnd = _ref$skipEnd === void 0 ? 0 : _ref$skipEnd;
      return span(this.getStart().move(skipStart).data, this.getEnd().move(-skipEnd).data);
    };

    _proto.sliceStartChars = function sliceStartChars(_ref2) {
      var _ref2$skipStart = _ref2.skipStart,
          skipStart = _ref2$skipStart === void 0 ? 0 : _ref2$skipStart,
          chars = _ref2.chars;
      return span(this.getStart().move(skipStart).data, this.getStart().move(skipStart + chars).data);
    };

    _proto.sliceEndChars = function sliceEndChars(_ref3) {
      var _ref3$skipEnd = _ref3.skipEnd,
          skipEnd = _ref3$skipEnd === void 0 ? 0 : _ref3$skipEnd,
          chars = _ref3.chars;
      return span(this.getEnd().move(skipEnd - chars).data, this.getStart().move(-skipEnd).data);
    };

    _createClass$1(SourceSpan, [{
      key: "loc",
      get: function get() {
        var span = this.data.toHbsSpan();
        return span === null ? BROKEN_LOCATION : span.toHbsLoc();
      }
    }, {
      key: "module",
      get: function get() {
        return this.data.getModule();
      }
      /**
       * Get the starting `SourcePosition` for this `SourceSpan`, lazily computing it if needed.
       */

    }, {
      key: "startPosition",
      get: function get() {
        return this.loc.start;
      }
      /**
       * Get the ending `SourcePosition` for this `SourceSpan`, lazily computing it if needed.
       */

    }, {
      key: "endPosition",
      get: function get() {
        return this.loc.end;
      }
    }, {
      key: "start",
      get: function get() {
        return this.loc.start;
      }
      /**
       * For compatibility with SourceLocation in AST plugins
       *
       * @deprecated use withStart instead
       */
      ,
      set: function set(position) {
        this.data.locDidUpdate({
          start: position
        });
      }
      /**
       * For compatibility with SourceLocation in AST plugins
       *
       * @deprecated use endPosition instead
       */

    }, {
      key: "end",
      get: function get() {
        return this.loc.end;
      }
      /**
       * For compatibility with SourceLocation in AST plugins
       *
       * @deprecated use withEnd instead
       */
      ,
      set: function set(position) {
        this.data.locDidUpdate({
          end: position
        });
      }
      /**
       * For compatibility with SourceLocation in AST plugins
       *
       * @deprecated use module instead
       */

    }, {
      key: "source",
      get: function get() {
        return this.module;
      }
    }], [{
      key: "NON_EXISTENT",
      get: function get() {
        return new InvisibleSpan("NonExistent"
        /* NonExistent */
        , NON_EXISTENT_LOCATION).wrap();
      }
    }]);

    return SourceSpan;
  }();

  var CharPositionSpan = /*#__PURE__*/function () {
    function CharPositionSpan(source, charPositions) {
      this.source = source;
      this.charPositions = charPositions;
      this.kind = "CharPosition"
      /* CharPosition */
      ;
      this._locPosSpan = null;
    }

    var _proto2 = CharPositionSpan.prototype;

    _proto2.wrap = function wrap() {
      return new SourceSpan(this);
    };

    _proto2.asString = function asString() {
      return this.source.slice(this.charPositions.start.charPos, this.charPositions.end.charPos);
    };

    _proto2.getModule = function getModule() {
      return this.source.module;
    };

    _proto2.getStart = function getStart() {
      return this.charPositions.start;
    };

    _proto2.getEnd = function getEnd() {
      return this.charPositions.end;
    };

    _proto2.locDidUpdate = function locDidUpdate() {
    };

    _proto2.toHbsSpan = function toHbsSpan() {
      var locPosSpan = this._locPosSpan;

      if (locPosSpan === null) {
        var start = this.charPositions.start.toHbsPos();
        var end = this.charPositions.end.toHbsPos();

        if (start === null || end === null) {
          locPosSpan = this._locPosSpan = BROKEN;
        } else {
          locPosSpan = this._locPosSpan = new HbsSpan(this.source, {
            start: start,
            end: end
          });
        }
      }

      return locPosSpan === BROKEN ? null : locPosSpan;
    };

    _proto2.serialize = function serialize() {
      var _this$charPositions = this.charPositions,
          start = _this$charPositions.start.charPos,
          end = _this$charPositions.end.charPos;

      if (start === end) {
        return start;
      } else {
        return [start, end];
      }
    };

    _proto2.toCharPosSpan = function toCharPosSpan() {
      return this;
    };

    return CharPositionSpan;
  }();

  var HbsSpan = /*#__PURE__*/function () {
    function HbsSpan(source, hbsPositions, providedHbsLoc) {
      if (providedHbsLoc === void 0) {
        providedHbsLoc = null;
      }

      this.source = source;
      this.hbsPositions = hbsPositions;
      this.kind = "HbsPosition"
      /* HbsPosition */
      ;
      this._charPosSpan = null;
      this._providedHbsLoc = providedHbsLoc;
    }

    var _proto3 = HbsSpan.prototype;

    _proto3.serialize = function serialize() {
      var charPos = this.toCharPosSpan();
      return charPos === null ? "Broken"
      /* Broken */
      : charPos.wrap().serialize();
    };

    _proto3.wrap = function wrap() {
      return new SourceSpan(this);
    };

    _proto3.updateProvided = function updateProvided(pos, edge) {
      if (this._providedHbsLoc) {
        this._providedHbsLoc[edge] = pos;
      } // invalidate computed character offsets


      this._charPosSpan = null;
      this._providedHbsLoc = {
        start: pos,
        end: pos
      };
    };

    _proto3.locDidUpdate = function locDidUpdate(_ref4) {
      var start = _ref4.start,
          end = _ref4.end;

      if (start !== undefined) {
        this.updateProvided(start, 'start');
        this.hbsPositions.start = new HbsPosition(this.source, start, null);
      }

      if (end !== undefined) {
        this.updateProvided(end, 'end');
        this.hbsPositions.end = new HbsPosition(this.source, end, null);
      }
    };

    _proto3.asString = function asString() {
      var span = this.toCharPosSpan();
      return span === null ? '' : span.asString();
    };

    _proto3.getModule = function getModule() {
      return this.source.module;
    };

    _proto3.getStart = function getStart() {
      return this.hbsPositions.start;
    };

    _proto3.getEnd = function getEnd() {
      return this.hbsPositions.end;
    };

    _proto3.toHbsLoc = function toHbsLoc() {
      return {
        start: this.hbsPositions.start.hbsPos,
        end: this.hbsPositions.end.hbsPos
      };
    };

    _proto3.toHbsSpan = function toHbsSpan() {
      return this;
    };

    _proto3.toCharPosSpan = function toCharPosSpan() {
      var charPosSpan = this._charPosSpan;

      if (charPosSpan === null) {
        var start = this.hbsPositions.start.toCharPos();
        var end = this.hbsPositions.end.toCharPos();

        if (start && end) {
          charPosSpan = this._charPosSpan = new CharPositionSpan(this.source, {
            start: start,
            end: end
          });
        } else {
          charPosSpan = this._charPosSpan = BROKEN;
          return null;
        }
      }

      return charPosSpan === BROKEN ? null : charPosSpan;
    };

    return HbsSpan;
  }();

  var InvisibleSpan = /*#__PURE__*/function () {
    function InvisibleSpan(kind, // whatever was provided, possibly broken
    loc, // if the span represents a synthetic string
    string) {
      if (string === void 0) {
        string = null;
      }

      this.kind = kind;
      this.loc = loc;
      this.string = string;
    }

    var _proto4 = InvisibleSpan.prototype;

    _proto4.serialize = function serialize() {
      switch (this.kind) {
        case "Broken"
        /* Broken */
        :
        case "NonExistent"
        /* NonExistent */
        :
          return this.kind;

        case "InternalsSynthetic"
        /* InternalsSynthetic */
        :
          return this.string || '';
      }
    };

    _proto4.wrap = function wrap() {
      return new SourceSpan(this);
    };

    _proto4.asString = function asString() {
      return this.string || '';
    };

    _proto4.locDidUpdate = function locDidUpdate(_ref5) {
      var start = _ref5.start,
          end = _ref5.end;

      if (start !== undefined) {
        this.loc.start = start;
      }

      if (end !== undefined) {
        this.loc.end = end;
      }
    };

    _proto4.getModule = function getModule() {
      // TODO: Make this reflect the actual module this span originated from
      return 'an unknown module';
    };

    _proto4.getStart = function getStart() {
      return new InvisiblePosition(this.kind, this.loc.start);
    };

    _proto4.getEnd = function getEnd() {
      return new InvisiblePosition(this.kind, this.loc.end);
    };

    _proto4.toCharPosSpan = function toCharPosSpan() {
      return this;
    };

    _proto4.toHbsSpan = function toHbsSpan() {
      return null;
    };

    _proto4.toHbsLoc = function toHbsLoc() {
      return BROKEN_LOCATION;
    };

    return InvisibleSpan;
  }();

  var span = match(function (m) {
    return m.when("HbsPosition"
    /* HbsPosition */
    , "HbsPosition"
    /* HbsPosition */
    , function (left, right) {
      return new HbsSpan(left.source, {
        start: left,
        end: right
      }).wrap();
    }).when("CharPosition"
    /* CharPosition */
    , "CharPosition"
    /* CharPosition */
    , function (left, right) {
      return new CharPositionSpan(left.source, {
        start: left,
        end: right
      }).wrap();
    }).when("CharPosition"
    /* CharPosition */
    , "HbsPosition"
    /* HbsPosition */
    , function (left, right) {
      var rightCharPos = right.toCharPos();

      if (rightCharPos === null) {
        return new InvisibleSpan("Broken"
        /* Broken */
        , BROKEN_LOCATION).wrap();
      } else {
        return span(left, rightCharPos);
      }
    }).when("HbsPosition"
    /* HbsPosition */
    , "CharPosition"
    /* CharPosition */
    , function (left, right) {
      var leftCharPos = left.toCharPos();

      if (leftCharPos === null) {
        return new InvisibleSpan("Broken"
        /* Broken */
        , BROKEN_LOCATION).wrap();
      } else {
        return span(leftCharPos, right);
      }
    }).when(IsInvisible, MatchAny, function (left) {
      return new InvisibleSpan(left.kind, BROKEN_LOCATION).wrap();
    }).when(MatchAny, IsInvisible, function (_, right) {
      return new InvisibleSpan(right.kind, BROKEN_LOCATION).wrap();
    });
  });

  // eslint-disable-next-line import/no-extraneous-dependencies
  var Source = /*#__PURE__*/function () {
    function Source(source, module) {
      if (module === void 0) {
        module = 'an unknown module';
      }

      this.source = source;
      this.module = module;
    }
    /**
     * Validate that the character offset represents a position in the source string.
     */


    var _proto = Source.prototype;

    _proto.check = function check(offset) {
      return offset >= 0 && offset <= this.source.length;
    };

    _proto.slice = function slice(start, end) {
      return this.source.slice(start, end);
    };

    _proto.offsetFor = function offsetFor(line, column) {
      return SourceOffset.forHbsPos(this, {
        line: line,
        column: column
      });
    };

    _proto.spanFor = function spanFor(_ref) {
      var start = _ref.start,
          end = _ref.end;
      return SourceSpan.forHbsLoc(this, {
        start: {
          line: start.line,
          column: start.column
        },
        end: {
          line: end.line,
          column: end.column
        }
      });
    };

    _proto.hbsPosFor = function hbsPosFor(offset) {
      var seenLines = 0;
      var seenChars = 0;

      if (offset > this.source.length) {
        return null;
      }

      while (true) {
        var nextLine = this.source.indexOf('\n', seenChars);

        if (offset <= nextLine || nextLine === -1) {
          return {
            line: seenLines + 1,
            column: offset - seenChars
          };
        } else {
          seenLines += 1;
          seenChars = nextLine + 1;
        }
      }
    };

    _proto.charPosFor = function charPosFor(position) {
      var line = position.line,
          column = position.column;
      var sourceString = this.source;
      var sourceLength = sourceString.length;
      var seenLines = 0;
      var seenChars = 0;

      while (true) {
        if (seenChars >= sourceLength) return sourceLength;
        var nextLine = this.source.indexOf('\n', seenChars);
        if (nextLine === -1) nextLine = this.source.length;

        if (seenLines === line - 1) {
          if (seenChars + column > nextLine) return nextLine;

          if (env.DEBUG) {
            var roundTrip = this.hbsPosFor(seenChars + column);
          }

          return seenChars + column;
        } else if (nextLine === -1) {
          return 0;
        } else {
          seenLines += 1;
          seenChars = nextLine + 1;
        }
      }
    };

    return Source;
  }();

  function _defineProperties$2(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$2(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$2(Constructor.prototype, protoProps); if (staticProps) _defineProperties$2(Constructor, staticProps); return Constructor; }
  var PathExpressionImplV1 = /*#__PURE__*/function () {
    function PathExpressionImplV1(original, head, tail, loc) {
      this.original = original;
      this.loc = loc;
      this.type = 'PathExpression';
      this["this"] = false;
      this.data = false; // Cache for the head value.

      this._head = undefined;
      var parts = tail.slice();

      if (head.type === 'ThisHead') {
        this["this"] = true;
      } else if (head.type === 'AtHead') {
        this.data = true;
        parts.unshift(head.name.slice(1));
      } else {
        parts.unshift(head.name);
      }

      this.parts = parts;
    }

    _createClass$2(PathExpressionImplV1, [{
      key: "head",
      get: function get() {
        if (this._head) {
          return this._head;
        }

        var firstPart;

        if (this["this"]) {
          firstPart = 'this';
        } else if (this.data) {
          firstPart = "@" + this.parts[0];
        } else {
          firstPart = this.parts[0];
        }

        var firstPartLoc = this.loc.collapse('start').sliceStartChars({
          chars: firstPart.length
        }).loc;
        return this._head = publicBuilder.head(firstPart, firstPartLoc);
      }
    }, {
      key: "tail",
      get: function get() {
        return this["this"] ? this.parts : this.parts.slice(1);
      }
    }]);

    return PathExpressionImplV1;
  }();

  var _SOURCE;

  function SOURCE() {
    if (!_SOURCE) {
      _SOURCE = new Source('', '(synthetic)');
    }

    return _SOURCE;
  }

  function buildMustache(path, params, hash, raw, loc, strip) {
    if (typeof path === 'string') {
      path = buildPath(path);
    }

    return {
      type: 'MustacheStatement',
      path: path,
      params: params || [],
      hash: hash || buildHash([]),
      escaped: !raw,
      trusting: !!raw,
      loc: buildLoc(loc || null),
      strip: strip || {
        open: false,
        close: false
      }
    };
  }

  function buildBlock(path, params, hash, _defaultBlock, _elseBlock, loc, openStrip, inverseStrip, closeStrip) {
    var defaultBlock;
    var elseBlock;

    if (_defaultBlock.type === 'Template') {

      defaultBlock = util.assign({}, _defaultBlock, {
        type: 'Block'
      });
    } else {
      defaultBlock = _defaultBlock;
    }

    if (_elseBlock !== undefined && _elseBlock !== null && _elseBlock.type === 'Template') {

      elseBlock = util.assign({}, _elseBlock, {
        type: 'Block'
      });
    } else {
      elseBlock = _elseBlock;
    }

    return {
      type: 'BlockStatement',
      path: buildPath(path),
      params: params || [],
      hash: hash || buildHash([]),
      program: defaultBlock || null,
      inverse: elseBlock || null,
      loc: buildLoc(loc || null),
      openStrip: openStrip || {
        open: false,
        close: false
      },
      inverseStrip: inverseStrip || {
        open: false,
        close: false
      },
      closeStrip: closeStrip || {
        open: false,
        close: false
      }
    };
  }

  function buildElementModifier(path, params, hash, loc) {
    return {
      type: 'ElementModifierStatement',
      path: buildPath(path),
      params: params || [],
      hash: hash || buildHash([]),
      loc: buildLoc(loc || null)
    };
  }

  function buildPartial(name, params, hash, indent, loc) {
    return {
      type: 'PartialStatement',
      name: name,
      params: params || [],
      hash: hash || buildHash([]),
      indent: indent || '',
      strip: {
        open: false,
        close: false
      },
      loc: buildLoc(loc || null)
    };
  }

  function buildComment(value, loc) {
    return {
      type: 'CommentStatement',
      value: value,
      loc: buildLoc(loc || null)
    };
  }

  function buildMustacheComment(value, loc) {
    return {
      type: 'MustacheCommentStatement',
      value: value,
      loc: buildLoc(loc || null)
    };
  }

  function buildConcat(parts, loc) {
    if (!util.isPresent(parts)) {
      throw new Error("b.concat requires at least one part");
    }

    return {
      type: 'ConcatStatement',
      parts: parts || [],
      loc: buildLoc(loc || null)
    };
  }

  function buildElement(tag, options) {
    if (options === void 0) {
      options = {};
    }

    var _options = options,
        attrs = _options.attrs,
        blockParams = _options.blockParams,
        modifiers = _options.modifiers,
        comments = _options.comments,
        children = _options.children,
        loc = _options.loc;
    var tagName; // this is used for backwards compat, prior to `selfClosing` being part of the ElementNode AST

    var selfClosing = false;

    if (typeof tag === 'object') {
      selfClosing = tag.selfClosing;
      tagName = tag.name;
    } else if (tag.slice(-1) === '/') {
      tagName = tag.slice(0, -1);
      selfClosing = true;
    } else {
      tagName = tag;
    }

    return {
      type: 'ElementNode',
      tag: tagName,
      selfClosing: selfClosing,
      attributes: attrs || [],
      blockParams: blockParams || [],
      modifiers: modifiers || [],
      comments: comments || [],
      children: children || [],
      loc: buildLoc(loc || null)
    };
  }

  function buildAttr(name, value, loc) {
    return {
      type: 'AttrNode',
      name: name,
      value: value,
      loc: buildLoc(loc || null)
    };
  }

  function buildText(chars, loc) {
    return {
      type: 'TextNode',
      chars: chars || '',
      loc: buildLoc(loc || null)
    };
  } // Expressions


  function buildSexpr(path, params, hash, loc) {
    return {
      type: 'SubExpression',
      path: buildPath(path),
      params: params || [],
      hash: hash || buildHash([]),
      loc: buildLoc(loc || null)
    };
  }

  function headToString(head) {
    switch (head.type) {
      case 'AtHead':
        return {
          original: head.name,
          parts: [head.name]
        };

      case 'ThisHead':
        return {
          original: "this",
          parts: []
        };

      case 'VarHead':
        return {
          original: head.name,
          parts: [head.name]
        };
    }
  }

  function buildHead(original, loc) {
    var _original$split = original.split('.'),
        head = _original$split[0],
        tail = _original$split.slice(1);

    var headNode;

    if (head === 'this') {
      headNode = {
        type: 'ThisHead',
        loc: buildLoc(loc || null)
      };
    } else if (head[0] === '@') {
      headNode = {
        type: 'AtHead',
        name: head,
        loc: buildLoc(loc || null)
      };
    } else {
      headNode = {
        type: 'VarHead',
        name: head,
        loc: buildLoc(loc || null)
      };
    }

    return {
      head: headNode,
      tail: tail
    };
  }

  function buildThis(loc) {
    return {
      type: 'ThisHead',
      loc: buildLoc(loc || null)
    };
  }

  function buildAtName(name, loc) {
    return {
      type: 'AtHead',
      name: name,
      loc: buildLoc(loc || null)
    };
  }

  function buildVar(name, loc) {
    return {
      type: 'VarHead',
      name: name,
      loc: buildLoc(loc || null)
    };
  }

  function buildHeadFromString(head, loc) {
    if (head[0] === '@') {
      return buildAtName(head, loc);
    } else if (head === 'this') {
      return buildThis(loc);
    } else {
      return buildVar(head, loc);
    }
  }

  function buildNamedBlockName(name, loc) {
    return {
      type: 'NamedBlockName',
      name: name,
      loc: buildLoc(loc || null)
    };
  }

  function buildCleanPath(head, tail, loc) {
    var _headToString = headToString(head),
        originalHead = _headToString.original,
        headParts = _headToString.parts;

    var parts = [].concat(headParts, tail);
    var original = [].concat(originalHead, parts).join('.');
    return new PathExpressionImplV1(original, head, tail, buildLoc(loc || null));
  }

  function buildPath(path, loc) {
    if (typeof path !== 'string') {
      if ('type' in path) {
        return path;
      } else {
        var _buildHead = buildHead(path.head, SourceSpan.broken()),
            _head = _buildHead.head,
            _tail = _buildHead.tail;

        var _headToString2 = headToString(_head),
            originalHead = _headToString2.original;

        return new PathExpressionImplV1([originalHead].concat(_tail).join('.'), _head, _tail, buildLoc(loc || null));
      }
    }

    var _buildHead2 = buildHead(path, SourceSpan.broken()),
        head = _buildHead2.head,
        tail = _buildHead2.tail;

    return new PathExpressionImplV1(path, head, tail, buildLoc(loc || null));
  }

  function buildLiteral(type, value, loc) {
    return {
      type: type,
      value: value,
      original: value,
      loc: buildLoc(loc || null)
    };
  } // Miscellaneous


  function buildHash(pairs, loc) {
    return {
      type: 'Hash',
      pairs: pairs || [],
      loc: buildLoc(loc || null)
    };
  }

  function buildPair(key, value, loc) {
    return {
      type: 'HashPair',
      key: key,
      value: value,
      loc: buildLoc(loc || null)
    };
  }

  function buildProgram(body, blockParams, loc) {
    return {
      type: 'Template',
      body: body || [],
      blockParams: blockParams || [],
      loc: buildLoc(loc || null)
    };
  }

  function buildBlockItself(body, blockParams, chained, loc) {
    if (chained === void 0) {
      chained = false;
    }

    return {
      type: 'Block',
      body: body || [],
      blockParams: blockParams || [],
      chained: chained,
      loc: buildLoc(loc || null)
    };
  }

  function buildTemplate(body, blockParams, loc) {
    return {
      type: 'Template',
      body: body || [],
      blockParams: blockParams || [],
      loc: buildLoc(loc || null)
    };
  }

  function buildPosition(line, column) {
    return {
      line: line,
      column: column
    };
  }

  function buildLoc() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (args.length === 1) {
      var loc = args[0];

      if (loc && typeof loc === 'object') {
        return SourceSpan.forHbsLoc(SOURCE(), loc);
      } else {
        return SourceSpan.forHbsLoc(SOURCE(), SYNTHETIC_LOCATION);
      }
    } else {
      var startLine = args[0],
          startColumn = args[1],
          endLine = args[2],
          endColumn = args[3],
          _source = args[4];
      var source = _source ? new Source('', _source) : SOURCE();
      return SourceSpan.forHbsLoc(source, {
        start: {
          line: startLine,
          column: startColumn
        },
        end: {
          line: endLine,
          column: endColumn
        }
      });
    }
  }

  var publicBuilder = {
    mustache: buildMustache,
    block: buildBlock,
    partial: buildPartial,
    comment: buildComment,
    mustacheComment: buildMustacheComment,
    element: buildElement,
    elementModifier: buildElementModifier,
    attr: buildAttr,
    text: buildText,
    sexpr: buildSexpr,
    concat: buildConcat,
    hash: buildHash,
    pair: buildPair,
    literal: buildLiteral,
    program: buildProgram,
    blockItself: buildBlockItself,
    template: buildTemplate,
    loc: buildLoc,
    pos: buildPosition,
    path: buildPath,
    fullPath: buildCleanPath,
    head: buildHeadFromString,
    at: buildAtName,
    "var": buildVar,
    "this": buildThis,
    blockName: buildNamedBlockName,
    string: literal('StringLiteral'),
    "boolean": literal('BooleanLiteral'),
    number: literal('NumberLiteral'),
    undefined: function (_undefined) {
      function undefined$1() {
        return _undefined.apply(this, arguments);
      }

      undefined$1.toString = function () {
        return _undefined.toString();
      };

      return undefined$1;
    }(function () {
      return buildLiteral('UndefinedLiteral', undefined);
    }),
    "null": function _null() {
      return buildLiteral('NullLiteral', null);
    }
  };

  function literal(type) {
    return function (value, loc) {
      return buildLiteral(type, value, loc);
    };
  }



  var api = /*#__PURE__*/Object.freeze({
    __proto__: null
  });

  /**
   * A free variable is resolved according to a resolution rule:
   *
   * 1. Strict resolution
   * 2. Namespaced resolution
   * 3. Fallback resolution
   */

  /**
   * Strict resolution is used:
   *
   * 1. in a strict mode template
   * 2. in an unambiguous invocation with dot paths
   */
  var StrictResolution = /*#__PURE__*/function () {
    function StrictResolution() {
      this.isAngleBracket = false;
    }

    var _proto = StrictResolution.prototype;

    _proto.resolution = function resolution() {
      return 31
      /* GetStrictFree */
      ;
    };

    _proto.serialize = function serialize() {
      return 'Strict';
    };

    return StrictResolution;
  }();
  var STRICT_RESOLUTION = new StrictResolution();
  /**
   * A `LooseModeResolution` includes:
   *
   * - 0 or more namespaces to resolve the variable in
   * - optional fallback behavior
   *
   * In practice, there are a limited number of possible combinations of these degrees of freedom,
   * and they are captured by the `Ambiguity` union below.
   */

  var LooseModeResolution = /*#__PURE__*/function () {
    function LooseModeResolution(ambiguity, isAngleBracket) {
      if (isAngleBracket === void 0) {
        isAngleBracket = false;
      }

      this.ambiguity = ambiguity;
      this.isAngleBracket = isAngleBracket;
    }
    /**
     * Namespaced resolution is used in an unambiguous syntax position:
     *
     * 1. `(sexp)` (namespace: `Helper`)
     * 2. `{{#block}}` (namespace: `Component`)
     * 3. `<a {{modifier}}>` (namespace: `Modifier`)
     * 4. `<Component />` (namespace: `Component`)
     *
     * @see {NamespacedAmbiguity}
     */


    LooseModeResolution.namespaced = function namespaced(namespace, isAngleBracket) {
      if (isAngleBracket === void 0) {
        isAngleBracket = false;
      }

      return new LooseModeResolution({
        namespaces: [namespace],
        fallback: false
      }, isAngleBracket);
    }
    /**
     * Fallback resolution is used when no namespaced resolutions are possible, but fallback
     * resolution is still allowed.
     *
     * ```hbs
     * {{x.y}}
     * ```
     *
     * @see {FallbackAmbiguity}
     */
    ;

    LooseModeResolution.fallback = function fallback() {
      return new LooseModeResolution({
        namespaces: [],
        fallback: true
      });
    }
    /**
     * Append resolution is used when the variable should be resolved in both the `component` and
     * `helper` namespaces. Fallback resolution is optional.
     *
     * ```hbs
     * {{x}}
     * ```
     *
     * ^ `x` should be resolved in the `component` and `helper` namespaces with fallback resolution.
     *
     * ```hbs
     * {{x y}}
     * ```
     *
     * ^ `x` should be resolved in the `component` and `helper` namespaces without fallback
     * resolution.
     *
     * @see {ComponentOrHelperAmbiguity}
     */
    ;

    LooseModeResolution.append = function append(_ref) {
      var invoke = _ref.invoke;
      return new LooseModeResolution({
        namespaces: ["Component"
        /* Component */
        , "Helper"
        /* Helper */
        ],
        fallback: !invoke
      });
    }
    /**
     * Trusting append resolution is used when the variable should be resolved in both the `component` and
     * `helper` namespaces. Fallback resolution is optional.
     *
     * ```hbs
     * {{{x}}}
     * ```
     *
     * ^ `x` should be resolved in the `component` and `helper` namespaces with fallback resolution.
     *
     * ```hbs
     * {{{x y}}}
     * ```
     *
     * ^ `x` should be resolved in the `component` and `helper` namespaces without fallback
     * resolution.
     *
     * @see {HelperAmbiguity}
     */
    ;

    LooseModeResolution.trustingAppend = function trustingAppend(_ref2) {
      var invoke = _ref2.invoke;
      return new LooseModeResolution({
        namespaces: ["Helper"
        /* Helper */
        ],
        fallback: !invoke
      });
    }
    /**
     * Attribute resolution is used when the variable should be resolved as a `helper` with fallback
     * resolution.
     *
     * ```hbs
     * <a href={{x}} />
     * <a href="{{x}}.html" />
     * ```
     *
     * ^ resolved in the `helper` namespace with fallback
     *
     * @see {HelperAmbiguity}
     */
    ;

    LooseModeResolution.attr = function attr() {
      return new LooseModeResolution({
        namespaces: ["Helper"
        /* Helper */
        ],
        fallback: true
      });
    };

    var _proto2 = LooseModeResolution.prototype;

    _proto2.resolution = function resolution() {
      if (this.ambiguity.namespaces.length === 0) {
        return 31
        /* GetStrictFree */
        ;
      } else if (this.ambiguity.namespaces.length === 1) {
        if (this.ambiguity.fallback) {
          // simple namespaced resolution with fallback must be attr={{x}}
          return 36
          /* GetFreeAsHelperHeadOrThisFallback */
          ;
        } else {
          // simple namespaced resolution without fallback
          switch (this.ambiguity.namespaces[0]) {
            case "Helper"
            /* Helper */
            :
              return 37
              /* GetFreeAsHelperHead */
              ;

            case "Modifier"
            /* Modifier */
            :
              return 38
              /* GetFreeAsModifierHead */
              ;

            case "Component"
            /* Component */
            :
              return 39
              /* GetFreeAsComponentHead */
              ;
          }
        }
      } else if (this.ambiguity.fallback) {
        // component or helper + fallback ({{something}})
        return 34
        /* GetFreeAsComponentOrHelperHeadOrThisFallback */
        ;
      } else {
          // component or helper without fallback ({{something something}})
          return 35
          /* GetFreeAsComponentOrHelperHead */
          ;
        }
    };

    _proto2.serialize = function serialize() {
      if (this.ambiguity.namespaces.length === 0) {
        return 'Loose';
      } else if (this.ambiguity.namespaces.length === 1) {
        if (this.ambiguity.fallback) {
          // simple namespaced resolution with fallback must be attr={{x}}
          return ['ambiguous', "Attr"
          /* Attr */
          ];
        } else {
          return ['ns', this.ambiguity.namespaces[0]];
        }
      } else if (this.ambiguity.fallback) {
        // component or helper + fallback ({{something}})
        return ['ambiguous', "Append"
        /* Append */
        ];
      } else {
        // component or helper without fallback ({{something something}})
        return ['ambiguous', "Invoke"
        /* Invoke */
        ];
      }
    };

    return LooseModeResolution;
  }();
  var ARGUMENT_RESOLUTION = LooseModeResolution.fallback();
  function loadResolution(resolution) {
    if (typeof resolution === 'string') {
      switch (resolution) {
        case 'Loose':
          return LooseModeResolution.fallback();

        case 'Strict':
          return STRICT_RESOLUTION;
      }
    }

    switch (resolution[0]) {
      case 'ambiguous':
        switch (resolution[1]) {
          case "Append"
          /* Append */
          :
            return LooseModeResolution.append({
              invoke: false
            });

          case "Attr"
          /* Attr */
          :
            return LooseModeResolution.attr();

          case "Invoke"
          /* Invoke */
          :
            return LooseModeResolution.append({
              invoke: true
            });
        }

      case 'ns':
        return LooseModeResolution.namespaced(resolution[1]);
    }
  }

  function node(name) {
    if (name !== undefined) {
      var type = name;
      return {
        fields: function fields() {
          return /*#__PURE__*/function () {
            function _class(fields) {
              this.type = type;
              util.assign(this, fields);
            }

            return _class;
          }();
        }
      };
    } else {
      return {
        fields: function fields() {
          return /*#__PURE__*/function () {
            function _class2(fields) {
              util.assign(this, fields);
            }

            return _class2;
          }();
        }
      };
    }
  }

  function _defineProperties$3(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$3(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$3(Constructor.prototype, protoProps); if (staticProps) _defineProperties$3(Constructor, staticProps); return Constructor; }

  function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
  /**
   * Corresponds to syntaxes with positional and named arguments:
   *
   * - SubExpression
   * - Invoking Append
   * - Invoking attributes
   * - InvokeBlock
   *
   * If `Args` is empty, the `SourceOffsets` for this node should be the collapsed position
   * immediately after the parent call node's `callee`.
   */

  var Args = /*#__PURE__*/function (_node$fields) {
    _inheritsLoose(Args, _node$fields);

    function Args() {
      return _node$fields.apply(this, arguments) || this;
    }

    Args.empty = function empty(loc) {
      return new Args({
        loc: loc,
        positional: PositionalArguments.empty(loc),
        named: NamedArguments.empty(loc)
      });
    };

    Args.named = function named(_named) {
      return new Args({
        loc: _named.loc,
        positional: PositionalArguments.empty(_named.loc.collapse('end')),
        named: _named
      });
    };

    var _proto = Args.prototype;

    _proto.nth = function nth(offset) {
      return this.positional.nth(offset);
    };

    _proto.get = function get(name) {
      return this.named.get(name);
    };

    _proto.isEmpty = function isEmpty() {
      return this.positional.isEmpty() && this.named.isEmpty();
    };

    return Args;
  }(node().fields());
  /**
   * Corresponds to positional arguments.
   *
   * If `PositionalArguments` is empty, the `SourceOffsets` for this node should be the collapsed
   * position immediately after the parent call node's `callee`.
   */

  var PositionalArguments = /*#__PURE__*/function (_node$fields2) {
    _inheritsLoose(PositionalArguments, _node$fields2);

    function PositionalArguments() {
      return _node$fields2.apply(this, arguments) || this;
    }

    PositionalArguments.empty = function empty(loc) {
      return new PositionalArguments({
        loc: loc,
        exprs: []
      });
    };

    var _proto2 = PositionalArguments.prototype;

    _proto2.nth = function nth(offset) {
      return this.exprs[offset] || null;
    };

    _proto2.isEmpty = function isEmpty() {
      return this.exprs.length === 0;
    };

    _createClass$3(PositionalArguments, [{
      key: "size",
      get: function get() {
        return this.exprs.length;
      }
    }]);

    return PositionalArguments;
  }(node().fields());
  /**
   * Corresponds to named arguments.
   *
   * If `PositionalArguments` and `NamedArguments` are empty, the `SourceOffsets` for this node should
   * be the same as the `Args` node that contains this node.
   *
   * If `PositionalArguments` is not empty but `NamedArguments` is empty, the `SourceOffsets` for this
   * node should be the collapsed position immediately after the last positional argument.
   */

  var NamedArguments = /*#__PURE__*/function (_node$fields3) {
    _inheritsLoose(NamedArguments, _node$fields3);

    function NamedArguments() {
      return _node$fields3.apply(this, arguments) || this;
    }

    NamedArguments.empty = function empty(loc) {
      return new NamedArguments({
        loc: loc,
        entries: []
      });
    };

    var _proto3 = NamedArguments.prototype;

    _proto3.get = function get(name) {
      var entry = this.entries.filter(function (e) {
        return e.name.chars === name;
      })[0];
      return entry ? entry.value : null;
    };

    _proto3.isEmpty = function isEmpty() {
      return this.entries.length === 0;
    };

    _createClass$3(NamedArguments, [{
      key: "size",
      get: function get() {
        return this.entries.length;
      }
    }]);

    return NamedArguments;
  }(node().fields());
  /**
   * Corresponds to a single named argument.
   *
   * ```hbs
   * x=<expr>
   * ```
   */

  var NamedArgument = function NamedArgument(options) {
    this.loc = options.name.loc.extend(options.value.loc);
    this.name = options.name;
    this.value = options.value;
  };

  function _inheritsLoose$1(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
  /**
   * `HtmlAttr` nodes are valid HTML attributes, with or without a value.
   *
   * Exceptions:
   *
   * - `...attributes` is `SplatAttr`
   * - `@x=<value>` is `ComponentArg`
   */

  var HtmlAttr = /*#__PURE__*/function (_node$fields) {
    _inheritsLoose$1(HtmlAttr, _node$fields);

    function HtmlAttr() {
      return _node$fields.apply(this, arguments) || this;
    }

    return HtmlAttr;
  }(node('HtmlAttr').fields());
  var SplatAttr = /*#__PURE__*/function (_node$fields2) {
    _inheritsLoose$1(SplatAttr, _node$fields2);

    function SplatAttr() {
      return _node$fields2.apply(this, arguments) || this;
    }

    return SplatAttr;
  }(node('SplatAttr').fields());
  /**
   * Corresponds to an argument passed by a component (`@x=<value>`)
   */

  var ComponentArg = /*#__PURE__*/function (_node$fields3) {
    _inheritsLoose$1(ComponentArg, _node$fields3);

    function ComponentArg() {
      return _node$fields3.apply(this, arguments) || this;
    }

    var _proto = ComponentArg.prototype;

    /**
     * Convert the component argument into a named argument node
     */
    _proto.toNamedArgument = function toNamedArgument() {
      return new NamedArgument({
        name: this.name,
        value: this.value
      });
    };

    return ComponentArg;
  }(node().fields());
  /**
   * An `ElementModifier` is just a normal call node in modifier position.
   */

  var ElementModifier = /*#__PURE__*/function (_node$fields4) {
    _inheritsLoose$1(ElementModifier, _node$fields4);

    function ElementModifier() {
      return _node$fields4.apply(this, arguments) || this;
    }

    return ElementModifier;
  }(node('ElementModifier').fields());

  var SpanList = /*#__PURE__*/function () {
    function SpanList(span) {
      if (span === void 0) {
        span = [];
      }

      this._span = span;
    }

    SpanList.range = function range(span, fallback) {
      if (fallback === void 0) {
        fallback = SourceSpan.NON_EXISTENT;
      }

      return new SpanList(span.map(loc)).getRangeOffset(fallback);
    };

    var _proto = SpanList.prototype;

    _proto.add = function add(offset) {
      this._span.push(offset);
    };

    _proto.getRangeOffset = function getRangeOffset(fallback) {
      if (this._span.length === 0) {
        return fallback;
      } else {
        var first = this._span[0];
        var last = this._span[this._span.length - 1];
        return first.extend(last);
      }
    };

    return SpanList;
  }();
  function loc(span) {
    if (Array.isArray(span)) {
      var first = span[0];
      var last = span[span.length - 1];
      return loc(first).extend(loc(last));
    } else if (span instanceof SourceSpan) {
      return span;
    } else {
      return span.loc;
    }
  }
  function hasSpan(span) {
    if (Array.isArray(span) && span.length === 0) {
      return false;
    }

    return true;
  }
  function maybeLoc(location, fallback) {
    if (hasSpan(location)) {
      return loc(location);
    } else {
      return fallback;
    }
  }

  function _defineProperties$4(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$4(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$4(Constructor.prototype, protoProps); if (staticProps) _defineProperties$4(Constructor, staticProps); return Constructor; }

  function _inheritsLoose$2(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
  var GlimmerComment = /*#__PURE__*/function (_node$fields) {
    _inheritsLoose$2(GlimmerComment, _node$fields);

    function GlimmerComment() {
      return _node$fields.apply(this, arguments) || this;
    }

    return GlimmerComment;
  }(node('GlimmerComment').fields());
  var HtmlText = /*#__PURE__*/function (_node$fields2) {
    _inheritsLoose$2(HtmlText, _node$fields2);

    function HtmlText() {
      return _node$fields2.apply(this, arguments) || this;
    }

    return HtmlText;
  }(node('HtmlText').fields());
  var HtmlComment = /*#__PURE__*/function (_node$fields3) {
    _inheritsLoose$2(HtmlComment, _node$fields3);

    function HtmlComment() {
      return _node$fields3.apply(this, arguments) || this;
    }

    return HtmlComment;
  }(node('HtmlComment').fields());
  var AppendContent = /*#__PURE__*/function (_node$fields4) {
    _inheritsLoose$2(AppendContent, _node$fields4);

    function AppendContent() {
      return _node$fields4.apply(this, arguments) || this;
    }

    _createClass$4(AppendContent, [{
      key: "callee",
      get: function get() {
        if (this.value.type === 'Call') {
          return this.value.callee;
        } else {
          return this.value;
        }
      }
    }, {
      key: "args",
      get: function get() {
        if (this.value.type === 'Call') {
          return this.value.args;
        } else {
          return Args.empty(this.value.loc.collapse('end'));
        }
      }
    }]);

    return AppendContent;
  }(node('AppendContent').fields());
  var InvokeBlock = /*#__PURE__*/function (_node$fields5) {
    _inheritsLoose$2(InvokeBlock, _node$fields5);

    function InvokeBlock() {
      return _node$fields5.apply(this, arguments) || this;
    }

    return InvokeBlock;
  }(node('InvokeBlock').fields());
  /**
   * Corresponds to a component invocation. When the content of a component invocation contains no
   * named blocks, `blocks` contains a single named block named `"default"`. When a component
   * invocation is self-closing, `blocks` is empty.
   */

  var InvokeComponent = /*#__PURE__*/function (_node$fields6) {
    _inheritsLoose$2(InvokeComponent, _node$fields6);

    function InvokeComponent() {
      return _node$fields6.apply(this, arguments) || this;
    }

    _createClass$4(InvokeComponent, [{
      key: "args",
      get: function get() {
        var entries = this.componentArgs.map(function (a) {
          return a.toNamedArgument();
        });
        return Args.named(new NamedArguments({
          loc: SpanList.range(entries, this.callee.loc.collapse('end')),
          entries: entries
        }));
      }
    }]);

    return InvokeComponent;
  }(node('InvokeComponent').fields());
  /**
   * Corresponds to a simple HTML element. The AST allows component arguments and modifiers to support
   * future extensions.
   */

  var SimpleElement = /*#__PURE__*/function (_node$fields7) {
    _inheritsLoose$2(SimpleElement, _node$fields7);

    function SimpleElement() {
      return _node$fields7.apply(this, arguments) || this;
    }

    _createClass$4(SimpleElement, [{
      key: "args",
      get: function get() {
        var entries = this.componentArgs.map(function (a) {
          return a.toNamedArgument();
        });
        return Args.named(new NamedArguments({
          loc: SpanList.range(entries, this.tag.loc.collapse('end')),
          entries: entries
        }));
      }
    }]);

    return SimpleElement;
  }(node('SimpleElement').fields());

  function _inheritsLoose$3(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
  /**
   * Corresponds to a Handlebars literal.
   *
   * @see {LiteralValue}
   */

  var LiteralExpression = /*#__PURE__*/function (_node$fields) {
    _inheritsLoose$3(LiteralExpression, _node$fields);

    function LiteralExpression() {
      return _node$fields.apply(this, arguments) || this;
    }

    var _proto = LiteralExpression.prototype;

    _proto.toSlice = function toSlice() {
      return new SourceSlice({
        loc: this.loc,
        chars: this.value
      });
    };

    return LiteralExpression;
  }(node('Literal').fields());
  /**
   * Returns true if an input {@see ExpressionNode} is a literal.
   */

  function isLiteral(node, kind) {
    if (node.type === 'Literal') {
      if (kind === undefined) {
        return true;
      } else if (kind === 'null') {
        return node.value === null;
      } else {
        return typeof node.value === kind;
      }
    } else {
      return false;
    }
  }
  /**
   * Corresponds to a path in expression position.
   *
   * ```hbs
   * this
   * this.x
   * @x
   * @x.y
   * x
   * x.y
   * ```
   */

  var PathExpression = /*#__PURE__*/function (_node$fields2) {
    _inheritsLoose$3(PathExpression, _node$fields2);

    function PathExpression() {
      return _node$fields2.apply(this, arguments) || this;
    }

    return PathExpression;
  }(node('Path').fields());
  /**
   * Corresponds to a parenthesized call expression.
   *
   * ```hbs
   * (x)
   * (x.y)
   * (x y)
   * (x.y z)
   * ```
   */

  var CallExpression = /*#__PURE__*/function (_node$fields3) {
    _inheritsLoose$3(CallExpression, _node$fields3);

    function CallExpression() {
      return _node$fields3.apply(this, arguments) || this;
    }

    return CallExpression;
  }(node('Call').fields());
  /**
   * Corresponds to a possible deprecated helper call. Must be:
   *
   * 1. A free variable (not this.foo, not @foo, not local).
   * 2. Argument-less.
   * 3. In a component invocation's named argument position.
   * 4. Not parenthesized (not @bar={{(helper)}}).
   * 5. Not interpolated (not @bar="{{helper}}").
   *
   * ```hbs
   * <Foo @bar={{helper}} />
   * ```
   */

  var DeprecatedCallExpression = /*#__PURE__*/function (_node$fields4) {
    _inheritsLoose$3(DeprecatedCallExpression, _node$fields4);

    function DeprecatedCallExpression() {
      return _node$fields4.apply(this, arguments) || this;
    }

    return DeprecatedCallExpression;
  }(node('DeprecatedCall').fields());
  /**
   * Corresponds to an interpolation in attribute value position.
   *
   * ```hbs
   * <a href="{{url}}.html"
   * ```
   */

  var InterpolateExpression = /*#__PURE__*/function (_node$fields5) {
    _inheritsLoose$3(InterpolateExpression, _node$fields5);

    function InterpolateExpression() {
      return _node$fields5.apply(this, arguments) || this;
    }

    return InterpolateExpression;
  }(node('Interpolate').fields());

  function _inheritsLoose$4(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
  /**
   * Corresponds to `this` at the head of an expression.
   */

  var ThisReference = /*#__PURE__*/function (_node$fields) {
    _inheritsLoose$4(ThisReference, _node$fields);

    function ThisReference() {
      return _node$fields.apply(this, arguments) || this;
    }

    return ThisReference;
  }(node('This').fields());
  /**
   * Corresponds to `@<ident>` at the beginning of an expression.
   */

  var ArgReference = /*#__PURE__*/function (_node$fields2) {
    _inheritsLoose$4(ArgReference, _node$fields2);

    function ArgReference() {
      return _node$fields2.apply(this, arguments) || this;
    }

    return ArgReference;
  }(node('Arg').fields());
  /**
   * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is in the current
   * block's scope.
   */

  var LocalVarReference = /*#__PURE__*/function (_node$fields3) {
    _inheritsLoose$4(LocalVarReference, _node$fields3);

    function LocalVarReference() {
      return _node$fields3.apply(this, arguments) || this;
    }

    return LocalVarReference;
  }(node('Local').fields());
  /**
   * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is *not* in the
   * current block's scope.
   *
   * The `resolution: FreeVarResolution` field describes how to resolve the free variable.
   *
   * Note: In strict mode, it must always be a variable that is in a concrete JavaScript scope that
   * the template will be installed into.
   */

  var FreeVarReference = /*#__PURE__*/function (_node$fields4) {
    _inheritsLoose$4(FreeVarReference, _node$fields4);

    function FreeVarReference() {
      return _node$fields4.apply(this, arguments) || this;
    }

    return FreeVarReference;
  }(node('Free').fields());

  function _defineProperties$5(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$5(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$5(Constructor.prototype, protoProps); if (staticProps) _defineProperties$5(Constructor, staticProps); return Constructor; }

  function _inheritsLoose$5(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
  /**
   * Corresponds to an entire template.
   */

  var Template = /*#__PURE__*/function (_node$fields) {
    _inheritsLoose$5(Template, _node$fields);

    function Template() {
      return _node$fields.apply(this, arguments) || this;
    }

    return Template;
  }(node().fields());
  /**
   * Represents a block. In principle this could be merged with `NamedBlock`, because all cases
   * involving blocks have at least a notional name.
   */

  var Block = /*#__PURE__*/function (_node$fields2) {
    _inheritsLoose$5(Block, _node$fields2);

    function Block() {
      return _node$fields2.apply(this, arguments) || this;
    }

    return Block;
  }(node().fields());
  /**
   * Corresponds to a collection of named blocks.
   */

  var NamedBlocks = /*#__PURE__*/function (_node$fields3) {
    _inheritsLoose$5(NamedBlocks, _node$fields3);

    function NamedBlocks() {
      return _node$fields3.apply(this, arguments) || this;
    }

    var _proto = NamedBlocks.prototype;

    _proto.get = function get(name) {
      return this.blocks.filter(function (block) {
        return block.name.chars === name;
      })[0] || null;
    };

    return NamedBlocks;
  }(node().fields());
  /**
   * Corresponds to a single named block. This is used for anonymous named blocks (`default` and
   * `else`).
   */

  var NamedBlock = /*#__PURE__*/function (_node$fields4) {
    _inheritsLoose$5(NamedBlock, _node$fields4);

    function NamedBlock() {
      return _node$fields4.apply(this, arguments) || this;
    }

    _createClass$5(NamedBlock, [{
      key: "args",
      get: function get() {
        var entries = this.componentArgs.map(function (a) {
          return a.toNamedArgument();
        });
        return Args.named(new NamedArguments({
          loc: SpanList.range(entries, this.name.loc.collapse('end')),
          entries: entries
        }));
      }
    }]);

    return NamedBlock;
  }(node().fields());



  var api$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    StrictResolution: StrictResolution,
    STRICT_RESOLUTION: STRICT_RESOLUTION,
    LooseModeResolution: LooseModeResolution,
    ARGUMENT_RESOLUTION: ARGUMENT_RESOLUTION,
    loadResolution: loadResolution,
    node: node,
    Args: Args,
    PositionalArguments: PositionalArguments,
    NamedArguments: NamedArguments,
    NamedArgument: NamedArgument,
    HtmlAttr: HtmlAttr,
    SplatAttr: SplatAttr,
    ComponentArg: ComponentArg,
    ElementModifier: ElementModifier,
    GlimmerComment: GlimmerComment,
    HtmlText: HtmlText,
    HtmlComment: HtmlComment,
    AppendContent: AppendContent,
    InvokeBlock: InvokeBlock,
    InvokeComponent: InvokeComponent,
    SimpleElement: SimpleElement,
    LiteralExpression: LiteralExpression,
    isLiteral: isLiteral,
    PathExpression: PathExpression,
    CallExpression: CallExpression,
    DeprecatedCallExpression: DeprecatedCallExpression,
    InterpolateExpression: InterpolateExpression,
    ThisReference: ThisReference,
    ArgReference: ArgReference,
    LocalVarReference: LocalVarReference,
    FreeVarReference: FreeVarReference,
    Template: Template,
    Block: Block,
    NamedBlocks: NamedBlocks,
    NamedBlock: NamedBlock
  });

  var ATTR_VALUE_REGEX_TEST = /[\xA0"&]/;
  var ATTR_VALUE_REGEX_REPLACE = new RegExp(ATTR_VALUE_REGEX_TEST.source, 'g');
  var TEXT_REGEX_TEST = /[\xA0&<>]/;
  var TEXT_REGEX_REPLACE = new RegExp(TEXT_REGEX_TEST.source, 'g');

  function attrValueReplacer(_char) {
    switch (_char.charCodeAt(0)) {
      case 160
      /* NBSP */
      :
        return '&nbsp;';

      case 34
      /* QUOT */
      :
        return '&quot;';

      case 38
      /* AMP */
      :
        return '&amp;';

      default:
        return _char;
    }
  }

  function textReplacer(_char2) {
    switch (_char2.charCodeAt(0)) {
      case 160
      /* NBSP */
      :
        return '&nbsp;';

      case 38
      /* AMP */
      :
        return '&amp;';

      case 60
      /* LT */
      :
        return '&lt;';

      case 62
      /* GT */
      :
        return '&gt;';

      default:
        return _char2;
    }
  }

  function escapeAttrValue(attrValue) {
    if (ATTR_VALUE_REGEX_TEST.test(attrValue)) {
      return attrValue.replace(ATTR_VALUE_REGEX_REPLACE, attrValueReplacer);
    }

    return attrValue;
  }
  function escapeText(text) {
    if (TEXT_REGEX_TEST.test(text)) {
      return text.replace(TEXT_REGEX_REPLACE, textReplacer);
    }

    return text;
  }
  function sortByLoc(a, b) {
    // If either is invisible, don't try to order them
    if (a.loc.isInvisible || b.loc.isInvisible) {
      return 0;
    }

    if (a.loc.startPosition.line < b.loc.startPosition.line) {
      return -1;
    }

    if (a.loc.startPosition.line === b.loc.startPosition.line && a.loc.startPosition.column < b.loc.startPosition.column) {
      return -1;
    }

    if (a.loc.startPosition.line === b.loc.startPosition.line && a.loc.startPosition.column === b.loc.startPosition.column) {
      return 0;
    }

    return 1;
  }

  function _createForOfIteratorHelperLoose$1(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$1(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; return function () { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } it = o[Symbol.iterator](); return it.next.bind(it); }

  function _unsupportedIterableToArray$1(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$1(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$1(o, minLen); }

  function _arrayLikeToArray$1(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
  var voidMap = Object.create(null);
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

      for (var _iterator = _createForOfIteratorHelperLoose$1(parts), _step; !(_step = _iterator()).done;) {
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

  function build(ast, options) {
    if (options === void 0) {
      options = {
        entityEncoding: 'transformed'
      };
    }

    if (!ast) {
      return '';
    }

    var printer = new Printer(options);
    return printer.print(ast);
  }

  function generateSyntaxError(message, location) {
    var module = location.module,
        loc = location.loc;
    var _loc$start = loc.start,
        line = _loc$start.line,
        column = _loc$start.column;
    var code = location.asString();
    var quotedCode = code ? "\n\n|\n|  " + code.split('\n').join('\n|  ') + "\n|\n\n" : '';
    var error = new Error(message + ": " + quotedCode + "(error occurred in '" + module + "' @ line " + line + " : column " + column + ")");
    error.name = 'SyntaxError';
    error.location = location;
    error.code = code;
    return error;
  }

  // ParentNode and ChildKey types are derived from VisitorKeysMap

  var visitorKeys = {
    Program: util.tuple('body'),
    Template: util.tuple('body'),
    Block: util.tuple('body'),
    MustacheStatement: util.tuple('path', 'params', 'hash'),
    BlockStatement: util.tuple('path', 'params', 'hash', 'program', 'inverse'),
    ElementModifierStatement: util.tuple('path', 'params', 'hash'),
    PartialStatement: util.tuple('name', 'params', 'hash'),
    CommentStatement: util.tuple(),
    MustacheCommentStatement: util.tuple(),
    ElementNode: util.tuple('attributes', 'modifiers', 'children', 'comments'),
    AttrNode: util.tuple('value'),
    TextNode: util.tuple(),
    ConcatStatement: util.tuple('parts'),
    SubExpression: util.tuple('path', 'params', 'hash'),
    PathExpression: util.tuple(),
    PathHead: util.tuple(),
    StringLiteral: util.tuple(),
    BooleanLiteral: util.tuple(),
    NumberLiteral: util.tuple(),
    NullLiteral: util.tuple(),
    UndefinedLiteral: util.tuple(),
    Hash: util.tuple('pairs'),
    HashPair: util.tuple('value'),
    // v2 new nodes
    NamedBlock: util.tuple('attributes', 'modifiers', 'children', 'comments'),
    SimpleElement: util.tuple('attributes', 'modifiers', 'children', 'comments'),
    Component: util.tuple('head', 'attributes', 'modifiers', 'children', 'comments')
  };

  var TraversalError = function () {
    TraversalError.prototype = Object.create(Error.prototype);
    TraversalError.prototype.constructor = TraversalError;

    function TraversalError(message, node, parent, key) {
      var error = Error.call(this, message);
      this.key = key;
      this.message = message;
      this.node = node;
      this.parent = parent;
      this.stack = error.stack;
    }

    return TraversalError;
  }();
  function cannotRemoveNode(node, parent, key) {
    return new TraversalError('Cannot remove a node unless it is part of an array', node, parent, key);
  }
  function cannotReplaceNode(node, parent, key) {
    return new TraversalError('Cannot replace a node with multiple nodes unless it is part of an array', node, parent, key);
  }
  function cannotReplaceOrRemoveInKeyHandlerYet(node, key) {
    return new TraversalError('Replacing and removing in key handlers is not yet supported.', node, null, key);
  }

  function _defineProperties$6(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$6(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$6(Constructor.prototype, protoProps); if (staticProps) _defineProperties$6(Constructor, staticProps); return Constructor; }

  var WalkerPath = /*#__PURE__*/function () {
    function WalkerPath(node, parent, parentKey) {
      if (parent === void 0) {
        parent = null;
      }

      if (parentKey === void 0) {
        parentKey = null;
      }

      this.node = node;
      this.parent = parent;
      this.parentKey = parentKey;
    }

    var _proto = WalkerPath.prototype;

    _proto.parents = function parents() {
      var _this = this,
          _ref;

      return _ref = {}, _ref[Symbol.iterator] = function () {
        return new PathParentsIterator(_this);
      }, _ref;
    };

    _createClass$6(WalkerPath, [{
      key: "parentNode",
      get: function get() {
        return this.parent ? this.parent.node : null;
      }
    }]);

    return WalkerPath;
  }();

  var PathParentsIterator = /*#__PURE__*/function () {
    function PathParentsIterator(path) {
      this.path = path;
    }

    var _proto2 = PathParentsIterator.prototype;

    _proto2.next = function next() {
      if (this.path.parent) {
        this.path = this.path.parent;
        return {
          done: false,
          value: this.path
        };
      } else {
        return {
          done: true,
          value: null
        };
      }
    };

    return PathParentsIterator;
  }();

  function getEnterFunction(handler) {
    if (typeof handler === 'function') {
      return handler;
    } else {
      return handler.enter;
    }
  }

  function getExitFunction(handler) {
    if (typeof handler === 'function') {
      return undefined;
    } else {
      return handler.exit;
    }
  }

  function getKeyHandler(handler, key) {
    var keyVisitor = typeof handler !== 'function' ? handler.keys : undefined;
    if (keyVisitor === undefined) return;
    var keyHandler = keyVisitor[key];

    if (keyHandler !== undefined) {
      return keyHandler;
    }

    return keyVisitor.All;
  }

  function getNodeHandler(visitor, nodeType) {
    if (nodeType === 'Template' || nodeType === 'Block') {
      if (visitor.Program) {

        return visitor.Program;
      }
    }

    var handler = visitor[nodeType];

    if (handler !== undefined) {
      return handler;
    }

    return visitor.All;
  }

  function visitNode(visitor, path) {
    var node = path.node,
        parent = path.parent,
        parentKey = path.parentKey;
    var handler = getNodeHandler(visitor, node.type);
    var enter;
    var exit;

    if (handler !== undefined) {
      enter = getEnterFunction(handler);
      exit = getExitFunction(handler);
    }

    var result;

    if (enter !== undefined) {
      result = enter(node, path);
    }

    if (result !== undefined && result !== null) {
      if (JSON.stringify(node) === JSON.stringify(result)) {
        result = undefined;
      } else if (Array.isArray(result)) {
        visitArray(visitor, result, parent, parentKey);
        return result;
      } else {
        var _path = new WalkerPath(result, parent, parentKey);

        return visitNode(visitor, _path) || result;
      }
    }

    if (result === undefined) {
      var keys = visitorKeys[node.type];

      for (var i = 0; i < keys.length; i++) {
        var key = keys[i]; // we know if it has child keys we can widen to a ParentNode

        visitKey(visitor, handler, path, key);
      }

      if (exit !== undefined) {
        result = exit(node, path);
      }
    }

    return result;
  }

  function get(node, key) {
    return node[key];
  }

  function set(node, key, value) {
    node[key] = value;
  }

  function visitKey(visitor, handler, path, key) {
    var node = path.node;
    var value = get(node, key);

    if (!value) {
      return;
    }

    var keyEnter;
    var keyExit;

    if (handler !== undefined) {
      var keyHandler = getKeyHandler(handler, key);

      if (keyHandler !== undefined) {
        keyEnter = getEnterFunction(keyHandler);
        keyExit = getExitFunction(keyHandler);
      }
    }

    if (keyEnter !== undefined) {
      if (keyEnter(node, key) !== undefined) {
        throw cannotReplaceOrRemoveInKeyHandlerYet(node, key);
      }
    }

    if (Array.isArray(value)) {
      visitArray(visitor, value, path, key);
    } else {
      var keyPath = new WalkerPath(value, path, key);
      var result = visitNode(visitor, keyPath);

      if (result !== undefined) {
        // TODO: dynamically check the results by having a table of
        // expected node types in value space, not just type space
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignKey(node, key, value, result);
      }
    }

    if (keyExit !== undefined) {
      if (keyExit(node, key) !== undefined) {
        throw cannotReplaceOrRemoveInKeyHandlerYet(node, key);
      }
    }
  }

  function visitArray(visitor, array, parent, parentKey) {
    for (var i = 0; i < array.length; i++) {
      var node = array[i];
      var path = new WalkerPath(node, parent, parentKey);
      var result = visitNode(visitor, path);

      if (result !== undefined) {
        i += spliceArray(array, i, result) - 1;
      }
    }
  }

  function assignKey(node, key, value, result) {
    if (result === null) {
      throw cannotRemoveNode(value, node, key);
    } else if (Array.isArray(result)) {
      if (result.length === 1) {
        set(node, key, result[0]);
      } else {
        if (result.length === 0) {
          throw cannotRemoveNode(value, node, key);
        } else {
          throw cannotReplaceNode(value, node, key);
        }
      }
    } else {
      set(node, key, result);
    }
  }

  function spliceArray(array, index, result) {
    if (result === null) {
      array.splice(index, 1);
      return 0;
    } else if (Array.isArray(result)) {
      array.splice.apply(array, [index, 1].concat(result));
      return result.length;
    } else {
      array.splice(index, 1, result);
      return 1;
    }
  }

  function traverse(node, visitor) {
    var path = new WalkerPath(node);
    visitNode(visitor, path);
  }

  var Walker = /*#__PURE__*/function () {
    function Walker(order) {
      this.order = order;
      this.stack = [];
    }

    var _proto = Walker.prototype;

    _proto.visit = function visit(node, callback) {
      if (!node) {
        return;
      }

      this.stack.push(node);

      if (this.order === 'post') {
        this.children(node, callback);
        callback(node, this);
      } else {
        callback(node, this);
        this.children(node, callback);
      }

      this.stack.pop();
    };

    _proto.children = function children(node, callback) {
      switch (node.type) {
        case 'Block':
        case 'Template':
          return visitors.Program(this, node, callback);

        case 'ElementNode':
          return visitors.ElementNode(this, node, callback);

        case 'BlockStatement':
          return visitors.BlockStatement(this, node, callback);

        default:
          return;
      }
    };

    return Walker;
  }();
  var visitors = {
    Program: function Program(walker, node, callback) {
      for (var i = 0; i < node.body.length; i++) {
        walker.visit(node.body[i], callback);
      }
    },
    Template: function Template(walker, node, callback) {
      for (var i = 0; i < node.body.length; i++) {
        walker.visit(node.body[i], callback);
      }
    },
    Block: function Block(walker, node, callback) {
      for (var i = 0; i < node.body.length; i++) {
        walker.visit(node.body[i], callback);
      }
    },
    ElementNode: function ElementNode(walker, node, callback) {
      for (var i = 0; i < node.children.length; i++) {
        walker.visit(node.children[i], callback);
      }
    },
    BlockStatement: function BlockStatement(walker, node, callback) {
      walker.visit(node.program, callback);
      walker.visit(node.inverse || null, callback);
    }
  };

  // Based on the ID validation regex in Handlebars.

  var ID_INVERSE_PATTERN = /[!"#%-,\.\/;->@\[-\^`\{-~]/; // Checks the element's attributes to see if it uses block params.
  // If it does, registers the block params with the program and
  // removes the corresponding attributes from the element.

  function parseElementBlockParams(element) {
    var params = parseBlockParams(element);
    if (params) element.blockParams = params;
  }

  function parseBlockParams(element) {
    var l = element.attributes.length;
    var attrNames = [];

    for (var i = 0; i < l; i++) {
      attrNames.push(element.attributes[i].name);
    }

    var asIndex = attrNames.indexOf('as');

    if (asIndex === -1 && attrNames.length > 0 && attrNames[attrNames.length - 1].charAt(0) === '|') {
      throw generateSyntaxError('Block parameters must be preceded by the `as` keyword, detected block parameters without `as`', element.loc);
    }

    if (asIndex !== -1 && l > asIndex && attrNames[asIndex + 1].charAt(0) === '|') {
      // Some basic validation, since we're doing the parsing ourselves
      var paramsString = attrNames.slice(asIndex).join(' ');

      if (paramsString.charAt(paramsString.length - 1) !== '|' || paramsString.match(/\|/g).length !== 2) {
        throw generateSyntaxError("Invalid block parameters syntax, '" + paramsString + "'", element.loc);
      }

      var params = [];

      for (var _i = asIndex + 1; _i < l; _i++) {
        var param = attrNames[_i].replace(/\|/g, '');

        if (param !== '') {
          if (ID_INVERSE_PATTERN.test(param)) {
            throw generateSyntaxError("Invalid identifier for block parameters, '" + param + "'", element.loc);
          }

          params.push(param);
        }
      }

      if (params.length === 0) {
        throw generateSyntaxError('Cannot use zero block parameters', element.loc);
      }

      element.attributes = element.attributes.slice(0, asIndex);
      return params;
    }

    return null;
  }

  function childrenFor(node) {
    switch (node.type) {
      case 'Block':
      case 'Template':
        return node.body;

      case 'ElementNode':
        return node.children;
    }
  }
  function appendChild(parent, node) {
    childrenFor(parent).push(node);
  }
  function isHBSLiteral(path) {
    return path.type === 'StringLiteral' || path.type === 'BooleanLiteral' || path.type === 'NumberLiteral' || path.type === 'NullLiteral' || path.type === 'UndefinedLiteral';
  }
  function printLiteral(literal) {
    if (literal.type === 'UndefinedLiteral') {
      return 'undefined';
    } else {
      return JSON.stringify(literal.value);
    }
  }
  function isUpperCase(tag) {
    return tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase();
  }
  function isLowerCase(tag) {
    return tag[0] === tag[0].toLowerCase() && tag[0] !== tag[0].toUpperCase();
  }

  var DEFAULT_STRIP = {
    close: false,
    open: false
  };
  /**
   * The Parser Builder differentiates from the public builder API by:
   *
   * 1. Offering fewer different ways to instantiate nodes
   * 2. Mandating source locations
   */

  var Builders = /*#__PURE__*/function () {
    function Builders() {}

    var _proto = Builders.prototype;

    _proto.pos = function pos(line, column) {
      return {
        line: line,
        column: column
      };
    };

    _proto.blockItself = function blockItself(_ref) {
      var body = _ref.body,
          blockParams = _ref.blockParams,
          _ref$chained = _ref.chained,
          chained = _ref$chained === void 0 ? false : _ref$chained,
          loc = _ref.loc;
      return {
        type: 'Block',
        body: body || [],
        blockParams: blockParams || [],
        chained: chained,
        loc: loc
      };
    };

    _proto.template = function template(_ref2) {
      var body = _ref2.body,
          blockParams = _ref2.blockParams,
          loc = _ref2.loc;
      return {
        type: 'Template',
        body: body || [],
        blockParams: blockParams || [],
        loc: loc
      };
    };

    _proto.mustache = function mustache(_ref3) {
      var path = _ref3.path,
          params = _ref3.params,
          hash = _ref3.hash,
          trusting = _ref3.trusting,
          loc = _ref3.loc,
          _ref3$strip = _ref3.strip,
          strip = _ref3$strip === void 0 ? DEFAULT_STRIP : _ref3$strip;
      return {
        type: 'MustacheStatement',
        path: path,
        params: params,
        hash: hash,
        escaped: !trusting,
        trusting: trusting,
        loc: loc,
        strip: strip || {
          open: false,
          close: false
        }
      };
    };

    _proto.block = function block(_ref4) {
      var path = _ref4.path,
          params = _ref4.params,
          hash = _ref4.hash,
          defaultBlock = _ref4.defaultBlock,
          _ref4$elseBlock = _ref4.elseBlock,
          elseBlock = _ref4$elseBlock === void 0 ? null : _ref4$elseBlock,
          loc = _ref4.loc,
          _ref4$openStrip = _ref4.openStrip,
          openStrip = _ref4$openStrip === void 0 ? DEFAULT_STRIP : _ref4$openStrip,
          _ref4$inverseStrip = _ref4.inverseStrip,
          inverseStrip = _ref4$inverseStrip === void 0 ? DEFAULT_STRIP : _ref4$inverseStrip,
          _ref4$closeStrip = _ref4.closeStrip,
          closeStrip = _ref4$closeStrip === void 0 ? DEFAULT_STRIP : _ref4$closeStrip;
      return {
        type: 'BlockStatement',
        path: path,
        params: params,
        hash: hash,
        program: defaultBlock,
        inverse: elseBlock,
        loc: loc,
        openStrip: openStrip,
        inverseStrip: inverseStrip,
        closeStrip: closeStrip
      };
    };

    _proto.comment = function comment(value, loc) {
      return {
        type: 'CommentStatement',
        value: value,
        loc: loc
      };
    };

    _proto.mustacheComment = function mustacheComment(value, loc) {
      return {
        type: 'MustacheCommentStatement',
        value: value,
        loc: loc
      };
    };

    _proto.concat = function concat(parts, loc) {
      return {
        type: 'ConcatStatement',
        parts: parts,
        loc: loc
      };
    };

    _proto.element = function element(_ref5) {
      var tag = _ref5.tag,
          selfClosing = _ref5.selfClosing,
          attrs = _ref5.attrs,
          blockParams = _ref5.blockParams,
          modifiers = _ref5.modifiers,
          comments = _ref5.comments,
          children = _ref5.children,
          loc = _ref5.loc;
      return {
        type: 'ElementNode',
        tag: tag,
        selfClosing: selfClosing,
        attributes: attrs || [],
        blockParams: blockParams || [],
        modifiers: modifiers || [],
        comments: comments || [],
        children: children || [],
        loc: loc
      };
    };

    _proto.elementModifier = function elementModifier(_ref6) {
      var path = _ref6.path,
          params = _ref6.params,
          hash = _ref6.hash,
          loc = _ref6.loc;
      return {
        type: 'ElementModifierStatement',
        path: path,
        params: params,
        hash: hash,
        loc: loc
      };
    };

    _proto.attr = function attr(_ref7) {
      var name = _ref7.name,
          value = _ref7.value,
          loc = _ref7.loc;
      return {
        type: 'AttrNode',
        name: name,
        value: value,
        loc: loc
      };
    };

    _proto.text = function text(_ref8) {
      var chars = _ref8.chars,
          loc = _ref8.loc;
      return {
        type: 'TextNode',
        chars: chars,
        loc: loc
      };
    };

    _proto.sexpr = function sexpr(_ref9) {
      var path = _ref9.path,
          params = _ref9.params,
          hash = _ref9.hash,
          loc = _ref9.loc;
      return {
        type: 'SubExpression',
        path: path,
        params: params,
        hash: hash,
        loc: loc
      };
    };

    _proto.path = function path(_ref10) {
      var head = _ref10.head,
          tail = _ref10.tail,
          loc = _ref10.loc;

      var _headToString = headToString$1(head),
          originalHead = _headToString.original;

      var original = [].concat(originalHead, tail).join('.');
      return new PathExpressionImplV1(original, head, tail, loc);
    };

    _proto.head = function head(_head, loc) {
      if (_head[0] === '@') {
        return this.atName(_head, loc);
      } else if (_head === 'this') {
        return this["this"](loc);
      } else {
        return this["var"](_head, loc);
      }
    };

    _proto["this"] = function _this(loc) {
      return {
        type: 'ThisHead',
        loc: loc
      };
    };

    _proto.atName = function atName(name, loc) {
      return {
        type: 'AtHead',
        name: name,
        loc: loc
      };
    };

    _proto["var"] = function _var(name, loc) {
      return {
        type: 'VarHead',
        name: name,
        loc: loc
      };
    };

    _proto.hash = function hash(pairs, loc) {
      return {
        type: 'Hash',
        pairs: pairs || [],
        loc: loc
      };
    };

    _proto.pair = function pair(_ref11) {
      var key = _ref11.key,
          value = _ref11.value,
          loc = _ref11.loc;
      return {
        type: 'HashPair',
        key: key,
        value: value,
        loc: loc
      };
    };

    _proto.literal = function literal(_ref12) {
      var type = _ref12.type,
          value = _ref12.value,
          loc = _ref12.loc;
      return {
        type: type,
        value: value,
        original: value,
        loc: loc
      };
    };

    _proto.undefined = function (_undefined) {
      function undefined$1() {
        return _undefined.apply(this, arguments);
      }

      undefined$1.toString = function () {
        return _undefined.toString();
      };

      return undefined$1;
    }(function () {
      return this.literal({
        type: 'UndefinedLiteral',
        value: undefined
      });
    });

    _proto["null"] = function _null() {
      return this.literal({
        type: 'NullLiteral',
        value: null
      });
    };

    _proto.string = function string(value, loc) {
      return this.literal({
        type: 'StringLiteral',
        value: value,
        loc: loc
      });
    };

    _proto["boolean"] = function boolean(value, loc) {
      return this.literal({
        type: 'BooleanLiteral',
        value: value,
        loc: loc
      });
    };

    _proto.number = function number(value, loc) {
      return this.literal({
        type: 'NumberLiteral',
        value: value,
        loc: loc
      });
    };

    return Builders;
  }(); // Expressions


  function headToString$1(head) {
    switch (head.type) {
      case 'AtHead':
        return {
          original: head.name,
          parts: [head.name]
        };

      case 'ThisHead':
        return {
          original: "this",
          parts: []
        };

      case 'VarHead':
        return {
          original: head.name,
          parts: [head.name]
        };
    }
  }

  var b = new Builders();

  function _defineProperties$7(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$7(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$7(Constructor.prototype, protoProps); if (staticProps) _defineProperties$7(Constructor, staticProps); return Constructor; }
  var Parser = /*#__PURE__*/function () {
    function Parser(source, entityParser, mode) {
      if (entityParser === void 0) {
        entityParser = new simpleHtmlTokenizer.EntityParser(simpleHtmlTokenizer.HTML5NamedCharRefs);
      }

      if (mode === void 0) {
        mode = 'precompile';
      }

      this.elementStack = [];
      this.currentAttribute = null;
      this.currentNode = null;
      this.source = source;
      this.lines = source.source.split(/(?:\r\n?|\n)/g);
      this.tokenizer = new simpleHtmlTokenizer.EventedTokenizer(this, entityParser, mode);
    }

    var _proto = Parser.prototype;

    _proto.offset = function offset() {
      var _this$tokenizer = this.tokenizer,
          line = _this$tokenizer.line,
          column = _this$tokenizer.column;
      return this.source.offsetFor(line, column);
    };

    _proto.pos = function pos(_ref) {
      var line = _ref.line,
          column = _ref.column;
      return this.source.offsetFor(line, column);
    };

    _proto.finish = function finish(node) {
      return util.assign({}, node, {
        loc: node.loc.until(this.offset())
      }); // node.loc = node.loc.withEnd(end);
    };

    _proto.acceptTemplate = function acceptTemplate(node) {
      return this[node.type](node);
    };

    _proto.acceptNode = function acceptNode(node) {
      return this[node.type](node);
    };

    _proto.currentElement = function currentElement() {
      return this.elementStack[this.elementStack.length - 1];
    };

    _proto.sourceForNode = function sourceForNode(node, endNode) {
      var firstLine = node.loc.start.line - 1;
      var currentLine = firstLine - 1;
      var firstColumn = node.loc.start.column;
      var string = [];
      var line;
      var lastLine;
      var lastColumn;

      if (endNode) {
        lastLine = endNode.loc.end.line - 1;
        lastColumn = endNode.loc.end.column;
      } else {
        lastLine = node.loc.end.line - 1;
        lastColumn = node.loc.end.column;
      }

      while (currentLine < lastLine) {
        currentLine++;
        line = this.lines[currentLine];

        if (currentLine === firstLine) {
          if (firstLine === lastLine) {
            string.push(line.slice(firstColumn, lastColumn));
          } else {
            string.push(line.slice(firstColumn));
          }
        } else if (currentLine === lastLine) {
          string.push(line.slice(0, lastColumn));
        } else {
          string.push(line);
        }
      }

      return string.join('\n');
    };

    _createClass$7(Parser, [{
      key: "currentAttr",
      get: function get() {
        return this.currentAttribute;
      }
    }, {
      key: "currentTag",
      get: function get() {
        var node = this.currentNode;
        return node;
      }
    }, {
      key: "currentStartTag",
      get: function get() {
        var node = this.currentNode;
        return node;
      }
    }, {
      key: "currentEndTag",
      get: function get() {
        var node = this.currentNode;
        return node;
      }
    }, {
      key: "currentComment",
      get: function get() {
        var node = this.currentNode;
        return node;
      }
    }, {
      key: "currentData",
      get: function get() {
        var node = this.currentNode;
        return node;
      }
    }]);

    return Parser;
  }();

  function _defineProperties$8(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$8(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$8(Constructor.prototype, protoProps); if (staticProps) _defineProperties$8(Constructor, staticProps); return Constructor; }

  function _inheritsLoose$6(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
  var HandlebarsNodeVisitors = /*#__PURE__*/function (_Parser) {
    _inheritsLoose$6(HandlebarsNodeVisitors, _Parser);

    function HandlebarsNodeVisitors() {
      return _Parser.apply(this, arguments) || this;
    }

    var _proto = HandlebarsNodeVisitors.prototype;

    _proto.Program = function Program(program) {
      var body = [];
      var node;

      if (this.isTopLevel) {
        node = b.template({
          body: body,
          blockParams: program.blockParams,
          loc: this.source.spanFor(program.loc)
        });
      } else {
        node = b.blockItself({
          body: body,
          blockParams: program.blockParams,
          chained: program.chained,
          loc: this.source.spanFor(program.loc)
        });
      }

      var i,
          l = program.body.length;
      this.elementStack.push(node);

      if (l === 0) {
        return this.elementStack.pop();
      }

      for (i = 0; i < l; i++) {
        this.acceptNode(program.body[i]);
      } // Ensure that that the element stack is balanced properly.


      var poppedNode = this.elementStack.pop();

      if (poppedNode !== node) {
        var elementNode = poppedNode;
        throw generateSyntaxError("Unclosed element `" + elementNode.tag + "`", elementNode.loc);
      }

      return node;
    };

    _proto.BlockStatement = function BlockStatement(block) {
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

      var _acceptCallNodes = acceptCallNodes(this, block),
          path = _acceptCallNodes.path,
          params = _acceptCallNodes.params,
          hash = _acceptCallNodes.hash; // These are bugs in Handlebars upstream


      if (!block.program.loc) {
        block.program.loc = NON_EXISTENT_LOCATION;
      }

      if (block.inverse && !block.inverse.loc) {
        block.inverse.loc = NON_EXISTENT_LOCATION;
      }

      var program = this.Program(block.program);
      var inverse = block.inverse ? this.Program(block.inverse) : null;
      var node = b.block({
        path: path,
        params: params,
        hash: hash,
        defaultBlock: program,
        elseBlock: inverse,
        loc: this.source.spanFor(block.loc),
        openStrip: block.openStrip,
        inverseStrip: block.inverseStrip,
        closeStrip: block.closeStrip
      });
      var parentProgram = this.currentElement();
      appendChild(parentProgram, node);
    };

    _proto.MustacheStatement = function MustacheStatement(rawMustache) {
      var tokenizer = this.tokenizer;

      if (tokenizer.state === 'comment') {
        this.appendToCommentData(this.sourceForNode(rawMustache));
        return;
      }

      var mustache;
      var escaped = rawMustache.escaped,
          loc = rawMustache.loc,
          strip = rawMustache.strip;

      if (isHBSLiteral(rawMustache.path)) {
        mustache = b.mustache({
          path: this.acceptNode(rawMustache.path),
          params: [],
          hash: b.hash([], this.source.spanFor(rawMustache.path.loc).collapse('end')),
          trusting: !escaped,
          loc: this.source.spanFor(loc),
          strip: strip
        });
      } else {
        var _acceptCallNodes2 = acceptCallNodes(this, rawMustache),
            path = _acceptCallNodes2.path,
            params = _acceptCallNodes2.params,
            hash = _acceptCallNodes2.hash;

        mustache = b.mustache({
          path: path,
          params: params,
          hash: hash,
          trusting: !escaped,
          loc: this.source.spanFor(loc),
          strip: strip
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
          throw generateSyntaxError("Cannot use mustaches in an elements tagname", mustache.loc);

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
    };

    _proto.appendDynamicAttributeValuePart = function appendDynamicAttributeValuePart(part) {
      this.finalizeTextPart();
      var attr = this.currentAttr;
      attr.isDynamic = true;
      attr.parts.push(part);
    };

    _proto.finalizeTextPart = function finalizeTextPart() {
      var attr = this.currentAttr;
      var text = attr.currentPart;

      if (text !== null) {
        this.currentAttr.parts.push(text);
        this.startTextPart();
      }
    };

    _proto.startTextPart = function startTextPart() {
      this.currentAttr.currentPart = null;
    };

    _proto.ContentStatement = function ContentStatement(content) {
      updateTokenizerLocation(this.tokenizer, content);
      this.tokenizer.tokenizePart(content.value);
      this.tokenizer.flushData();
    };

    _proto.CommentStatement = function CommentStatement(rawComment) {
      var tokenizer = this.tokenizer;

      if (tokenizer.state === "comment"
      /* comment */
      ) {
          this.appendToCommentData(this.sourceForNode(rawComment));
          return null;
        }

      var value = rawComment.value,
          loc = rawComment.loc;
      var comment = b.mustacheComment(value, this.source.spanFor(loc));

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
          throw generateSyntaxError("Using a Handlebars comment when in the `" + tokenizer['state'] + "` state is not supported", this.source.spanFor(rawComment.loc));
      }

      return comment;
    };

    _proto.PartialStatement = function PartialStatement(partial) {
      throw generateSyntaxError("Handlebars partials are not supported", this.source.spanFor(partial.loc));
    };

    _proto.PartialBlockStatement = function PartialBlockStatement(partialBlock) {
      throw generateSyntaxError("Handlebars partial blocks are not supported", this.source.spanFor(partialBlock.loc));
    };

    _proto.Decorator = function Decorator(decorator) {
      throw generateSyntaxError("Handlebars decorators are not supported", this.source.spanFor(decorator.loc));
    };

    _proto.DecoratorBlock = function DecoratorBlock(decoratorBlock) {
      throw generateSyntaxError("Handlebars decorator blocks are not supported", this.source.spanFor(decoratorBlock.loc));
    };

    _proto.SubExpression = function SubExpression(sexpr) {
      var _acceptCallNodes3 = acceptCallNodes(this, sexpr),
          path = _acceptCallNodes3.path,
          params = _acceptCallNodes3.params,
          hash = _acceptCallNodes3.hash;

      return b.sexpr({
        path: path,
        params: params,
        hash: hash,
        loc: this.source.spanFor(sexpr.loc)
      });
    };

    _proto.PathExpression = function PathExpression(path) {
      var original = path.original;
      var parts;

      if (original.indexOf('/') !== -1) {
        if (original.slice(0, 2) === './') {
          throw generateSyntaxError("Using \"./\" is not supported in Glimmer and unnecessary", this.source.spanFor(path.loc));
        }

        if (original.slice(0, 3) === '../') {
          throw generateSyntaxError("Changing context using \"../\" is not supported in Glimmer", this.source.spanFor(path.loc));
        }

        if (original.indexOf('.') !== -1) {
          throw generateSyntaxError("Mixing '.' and '/' in paths is not supported in Glimmer; use only '.' to separate property paths", this.source.spanFor(path.loc));
        }

        parts = [path.parts.join('/')];
      } else if (original === '.') {
        throw generateSyntaxError("'.' is not a supported path in Glimmer; check for a path with a trailing '.'", this.source.spanFor(path.loc));
      } else {
        parts = path.parts;
      }

      var thisHead = false; // This is to fix a bug in the Handlebars AST where the path expressions in
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

      var pathHead;

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
        var head = parts.shift();

        if (head === undefined) {
          throw generateSyntaxError("Attempted to parse a path expression, but it was not valid. Paths beginning with @ must start with a-z.", this.source.spanFor(path.loc));
        }

        pathHead = {
          type: 'AtHead',
          name: "@" + head,
          loc: {
            start: path.loc.start,
            end: {
              line: path.loc.start.line,
              column: path.loc.start.column + head.length + 1
            }
          }
        };
      } else {
        var _head = parts.shift();

        if (_head === undefined) {
          throw generateSyntaxError("Attempted to parse a path expression, but it was not valid. Paths must start with a-z or A-Z.", this.source.spanFor(path.loc));
        }

        pathHead = {
          type: 'VarHead',
          name: _head,
          loc: {
            start: path.loc.start,
            end: {
              line: path.loc.start.line,
              column: path.loc.start.column + _head.length
            }
          }
        };
      }

      return new PathExpressionImplV1(path.original, pathHead, parts, this.source.spanFor(path.loc));
    };

    _proto.Hash = function Hash(hash) {
      var pairs = [];

      for (var i = 0; i < hash.pairs.length; i++) {
        var pair = hash.pairs[i];
        pairs.push(b.pair({
          key: pair.key,
          value: this.acceptNode(pair.value),
          loc: this.source.spanFor(pair.loc)
        }));
      }

      return b.hash(pairs, this.source.spanFor(hash.loc));
    };

    _proto.StringLiteral = function StringLiteral(string) {
      return b.literal({
        type: 'StringLiteral',
        value: string.value,
        loc: string.loc
      });
    };

    _proto.BooleanLiteral = function BooleanLiteral(_boolean) {
      return b.literal({
        type: 'BooleanLiteral',
        value: _boolean.value,
        loc: _boolean.loc
      });
    };

    _proto.NumberLiteral = function NumberLiteral(number) {
      return b.literal({
        type: 'NumberLiteral',
        value: number.value,
        loc: number.loc
      });
    };

    _proto.UndefinedLiteral = function UndefinedLiteral(undef) {
      return b.literal({
        type: 'UndefinedLiteral',
        value: undefined,
        loc: undef.loc
      });
    };

    _proto.NullLiteral = function NullLiteral(nul) {
      return b.literal({
        type: 'NullLiteral',
        value: null,
        loc: nul.loc
      });
    };

    _createClass$8(HandlebarsNodeVisitors, [{
      key: "isTopLevel",
      get: function get() {
        return this.elementStack.length === 0;
      }
    }]);

    return HandlebarsNodeVisitors;
  }(Parser);

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


    var difference = original.split(value)[0];
    var lines = difference.split(/\n/);
    var lineCount = lines.length - 1;
    return {
      lines: lineCount,
      columns: lines[lineCount].length
    };
  }

  function updateTokenizerLocation(tokenizer, content) {
    var line = content.loc.start.line;
    var column = content.loc.start.column;
    var offsets = calculateRightStrippedOffsets(content.original, content.value);
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
      var _path = node.path;
      var value = '';

      if (_path.type === 'BooleanLiteral') {
        value = _path.original.toString();
      } else if (_path.type === 'StringLiteral') {
        value = "\"" + _path.original + "\"";
      } else if (_path.type === 'NullLiteral') {
        value = 'null';
      } else if (_path.type === 'NumberLiteral') {
        value = _path.value.toString();
      } else {
        value = 'undefined';
      }

      throw generateSyntaxError(_path.type + " \"" + (_path.type === 'StringLiteral' ? _path.original : value) + "\" cannot be called as a sub-expression, replace (" + value + ") with " + value, compiler.source.spanFor(_path.loc));
    }

    var path = node.path.type === 'PathExpression' ? compiler.PathExpression(node.path) : compiler.SubExpression(node.path);
    var params = node.params ? node.params.map(function (e) {
      return compiler.acceptNode(e);
    }) : []; // if there is no hash, position it as a collapsed node immediately after the last param (or the
    // path, if there are also no params)

    var end = params.length > 0 ? params[params.length - 1].loc : path.loc;
    var hash = node.hash ? compiler.Hash(node.hash) : {
      type: 'Hash',
      pairs: [],
      loc: compiler.source.spanFor(end).collapse('end')
    };
    return {
      path: path,
      params: params,
      hash: hash
    };
  }

  function addElementModifier(element, mustache) {
    var path = mustache.path,
        params = mustache.params,
        hash = mustache.hash,
        loc = mustache.loc;

    if (isHBSLiteral(path)) {
      var _modifier = "{{" + printLiteral(path) + "}}";

      var tag = "<" + element.name + " ... " + _modifier + " ...";
      throw generateSyntaxError("In " + tag + ", " + _modifier + " is not a valid modifier", mustache.loc);
    }

    var modifier = b.elementModifier({
      path: path,
      params: params,
      hash: hash,
      loc: loc
    });
    element.modifiers.push(modifier);
  }

  function _inheritsLoose$7(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
  var TokenizerEventHandlers = /*#__PURE__*/function (_HandlebarsNodeVisito) {
    _inheritsLoose$7(TokenizerEventHandlers, _HandlebarsNodeVisito);

    function TokenizerEventHandlers() {
      var _this;

      _this = _HandlebarsNodeVisito.apply(this, arguments) || this;
      _this.tagOpenLine = 0;
      _this.tagOpenColumn = 0;
      return _this;
    }

    var _proto = TokenizerEventHandlers.prototype;

    _proto.reset = function reset() {
      this.currentNode = null;
    } // Comment
    ;

    _proto.beginComment = function beginComment() {
      this.currentNode = b.comment('', this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn));
    };

    _proto.appendToCommentData = function appendToCommentData(_char) {
      this.currentComment.value += _char;
    };

    _proto.finishComment = function finishComment() {
      appendChild(this.currentElement(), this.finish(this.currentComment));
    } // Data
    ;

    _proto.beginData = function beginData() {
      this.currentNode = b.text({
        chars: '',
        loc: this.offset().collapsed()
      });
    };

    _proto.appendToData = function appendToData(_char2) {
      this.currentData.chars += _char2;
    };

    _proto.finishData = function finishData() {
      this.currentData.loc = this.currentData.loc.withEnd(this.offset());
      appendChild(this.currentElement(), this.currentData);
    } // Tags - basic
    ;

    _proto.tagOpen = function tagOpen() {
      this.tagOpenLine = this.tokenizer.line;
      this.tagOpenColumn = this.tokenizer.column;
    };

    _proto.beginStartTag = function beginStartTag() {
      this.currentNode = {
        type: 'StartTag',
        name: '',
        attributes: [],
        modifiers: [],
        comments: [],
        selfClosing: false,
        loc: this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn)
      };
    };

    _proto.beginEndTag = function beginEndTag() {
      this.currentNode = {
        type: 'EndTag',
        name: '',
        attributes: [],
        modifiers: [],
        comments: [],
        selfClosing: false,
        loc: this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn)
      };
    };

    _proto.finishTag = function finishTag() {
      var tag = this.finish(this.currentTag);

      if (tag.type === 'StartTag') {
        this.finishStartTag();

        if (tag.name === ':') {
          throw generateSyntaxError('Invalid named block named detected, you may have created a named block without a name, or you may have began your name with a number. Named blocks must have names that are at least one character long, and begin with a lower case letter', this.source.spanFor({
            start: this.currentTag.loc.toJSON(),
            end: this.offset().toJSON()
          }));
        }

        if (voidMap[tag.name] || tag.selfClosing) {
          this.finishEndTag(true);
        }
      } else if (tag.type === 'EndTag') {
        this.finishEndTag(false);
      }
    };

    _proto.finishStartTag = function finishStartTag() {
      var _this$finish = this.finish(this.currentStartTag),
          name = _this$finish.name,
          attrs = _this$finish.attributes,
          modifiers = _this$finish.modifiers,
          comments = _this$finish.comments,
          selfClosing = _this$finish.selfClosing,
          loc = _this$finish.loc;

      var element = b.element({
        tag: name,
        selfClosing: selfClosing,
        attrs: attrs,
        modifiers: modifiers,
        comments: comments,
        children: [],
        blockParams: [],
        loc: loc
      });
      this.elementStack.push(element);
    };

    _proto.finishEndTag = function finishEndTag(isVoid) {
      var tag = this.finish(this.currentTag);
      var element = this.elementStack.pop();
      var parent = this.currentElement();
      this.validateEndTag(tag, element, isVoid);
      element.loc = element.loc.withEnd(this.offset());
      parseElementBlockParams(element);
      appendChild(parent, element);
    };

    _proto.markTagAsSelfClosing = function markTagAsSelfClosing() {
      this.currentTag.selfClosing = true;
    } // Tags - name
    ;

    _proto.appendToTagName = function appendToTagName(_char3) {
      this.currentTag.name += _char3;
    } // Tags - attributes
    ;

    _proto.beginAttribute = function beginAttribute() {
      var offset = this.offset();
      this.currentAttribute = {
        name: '',
        parts: [],
        currentPart: null,
        isQuoted: false,
        isDynamic: false,
        start: offset,
        valueSpan: offset.collapsed()
      };
    };

    _proto.appendToAttributeName = function appendToAttributeName(_char4) {
      this.currentAttr.name += _char4;
    };

    _proto.beginAttributeValue = function beginAttributeValue(isQuoted) {
      this.currentAttr.isQuoted = isQuoted;
      this.startTextPart();
      this.currentAttr.valueSpan = this.offset().collapsed();
    };

    _proto.appendToAttributeValue = function appendToAttributeValue(_char5) {
      var parts = this.currentAttr.parts;
      var lastPart = parts[parts.length - 1];
      var current = this.currentAttr.currentPart;

      if (current) {
        current.chars += _char5; // update end location for each added char

        current.loc = current.loc.withEnd(this.offset());
      } else {
        // initially assume the text node is a single char
        var loc = this.offset(); // the tokenizer line/column have already been advanced, correct location info

        if (_char5 === '\n') {
          loc = lastPart ? lastPart.loc.getEnd() : this.currentAttr.valueSpan.getStart();
        } else {
          loc = loc.move(-1);
        }

        this.currentAttr.currentPart = b.text({
          chars: _char5,
          loc: loc.collapsed()
        });
      }
    };

    _proto.finishAttributeValue = function finishAttributeValue() {
      this.finalizeTextPart();
      var tag = this.currentTag;
      var tokenizerPos = this.offset();

      if (tag.type === 'EndTag') {
        throw generateSyntaxError("Invalid end tag: closing tag must not have attributes", this.source.spanFor({
          start: tag.loc.toJSON(),
          end: tokenizerPos.toJSON()
        }));
      }

      var _this$currentAttr = this.currentAttr,
          name = _this$currentAttr.name,
          parts = _this$currentAttr.parts,
          start = _this$currentAttr.start,
          isQuoted = _this$currentAttr.isQuoted,
          isDynamic = _this$currentAttr.isDynamic,
          valueSpan = _this$currentAttr.valueSpan;
      var value = this.assembleAttributeValue(parts, isQuoted, isDynamic, start.until(tokenizerPos));
      value.loc = valueSpan.withEnd(tokenizerPos);
      var attribute = b.attr({
        name: name,
        value: value,
        loc: start.until(tokenizerPos)
      });
      this.currentStartTag.attributes.push(attribute);
    };

    _proto.reportSyntaxError = function reportSyntaxError(message) {
      throw generateSyntaxError(message, this.offset().collapsed());
    };

    _proto.assembleConcatenatedValue = function assembleConcatenatedValue(parts) {
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];

        if (part.type !== 'MustacheStatement' && part.type !== 'TextNode') {
          throw generateSyntaxError('Unsupported node in quoted attribute value: ' + part['type'], part.loc);
        }
      }

      util.assertPresent(parts, "the concatenation parts of an element should not be empty");
      var first = parts[0];
      var last = parts[parts.length - 1];
      return b.concat(parts, this.source.spanFor(first.loc).extend(this.source.spanFor(last.loc)));
    };

    _proto.validateEndTag = function validateEndTag(tag, element, selfClosing) {
      var error;

      if (voidMap[tag.name] && !selfClosing) {
        // EngTag is also called by StartTag for void and self-closing tags (i.e.
        // <input> or <br />, so we need to check for that here. Otherwise, we would
        // throw an error for those cases.
        error = "<" + tag.name + "> elements do not need end tags. You should remove it";
      } else if (element.tag === undefined) {
        error = "Closing tag </" + tag.name + "> without an open tag";
      } else if (element.tag !== tag.name) {
        error = "Closing tag </" + tag.name + "> did not match last open tag <" + element.tag + "> (on line " + element.loc.startPosition.line + ")";
      }

      if (error) {
        throw generateSyntaxError(error, tag.loc);
      }
    };

    _proto.assembleAttributeValue = function assembleAttributeValue(parts, isQuoted, isDynamic, span) {
      if (isDynamic) {
        if (isQuoted) {
          return this.assembleConcatenatedValue(parts);
        } else {
          if (parts.length === 1 || parts.length === 2 && parts[1].type === 'TextNode' && parts[1].chars === '/') {
            return parts[0];
          } else {
            throw generateSyntaxError("An unquoted attribute value must be a string or a mustache, " + "preceded by whitespace or a '=' character, and " + "followed by whitespace, a '>' character, or '/>'", span);
          }
        }
      } else {
        return parts.length > 0 ? parts[0] : b.text({
          chars: '',
          loc: span
        });
      }
    };

    return TokenizerEventHandlers;
  }(HandlebarsNodeVisitors);
  var syntax = {
    parse: preprocess,
    builders: publicBuilder,
    print: build,
    traverse: traverse,
    Walker: Walker
  };

  var CodemodEntityParser = /*#__PURE__*/function (_EntityParser) {
    _inheritsLoose$7(CodemodEntityParser, _EntityParser);

    // match upstream types, but never match an entity
    function CodemodEntityParser() {
      return _EntityParser.call(this, {}) || this;
    }

    var _proto2 = CodemodEntityParser.prototype;

    _proto2.parse = function parse() {
      return undefined;
    };

    return CodemodEntityParser;
  }(simpleHtmlTokenizer.EntityParser);

  function preprocess(input, options) {
    if (options === void 0) {
      options = {};
    }

    var _a, _b, _c;

    var mode = options.mode || 'precompile';
    var source;
    var ast;

    if (typeof input === 'string') {
      source = new Source(input, (_a = options.meta) === null || _a === void 0 ? void 0 : _a.moduleName);

      if (mode === 'codemod') {
        ast = parser.parseWithoutProcessing(input, options.parseOptions);
      } else {
        ast = parser.parse(input, options.parseOptions);
      }
    } else if (input instanceof Source) {
      source = input;

      if (mode === 'codemod') {
        ast = parser.parseWithoutProcessing(input.source, options.parseOptions);
      } else {
        ast = parser.parse(input.source, options.parseOptions);
      }
    } else {
      source = new Source('', (_b = options.meta) === null || _b === void 0 ? void 0 : _b.moduleName);
      ast = input;
    }

    var entityParser = undefined;

    if (mode === 'codemod') {
      entityParser = new CodemodEntityParser();
    }

    var offsets = SourceSpan.forCharPositions(source, 0, source.source.length);
    ast.loc = {
      source: '(program)',
      start: offsets.startPosition,
      end: offsets.endPosition
    };
    var program = new TokenizerEventHandlers(source, entityParser, mode).acceptTemplate(ast);

    if (options.strictMode) {
      program.blockParams = (_c = options.locals) !== null && _c !== void 0 ? _c : [];
    }

    if (options && options.plugins && options.plugins.ast) {
      for (var i = 0, l = options.plugins.ast.length; i < l; i++) {
        var transform = options.plugins.ast[i];
        var env = util.assign({}, options, {
          syntax: syntax
        }, {
          plugins: undefined
        });
        var pluginResult = transform(env);
        traverse(program, pluginResult.visitor);
      }
    }

    return program;
  }

  function _defineProperties$9(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$9(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$9(Constructor.prototype, protoProps); if (staticProps) _defineProperties$9(Constructor, staticProps); return Constructor; }

  function _inheritsLoose$8(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
  var SymbolTable = /*#__PURE__*/function () {
    function SymbolTable() {}

    SymbolTable.top = function top(locals, customizeComponentName) {
      return new ProgramSymbolTable(locals, customizeComponentName);
    };

    var _proto = SymbolTable.prototype;

    _proto.child = function child(locals) {
      var _this = this;

      var symbols = locals.map(function (name) {
        return _this.allocate(name);
      });
      return new BlockSymbolTable(this, locals, symbols);
    };

    return SymbolTable;
  }();
  var ProgramSymbolTable = /*#__PURE__*/function (_SymbolTable) {
    _inheritsLoose$8(ProgramSymbolTable, _SymbolTable);

    function ProgramSymbolTable(templateLocals, customizeComponentName) {
      var _this2;

      _this2 = _SymbolTable.call(this) || this;
      _this2.templateLocals = templateLocals;
      _this2.customizeComponentName = customizeComponentName;
      _this2.symbols = [];
      _this2.upvars = [];
      _this2.size = 1;
      _this2.named = util.dict();
      _this2.blocks = util.dict();
      _this2.usedTemplateLocals = [];
      _this2._hasEval = false;
      return _this2;
    }

    var _proto2 = ProgramSymbolTable.prototype;

    _proto2.getUsedTemplateLocals = function getUsedTemplateLocals() {
      return this.usedTemplateLocals;
    };

    _proto2.setHasEval = function setHasEval() {
      this._hasEval = true;
    };

    _proto2.has = function has(name) {
      return this.templateLocals.indexOf(name) !== -1;
    };

    _proto2.get = function get(name) {
      var index = this.usedTemplateLocals.indexOf(name);

      if (index !== -1) {
        return [index, true];
      }

      index = this.usedTemplateLocals.length;
      this.usedTemplateLocals.push(name);
      return [index, true];
    };

    _proto2.getLocalsMap = function getLocalsMap() {
      return util.dict();
    };

    _proto2.getEvalInfo = function getEvalInfo() {
      var locals = this.getLocalsMap();
      return Object.keys(locals).map(function (symbol) {
        return locals[symbol];
      });
    };

    _proto2.allocateFree = function allocateFree(name, resolution) {
      // If the name in question is an uppercase (i.e. angle-bracket) component invocation, run
      // the optional `customizeComponentName` function provided to the precompiler.
      if (resolution.resolution() === 39
      /* GetFreeAsComponentHead */
      && resolution.isAngleBracket && isUpperCase(name)) {
        name = this.customizeComponentName(name);
      }

      var index = this.upvars.indexOf(name);

      if (index !== -1) {
        return index;
      }

      index = this.upvars.length;
      this.upvars.push(name);
      return index;
    };

    _proto2.allocateNamed = function allocateNamed(name) {
      var named = this.named[name];

      if (!named) {
        named = this.named[name] = this.allocate(name);
      }

      return named;
    };

    _proto2.allocateBlock = function allocateBlock(name) {
      if (name === 'inverse') {
        name = 'else';
      }

      var block = this.blocks[name];

      if (!block) {
        block = this.blocks[name] = this.allocate("&" + name);
      }

      return block;
    };

    _proto2.allocate = function allocate(identifier) {
      this.symbols.push(identifier);
      return this.size++;
    };

    _createClass$9(ProgramSymbolTable, [{
      key: "hasEval",
      get: function get() {
        return this._hasEval;
      }
    }]);

    return ProgramSymbolTable;
  }(SymbolTable);
  var BlockSymbolTable = /*#__PURE__*/function (_SymbolTable2) {
    _inheritsLoose$8(BlockSymbolTable, _SymbolTable2);

    function BlockSymbolTable(parent, symbols, slots) {
      var _this3;

      _this3 = _SymbolTable2.call(this) || this;
      _this3.parent = parent;
      _this3.symbols = symbols;
      _this3.slots = slots;
      return _this3;
    }

    var _proto3 = BlockSymbolTable.prototype;

    _proto3.has = function has(name) {
      return this.symbols.indexOf(name) !== -1 || this.parent.has(name);
    };

    _proto3.get = function get(name) {
      var slot = this.symbols.indexOf(name);
      return slot === -1 ? this.parent.get(name) : [this.slots[slot], false];
    };

    _proto3.getLocalsMap = function getLocalsMap() {
      var _this4 = this;

      var dict = this.parent.getLocalsMap();
      this.symbols.forEach(function (symbol) {
        return dict[symbol] = _this4.get(symbol)[0];
      });
      return dict;
    };

    _proto3.getEvalInfo = function getEvalInfo() {
      var locals = this.getLocalsMap();
      return Object.keys(locals).map(function (symbol) {
        return locals[symbol];
      });
    };

    _proto3.setHasEval = function setHasEval() {
      this.parent.setHasEval();
    };

    _proto3.allocateFree = function allocateFree(name, resolution) {
      return this.parent.allocateFree(name, resolution);
    };

    _proto3.allocateNamed = function allocateNamed(name) {
      return this.parent.allocateNamed(name);
    };

    _proto3.allocateBlock = function allocateBlock(name) {
      return this.parent.allocateBlock(name);
    };

    _proto3.allocate = function allocate(identifier) {
      return this.parent.allocate(identifier);
    };

    _createClass$9(BlockSymbolTable, [{
      key: "locals",
      get: function get() {
        return this.symbols;
      }
    }]);

    return BlockSymbolTable;
  }(SymbolTable);

  var __rest = undefined && undefined.__rest || function (s, e) {
    var t = {};

    for (var p in s) {
      if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];
    }

    if (s != null && typeof Object.getOwnPropertySymbols === "function") for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i])) t[p[i]] = s[p[i]];
    }
    return t;
  };
  var Builder = /*#__PURE__*/function () {
    function Builder() {}

    var _proto = Builder.prototype;

    // TEMPLATE //
    _proto.template = function template(symbols, body, loc) {
      return new Template({
        table: symbols,
        body: body,
        loc: loc
      });
    } // INTERNAL (these nodes cannot be reached when doing general-purpose visiting) //
    ;

    _proto.block = function block(symbols, body, loc) {
      return new Block({
        scope: symbols,
        body: body,
        loc: loc
      });
    };

    _proto.namedBlock = function namedBlock(name, block, loc) {
      return new NamedBlock({
        name: name,
        block: block,
        attrs: [],
        componentArgs: [],
        modifiers: [],
        loc: loc
      });
    };

    _proto.simpleNamedBlock = function simpleNamedBlock(name, block, loc) {
      return new BuildElement({
        selfClosing: false,
        attrs: [],
        componentArgs: [],
        modifiers: [],
        comments: []
      }).named(name, block, loc);
    };

    _proto.slice = function slice(chars, loc) {
      return new SourceSlice({
        loc: loc,
        chars: chars
      });
    };

    _proto.args = function args(positional, named, loc) {
      return new Args({
        loc: loc,
        positional: positional,
        named: named
      });
    };

    _proto.positional = function positional(exprs, loc) {
      return new PositionalArguments({
        loc: loc,
        exprs: exprs
      });
    };

    _proto.namedArgument = function namedArgument(key, value) {
      return new NamedArgument({
        name: key,
        value: value
      });
    };

    _proto.named = function named(entries, loc) {
      return new NamedArguments({
        loc: loc,
        entries: entries
      });
    };

    _proto.attr = function attr(_ref, loc) {
      var name = _ref.name,
          value = _ref.value,
          trusting = _ref.trusting;
      return new HtmlAttr({
        loc: loc,
        name: name,
        value: value,
        trusting: trusting
      });
    };

    _proto.splatAttr = function splatAttr(symbol, loc) {
      return new SplatAttr({
        symbol: symbol,
        loc: loc
      });
    };

    _proto.arg = function arg(_ref2, loc) {
      var name = _ref2.name,
          value = _ref2.value,
          trusting = _ref2.trusting;
      return new ComponentArg({
        name: name,
        value: value,
        trusting: trusting,
        loc: loc
      });
    } // EXPRESSIONS //
    ;

    _proto.path = function path(head, tail, loc) {
      return new PathExpression({
        loc: loc,
        ref: head,
        tail: tail
      });
    };

    _proto.self = function self(loc) {
      return new ThisReference({
        loc: loc
      });
    };

    _proto.at = function at(name, symbol, loc) {
      return new ArgReference({
        loc: loc,
        name: new SourceSlice({
          loc: loc,
          chars: name
        }),
        symbol: symbol
      });
    };

    _proto.freeVar = function freeVar(_ref3) {
      var name = _ref3.name,
          context = _ref3.context,
          symbol = _ref3.symbol,
          loc = _ref3.loc;
      return new FreeVarReference({
        name: name,
        resolution: context,
        symbol: symbol,
        loc: loc
      });
    };

    _proto.localVar = function localVar(name, symbol, isTemplateLocal, loc) {
      return new LocalVarReference({
        loc: loc,
        name: name,
        isTemplateLocal: isTemplateLocal,
        symbol: symbol
      });
    };

    _proto.sexp = function sexp(parts, loc) {
      return new CallExpression({
        loc: loc,
        callee: parts.callee,
        args: parts.args
      });
    };

    _proto.deprecatedCall = function deprecatedCall(arg, callee, loc) {
      return new DeprecatedCallExpression({
        loc: loc,
        arg: arg,
        callee: callee
      });
    };

    _proto.interpolate = function interpolate(parts, loc) {
      util.assertPresent(parts);
      return new InterpolateExpression({
        loc: loc,
        parts: parts
      });
    };

    _proto.literal = function literal(value, loc) {
      return new LiteralExpression({
        loc: loc,
        value: value
      });
    } // STATEMENTS //
    ;

    _proto.append = function append(_ref4, loc) {
      var table = _ref4.table,
          trusting = _ref4.trusting,
          value = _ref4.value;
      return new AppendContent({
        table: table,
        trusting: trusting,
        value: value,
        loc: loc
      });
    };

    _proto.modifier = function modifier(_ref5, loc) {
      var callee = _ref5.callee,
          args = _ref5.args;
      return new ElementModifier({
        loc: loc,
        callee: callee,
        args: args
      });
    };

    _proto.namedBlocks = function namedBlocks(blocks, loc) {
      return new NamedBlocks({
        loc: loc,
        blocks: blocks
      });
    };

    _proto.blockStatement = function blockStatement(_a, loc) {
      var symbols = _a.symbols,
          program = _a.program,
          _a$inverse = _a.inverse,
          inverse = _a$inverse === void 0 ? null : _a$inverse,
          call = __rest(_a, ["symbols", "program", "inverse"]);

      var blocksLoc = program.loc;
      var blocks = [this.namedBlock(SourceSlice.synthetic('default'), program, program.loc)];

      if (inverse) {
        blocksLoc = blocksLoc.extend(inverse.loc);
        blocks.push(this.namedBlock(SourceSlice.synthetic('else'), inverse, inverse.loc));
      }

      return new InvokeBlock({
        loc: loc,
        blocks: this.namedBlocks(blocks, blocksLoc),
        callee: call.callee,
        args: call.args
      });
    };

    _proto.element = function element(options) {
      return new BuildElement(options);
    };

    return Builder;
  }();
  var BuildElement = /*#__PURE__*/function () {
    function BuildElement(base) {
      this.base = base;
      this.builder = new Builder();
    }

    var _proto2 = BuildElement.prototype;

    _proto2.simple = function simple(tag, body, loc) {
      return new SimpleElement(util.assign({
        tag: tag,
        body: body,
        componentArgs: [],
        loc: loc
      }, this.base));
    };

    _proto2.named = function named(name, block, loc) {
      return new NamedBlock(util.assign({
        name: name,
        block: block,
        componentArgs: [],
        loc: loc
      }, this.base));
    };

    _proto2.selfClosingComponent = function selfClosingComponent(callee, loc) {
      return new InvokeComponent(util.assign({
        loc: loc,
        callee: callee,
        // point the empty named blocks at the `/` self-closing tag
        blocks: new NamedBlocks({
          blocks: [],
          loc: loc.sliceEndChars({
            skipEnd: 1,
            chars: 1
          })
        })
      }, this.base));
    };

    _proto2.componentWithDefaultBlock = function componentWithDefaultBlock(callee, children, symbols, loc) {
      var block = this.builder.block(symbols, children, loc);
      var namedBlock = this.builder.namedBlock(SourceSlice.synthetic('default'), block, loc); // BUILDER.simpleNamedBlock('default', children, symbols, loc);

      return new InvokeComponent(util.assign({
        loc: loc,
        callee: callee,
        blocks: this.builder.namedBlocks([namedBlock], namedBlock.loc)
      }, this.base));
    };

    _proto2.componentWithNamedBlocks = function componentWithNamedBlocks(callee, blocks, loc) {
      return new InvokeComponent(util.assign({
        loc: loc,
        callee: callee,
        blocks: this.builder.namedBlocks(blocks, SpanList.range(blocks))
      }, this.base));
    };

    return BuildElement;
  }();

  function SexpSyntaxContext(node) {
    if (isSimpleCallee(node)) {
      return LooseModeResolution.namespaced("Helper"
      /* Helper */
      );
    } else {
      return null;
    }
  }
  function ModifierSyntaxContext(node) {
    if (isSimpleCallee(node)) {
      return LooseModeResolution.namespaced("Modifier"
      /* Modifier */
      );
    } else {
      return null;
    }
  }
  function BlockSyntaxContext(node) {
    if (isSimpleCallee(node)) {
      return LooseModeResolution.namespaced("Component"
      /* Component */
      );
    } else {
      return LooseModeResolution.fallback();
    }
  }
  function ComponentSyntaxContext(node) {
    if (isSimplePath(node)) {
      return LooseModeResolution.namespaced("Component"
      /* Component */
      , true);
    } else {
      return null;
    }
  }
  /**
   * This corresponds to append positions (text curlies or attribute
   * curlies). In strict mode, this also corresponds to arg curlies.
   */

  function AttrValueSyntaxContext(node) {
    var isSimple = isSimpleCallee(node);
    var isInvoke = isInvokeNode(node);

    if (isSimple) {
      return isInvoke ? LooseModeResolution.namespaced("Helper"
      /* Helper */
      ) : LooseModeResolution.attr();
    } else {
      return isInvoke ? STRICT_RESOLUTION : LooseModeResolution.fallback();
    }
  }
  /**
   * This corresponds to append positions (text curlies or attribute
   * curlies). In strict mode, this also corresponds to arg curlies.
   */

  function AppendSyntaxContext(node) {
    var isSimple = isSimpleCallee(node);
    var isInvoke = isInvokeNode(node);
    var trusting = node.trusting;

    if (isSimple) {
      return trusting ? LooseModeResolution.trustingAppend({
        invoke: isInvoke
      }) : LooseModeResolution.append({
        invoke: isInvoke
      });
    } else {
      return LooseModeResolution.fallback();
    }
  } // UTILITIES

  /**
   * A call node has a simple callee if its head is:
   *
   * - a `PathExpression`
   * - the `PathExpression`'s head is a `VarHead`
   * - it has no tail
   *
   * Simple heads:
   *
   * ```
   * {{x}}
   * {{x y}}
   * ```
   *
   * Not simple heads:
   *
   * ```
   * {{x.y}}
   * {{x.y z}}
   * {{@x}}
   * {{@x a}}
   * {{this}}
   * {{this a}}
   * ```
   */

  function isSimpleCallee(node) {
    var path = node.path;
    return isSimplePath(path);
  }

  function isSimplePath(node) {
    if (node.type === 'PathExpression' && node.head.type === 'VarHead') {
      return node.tail.length === 0;
    } else {
      return false;
    }
  }
  /**
   * The call expression has at least one argument.
   */


  function isInvokeNode(node) {
    return node.params.length > 0 || node.hash.pairs.length > 0;
  }

  function _inheritsLoose$9(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

  function _createForOfIteratorHelperLoose$2(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$2(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; return function () { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } it = o[Symbol.iterator](); return it.next.bind(it); }

  function _unsupportedIterableToArray$2(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$2(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$2(o, minLen); }

  function _arrayLikeToArray$2(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

  function _defineProperties$a(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

  function _createClass$a(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$a(Constructor.prototype, protoProps); if (staticProps) _defineProperties$a(Constructor, staticProps); return Constructor; }
  function normalize(source, options) {
    if (options === void 0) {
      options = {};
    }

    var _a;

    var ast = preprocess(source, options);
    var normalizeOptions = util.assign({
      strictMode: false,
      locals: []
    }, options);
    var top = SymbolTable.top(normalizeOptions.locals, (_a = // eslint-disable-next-line @typescript-eslint/unbound-method
    options.customizeComponentName) !== null && _a !== void 0 ? _a : function (name) {
      return name;
    });
    var block = new BlockContext(source, normalizeOptions, top);
    var normalizer = new StatementNormalizer(block);
    var astV2 = new TemplateChildren(block.loc(ast.loc), ast.body.map(function (b) {
      return normalizer.normalize(b);
    }), block).assertTemplate(top);
    var locals = top.getUsedTemplateLocals();
    return [astV2, locals];
  }
  /**
   * A `BlockContext` represents the block that a particular AST node is contained inside of.
   *
   * `BlockContext` is aware of template-wide options (such as strict mode), as well as the bindings
   * that are in-scope within that block.
   *
   * Concretely, it has the `PrecompileOptions` and current `SymbolTable`, and provides
   * facilities for working with those options.
   *
   * `BlockContext` is stateless.
   */

  var BlockContext = /*#__PURE__*/function () {
    function BlockContext(source, options, table) {
      this.source = source;
      this.options = options;
      this.table = table;
      this.builder = new Builder();
    }

    var _proto = BlockContext.prototype;

    _proto.loc = function loc(_loc) {
      return this.source.spanFor(_loc);
    };

    _proto.resolutionFor = function resolutionFor(node, resolution) {
      if (this.strict) {
        return {
          resolution: STRICT_RESOLUTION
        };
      }

      if (this.isFreeVar(node)) {
        var r = resolution(node);

        if (r === null) {
          return {
            resolution: 'error',
            path: printPath(node),
            head: printHead(node)
          };
        }

        return {
          resolution: r
        };
      } else {
        return {
          resolution: STRICT_RESOLUTION
        };
      }
    };

    _proto.isFreeVar = function isFreeVar(callee) {
      if (callee.type === 'PathExpression') {
        if (callee.head.type !== 'VarHead') {
          return false;
        }

        return !this.table.has(callee.head.name);
      } else if (callee.path.type === 'PathExpression') {
        return this.isFreeVar(callee.path);
      } else {
        return false;
      }
    };

    _proto.hasBinding = function hasBinding(name) {
      return this.table.has(name);
    };

    _proto.child = function child(blockParams) {
      return new BlockContext(this.source, this.options, this.table.child(blockParams));
    };

    _proto.customizeComponentName = function customizeComponentName(input) {
      if (this.options.customizeComponentName) {
        return this.options.customizeComponentName(input);
      } else {
        return input;
      }
    };

    _createClass$a(BlockContext, [{
      key: "strict",
      get: function get() {
        return this.options.strictMode || false;
      }
    }]);

    return BlockContext;
  }();
  /**
   * An `ExpressionNormalizer` normalizes expressions within a block.
   *
   * `ExpressionNormalizer` is stateless.
   */

  var ExpressionNormalizer = /*#__PURE__*/function () {
    function ExpressionNormalizer(block) {
      this.block = block;
    }

    var _proto2 = ExpressionNormalizer.prototype;

    _proto2.normalize = function normalize(expr, resolution) {
      switch (expr.type) {
        case 'NullLiteral':
        case 'BooleanLiteral':
        case 'NumberLiteral':
        case 'StringLiteral':
        case 'UndefinedLiteral':
          return this.block.builder.literal(expr.value, this.block.loc(expr.loc));

        case 'PathExpression':
          return this.path(expr, resolution);

        case 'SubExpression':
          {
            var _resolution = this.block.resolutionFor(expr, SexpSyntaxContext);

            if (_resolution.resolution === 'error') {
              throw generateSyntaxError("You attempted to invoke a path (`" + _resolution.path + "`) but " + _resolution.head + " was not in scope", expr.loc);
            }

            return this.block.builder.sexp(this.callParts(expr, _resolution.resolution), this.block.loc(expr.loc));
          }
      }
    };

    _proto2.path = function path(expr, resolution) {
      var headOffsets = this.block.loc(expr.head.loc);
      var tail = []; // start with the head

      var offset = headOffsets;

      for (var _iterator = _createForOfIteratorHelperLoose$2(expr.tail), _step; !(_step = _iterator()).done;) {
        var part = _step.value;
        offset = offset.sliceStartChars({
          chars: part.length,
          skipStart: 1
        });
        tail.push(new SourceSlice({
          loc: offset,
          chars: part
        }));
      }

      return this.block.builder.path(this.ref(expr.head, resolution), tail, this.block.loc(expr.loc));
    }
    /**
     * The `callParts` method takes ASTv1.CallParts as well as a syntax context and normalizes
     * it to an ASTv2 CallParts.
     */
    ;

    _proto2.callParts = function callParts(parts, context) {
      var _this = this;

      var path = parts.path,
          params = parts.params,
          hash = parts.hash;
      var callee = this.normalize(path, context);
      var paramList = params.map(function (p) {
        return _this.normalize(p, ARGUMENT_RESOLUTION);
      });
      var paramLoc = SpanList.range(paramList, callee.loc.collapse('end'));
      var namedLoc = this.block.loc(hash.loc);
      var argsLoc = SpanList.range([paramLoc, namedLoc]);
      var positional = this.block.builder.positional(params.map(function (p) {
        return _this.normalize(p, ARGUMENT_RESOLUTION);
      }), paramLoc);
      var named = this.block.builder.named(hash.pairs.map(function (p) {
        return _this.namedArgument(p);
      }), this.block.loc(hash.loc));
      return {
        callee: callee,
        args: this.block.builder.args(positional, named, argsLoc)
      };
    };

    _proto2.namedArgument = function namedArgument(pair) {
      var offsets = this.block.loc(pair.loc);
      var keyOffsets = offsets.sliceStartChars({
        chars: pair.key.length
      });
      return this.block.builder.namedArgument(new SourceSlice({
        chars: pair.key,
        loc: keyOffsets
      }), this.normalize(pair.value, ARGUMENT_RESOLUTION));
    }
    /**
     * The `ref` method normalizes an `ASTv1.PathHead` into an `ASTv2.VariableReference`.
     * This method is extremely important, because it is responsible for normalizing free
     * variables into an an ASTv2.PathHead *with appropriate context*.
     *
     * The syntax context is originally determined by the syntactic position that this `PathHead`
     * came from, and is ultimately attached to the `ASTv2.VariableReference` here. In ASTv2,
     * the `VariableReference` node bears full responsibility for loose mode rules that control
     * the behavior of free variables.
     */
    ;

    _proto2.ref = function ref(head, resolution) {
      var block = this.block;
      var builder = block.builder,
          table = block.table;
      var offsets = block.loc(head.loc);

      switch (head.type) {
        case 'ThisHead':
          return builder.self(offsets);

        case 'AtHead':
          {
            var symbol = table.allocateNamed(head.name);
            return builder.at(head.name, symbol, offsets);
          }

        case 'VarHead':
          {
            if (block.hasBinding(head.name)) {
              var _table$get = table.get(head.name),
                  _symbol = _table$get[0],
                  isRoot = _table$get[1];

              return block.builder.localVar(head.name, _symbol, isRoot, offsets);
            } else {
              var context = block.strict ? STRICT_RESOLUTION : resolution;

              var _symbol2 = block.table.allocateFree(head.name, context);

              return block.builder.freeVar({
                name: head.name,
                context: context,
                symbol: _symbol2,
                loc: offsets
              });
            }
          }
      }
    };

    return ExpressionNormalizer;
  }();
  /**
   * `TemplateNormalizer` normalizes top-level ASTv1 statements to ASTv2.
   */


  var StatementNormalizer = /*#__PURE__*/function () {
    function StatementNormalizer(block) {
      this.block = block;
    }

    var _proto3 = StatementNormalizer.prototype;

    _proto3.normalize = function normalize(node) {
      switch (node.type) {
        case 'PartialStatement':
          throw new Error("Handlebars partial syntax ({{> ...}}) is not allowed in Glimmer");

        case 'BlockStatement':
          return this.BlockStatement(node);

        case 'ElementNode':
          return new ElementNormalizer(this.block).ElementNode(node);

        case 'MustacheStatement':
          return this.MustacheStatement(node);
        // These are the same in ASTv2

        case 'MustacheCommentStatement':
          return this.MustacheCommentStatement(node);

        case 'CommentStatement':
          {
            var loc = this.block.loc(node.loc);
            return new HtmlComment({
              loc: loc,
              text: loc.slice({
                skipStart: 4,
                skipEnd: 3
              }).toSlice(node.value)
            });
          }

        case 'TextNode':
          return new HtmlText({
            loc: this.block.loc(node.loc),
            chars: node.chars
          });
      }
    };

    _proto3.MustacheCommentStatement = function MustacheCommentStatement(node) {
      var loc = this.block.loc(node.loc);
      var textLoc;

      if (loc.asString().slice(0, 5) === '{{!--') {
        textLoc = loc.slice({
          skipStart: 5,
          skipEnd: 4
        });
      } else {
        textLoc = loc.slice({
          skipStart: 3,
          skipEnd: 2
        });
      }

      return new GlimmerComment({
        loc: loc,
        text: textLoc.toSlice(node.value)
      });
    }
    /**
     * Normalizes an ASTv1.MustacheStatement to an ASTv2.AppendStatement
     */
    ;

    _proto3.MustacheStatement = function MustacheStatement(mustache) {
      var escaped = mustache.escaped;
      var loc = this.block.loc(mustache.loc); // Normalize the call parts in AppendSyntaxContext

      var callParts = this.expr.callParts({
        path: mustache.path,
        params: mustache.params,
        hash: mustache.hash
      }, AppendSyntaxContext(mustache));
      var value = callParts.args.isEmpty() ? callParts.callee : this.block.builder.sexp(callParts, loc);
      return this.block.builder.append({
        table: this.block.table,
        trusting: !escaped,
        value: value
      }, loc);
    }
    /**
     * Normalizes a ASTv1.BlockStatement to an ASTv2.BlockStatement
     */
    ;

    _proto3.BlockStatement = function BlockStatement(block) {
      var program = block.program,
          inverse = block.inverse;
      var loc = this.block.loc(block.loc);
      var resolution = this.block.resolutionFor(block, BlockSyntaxContext);

      if (resolution.resolution === 'error') {
        throw generateSyntaxError("You attempted to invoke a path (`{{#" + resolution.path + "}}`) but " + resolution.head + " was not in scope", loc);
      }

      var callParts = this.expr.callParts(block, resolution.resolution);
      return this.block.builder.blockStatement(util.assign({
        symbols: this.block.table,
        program: this.Block(program),
        inverse: inverse ? this.Block(inverse) : null
      }, callParts), loc);
    };

    _proto3.Block = function Block(_ref) {
      var body = _ref.body,
          loc = _ref.loc,
          blockParams = _ref.blockParams;
      var child = this.block.child(blockParams);
      var normalizer = new StatementNormalizer(child);
      return new BlockChildren(this.block.loc(loc), body.map(function (b) {
        return normalizer.normalize(b);
      }), this.block).assertBlock(child.table);
    };

    _createClass$a(StatementNormalizer, [{
      key: "expr",
      get: function get() {
        return new ExpressionNormalizer(this.block);
      }
    }]);

    return StatementNormalizer;
  }();

  var ElementNormalizer = /*#__PURE__*/function () {
    function ElementNormalizer(ctx) {
      this.ctx = ctx;
    }
    /**
     * Normalizes an ASTv1.ElementNode to:
     *
     * - ASTv2.NamedBlock if the tag name begins with `:`
     * - ASTv2.Component if the tag name matches the component heuristics
     * - ASTv2.SimpleElement if the tag name doesn't match the component heuristics
     *
     * A tag name represents a component if:
     *
     * - it begins with `@`
     * - it is exactly `this` or begins with `this.`
     * - the part before the first `.` is a reference to an in-scope variable binding
     * - it begins with an uppercase character
     */


    var _proto4 = ElementNormalizer.prototype;

    _proto4.ElementNode = function ElementNode(element) {
      var _this2 = this;

      var tag = element.tag,
          selfClosing = element.selfClosing,
          comments = element.comments;
      var loc = this.ctx.loc(element.loc);

      var _tag$split = tag.split('.'),
          tagHead = _tag$split[0],
          rest = _tag$split.slice(1); // the head, attributes and modifiers are in the current scope


      var path = this.classifyTag(tagHead, rest, element.loc);
      var attrs = element.attributes.filter(function (a) {
        return a.name[0] !== '@';
      }).map(function (a) {
        return _this2.attr(a);
      });
      var args = element.attributes.filter(function (a) {
        return a.name[0] === '@';
      }).map(function (a) {
        return _this2.arg(a);
      });
      var modifiers = element.modifiers.map(function (m) {
        return _this2.modifier(m);
      }); // the element's block params are in scope for the children

      var child = this.ctx.child(element.blockParams);
      var normalizer = new StatementNormalizer(child);
      var childNodes = element.children.map(function (s) {
        return normalizer.normalize(s);
      });
      var el = this.ctx.builder.element({
        selfClosing: selfClosing,
        attrs: attrs,
        componentArgs: args,
        modifiers: modifiers,
        comments: comments.map(function (c) {
          return new StatementNormalizer(_this2.ctx).MustacheCommentStatement(c);
        })
      });
      var children = new ElementChildren(el, loc, childNodes, this.ctx);
      var offsets = this.ctx.loc(element.loc);
      var tagOffsets = offsets.sliceStartChars({
        chars: tag.length,
        skipStart: 1
      });

      if (path === 'ElementHead') {
        if (tag[0] === ':') {
          return children.assertNamedBlock(tagOffsets.slice({
            skipStart: 1
          }).toSlice(tag.slice(1)), child.table);
        } else {
          return children.assertElement(tagOffsets.toSlice(tag), element.blockParams.length > 0);
        }
      }

      if (element.selfClosing) {
        return el.selfClosingComponent(path, loc);
      } else {
        var blocks = children.assertComponent(tag, child.table, element.blockParams.length > 0);
        return el.componentWithNamedBlocks(path, blocks, loc);
      }
    };

    _proto4.modifier = function modifier(m) {
      var resolution = this.ctx.resolutionFor(m, ModifierSyntaxContext);

      if (resolution.resolution === 'error') {
        throw generateSyntaxError("You attempted to invoke a path (`{{#" + resolution.path + "}}`) as a modifier, but " + resolution.head + " was not in scope. Try adding `this` to the beginning of the path", m.loc);
      }

      var callParts = this.expr.callParts(m, resolution.resolution);
      return this.ctx.builder.modifier(callParts, this.ctx.loc(m.loc));
    }
    /**
     * This method handles attribute values that are curlies, as well as curlies nested inside of
     * interpolations:
     *
     * ```hbs
     * <a href={{url}} />
     * <a href="{{url}}.html" />
     * ```
     */
    ;

    _proto4.mustacheAttr = function mustacheAttr(mustache) {
      // Normalize the call parts in AttrValueSyntaxContext
      var sexp = this.ctx.builder.sexp(this.expr.callParts(mustache, AttrValueSyntaxContext(mustache)), this.ctx.loc(mustache.loc)); // If there are no params or hash, just return the function part as its own expression

      if (sexp.args.isEmpty()) {
        return sexp.callee;
      } else {
        return sexp;
      }
    }
    /**
     * attrPart is the narrowed down list of valid attribute values that are also
     * allowed as a concat part (you can't nest concats).
     */
    ;

    _proto4.attrPart = function attrPart(part) {
      switch (part.type) {
        case 'MustacheStatement':
          return {
            expr: this.mustacheAttr(part),
            trusting: !part.escaped
          };

        case 'TextNode':
          return {
            expr: this.ctx.builder.literal(part.chars, this.ctx.loc(part.loc)),
            trusting: true
          };
      }
    };

    _proto4.attrValue = function attrValue(part) {
      var _this3 = this;

      switch (part.type) {
        case 'ConcatStatement':
          {
            var parts = part.parts.map(function (p) {
              return _this3.attrPart(p).expr;
            });
            return {
              expr: this.ctx.builder.interpolate(parts, this.ctx.loc(part.loc)),
              trusting: false
            };
          }

        default:
          return this.attrPart(part);
      }
    };

    _proto4.attr = function attr(m) {

      if (m.name === '...attributes') {
        return this.ctx.builder.splatAttr(this.ctx.table.allocateBlock('attrs'), this.ctx.loc(m.loc));
      }

      var offsets = this.ctx.loc(m.loc);
      var nameSlice = offsets.sliceStartChars({
        chars: m.name.length
      }).toSlice(m.name);
      var value = this.attrValue(m.value);
      return this.ctx.builder.attr({
        name: nameSlice,
        value: value.expr,
        trusting: value.trusting
      }, offsets);
    };

    _proto4.maybeDeprecatedCall = function maybeDeprecatedCall(arg, part) {
      if (this.ctx.strict) {
        return null;
      }

      if (part.type !== 'MustacheStatement') {
        return null;
      }

      var path = part.path;

      if (path.type !== 'PathExpression') {
        return null;
      }

      if (path.head.type !== 'VarHead') {
        return null;
      }

      var name = path.head.name;

      if (name === 'has-block' || name === 'has-block-params') {
        return null;
      }

      if (this.ctx.hasBinding(name)) {
        return null;
      }

      if (path.tail.length !== 0) {
        return null;
      }

      if (part.params.length !== 0 || part.hash.pairs.length !== 0) {
        return null;
      }

      var context = LooseModeResolution.attr();
      var callee = this.ctx.builder.freeVar({
        name: name,
        context: context,
        symbol: this.ctx.table.allocateFree(name, context),
        loc: path.loc
      });
      return {
        expr: this.ctx.builder.deprecatedCall(arg, callee, part.loc),
        trusting: false
      };
    };

    _proto4.arg = function arg(_arg) {
      var offsets = this.ctx.loc(_arg.loc);
      var nameSlice = offsets.sliceStartChars({
        chars: _arg.name.length
      }).toSlice(_arg.name);
      var value = this.maybeDeprecatedCall(nameSlice, _arg.value) || this.attrValue(_arg.value);
      return this.ctx.builder.arg({
        name: nameSlice,
        value: value.expr,
        trusting: value.trusting
      }, offsets);
    }
    /**
     * This function classifies the head of an ASTv1.Element into an ASTv2.PathHead (if the
     * element is a component) or `'ElementHead'` (if the element is a simple element).
     *
     * Rules:
     *
     * 1. If the variable is an `@arg`, return an `AtHead`
     * 2. If the variable is `this`, return a `ThisHead`
     * 3. If the variable is in the current scope:
     *   a. If the scope is the root scope, then return a Free `LocalVarHead`
     *   b. Else, return a standard `LocalVarHead`
     * 4. If the tag name is a path and the variable is not in the current scope, Syntax Error
     * 5. If the variable is uppercase return a FreeVar(ResolveAsComponentHead)
     * 6. Otherwise, return `'ElementHead'`
     */
    ;

    _proto4.classifyTag = function classifyTag(variable, tail, loc) {
      var uppercase = isUpperCase(variable);
      var inScope = variable[0] === '@' || variable === 'this' || this.ctx.hasBinding(variable);

      if (this.ctx.strict && !inScope) {
        if (uppercase) {
          throw generateSyntaxError("Attempted to invoke a component that was not in scope in a strict mode template, `<" + variable + ">`. If you wanted to create an element with that name, convert it to lowercase - `<" + variable.toLowerCase() + ">`", loc);
        } // In strict mode, values are always elements unless they are in scope


        return 'ElementHead';
      } // Since the parser handed us the HTML element name as a string, we need
      // to convert it into an ASTv1 path so it can be processed using the
      // expression normalizer.


      var isComponent = inScope || uppercase;
      var variableLoc = loc.sliceStartChars({
        skipStart: 1,
        chars: variable.length
      });
      var tailLength = tail.reduce(function (accum, part) {
        return accum + 1 + part.length;
      }, 0);
      var pathEnd = variableLoc.getEnd().move(tailLength);
      var pathLoc = variableLoc.withEnd(pathEnd);

      if (isComponent) {
        var path = b.path({
          head: b.head(variable, variableLoc),
          tail: tail,
          loc: pathLoc
        });
        var resolution = this.ctx.resolutionFor(path, ComponentSyntaxContext);

        if (resolution.resolution === 'error') {
          throw generateSyntaxError("You attempted to invoke a path (`<" + resolution.path + ">`) but " + resolution.head + " was not in scope", loc);
        }

        return new ExpressionNormalizer(this.ctx).normalize(path, resolution.resolution);
      } // If the tag name wasn't a valid component but contained a `.`, it's
      // a syntax error.


      if (tail.length > 0) {
        throw generateSyntaxError("You used " + variable + "." + tail.join('.') + " as a tag name, but " + variable + " is not in scope", loc);
      }

      return 'ElementHead';
    };

    _createClass$a(ElementNormalizer, [{
      key: "expr",
      get: function get() {
        return new ExpressionNormalizer(this.ctx);
      }
    }]);

    return ElementNormalizer;
  }();

  var Children = function Children(loc, children, block) {
    this.loc = loc;
    this.children = children;
    this.block = block;
    this.namedBlocks = children.filter(function (c) {
      return c instanceof NamedBlock;
    });
    this.hasSemanticContent = Boolean(children.filter(function (c) {
      if (c instanceof NamedBlock) {
        return false;
      }

      switch (c.type) {
        case 'GlimmerComment':
        case 'HtmlComment':
          return false;

        case 'HtmlText':
          return !/^\s*$/.exec(c.chars);

        default:
          return true;
      }
    }).length);
    this.nonBlockChildren = children.filter(function (c) {
      return !(c instanceof NamedBlock);
    });
  };

  var TemplateChildren = /*#__PURE__*/function (_Children) {
    _inheritsLoose$9(TemplateChildren, _Children);

    function TemplateChildren() {
      return _Children.apply(this, arguments) || this;
    }

    var _proto5 = TemplateChildren.prototype;

    _proto5.assertTemplate = function assertTemplate(table) {
      if (util.isPresent(this.namedBlocks)) {
        throw generateSyntaxError("Unexpected named block at the top-level of a template", this.loc);
      }

      return this.block.builder.template(table, this.nonBlockChildren, this.block.loc(this.loc));
    };

    return TemplateChildren;
  }(Children);

  var BlockChildren = /*#__PURE__*/function (_Children2) {
    _inheritsLoose$9(BlockChildren, _Children2);

    function BlockChildren() {
      return _Children2.apply(this, arguments) || this;
    }

    var _proto6 = BlockChildren.prototype;

    _proto6.assertBlock = function assertBlock(table) {
      if (util.isPresent(this.namedBlocks)) {
        throw generateSyntaxError("Unexpected named block nested in a normal block", this.loc);
      }

      return this.block.builder.block(table, this.nonBlockChildren, this.loc);
    };

    return BlockChildren;
  }(Children);

  var ElementChildren = /*#__PURE__*/function (_Children3) {
    _inheritsLoose$9(ElementChildren, _Children3);

    function ElementChildren(el, loc, children, block) {
      var _this4;

      _this4 = _Children3.call(this, loc, children, block) || this;
      _this4.el = el;
      return _this4;
    }

    var _proto7 = ElementChildren.prototype;

    _proto7.assertNamedBlock = function assertNamedBlock(name, table) {
      if (this.el.base.selfClosing) {
        throw generateSyntaxError("<:" + name.chars + "/> is not a valid named block: named blocks cannot be self-closing", this.loc);
      }

      if (util.isPresent(this.namedBlocks)) {
        throw generateSyntaxError("Unexpected named block inside <:" + name.chars + "> named block: named blocks cannot contain nested named blocks", this.loc);
      }

      if (!isLowerCase(name.chars)) {
        throw generateSyntaxError("<:" + name.chars + "> is not a valid named block, and named blocks must begin with a lowercase letter", this.loc);
      }

      if (this.el.base.attrs.length > 0 || this.el.base.componentArgs.length > 0 || this.el.base.modifiers.length > 0) {
        throw generateSyntaxError("named block <:" + name.chars + "> cannot have attributes, arguments, or modifiers", this.loc);
      }

      var offsets = SpanList.range(this.nonBlockChildren, this.loc);
      return this.block.builder.namedBlock(name, this.block.builder.block(table, this.nonBlockChildren, offsets), this.loc);
    };

    _proto7.assertElement = function assertElement(name, hasBlockParams) {
      if (hasBlockParams) {
        throw generateSyntaxError("Unexpected block params in <" + name + ">: simple elements cannot have block params", this.loc);
      }

      if (util.isPresent(this.namedBlocks)) {
        var names = this.namedBlocks.map(function (b) {
          return b.name;
        });

        if (names.length === 1) {
          throw generateSyntaxError("Unexpected named block <:foo> inside <" + name.chars + "> HTML element", this.loc);
        } else {
          var printedNames = names.map(function (n) {
            return "<:" + n.chars + ">";
          }).join(', ');
          throw generateSyntaxError("Unexpected named blocks inside <" + name.chars + "> HTML element (" + printedNames + ")", this.loc);
        }
      }

      return this.el.simple(name, this.nonBlockChildren, this.loc);
    };

    _proto7.assertComponent = function assertComponent(name, table, hasBlockParams) {
      if (util.isPresent(this.namedBlocks) && this.hasSemanticContent) {
        throw generateSyntaxError("Unexpected content inside <" + name + "> component invocation: when using named blocks, the tag cannot contain other content", this.loc);
      }

      if (util.isPresent(this.namedBlocks)) {
        if (hasBlockParams) {
          throw generateSyntaxError("Unexpected block params list on <" + name + "> component invocation: when passing named blocks, the invocation tag cannot take block params", this.loc);
        }

        var seenNames = new Set();

        for (var _iterator2 = _createForOfIteratorHelperLoose$2(this.namedBlocks), _step2; !(_step2 = _iterator2()).done;) {
          var block = _step2.value;
          var _name = block.name.chars;

          if (seenNames.has(_name)) {
            throw generateSyntaxError("Component had two named blocks with the same name, `<:" + _name + ">`. Only one block with a given name may be passed", this.loc);
          }

          if (_name === 'inverse' && seenNames.has('else') || _name === 'else' && seenNames.has('inverse')) {
            throw generateSyntaxError("Component has both <:else> and <:inverse> block. <:inverse> is an alias for <:else>", this.loc);
          }

          seenNames.add(_name);
        }

        return this.namedBlocks;
      } else {
        return [this.block.builder.namedBlock(SourceSlice.synthetic('default'), this.block.builder.block(table, this.nonBlockChildren, this.loc), this.loc)];
      }
    };

    return ElementChildren;
  }(Children);

  function printPath(node) {
    if (node.type !== 'PathExpression' && node.path.type === 'PathExpression') {
      return printPath(node.path);
    } else {
      return new Printer({
        entityEncoding: 'raw'
      }).print(node);
    }
  }

  function printHead(node) {
    if (node.type === 'PathExpression') {
      switch (node.head.type) {
        case 'AtHead':
        case 'VarHead':
          return node.head.name;

        case 'ThisHead':
          return 'this';
      }
    } else if (node.path.type === 'PathExpression') {
      return printHead(node.path);
    } else {
      return new Printer({
        entityEncoding: 'raw'
      }).print(node);
    }
  }

  function isKeyword(word) {
    return word in KEYWORDS_TYPES;
  }
  /**
   * This includes the full list of keywords currently in use in the template
   * language, and where their valid usages are.
   */

  var KEYWORDS_TYPES = {
    component: ['Call', 'Append', 'Block'],
    "debugger": ['Append'],
    'each-in': ['Block'],
    each: ['Block'],
    'has-block-params': ['Call', 'Append'],
    'has-block': ['Call', 'Append'],
    helper: ['Call', 'Append'],
    "if": ['Call', 'Append', 'Block'],
    'in-element': ['Block'],
    "let": ['Block'],
    'link-to': ['Append', 'Block'],
    log: ['Call', 'Append'],
    modifier: ['Call'],
    mount: ['Append'],
    mut: ['Call', 'Append'],
    outlet: ['Append'],
    'query-params': ['Call'],
    readonly: ['Call', 'Append'],
    unbound: ['Call', 'Append'],
    unless: ['Call', 'Append', 'Block'],
    "with": ['Block'],
    "yield": ['Append']
  };

  /**
   * Gets the correct Token from the Node based on it's type
   */

  function tokensFromType(node, scopedTokens, options) {
    if (node.type === 'PathExpression') {
      if (node.head.type === 'AtHead' || node.head.type === 'ThisHead') {
        return;
      }

      var possbleToken = node.head.name;

      if (scopedTokens.indexOf(possbleToken) === -1) {
        return possbleToken;
      }
    } else if (node.type === 'ElementNode') {
      var tag = node.tag;

      var _char = tag.charAt(0);

      if (_char === ':' || _char === '@') {
        return;
      }

      if (!options.includeHtmlElements && tag.indexOf('.') === -1 && tag.toLowerCase() === tag) {
        return;
      }

      if (tag.substr(0, 5) === 'this.') {
        return;
      }

      if (scopedTokens.indexOf(tag) !== -1) {
        return;
      }

      return tag;
    }
  }
  /**
   * Adds tokens to the tokensSet based on their node.type
   */


  function addTokens(tokensSet, node, scopedTokens, options) {
    var maybeTokens = tokensFromType(node, scopedTokens, options);
    (Array.isArray(maybeTokens) ? maybeTokens : [maybeTokens]).forEach(function (maybeToken) {
      if (maybeToken !== undefined && maybeToken[0] !== '@') {
        var maybeTokenFirstSegment = maybeToken.split('.')[0];

        if (!scopedTokens.includes(maybeTokenFirstSegment)) {
          tokensSet.add(maybeToken.split('.')[0]);
        }
      }
    });
  }
  /**
   * Parses and traverses a given handlebars html template to extract all template locals
   * referenced that could possible come from the parent scope. Can exclude known keywords
   * optionally.
   */


  function getTemplateLocals(html, options) {
    if (options === void 0) {
      options = {
        includeHtmlElements: false,
        includeKeywords: false
      };
    }

    var ast = preprocess(html);
    var tokensSet = new Set();
    var scopedTokens = [];
    traverse(ast, {
      Block: {
        enter: function enter(_ref) {
          var blockParams = _ref.blockParams;
          blockParams.forEach(function (param) {
            scopedTokens.push(param);
          });
        },
        exit: function exit(_ref2) {
          var blockParams = _ref2.blockParams;
          blockParams.forEach(function () {
            scopedTokens.pop();
          });
        }
      },
      ElementNode: {
        enter: function enter(node) {
          node.blockParams.forEach(function (param) {
            scopedTokens.push(param);
          });
          addTokens(tokensSet, node, scopedTokens, options);
        },
        exit: function exit(_ref3) {
          var blockParams = _ref3.blockParams;
          blockParams.forEach(function () {
            scopedTokens.pop();
          });
        }
      },
      PathExpression: function PathExpression(node) {
        addTokens(tokensSet, node, scopedTokens, options);
      }
    });
    var tokens = [];
    tokensSet.forEach(function (s) {
      return tokens.push(s);
    });

    if (!(options === null || options === void 0 ? void 0 : options.includeKeywords)) {
      tokens = tokens.filter(function (token) {
        return !isKeyword(token);
      });
    }

    return tokens;
  }

  exports.AST = api;
  exports.ASTv1 = api;
  exports.ASTv2 = api$1;
  exports.BlockSymbolTable = BlockSymbolTable;
  exports.KEYWORDS_TYPES = KEYWORDS_TYPES;
  exports.Path = Walker;
  exports.ProgramSymbolTable = ProgramSymbolTable;
  exports.Source = Source;
  exports.SourceSlice = SourceSlice;
  exports.SourceSpan = SourceSpan;
  exports.SpanList = SpanList;
  exports.SymbolTable = SymbolTable;
  exports.Walker = Walker;
  exports.WalkerPath = WalkerPath;
  exports.builders = publicBuilder;
  exports.cannotRemoveNode = cannotRemoveNode;
  exports.cannotReplaceNode = cannotReplaceNode;
  exports.generateSyntaxError = generateSyntaxError;
  exports.getTemplateLocals = getTemplateLocals;
  exports.hasSpan = hasSpan;
  exports.isKeyword = isKeyword;
  exports.loc = loc;
  exports.maybeLoc = maybeLoc;
  exports.node = node;
  exports.normalize = normalize;
  exports.preprocess = preprocess;
  exports.print = build;
  exports.sortByLoc = sortByLoc;
  exports.traverse = traverse;

  Object.defineProperty(exports, '__esModule', { value: true });

});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xpbW1lci1zeW50YXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvc291cmNlL2xvY2F0aW9uLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi9zb3VyY2Uvc2xpY2UudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3NvdXJjZS9sb2MvbWF0Y2gudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3NvdXJjZS9sb2Mvb2Zmc2V0LnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi9zb3VyY2UvbG9jL3NwYW4udHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3NvdXJjZS9zb3VyY2UudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3YxL2xlZ2FjeS1pbnRlcm9wLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi92MS9wdWJsaWMtYnVpbGRlcnMudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3YyLWEvb2JqZWN0cy9yZXNvbHV0aW9uLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi92Mi1hL29iamVjdHMvbm9kZS50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvdjItYS9vYmplY3RzL2FyZ3MudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3YyLWEvb2JqZWN0cy9hdHRyLWJsb2NrLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi9zb3VyY2Uvc3Bhbi1saXN0LnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi92Mi1hL29iamVjdHMvY29udGVudC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvdjItYS9vYmplY3RzL2V4cHIudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3YyLWEvb2JqZWN0cy9yZWZzLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi92Mi1hL29iamVjdHMvaW50ZXJuYWwtbm9kZS50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvZ2VuZXJhdGlvbi91dGlsLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi9nZW5lcmF0aW9uL3ByaW50ZXIudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL2dlbmVyYXRpb24vcHJpbnQudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3N5bnRheC1lcnJvci50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvdjEvdmlzaXRvci1rZXlzLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi90cmF2ZXJzYWwvZXJyb3JzLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi90cmF2ZXJzYWwvcGF0aC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvdHJhdmVyc2FsL3RyYXZlcnNlLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi90cmF2ZXJzYWwvd2Fsa2VyLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi91dGlscy50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvdjEvcGFyc2VyLWJ1aWxkZXJzLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi9wYXJzZXIudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3BhcnNlci9oYW5kbGViYXJzLW5vZGUtdmlzaXRvcnMudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3BhcnNlci90b2tlbml6ZXItZXZlbnQtaGFuZGxlcnMudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL3N5bWJvbC10YWJsZS50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvdjItYS9idWlsZGVycy50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIvdjItYS9sb29zZS1yZXNvbHV0aW9uLnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvQGdsaW1tZXIvc3ludGF4L2xpYi92Mi1hL25vcm1hbGl6ZS50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3N5bnRheC9saWIva2V5d29yZHMudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9AZ2xpbW1lci9zeW50YXgvbGliL2dldC10ZW1wbGF0ZS1sb2NhbHMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHJlc2VudEFycmF5IH0gZnJvbSAnQGdsaW1tZXIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBpc1ByZXNlbnQgfSBmcm9tICdAZ2xpbW1lci91dGlsJztcblxuaW1wb3J0IHsgU291cmNlU3BhbiB9IGZyb20gJy4vc3Bhbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU291cmNlTG9jYXRpb24ge1xuICBzdGFydDogU291cmNlUG9zaXRpb247XG4gIGVuZDogU291cmNlUG9zaXRpb247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU291cmNlUG9zaXRpb24ge1xuICAvKiogPj0gMSAqL1xuICBsaW5lOiBudW1iZXI7XG4gIC8qKiA+PSAwICovXG4gIGNvbHVtbjogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgVU5LTk9XTl9QT1NJVElPTiA9IE9iamVjdC5mcmVlemUoe1xuICBsaW5lOiAxLFxuICBjb2x1bW46IDAsXG59IGFzIGNvbnN0KTtcblxuZXhwb3J0IGNvbnN0IFNZTlRIRVRJQ19MT0NBVElPTiA9IE9iamVjdC5mcmVlemUoe1xuICBzb3VyY2U6ICcoc3ludGhldGljKScsXG4gIHN0YXJ0OiBVTktOT1dOX1BPU0lUSU9OLFxuICBlbmQ6IFVOS05PV05fUE9TSVRJT04sXG59IGFzIGNvbnN0KTtcblxuLyoqIEBkZXByZWNhdGVkICovXG5leHBvcnQgY29uc3QgU1lOVEhFVElDID0gU1lOVEhFVElDX0xPQ0FUSU9OO1xuXG5leHBvcnQgY29uc3QgVEVNUE9SQVJZX0xPQ0FUSU9OID0gT2JqZWN0LmZyZWV6ZSh7XG4gIHNvdXJjZTogJyh0ZW1wb3JhcnkpJyxcbiAgc3RhcnQ6IFVOS05PV05fUE9TSVRJT04sXG4gIGVuZDogVU5LTk9XTl9QT1NJVElPTixcbn0gYXMgY29uc3QpO1xuXG5leHBvcnQgY29uc3QgTk9OX0VYSVNURU5UX0xPQ0FUSU9OID0gT2JqZWN0LmZyZWV6ZSh7XG4gIHNvdXJjZTogJyhub25leGlzdGVudCknLFxuICBzdGFydDogVU5LTk9XTl9QT1NJVElPTixcbiAgZW5kOiBVTktOT1dOX1BPU0lUSU9OLFxufSBhcyBjb25zdCk7XG5cbmV4cG9ydCBjb25zdCBCUk9LRU5fTE9DQVRJT04gPSBPYmplY3QuZnJlZXplKHtcbiAgc291cmNlOiAnKGJyb2tlbiknLFxuICBzdGFydDogVU5LTk9XTl9QT1NJVElPTixcbiAgZW5kOiBVTktOT1dOX1BPU0lUSU9OLFxufSBhcyBjb25zdCk7XG5cbmV4cG9ydCB0eXBlIExvY2F0ZWRXaXRoU3BhbiA9IHsgb2Zmc2V0czogU291cmNlU3BhbiB9O1xuZXhwb3J0IHR5cGUgTG9jYXRlZFdpdGhPcHRpb25hbFNwYW4gPSB7IG9mZnNldHM6IFNvdXJjZVNwYW4gfCBudWxsIH07XG5cbmV4cG9ydCB0eXBlIExvY2F0ZWRXaXRoUG9zaXRpb25zID0geyBsb2M6IFNvdXJjZUxvY2F0aW9uIH07XG5leHBvcnQgdHlwZSBMb2NhdGVkV2l0aE9wdGlvbmFsUG9zaXRpb25zID0geyBsb2M/OiBTb3VyY2VMb2NhdGlvbiB9O1xuXG5leHBvcnQgZnVuY3Rpb24gaXNMb2NhdGVkV2l0aFBvc2l0aW9uc0FycmF5KFxuICBsb2NhdGlvbjogTG9jYXRlZFdpdGhPcHRpb25hbFBvc2l0aW9uc1tdXG4pOiBsb2NhdGlvbiBpcyBQcmVzZW50QXJyYXk8TG9jYXRlZFdpdGhQb3NpdGlvbnM+IHtcbiAgcmV0dXJuIGlzUHJlc2VudChsb2NhdGlvbikgJiYgbG9jYXRpb24uZXZlcnkoaXNMb2NhdGVkV2l0aFBvc2l0aW9ucyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0xvY2F0ZWRXaXRoUG9zaXRpb25zKFxuICBsb2NhdGlvbjogTG9jYXRlZFdpdGhPcHRpb25hbFBvc2l0aW9uc1xuKTogbG9jYXRpb24gaXMgTG9jYXRlZFdpdGhQb3NpdGlvbnMge1xuICByZXR1cm4gbG9jYXRpb24ubG9jICE9PSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCB0eXBlIEhhc1NvdXJjZUxvY2F0aW9uID1cbiAgfCBTb3VyY2VMb2NhdGlvblxuICB8IExvY2F0ZWRXaXRoUG9zaXRpb25zXG4gIHwgUHJlc2VudEFycmF5PExvY2F0ZWRXaXRoUG9zaXRpb25zPjtcblxuZXhwb3J0IHR5cGUgTWF5YmVIYXNTb3VyY2VMb2NhdGlvbiA9XG4gIHwgbnVsbFxuICB8IExvY2F0ZWRXaXRoT3B0aW9uYWxQb3NpdGlvbnNcbiAgfCBMb2NhdGVkV2l0aE9wdGlvbmFsUG9zaXRpb25zW107XG4iLCJpbXBvcnQgeyBTb3VyY2UgfSBmcm9tICcuL2luZGV4JztcbmltcG9ydCB7IFNlcmlhbGl6ZWRTb3VyY2VTcGFuLCBTb3VyY2VTcGFuIH0gZnJvbSAnLi9zcGFuJztcblxuZXhwb3J0IHR5cGUgU2VyaWFsaXplZFNvdXJjZVNsaWNlPENoYXJzIGV4dGVuZHMgc3RyaW5nID0gc3RyaW5nPiA9IFtcbiAgY2hhcnM6IENoYXJzLFxuICBzcGFuOiBTZXJpYWxpemVkU291cmNlU3BhblxuXTtcblxuZXhwb3J0IGNsYXNzIFNvdXJjZVNsaWNlPENoYXJzIGV4dGVuZHMgc3RyaW5nID0gc3RyaW5nPiB7XG4gIHN0YXRpYyBzeW50aGV0aWM8UyBleHRlbmRzIHN0cmluZz4oY2hhcnM6IFMpOiBTb3VyY2VTbGljZTxTPiB7XG4gICAgbGV0IG9mZnNldHMgPSBTb3VyY2VTcGFuLnN5bnRoZXRpYyhjaGFycyk7XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VTbGljZSh7IGxvYzogb2Zmc2V0cywgY2hhcnM6IGNoYXJzIH0pO1xuICB9XG5cbiAgc3RhdGljIGxvYWQoc291cmNlOiBTb3VyY2UsIHNsaWNlOiBTZXJpYWxpemVkU291cmNlU2xpY2UpOiBTb3VyY2VTbGljZSB7XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VTbGljZSh7XG4gICAgICBsb2M6IFNvdXJjZVNwYW4ubG9hZChzb3VyY2UsIHNsaWNlWzFdKSxcbiAgICAgIGNoYXJzOiBzbGljZVswXSxcbiAgICB9KTtcbiAgfVxuXG4gIHJlYWRvbmx5IGNoYXJzOiBDaGFycztcbiAgcmVhZG9ubHkgbG9jOiBTb3VyY2VTcGFuO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IHsgbG9jOiBTb3VyY2VTcGFuOyBjaGFyczogQ2hhcnMgfSkge1xuICAgIHRoaXMubG9jID0gb3B0aW9ucy5sb2M7XG4gICAgdGhpcy5jaGFycyA9IG9wdGlvbnMuY2hhcnM7XG4gIH1cblxuICBnZXRTdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5jaGFycztcbiAgfVxuXG4gIHNlcmlhbGl6ZSgpOiBTZXJpYWxpemVkU291cmNlU2xpY2U8Q2hhcnM+IHtcbiAgICByZXR1cm4gW3RoaXMuY2hhcnMsIHRoaXMubG9jLnNlcmlhbGl6ZSgpXTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgYXNzZXJ0LCBpc1ByZXNlbnQgfSBmcm9tICdAZ2xpbW1lci91dGlsJztcblxuaW1wb3J0IHsgQ2hhclBvc2l0aW9uLCBIYnNQb3NpdGlvbiwgSW52aXNpYmxlUG9zaXRpb24sIE9mZnNldEtpbmQsIFBvc2l0aW9uRGF0YSB9IGZyb20gJy4vb2Zmc2V0JztcblxuLyoqXG4gKiBUaGlzIGZpbGUgaW1wbGVtZW50cyB0aGUgRFNMIHVzZWQgYnkgc3BhbiBhbmQgb2Zmc2V0IGluIHBsYWNlcyB3aGVyZSB0aGV5IG5lZWQgdG8gZXhoYXVzdGl2ZWx5XG4gKiBjb25zaWRlciBhbGwgY29tYmluYXRpb25zIG9mIHN0YXRlcyAoSGFuZGxlYmFycyBvZmZzZXRzLCBjaGFyYWN0ZXIgb2Zmc2V0cyBhbmQgaW52aXNpYmxlL2Jyb2tlblxuICogb2Zmc2V0cykuXG4gKlxuICogSXQncyBwcm9iYWJseSBvdmVya2lsbCwgYnV0IGl0IG1ha2VzIHRoZSBjb2RlIHRoYXQgdXNlcyBpdCBjbGVhci4gSXQgY291bGQgYmUgcmVmYWN0b3JlZCBvclxuICogcmVtb3ZlZC5cbiAqL1xuXG5leHBvcnQgY29uc3QgTWF0Y2hBbnkgPSAnTUFUQ0hfQU5ZJztcbmV4cG9ydCB0eXBlIE1hdGNoQW55ID0gJ01BVENIX0FOWSc7XG5cbnR5cGUgTWF0Y2hlcyA9XG4gIHwgJ0NoYXIsSGJzJ1xuICB8ICdIYnMsQ2hhcidcbiAgfCAnSGJzLEhicydcbiAgfCAnQ2hhcixDaGFyJ1xuICB8ICdJbnZpc2libGUsQW55J1xuICB8ICdBbnksSW52aXNpYmxlJztcblxuZXhwb3J0IGNvbnN0IElzSW52aXNpYmxlID0gJ0lTX0lOVklTSUJMRSc7XG5leHBvcnQgdHlwZSBJc0ludmlzaWJsZSA9ICdJU19JTlZJU0lCTEUnO1xuXG50eXBlIFBhdHRlcm4gPSBPZmZzZXRLaW5kIHwgSXNJbnZpc2libGUgfCBNYXRjaEFueTtcblxuY2xhc3MgV2hlbkxpc3Q8T3V0PiB7XG4gIF93aGVuczogV2hlbjxPdXQ+W107XG5cbiAgY29uc3RydWN0b3Iod2hlbnM6IFdoZW48T3V0PltdKSB7XG4gICAgdGhpcy5fd2hlbnMgPSB3aGVucztcbiAgfVxuXG4gIGZpcnN0KGtpbmQ6IE9mZnNldEtpbmQpOiBPdXQgfCBudWxsIHtcbiAgICBmb3IgKGxldCB3aGVuIG9mIHRoaXMuX3doZW5zKSB7XG4gICAgICBsZXQgdmFsdWUgPSB3aGVuLm1hdGNoKGtpbmQpO1xuICAgICAgaWYgKGlzUHJlc2VudCh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlWzBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmNsYXNzIFdoZW48T3V0PiB7XG4gIF9tYXA6IE1hcDxQYXR0ZXJuLCBPdXQ+ID0gbmV3IE1hcCgpO1xuXG4gIGdldChwYXR0ZXJuOiBQYXR0ZXJuLCBvcjogKCkgPT4gT3V0KTogT3V0IHtcbiAgICBsZXQgdmFsdWUgPSB0aGlzLl9tYXAuZ2V0KHBhdHRlcm4pO1xuXG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgdmFsdWUgPSBvcigpO1xuXG4gICAgdGhpcy5fbWFwLnNldChwYXR0ZXJuLCB2YWx1ZSk7XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICBhZGQocGF0dGVybjogUGF0dGVybiwgb3V0OiBPdXQpOiB2b2lkIHtcbiAgICB0aGlzLl9tYXAuc2V0KHBhdHRlcm4sIG91dCk7XG4gIH1cblxuICBtYXRjaChraW5kOiBPZmZzZXRLaW5kKTogT3V0W10ge1xuICAgIGxldCBwYXR0ZXJuID0gcGF0dGVybkZvcihraW5kKTtcblxuICAgIGxldCBvdXQ6IE91dFtdID0gW107XG5cbiAgICBsZXQgZXhhY3QgPSB0aGlzLl9tYXAuZ2V0KHBhdHRlcm4pO1xuICAgIGxldCBmYWxsYmFjayA9IHRoaXMuX21hcC5nZXQoTWF0Y2hBbnkpO1xuXG4gICAgaWYgKGV4YWN0KSB7XG4gICAgICBvdXQucHVzaChleGFjdCk7XG4gICAgfVxuXG4gICAgaWYgKGZhbGxiYWNrKSB7XG4gICAgICBvdXQucHVzaChmYWxsYmFjayk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dDtcbiAgfVxufVxuXG50eXBlIEV4aGF1c3RpdmVDaGVjazxPdXQsIEluIGV4dGVuZHMgTWF0Y2hlcywgUmVtb3ZlZCBleHRlbmRzIE1hdGNoZXM+ID0gRXhjbHVkZTxcbiAgSW4sXG4gIFJlbW92ZWRcbj4gZXh0ZW5kcyBuZXZlclxuICA/IEV4aGF1c3RpdmVNYXRjaGVyPE91dD5cbiAgOiBNYXRjaGVyPE91dCwgRXhjbHVkZTxJbiwgUmVtb3ZlZD4+O1xuXG5leHBvcnQgdHlwZSBNYXRjaEZuPE91dD4gPSAobGVmdDogUG9zaXRpb25EYXRhLCByaWdodDogUG9zaXRpb25EYXRhKSA9PiBPdXQ7XG5cbmludGVyZmFjZSBFeGhhdXN0aXZlTWF0Y2hlcjxPdXQ+IHtcbiAgY2hlY2soKTogTWF0Y2hGbjxPdXQ+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2g8T3V0PihjYWxsYmFjazogKG06IE1hdGNoZXI8T3V0PikgPT4gRXhoYXVzdGl2ZU1hdGNoZXI8T3V0Pik6IE1hdGNoRm48T3V0PiB7XG4gIHJldHVybiBjYWxsYmFjayhuZXcgTWF0Y2hlcigpKS5jaGVjaygpO1xufVxuXG5jbGFzcyBNYXRjaGVyPE91dCwgTSBleHRlbmRzIE1hdGNoZXMgPSBNYXRjaGVzPiB7XG4gIF93aGVuczogV2hlbjxXaGVuPChsZWZ0OiBQb3NpdGlvbkRhdGEsIHJpZ2h0OiBQb3NpdGlvbkRhdGEpID0+IE91dD4+ID0gbmV3IFdoZW4oKTtcblxuICAvKipcbiAgICogWW91IGRpZG4ndCBleGhhdXN0aXZlbHkgbWF0Y2ggYWxsIHBvc3NpYmlsaXRpZXMuXG4gICAqL1xuICBwcm90ZWN0ZWQgY2hlY2soKTogTWF0Y2hGbjxPdXQ+IHtcbiAgICByZXR1cm4gKGxlZnQsIHJpZ2h0KSA9PiB0aGlzLm1hdGNoRm9yKGxlZnQua2luZCwgcmlnaHQua2luZCkobGVmdCwgcmlnaHQpO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaEZvcihcbiAgICBsZWZ0OiBPZmZzZXRLaW5kLFxuICAgIHJpZ2h0OiBPZmZzZXRLaW5kXG4gICk6IChsZWZ0OiBQb3NpdGlvbkRhdGEsIHJpZ2h0OiBQb3NpdGlvbkRhdGEpID0+IE91dCB7XG4gICAgbGV0IG5lc3RlZHMgPSB0aGlzLl93aGVucy5tYXRjaChsZWZ0KTtcblxuICAgIGFzc2VydChcbiAgICAgIGlzUHJlc2VudChuZXN0ZWRzKSxcbiAgICAgIGBubyBtYXRjaCBkZWZpbmVkIGZvciAoJHtsZWZ0fSwgJHtyaWdodH0pIGFuZCBubyBBbnlNYXRjaCBkZWZpbmVkIGVpdGhlcmBcbiAgICApO1xuXG4gICAgbGV0IGNhbGxiYWNrID0gbmV3IFdoZW5MaXN0KG5lc3RlZHMpLmZpcnN0KHJpZ2h0KTtcblxuICAgIGFzc2VydChcbiAgICAgIGNhbGxiYWNrICE9PSBudWxsLFxuICAgICAgYG5vIG1hdGNoIGRlZmluZWQgZm9yICgke2xlZnR9LCAke3JpZ2h0fSkgYW5kIG5vIEFueU1hdGNoIGRlZmluZWQgZWl0aGVyYFxuICAgICk7XG5cbiAgICByZXR1cm4gY2FsbGJhY2s7XG4gIH1cblxuICAvLyBUaGlzIGJpZyBibG9jayBpcyB0aGUgYnVsayBvZiB0aGUgaGVhdnkgbGlmdGluZyBpbiB0aGlzIGZpbGUuIEl0IGZhY2lsaXRhdGVzIGV4aGF1c3RpdmVuZXNzXG4gIC8vIGNoZWNraW5nIHNvIHRoYXQgbWF0Y2hlcnMgY2FuIGVuc3VyZSB0aGV5J3ZlIGFjdHVhbGx5IGNvdmVyZWQgYWxsIHRoZSBjYXNlcyAoYW5kIFR5cGVTY3JpcHRcbiAgLy8gd2lsbCB0cmVhdCBpdCBhcyBhbiBleGhhdXN0aXZlIG1hdGNoKS5cbiAgd2hlbihcbiAgICBsZWZ0OiBPZmZzZXRLaW5kLkNoYXJQb3NpdGlvbixcbiAgICByaWdodDogT2Zmc2V0S2luZC5IYnNQb3NpdGlvbixcbiAgICBjYWxsYmFjazogKGxlZnQ6IENoYXJQb3NpdGlvbiwgcmlnaHQ6IEhic1Bvc2l0aW9uKSA9PiBPdXRcbiAgKTogRXhoYXVzdGl2ZUNoZWNrPE91dCwgTSwgJ0NoYXIsSGJzJz47XG4gIHdoZW4oXG4gICAgbGVmdDogT2Zmc2V0S2luZC5IYnNQb3NpdGlvbixcbiAgICByaWdodDogT2Zmc2V0S2luZC5DaGFyUG9zaXRpb24sXG4gICAgY2FsbGJhY2s6IChsZWZ0OiBIYnNQb3NpdGlvbiwgcmlnaHQ6IENoYXJQb3NpdGlvbikgPT4gT3V0XG4gICk6IEV4aGF1c3RpdmVDaGVjazxPdXQsIE0sICdIYnMsQ2hhcic+O1xuICB3aGVuKFxuICAgIGxlZnQ6IE9mZnNldEtpbmQuSGJzUG9zaXRpb24sXG4gICAgcmlnaHQ6IE9mZnNldEtpbmQuSGJzUG9zaXRpb24sXG4gICAgY2FsbGJhY2s6IChsZWZ0OiBIYnNQb3NpdGlvbiwgcmlnaHQ6IEhic1Bvc2l0aW9uKSA9PiBPdXRcbiAgKTogRXhoYXVzdGl2ZUNoZWNrPE91dCwgTSwgJ0hicyxIYnMnPjtcbiAgd2hlbihcbiAgICBsZWZ0OiBPZmZzZXRLaW5kLkNoYXJQb3NpdGlvbixcbiAgICByaWdodDogT2Zmc2V0S2luZC5DaGFyUG9zaXRpb24sXG4gICAgY2FsbGJhY2s6IChsZWZ0OiBDaGFyUG9zaXRpb24sIHJpZ2h0OiBDaGFyUG9zaXRpb24pID0+IE91dFxuICApOiBFeGhhdXN0aXZlQ2hlY2s8T3V0LCBNLCAnQ2hhcixDaGFyJz47XG4gIHdoZW4oXG4gICAgbGVmdDogSXNJbnZpc2libGUsXG4gICAgcmlnaHQ6IE1hdGNoQW55LFxuICAgIGNhbGxiYWNrOiAobGVmdDogSW52aXNpYmxlUG9zaXRpb24sIHJpZ2h0OiBQb3NpdGlvbkRhdGEpID0+IE91dFxuICApOiBNYXRjaGVyPE91dCwgRXhjbHVkZTxNLCAnSW52aXNpYmxlLEFueSc+PjtcbiAgd2hlbihcbiAgICBsZWZ0OiBNYXRjaEFueSxcbiAgICByaWdodDogSXNJbnZpc2libGUsXG4gICAgY2FsbGJhY2s6IChsZWZ0OiBQb3NpdGlvbkRhdGEsIHJpZ2h0OiBJbnZpc2libGVQb3NpdGlvbikgPT4gT3V0XG4gICk6IEV4aGF1c3RpdmVDaGVjazxPdXQsIE0sICdBbnksSW52aXNpYmxlJz47XG4gIHdoZW4oXG4gICAgbGVmdDogTWF0Y2hBbnksXG4gICAgcmlnaHQ6IE1hdGNoQW55LFxuICAgIGNhbGxiYWNrOiAobGVmdDogUG9zaXRpb25EYXRhLCByaWdodDogUG9zaXRpb25EYXRhKSA9PiBPdXRcbiAgKTogRXhoYXVzdGl2ZU1hdGNoZXI8T3V0PjtcbiAgd2hlbihcbiAgICBsZWZ0OiBQYXR0ZXJuLFxuICAgIHJpZ2h0OiBQYXR0ZXJuLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY2FsbGJhY2s6IChsZWZ0OiBhbnksIHJpZ2h0OiBhbnkpID0+IE91dFxuICApOiBNYXRjaGVyPE91dCwgTWF0Y2hlcz4gfCBFeGhhdXN0aXZlTWF0Y2hlcjxPdXQ+IHtcbiAgICB0aGlzLl93aGVucy5nZXQobGVmdCwgKCkgPT4gbmV3IFdoZW4oKSkuYWRkKHJpZ2h0LCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXR0ZXJuRm9yKGtpbmQ6IE9mZnNldEtpbmQpOiBQYXR0ZXJuIHtcbiAgc3dpdGNoIChraW5kKSB7XG4gICAgY2FzZSBPZmZzZXRLaW5kLkJyb2tlbjpcbiAgICBjYXNlIE9mZnNldEtpbmQuSW50ZXJuYWxzU3ludGhldGljOlxuICAgIGNhc2UgT2Zmc2V0S2luZC5Ob25FeGlzdGVudDpcbiAgICAgIHJldHVybiBJc0ludmlzaWJsZTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGtpbmQ7XG4gIH1cbn1cbiIsIi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IFNvdXJjZVBvc2l0aW9uLCBVTktOT1dOX1BPU0lUSU9OIH0gZnJvbSAnLi4vbG9jYXRpb24nO1xuaW1wb3J0IHsgU291cmNlIH0gZnJvbSAnLi4vc291cmNlJztcbmltcG9ydCB7IG1hdGNoLCBNYXRjaEFueSB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0IHsgU291cmNlU3Bhbiwgc3BhbiB9IGZyb20gJy4vc3Bhbic7XG5cbmV4cG9ydCBjb25zdCBlbnVtIE9mZnNldEtpbmQge1xuICAvKipcbiAgICogV2UgaGF2ZSBhbHJlYWR5IGNvbXB1dGVkIHRoZSBjaGFyYWN0ZXIgcG9zaXRpb24gb2YgdGhpcyBvZmZzZXQgb3Igc3Bhbi5cbiAgICovXG4gIENoYXJQb3NpdGlvbiA9ICdDaGFyUG9zaXRpb24nLFxuXG4gIC8qKlxuICAgKiBUaGlzIG9mZnNldCBvciBzcGFuIHdhcyBpbnN0YW50aWF0ZWQgd2l0aCBhIEhhbmRsZWJhcnMgU291cmNlUG9zaXRpb24gb3IgU291cmNlTG9jYXRpb24uIEl0c1xuICAgKiBjaGFyYWN0ZXIgcG9zaXRpb24gd2lsbCBiZSBjb21wdXRlZCBvbiBkZW1hbmQuXG4gICAqL1xuICBIYnNQb3NpdGlvbiA9ICdIYnNQb3NpdGlvbicsXG5cbiAgLyoqXG4gICAqIGZvciAocmFyZSkgc2l0dWF0aW9ucyB3aGVyZSBhIG5vZGUgaXMgY3JlYXRlZCBidXQgdGhlcmUgd2FzIG5vIHNvdXJjZSBsb2NhdGlvbiAoZS5nLiB0aGUgbmFtZVxuICAgKiBcImRlZmF1bHRcIiBpbiBkZWZhdWx0IGJsb2NrcyB3aGVuIHRoZSB3b3JkIFwiZGVmYXVsdFwiIG5ldmVyIGFwcGVhcmVkIGluIHNvdXJjZSkuIFRoaXMgaXMgdXNlZFxuICAgKiBieSB0aGUgaW50ZXJuYWxzIHdoZW4gdGhlcmUgaXMgYSBsZWdpdGltYXRlIHJlYXNvbiBmb3IgdGhlIGludGVybmFscyB0byBzeW50aGVzaXplIGEgbm9kZVxuICAgKiB3aXRoIG5vIGxvY2F0aW9uLlxuICAgKi9cbiAgSW50ZXJuYWxzU3ludGhldGljID0gJ0ludGVybmFsc1N5bnRoZXRpYycsXG4gIC8qKlxuICAgKiBGb3Igc2l0dWF0aW9ucyB3aGVyZSBhIG5vZGUgcmVwcmVzZW50cyB6ZXJvIHBhcnRzIG9mIHRoZSBzb3VyY2UgKGZvciBleGFtcGxlLCBlbXB0eSBhcmd1bWVudHMpLlxuICAgKiBJbiBnZW5lcmFsLCB3ZSBhdHRlbXB0IHRvIGFzc2lnbiB0aGVzZSBub2RlcyAqc29tZSogcG9zaXRpb24gKGVtcHR5IGFyZ3VtZW50cyBjYW4gYmVcbiAgICogcG9zaXRpb25lZCBpbW1lZGlhdGVseSBhZnRlciB0aGUgY2FsbGVlKSwgYnV0IGl0J3Mgbm90IGFsd2F5cyBwb3NzaWJsZVxuICAgKi9cbiAgTm9uRXhpc3RlbnQgPSAnTm9uRXhpc3RlbnQnLFxuICAvKipcbiAgICogRm9yIHNpdHVhdGlvbnMgd2hlcmUgYSBzb3VyY2UgbG9jYXRpb24gd2FzIGV4cGVjdGVkLCBidXQgaXQgZGlkbid0IGNvcnJlc3BvbmQgdG8gdGhlIG5vZGUgaW5cbiAgICogdGhlIHNvdXJjZS4gVGhpcyBoYXBwZW5zIGlmIGEgcGx1Z2luIGNyZWF0ZXMgYnJva2VuIGxvY2F0aW9ucy5cbiAgICovXG4gIEJyb2tlbiA9ICdCcm9rZW4nLFxufVxuXG4vKipcbiAqIEFsbCBwb3NpdGlvbnMgaGF2ZSB0aGVzZSBkZXRhaWxzIGluIGNvbW1vbi4gTW9zdCBub3RhYmx5LCBhbGwgdGhyZWUga2luZHMgb2YgcG9zaXRpb25zIGNhblxuICogbXVzdCBiZSBhYmxlIHRvIGF0dGVtcHQgdG8gY29udmVydCB0aGVtc2VsdmVzIGludG8ge0BzZWUgQ2hhclBvc2l0aW9ufS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQb3NpdGlvbkRhdGEge1xuICByZWFkb25seSBraW5kOiBPZmZzZXRLaW5kO1xuICB0b0NoYXJQb3MoKTogQ2hhclBvc2l0aW9uIHwgbnVsbDtcbiAgdG9KU09OKCk6IFNvdXJjZVBvc2l0aW9uO1xufVxuXG4vKipcbiAqIFVzZWQgdG8gaW5kaWNhdGUgdGhhdCBhbiBhdHRlbXB0IHRvIGNvbnZlcnQgYSBgU291cmNlUG9zaXRpb25gIHRvIGEgY2hhcmFjdGVyIG9mZnNldCBmYWlsZWQuIEl0XG4gKiBpcyBzZXBhcmF0ZSBmcm9tIGBudWxsYCBzbyB0aGF0IGBudWxsYCBjYW4gYmUgdXNlZCB0byBpbmRpY2F0ZSB0aGF0IHRoZSBjb21wdXRhdGlvbiB3YXNuJ3QgeWV0XG4gKiBhdHRlbXB0ZWQgKGFuZCB0aGVyZWZvcmUgdG8gY2FjaGUgdGhlIGZhaWx1cmUpXG4gKi9cbmV4cG9ydCBjb25zdCBCUk9LRU4gPSAnQlJPS0VOJztcbmV4cG9ydCB0eXBlIEJST0tFTiA9ICdCUk9LRU4nO1xuXG5leHBvcnQgdHlwZSBBbnlQb3NpdGlvbiA9IEhic1Bvc2l0aW9uIHwgQ2hhclBvc2l0aW9uIHwgSW52aXNpYmxlUG9zaXRpb247XG5cbi8qKlxuICogQSBgU291cmNlT2Zmc2V0YCByZXByZXNlbnRzIGEgc2luZ2xlIHBvc2l0aW9uIGluIHRoZSBzb3VyY2UuXG4gKlxuICogVGhlcmUgYXJlIHRocmVlIGtpbmRzIG9mIGJhY2tpbmcgZGF0YSBmb3IgYFNvdXJjZU9mZnNldGAgb2JqZWN0czpcbiAqXG4gKiAtIGBDaGFyUG9zaXRpb25gLCB3aGljaCBjb250YWlucyBhIGNoYXJhY3RlciBvZmZzZXQgaW50byB0aGUgcmF3IHNvdXJjZSBzdHJpbmdcbiAqIC0gYEhic1Bvc2l0aW9uYCwgd2hpY2ggY29udGFpbnMgYSBgU291cmNlUG9zaXRpb25gIGZyb20gdGhlIEhhbmRsZWJhcnMgQVNULCB3aGljaCBjYW4gYmVcbiAqICAgY29udmVydGVkIHRvIGEgYENoYXJQb3NpdGlvbmAgb24gZGVtYW5kLlxuICogLSBgSW52aXNpYmxlUG9zaXRpb25gLCB3aGljaCByZXByZXNlbnRzIGEgcG9zaXRpb24gbm90IGluIHNvdXJjZSAoQHNlZSB7SW52aXNpYmxlUG9zaXRpb259KVxuICovXG5leHBvcnQgY2xhc3MgU291cmNlT2Zmc2V0IHtcbiAgLyoqXG4gICAqIENyZWF0ZSBhIGBTb3VyY2VPZmZzZXRgIGZyb20gYSBIYW5kbGViYXJzIGBTb3VyY2VQb3NpdGlvbmAuIEl0J3Mgc3RvcmVkIGFzLWlzLCBhbmQgY29udmVydGVkXG4gICAqIGludG8gYSBjaGFyYWN0ZXIgb2Zmc2V0IG9uIGRlbWFuZCwgd2hpY2ggYXZvaWRzIHVubmVjZXNzYXJpbHkgY29tcHV0aW5nIHRoZSBvZmZzZXQgb2YgZXZlcnlcbiAgICogYFNvdXJjZUxvY2F0aW9uYCwgYnV0IGFsc28gbWVhbnMgdGhhdCBicm9rZW4gYFNvdXJjZVBvc2l0aW9uYHMgYXJlIG5vdCBhbHdheXMgZGV0ZWN0ZWQuXG4gICAqL1xuICBzdGF0aWMgZm9ySGJzUG9zKHNvdXJjZTogU291cmNlLCBwb3M6IFNvdXJjZVBvc2l0aW9uKTogU291cmNlT2Zmc2V0IHtcbiAgICByZXR1cm4gbmV3IEhic1Bvc2l0aW9uKHNvdXJjZSwgcG9zLCBudWxsKS53cmFwKCk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgYFNvdXJjZU9mZnNldGAgdGhhdCBjb3JyZXNwb25kcyB0byBhIGJyb2tlbiBgU291cmNlUG9zaXRpb25gLiBUaGlzIG1lYW5zIHRoYXQgdGhlXG4gICAqIGNhbGxpbmcgY29kZSBkZXRlcm1pbmVkIChvciBrbm93cykgdGhhdCB0aGUgYFNvdXJjZUxvY2F0aW9uYCBkb2Vzbid0IGNvcnJlc3BvbmQgY29ycmVjdGx5IHRvXG4gICAqIGFueSBwYXJ0IG9mIHRoZSBzb3VyY2UuXG4gICAqL1xuICBzdGF0aWMgYnJva2VuKHBvczogU291cmNlUG9zaXRpb24gPSBVTktOT1dOX1BPU0lUSU9OKTogU291cmNlT2Zmc2V0IHtcbiAgICByZXR1cm4gbmV3IEludmlzaWJsZVBvc2l0aW9uKE9mZnNldEtpbmQuQnJva2VuLCBwb3MpLndyYXAoKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGRhdGE6IFBvc2l0aW9uRGF0YSAmIEFueVBvc2l0aW9uKSB7fVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGNoYXJhY3RlciBvZmZzZXQgZm9yIHRoaXMgYFNvdXJjZU9mZnNldGAsIGlmIHBvc3NpYmxlLlxuICAgKi9cbiAgZ2V0IG9mZnNldCgpOiBudW1iZXIgfCBudWxsIHtcbiAgICBsZXQgY2hhclBvcyA9IHRoaXMuZGF0YS50b0NoYXJQb3MoKTtcbiAgICByZXR1cm4gY2hhclBvcyA9PT0gbnVsbCA/IG51bGwgOiBjaGFyUG9zLm9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wYXJlIHRoaXMgb2Zmc2V0IHdpdGggYW5vdGhlciBvbmUuXG4gICAqXG4gICAqIElmIGJvdGggb2Zmc2V0cyBhcmUgYEhic1Bvc2l0aW9uYHMsIHRoZXkncmUgZXF1aXZhbGVudCBhcyBsb25nIGFzIHRoZWlyIGxpbmVzIGFuZCBjb2x1bW5zIGFyZVxuICAgKiB0aGUgc2FtZS4gVGhpcyBhdm9pZHMgY29tcHV0aW5nIG9mZnNldHMgdW5uZWNlc3NhcmlseS5cbiAgICpcbiAgICogT3RoZXJ3aXNlLCB0d28gYFNvdXJjZU9mZnNldGBzIGFyZSBlcXVpdmFsZW50IGlmIHRoZWlyIHN1Y2Nlc3NmdWxseSBjb21wdXRlZCBjaGFyYWN0ZXIgb2Zmc2V0c1xuICAgKiBhcmUgdGhlIHNhbWUuXG4gICAqL1xuICBlcWwocmlnaHQ6IFNvdXJjZU9mZnNldCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBlcWwodGhpcy5kYXRhLCByaWdodC5kYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBzcGFuIHRoYXQgc3RhcnRzIGZyb20gdGhpcyBzb3VyY2Ugb2Zmc2V0IGFuZCBlbmRzIHdpdGggYW5vdGhlciBzb3VyY2Ugb2Zmc2V0LiBBdm9pZFxuICAgKiBjb21wdXRpbmcgY2hhcmFjdGVyIG9mZnNldHMgaWYgYm90aCBgU291cmNlT2Zmc2V0YHMgYXJlIHN0aWxsIGxhenkuXG4gICAqL1xuICB1bnRpbChvdGhlcjogU291cmNlT2Zmc2V0KTogU291cmNlU3BhbiB7XG4gICAgcmV0dXJuIHNwYW4odGhpcy5kYXRhLCBvdGhlci5kYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBgU291cmNlT2Zmc2V0YCBieSBtb3ZpbmcgdGhlIGNoYXJhY3RlciBwb3NpdGlvbiByZXByZXNlbnRlZCBieSB0aGlzIHNvdXJjZSBvZmZzZXRcbiAgICogZm9yd2FyZCBvciBiYWNrd2FyZCAoaWYgYGJ5YCBpcyBuZWdhdGl2ZSksIGlmIHBvc3NpYmxlLlxuICAgKlxuICAgKiBJZiB0aGlzIGBTb3VyY2VPZmZzZXRgIGNhbid0IGNvbXB1dGUgYSB2YWxpZCBjaGFyYWN0ZXIgb2Zmc2V0LCBgbW92ZWAgcmV0dXJucyBhIGJyb2tlbiBvZmZzZXQuXG4gICAqXG4gICAqIElmIHRoZSByZXN1bHRpbmcgY2hhcmFjdGVyIG9mZnNldCBpcyBsZXNzIHRoYW4gMCBvciBncmVhdGVyIHRoYW4gdGhlIHNpemUgb2YgdGhlIHNvdXJjZSwgYG1vdmVgXG4gICAqIHJldHVybnMgYSBicm9rZW4gb2Zmc2V0LlxuICAgKi9cbiAgbW92ZShieTogbnVtYmVyKTogU291cmNlT2Zmc2V0IHtcbiAgICBsZXQgY2hhclBvcyA9IHRoaXMuZGF0YS50b0NoYXJQb3MoKTtcblxuICAgIGlmIChjaGFyUG9zID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gU291cmNlT2Zmc2V0LmJyb2tlbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcmVzdWx0ID0gY2hhclBvcy5vZmZzZXQgKyBieTtcblxuICAgICAgaWYgKGNoYXJQb3Muc291cmNlLmNoZWNrKHJlc3VsdCkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDaGFyUG9zaXRpb24oY2hhclBvcy5zb3VyY2UsIHJlc3VsdCkud3JhcCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFNvdXJjZU9mZnNldC5icm9rZW4oKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGBTb3VyY2VTcGFuYCB0aGF0IHJlcHJlc2VudHMgYSBjb2xsYXBzZWQgcmFuZ2UgYXQgdGhpcyBzb3VyY2Ugb2Zmc2V0LiBBdm9pZFxuICAgKiBjb21wdXRpbmcgdGhlIGNoYXJhY3RlciBvZmZzZXQgaWYgaXQgaGFzIG5vdCBhbHJlYWR5IGJlZW4gY29tcHV0ZWQuXG4gICAqL1xuICBjb2xsYXBzZWQoKTogU291cmNlU3BhbiB7XG4gICAgcmV0dXJuIHNwYW4odGhpcy5kYXRhLCB0aGlzLmRhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgdGhpcyBgU291cmNlT2Zmc2V0YCBpbnRvIGEgSGFuZGxlYmFycyB7QHNlZSBTb3VyY2VQb3NpdGlvbn0gZm9yIGNvbXBhdGliaWxpdHkgd2l0aFxuICAgKiBleGlzdGluZyBwbHVnaW5zLlxuICAgKi9cbiAgdG9KU09OKCk6IFNvdXJjZVBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLnRvSlNPTigpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGFyUG9zaXRpb24gaW1wbGVtZW50cyBQb3NpdGlvbkRhdGEge1xuICByZWFkb25seSBraW5kID0gT2Zmc2V0S2luZC5DaGFyUG9zaXRpb247XG5cbiAgLyoqIENvbXB1dGVkIGZyb20gY2hhciBvZmZzZXQgKi9cbiAgX2xvY1BvczogSGJzUG9zaXRpb24gfCBCUk9LRU4gfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSBzb3VyY2U6IFNvdXJjZSwgcmVhZG9ubHkgY2hhclBvczogbnVtYmVyKSB7fVxuXG4gIC8qKlxuICAgKiBUaGlzIGlzIGFscmVhZHkgYSBgQ2hhclBvc2l0aW9uYC5cbiAgICpcbiAgICoge0BzZWUgSGJzUG9zaXRpb259IGZvciB0aGUgYWx0ZXJuYXRpdmUuXG4gICAqXG4gICAqIEBpbXBsZW1lbnRzIHtQb3NpdGlvbkRhdGF9XG4gICAqL1xuICB0b0NoYXJQb3MoKTogQ2hhclBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9kdWNlIGEgSGFuZGxlYmFycyB7QHNlZSBTb3VyY2VQb3NpdGlvbn0gZm9yIHRoaXMgYENoYXJQb3NpdGlvbmAuIElmIHRoaXMgYENoYXJQb3NpdGlvbmAgd2FzXG4gICAqIGNvbXB1dGVkIHVzaW5nIHtAc2VlIFNvdXJjZU9mZnNldCNtb3ZlfSwgdGhpcyB3aWxsIGNvbXB1dGUgdGhlIGBTb3VyY2VQb3NpdGlvbmAgZm9yIHRoZSBvZmZzZXQuXG4gICAqXG4gICAqIEBpbXBsZW1lbnRzIHtQb3NpdGlvbkRhdGF9XG4gICAqL1xuICB0b0pTT04oKTogU291cmNlUG9zaXRpb24ge1xuICAgIGxldCBoYnMgPSB0aGlzLnRvSGJzUG9zKCk7XG4gICAgcmV0dXJuIGhicyA9PT0gbnVsbCA/IFVOS05PV05fUE9TSVRJT04gOiBoYnMudG9KU09OKCk7XG4gIH1cblxuICB3cmFwKCk6IFNvdXJjZU9mZnNldCB7XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VPZmZzZXQodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogQSBgQ2hhclBvc2l0aW9uYCBhbHdheXMgaGFzIGFuIG9mZnNldCBpdCBjYW4gcHJvZHVjZSB3aXRob3V0IGFueSBhZGRpdGlvbmFsIGNvbXB1dGF0aW9uLlxuICAgKi9cbiAgZ2V0IG9mZnNldCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmNoYXJQb3M7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCB0aGUgY3VycmVudCBjaGFyYWN0ZXIgb2Zmc2V0IHRvIGFuIGBIYnNQb3NpdGlvbmAsIGlmIGl0IHdhcyBub3QgYWxyZWFkeSBjb21wdXRlZC4gT25jZVxuICAgKiBhIGBDaGFyUG9zaXRpb25gIGhhcyBjb21wdXRlZCBpdHMgYEhic1Bvc2l0aW9uYCwgaXQgd2lsbCBub3QgbmVlZCB0byBkbyBjb21wdXRlIGl0IGFnYWluLCBhbmRcbiAgICogdGhlIHNhbWUgYENoYXJQb3NpdGlvbmAgaXMgcmV0YWluZWQgd2hlbiB1c2VkIGFzIG9uZSBvZiB0aGUgZW5kcyBvZiBhIGBTb3VyY2VTcGFuYCwgc29cbiAgICogY29tcHV0aW5nIHRoZSBgSGJzUG9zaXRpb25gIHNob3VsZCBiZSBhIG9uZS10aW1lIG9wZXJhdGlvbi5cbiAgICovXG4gIHRvSGJzUG9zKCk6IEhic1Bvc2l0aW9uIHwgbnVsbCB7XG4gICAgbGV0IGxvY1BvcyA9IHRoaXMuX2xvY1BvcztcblxuICAgIGlmIChsb2NQb3MgPT09IG51bGwpIHtcbiAgICAgIGxldCBoYnNQb3MgPSB0aGlzLnNvdXJjZS5oYnNQb3NGb3IodGhpcy5jaGFyUG9zKTtcblxuICAgICAgaWYgKGhic1BvcyA9PT0gbnVsbCkge1xuICAgICAgICB0aGlzLl9sb2NQb3MgPSBsb2NQb3MgPSBCUk9LRU47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9sb2NQb3MgPSBsb2NQb3MgPSBuZXcgSGJzUG9zaXRpb24odGhpcy5zb3VyY2UsIGhic1BvcywgdGhpcy5jaGFyUG9zKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbG9jUG9zID09PSBCUk9LRU4gPyBudWxsIDogbG9jUG9zO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBIYnNQb3NpdGlvbiBpbXBsZW1lbnRzIFBvc2l0aW9uRGF0YSB7XG4gIHJlYWRvbmx5IGtpbmQgPSBPZmZzZXRLaW5kLkhic1Bvc2l0aW9uO1xuXG4gIF9jaGFyUG9zOiBDaGFyUG9zaXRpb24gfCBCUk9LRU4gfCBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHJlYWRvbmx5IHNvdXJjZTogU291cmNlLFxuICAgIHJlYWRvbmx5IGhic1BvczogU291cmNlUG9zaXRpb24sXG4gICAgY2hhclBvczogbnVtYmVyIHwgbnVsbCA9IG51bGxcbiAgKSB7XG4gICAgdGhpcy5fY2hhclBvcyA9IGNoYXJQb3MgPT09IG51bGwgPyBudWxsIDogbmV3IENoYXJQb3NpdGlvbihzb3VyY2UsIGNoYXJQb3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIExhemlseSBjb21wdXRlIHRoZSBjaGFyYWN0ZXIgb2Zmc2V0IGZyb20gdGhlIHtAc2VlIFNvdXJjZVBvc2l0aW9ufS4gT25jZSBhbiBgSGJzUG9zaXRpb25gIGhhc1xuICAgKiBjb21wdXRlZCBpdHMgYENoYXJQb3NpdGlvbmAsIGl0IHdpbGwgbm90IG5lZWQgdG8gZG8gY29tcHV0ZSBpdCBhZ2FpbiwgYW5kIHRoZSBzYW1lXG4gICAqIGBIYnNQb3NpdGlvbmAgaXMgcmV0YWluZWQgd2hlbiB1c2VkIGFzIG9uZSBvZiB0aGUgZW5kcyBvZiBhIGBTb3VyY2VTcGFuYCwgc28gY29tcHV0aW5nIHRoZVxuICAgKiBgQ2hhclBvc2l0aW9uYCBzaG91bGQgYmUgYSBvbmUtdGltZSBvcGVyYXRpb24uXG4gICAqXG4gICAqIEBpbXBsZW1lbnRzIHtQb3NpdGlvbkRhdGF9XG4gICAqL1xuICB0b0NoYXJQb3MoKTogQ2hhclBvc2l0aW9uIHwgbnVsbCB7XG4gICAgbGV0IGNoYXJQb3MgPSB0aGlzLl9jaGFyUG9zO1xuXG4gICAgaWYgKGNoYXJQb3MgPT09IG51bGwpIHtcbiAgICAgIGxldCBjaGFyUG9zTnVtYmVyID0gdGhpcy5zb3VyY2UuY2hhclBvc0Zvcih0aGlzLmhic1Bvcyk7XG5cbiAgICAgIGlmIChjaGFyUG9zTnVtYmVyID09PSBudWxsKSB7XG4gICAgICAgIHRoaXMuX2NoYXJQb3MgPSBjaGFyUG9zID0gQlJPS0VOO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fY2hhclBvcyA9IGNoYXJQb3MgPSBuZXcgQ2hhclBvc2l0aW9uKHRoaXMuc291cmNlLCBjaGFyUG9zTnVtYmVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY2hhclBvcyA9PT0gQlJPS0VOID8gbnVsbCA6IGNoYXJQb3M7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSB7QHNlZSBTb3VyY2VQb3NpdGlvbn0gdGhhdCB0aGlzIGBIYnNQb3NpdGlvbmAgd2FzIGluc3RhbnRpYXRlZCB3aXRoLiBUaGlzIG9wZXJhdGlvblxuICAgKiBkb2VzIG5vdCBuZWVkIHRvIGNvbXB1dGUgYW55dGhpbmcuXG4gICAqXG4gICAqIEBpbXBsZW1lbnRzIHtQb3NpdGlvbkRhdGF9XG4gICAqL1xuICB0b0pTT04oKTogU291cmNlUG9zaXRpb24ge1xuICAgIHJldHVybiB0aGlzLmhic1BvcztcbiAgfVxuXG4gIHdyYXAoKTogU291cmNlT2Zmc2V0IHtcbiAgICByZXR1cm4gbmV3IFNvdXJjZU9mZnNldCh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIGlzIGFscmVhZHkgYW4gYEhic1Bvc2l0aW9uYC5cbiAgICpcbiAgICoge0BzZWUgQ2hhclBvc2l0aW9ufSBmb3IgdGhlIGFsdGVybmF0aXZlLlxuICAgKi9cbiAgdG9IYnNQb3MoKTogSGJzUG9zaXRpb24ge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnZpc2libGVQb3NpdGlvbiBpbXBsZW1lbnRzIFBvc2l0aW9uRGF0YSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHJlYWRvbmx5IGtpbmQ6IE9mZnNldEtpbmQuQnJva2VuIHwgT2Zmc2V0S2luZC5JbnRlcm5hbHNTeW50aGV0aWMgfCBPZmZzZXRLaW5kLk5vbkV4aXN0ZW50LFxuICAgIC8vIHdoYXRldmVyIHdhcyBwcm92aWRlZCwgcG9zc2libHkgYnJva2VuXG4gICAgcmVhZG9ubHkgcG9zOiBTb3VyY2VQb3NpdGlvblxuICApIHt9XG5cbiAgLyoqXG4gICAqIEEgYnJva2VuIHBvc2l0aW9uIGNhbm5vdCBiZSB0dXJuZWQgaW50byBhIHtAc2VlIENoYXJhY3RlclBvc2l0aW9ufS5cbiAgICovXG4gIHRvQ2hhclBvcygpOiBudWxsIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc2VyaWFsaXphdGlvbiBvZiBhbiBgSW52aXNpYmxlUG9zaXRpb24gaXMgd2hhdGV2ZXIgSGFuZGxlYmFycyB7QHNlZSBTb3VyY2VQb3NpdGlvbn0gd2FzXG4gICAqIG9yaWdpbmFsbHkgaWRlbnRpZmllZCBhcyBicm9rZW4sIG5vbi1leGlzdGVudCBvciBzeW50aGV0aWMuXG4gICAqXG4gICAqIElmIGFuIGBJbnZpc2libGVQb3NpdGlvbmAgbmV2ZXIgaGFkIGFuIHNvdXJjZSBvZmZzZXQgYXQgYWxsLCB0aGlzIG1ldGhvZCByZXR1cm5zXG4gICAqIHtAc2VlIFVOS05PV05fUE9TSVRJT059IGZvciBjb21wYXRpYmlsaXR5LlxuICAgKi9cbiAgdG9KU09OKCk6IFNvdXJjZVBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5wb3M7XG4gIH1cblxuICB3cmFwKCk6IFNvdXJjZU9mZnNldCB7XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VPZmZzZXQodGhpcyk7XG4gIH1cblxuICBnZXQgb2Zmc2V0KCk6IG51bGwge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGFyZSB0d28ge0BzZWUgQW55UG9zaXRpb259IGFuZCBkZXRlcm1pbmUgd2hldGhlciB0aGV5IGFyZSBlcXVhbC5cbiAqXG4gKiBAc2VlIHtTb3VyY2VPZmZzZXQjZXFsfVxuICovXG5jb25zdCBlcWwgPSBtYXRjaDxib29sZWFuPigobSkgPT5cbiAgbVxuICAgIC53aGVuKFxuICAgICAgT2Zmc2V0S2luZC5IYnNQb3NpdGlvbixcbiAgICAgIE9mZnNldEtpbmQuSGJzUG9zaXRpb24sXG4gICAgICAoeyBoYnNQb3M6IGxlZnQgfSwgeyBoYnNQb3M6IHJpZ2h0IH0pID0+XG4gICAgICAgIGxlZnQuY29sdW1uID09PSByaWdodC5jb2x1bW4gJiYgbGVmdC5saW5lID09PSByaWdodC5saW5lXG4gICAgKVxuICAgIC53aGVuKFxuICAgICAgT2Zmc2V0S2luZC5DaGFyUG9zaXRpb24sXG4gICAgICBPZmZzZXRLaW5kLkNoYXJQb3NpdGlvbixcbiAgICAgICh7IGNoYXJQb3M6IGxlZnQgfSwgeyBjaGFyUG9zOiByaWdodCB9KSA9PiBsZWZ0ID09PSByaWdodFxuICAgIClcbiAgICAud2hlbihcbiAgICAgIE9mZnNldEtpbmQuQ2hhclBvc2l0aW9uLFxuICAgICAgT2Zmc2V0S2luZC5IYnNQb3NpdGlvbixcbiAgICAgICh7IG9mZnNldDogbGVmdCB9LCByaWdodCkgPT4gbGVmdCA9PT0gcmlnaHQudG9DaGFyUG9zKCk/Lm9mZnNldFxuICAgIClcbiAgICAud2hlbihcbiAgICAgIE9mZnNldEtpbmQuSGJzUG9zaXRpb24sXG4gICAgICBPZmZzZXRLaW5kLkNoYXJQb3NpdGlvbixcbiAgICAgIChsZWZ0LCB7IG9mZnNldDogcmlnaHQgfSkgPT4gbGVmdC50b0NoYXJQb3MoKT8ub2Zmc2V0ID09PSByaWdodFxuICAgIClcbiAgICAud2hlbihNYXRjaEFueSwgTWF0Y2hBbnksICgpID0+IGZhbHNlKVxuKTtcbiIsIi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IERFQlVHIH0gZnJvbSAnQGdsaW1tZXIvZW52JztcbmltcG9ydCB7IExPQ0FMX0RFQlVHIH0gZnJvbSAnQGdsaW1tZXIvbG9jYWwtZGVidWctZmxhZ3MnO1xuaW1wb3J0IHsgYXNzZXJ0TmV2ZXIgfSBmcm9tICdAZ2xpbW1lci91dGlsJztcblxuaW1wb3J0IHtcbiAgQlJPS0VOX0xPQ0FUSU9OLFxuICBOT05fRVhJU1RFTlRfTE9DQVRJT04sXG4gIFNvdXJjZUxvY2F0aW9uLFxuICBTb3VyY2VQb3NpdGlvbixcbn0gZnJvbSAnLi4vbG9jYXRpb24nO1xuaW1wb3J0IHsgU291cmNlU2xpY2UgfSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQgeyBTb3VyY2UgfSBmcm9tICcuLi9zb3VyY2UnO1xuaW1wb3J0IHsgSXNJbnZpc2libGUsIG1hdGNoLCBNYXRjaEFueSwgTWF0Y2hGbiB9IGZyb20gJy4vbWF0Y2gnO1xuaW1wb3J0IHtcbiAgQW55UG9zaXRpb24sXG4gIEJST0tFTixcbiAgQ2hhclBvc2l0aW9uLFxuICBIYnNQb3NpdGlvbixcbiAgSW52aXNpYmxlUG9zaXRpb24sXG4gIE9mZnNldEtpbmQsXG4gIFNvdXJjZU9mZnNldCxcbn0gZnJvbSAnLi9vZmZzZXQnO1xuXG4vKipcbiAqIEFsbCBzcGFucyBoYXZlIHRoZXNlIGRldGFpbHMgaW4gY29tbW9uLlxuICovXG5pbnRlcmZhY2UgU3BhbkRhdGEge1xuICByZWFkb25seSBraW5kOiBPZmZzZXRLaW5kO1xuXG4gIC8qKlxuICAgKiBDb252ZXJ0IHRoaXMgc3BhbiBpbnRvIGEgc3RyaW5nLiBJZiB0aGUgc3BhbiBpcyBicm9rZW4sIHJldHVybiBgJydgLlxuICAgKi9cbiAgYXNTdHJpbmcoKTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBtb2R1bGUgdGhlIHNwYW4gd2FzIGxvY2F0ZWQgaW4uXG4gICAqL1xuICBnZXRNb2R1bGUoKTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHN0YXJ0aW5nIHBvc2l0aW9uIGZvciB0aGlzIHNwYW4uIFRyeSB0byBhdm9pZCBjcmVhdGluZyBuZXcgcG9zaXRpb24gb2JqZWN0cywgYXMgdGhleVxuICAgKiBjYWNoZSBjb21wdXRhdGlvbnMuXG4gICAqL1xuICBnZXRTdGFydCgpOiBBbnlQb3NpdGlvbjtcblxuICAvKipcbiAgICogR2V0IHRoZSBlbmRpbmcgcG9zaXRpb24gZm9yIHRoaXMgc3Bhbi4gVHJ5IHRvIGF2b2lkIGNyZWF0aW5nIG5ldyBwb3NpdGlvbiBvYmplY3RzLCBhcyB0aGV5XG4gICAqIGNhY2hlIGNvbXB1dGF0aW9ucy5cbiAgICovXG4gIGdldEVuZCgpOiBBbnlQb3NpdGlvbjtcblxuICAvKipcbiAgICogQ29tcHV0ZSB0aGUgYFNvdXJjZUxvY2F0aW9uYCBmb3IgdGhpcyBzcGFuLCByZXR1cm5lZCBhcyBhbiBpbnN0YW5jZSBvZiBgSGJzU3BhbmAuXG4gICAqL1xuICB0b0hic1NwYW4oKTogSGJzU3BhbiB8IG51bGw7XG5cbiAgLyoqXG4gICAqIEZvciBjb21wYXRpYmlsaXR5LCB3aGVuZXZlciB0aGUgYHN0YXJ0YCBvciBgZW5kYCBvZiBhIHtAc2VlIFNvdXJjZU9mZnNldH0gY2hhbmdlcywgc3BhbnMgYXJlXG4gICAqIG5vdGlmaWVkIG9mIHRoZSBjaGFuZ2Ugc28gdGhleSBjYW4gdXBkYXRlIHRoZW1zZWx2ZXMuIFRoaXMgc2hvdWxkbid0IGhhcHBlbiBvdXRzaWRlIG9mIEFTVFxuICAgKiBwbHVnaW5zLlxuICAgKi9cbiAgbG9jRGlkVXBkYXRlKGNoYW5nZXM6IHsgc3RhcnQ/OiBTb3VyY2VQb3NpdGlvbjsgZW5kPzogU291cmNlUG9zaXRpb24gfSk6IHZvaWQ7XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZSBpbnRvIGEge0BzZWUgU2VyaWFsaXplZFNvdXJjZVNwYW59LCB3aGljaCBpcyBjb21wYWN0IGFuZCBkZXNpZ25lZCBmb3IgcmVhZGFiaWxpdHkgaW5cbiAgICogY29udGV4dCBsaWtlIEFTVCBFeHBsb3Jlci4gSWYgeW91IG5lZWQgYSB7QHNlZSBTb3VyY2VMb2NhdGlvbn0sIHVzZSB7QHNlZSB0b0pTT059LlxuICAgKi9cbiAgc2VyaWFsaXplKCk6IFNlcmlhbGl6ZWRTb3VyY2VTcGFuO1xufVxuXG4vKipcbiAqIEEgYFNvdXJjZVNwYW5gIG9iamVjdCByZXByZXNlbnRzIGEgc3BhbiBvZiBjaGFyYWN0ZXJzIGluc2lkZSBvZiBhIHRlbXBsYXRlIHNvdXJjZS5cbiAqXG4gKiBUaGVyZSBhcmUgdGhyZWUga2luZHMgb2YgYFNvdXJjZVNwYW5gIG9iamVjdHM6XG4gKlxuICogLSBgQ29uY3JldGVTb3VyY2VTcGFuYCwgd2hpY2ggY29udGFpbnMgYnl0ZSBvZmZzZXRzXG4gKiAtIGBMYXp5U291cmNlU3BhbmAsIHdoaWNoIGNvbnRhaW5zIGBTb3VyY2VMb2NhdGlvbmBzIGZyb20gdGhlIEhhbmRsZWJhcnMgQVNULCB3aGljaCBjYW4gYmVcbiAqICAgY29udmVydGVkIHRvIGJ5dGUgb2Zmc2V0cyBvbiBkZW1hbmQuXG4gKiAtIGBJbnZpc2libGVTb3VyY2VTcGFuYCwgd2hpY2ggcmVwcmVzZW50IHNvdXJjZSBzdHJpbmdzIHRoYXQgYXJlbid0IHByZXNlbnQgaW4gdGhlIHNvdXJjZSxcbiAqICAgYmVjYXVzZTpcbiAqICAgICAtIHRoZXkgd2VyZSBjcmVhdGVkIHN5bnRoZXRpY2FsbHlcbiAqICAgICAtIHRoZWlyIGxvY2F0aW9uIGlzIG5vbnNlbnNpY2FsICh0aGUgc3BhbiBpcyBicm9rZW4pXG4gKiAgICAgLSB0aGV5IHJlcHJlc2VudCBub3RoaW5nIGluIHRoZSBzb3VyY2UgKHRoaXMgY3VycmVudGx5IGhhcHBlbnMgb25seSB3aGVuIGEgYnVnIGluIHRoZVxuICogICAgICAgdXBzdHJlYW0gSGFuZGxlYmFycyBwYXJzZXIgZmFpbHMgdG8gYXNzaWduIGEgbG9jYXRpb24gdG8gZW1wdHkgYmxvY2tzKVxuICpcbiAqIEF0IGEgaGlnaCBsZXZlbCwgYWxsIGBTb3VyY2VTcGFuYCBvYmplY3RzIHByb3ZpZGU6XG4gKlxuICogLSBieXRlIG9mZnNldHNcbiAqIC0gc291cmNlIGluIGNvbHVtbiBhbmQgbGluZSBmb3JtYXRcbiAqXG4gKiBBbmQgeW91IGNhbiBkbyB0aGVzZSBvcGVyYXRpb25zIG9uIGBTb3VyY2VTcGFuYHM6XG4gKlxuICogLSBjb2xsYXBzZSBpdCB0byBhIGBTb3VyY2VTcGFuYCByZXByZXNlbnRpbmcgaXRzIHN0YXJ0aW5nIG9yIGVuZGluZyBwb3NpdGlvblxuICogLSBzbGljZSBvdXQgc29tZSBjaGFyYWN0ZXJzLCBvcHRpb25hbGx5IHNraXBwaW5nIHNvbWUgY2hhcmFjdGVycyBhdCB0aGUgYmVnaW5uaW5nIG9yIGVuZFxuICogLSBjcmVhdGUgYSBuZXcgYFNvdXJjZVNwYW5gIHdpdGggYSBkaWZmZXJlbnQgc3RhcnRpbmcgb3IgZW5kaW5nIG9mZnNldFxuICpcbiAqIEFsbCBTb3VyY2VTcGFuIG9iamVjdHMgaW1wbGVtZW50IGBTb3VyY2VMb2NhdGlvbmAsIGZvciBjb21wYXRpYmlsaXR5LiBBbGwgU291cmNlU3BhblxuICogb2JqZWN0cyBoYXZlIGEgYHRvSlNPTmAgdGhhdCBlbWl0cyBgU291cmNlTG9jYXRpb25gLCBhbHNvIGZvciBjb21wYXRpYmlsaXR5LlxuICpcbiAqIEZvciBjb21wYXRpYmlsaXR5LCBzdWJjbGFzc2VzIG9mIGBBYnN0cmFjdFNvdXJjZVNwYW5gIG11c3QgaW1wbGVtZW50IGBsb2NEaWRVcGRhdGVgLCB3aGljaFxuICogaGFwcGVucyB3aGVuIGFuIEFTVCBwbHVnaW4gYXR0ZW1wdHMgdG8gbW9kaWZ5IHRoZSBgc3RhcnRgIG9yIGBlbmRgIG9mIGEgc3BhbiBkaXJlY3RseS5cbiAqXG4gKiBUaGUgZ29hbCBpcyB0byBhdm9pZCBjcmVhdGluZyBhbnkgcHJvYmxlbXMgZm9yIHVzZS1jYXNlcyBsaWtlIEFTVCBFeHBsb3Jlci5cbiAqL1xuZXhwb3J0IGNsYXNzIFNvdXJjZVNwYW4gaW1wbGVtZW50cyBTb3VyY2VMb2NhdGlvbiB7XG4gIHN0YXRpYyBnZXQgTk9OX0VYSVNURU5UKCk6IFNvdXJjZVNwYW4ge1xuICAgIHJldHVybiBuZXcgSW52aXNpYmxlU3BhbihPZmZzZXRLaW5kLk5vbkV4aXN0ZW50LCBOT05fRVhJU1RFTlRfTE9DQVRJT04pLndyYXAoKTtcbiAgfVxuXG4gIHN0YXRpYyBsb2FkKHNvdXJjZTogU291cmNlLCBzZXJpYWxpemVkOiBTZXJpYWxpemVkU291cmNlU3Bhbik6IFNvdXJjZVNwYW4ge1xuICAgIGlmICh0eXBlb2Ygc2VyaWFsaXplZCA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiBTb3VyY2VTcGFuLmZvckNoYXJQb3NpdGlvbnMoc291cmNlLCBzZXJpYWxpemVkLCBzZXJpYWxpemVkKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZXJpYWxpemVkID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIFNvdXJjZVNwYW4uc3ludGhldGljKHNlcmlhbGl6ZWQpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShzZXJpYWxpemVkKSkge1xuICAgICAgcmV0dXJuIFNvdXJjZVNwYW4uZm9yQ2hhclBvc2l0aW9ucyhzb3VyY2UsIHNlcmlhbGl6ZWRbMF0sIHNlcmlhbGl6ZWRbMV0pO1xuICAgIH0gZWxzZSBpZiAoc2VyaWFsaXplZCA9PT0gT2Zmc2V0S2luZC5Ob25FeGlzdGVudCkge1xuICAgICAgcmV0dXJuIFNvdXJjZVNwYW4uTk9OX0VYSVNURU5UO1xuICAgIH0gZWxzZSBpZiAoc2VyaWFsaXplZCA9PT0gT2Zmc2V0S2luZC5Ccm9rZW4pIHtcbiAgICAgIHJldHVybiBTb3VyY2VTcGFuLmJyb2tlbihCUk9LRU5fTE9DQVRJT04pO1xuICAgIH1cblxuICAgIGFzc2VydE5ldmVyKHNlcmlhbGl6ZWQpO1xuICB9XG5cbiAgc3RhdGljIGZvckhic0xvYyhzb3VyY2U6IFNvdXJjZSwgbG9jOiBTb3VyY2VMb2NhdGlvbik6IFNvdXJjZVNwYW4ge1xuICAgIGxldCBzdGFydCA9IG5ldyBIYnNQb3NpdGlvbihzb3VyY2UsIGxvYy5zdGFydCk7XG4gICAgbGV0IGVuZCA9IG5ldyBIYnNQb3NpdGlvbihzb3VyY2UsIGxvYy5lbmQpO1xuICAgIHJldHVybiBuZXcgSGJzU3Bhbihzb3VyY2UsIHsgc3RhcnQsIGVuZCB9LCBsb2MpLndyYXAoKTtcbiAgfVxuXG4gIHN0YXRpYyBmb3JDaGFyUG9zaXRpb25zKHNvdXJjZTogU291cmNlLCBzdGFydFBvczogbnVtYmVyLCBlbmRQb3M6IG51bWJlcik6IFNvdXJjZVNwYW4ge1xuICAgIGxldCBzdGFydCA9IG5ldyBDaGFyUG9zaXRpb24oc291cmNlLCBzdGFydFBvcyk7XG4gICAgbGV0IGVuZCA9IG5ldyBDaGFyUG9zaXRpb24oc291cmNlLCBlbmRQb3MpO1xuXG4gICAgcmV0dXJuIG5ldyBDaGFyUG9zaXRpb25TcGFuKHNvdXJjZSwgeyBzdGFydCwgZW5kIH0pLndyYXAoKTtcbiAgfVxuXG4gIHN0YXRpYyBzeW50aGV0aWMoY2hhcnM6IHN0cmluZyk6IFNvdXJjZVNwYW4ge1xuICAgIHJldHVybiBuZXcgSW52aXNpYmxlU3BhbihPZmZzZXRLaW5kLkludGVybmFsc1N5bnRoZXRpYywgTk9OX0VYSVNURU5UX0xPQ0FUSU9OLCBjaGFycykud3JhcCgpO1xuICB9XG5cbiAgc3RhdGljIGJyb2tlbihwb3M6IFNvdXJjZUxvY2F0aW9uID0gQlJPS0VOX0xPQ0FUSU9OKTogU291cmNlU3BhbiB7XG4gICAgcmV0dXJuIG5ldyBJbnZpc2libGVTcGFuKE9mZnNldEtpbmQuQnJva2VuLCBwb3MpLndyYXAoKTtcbiAgfVxuXG4gIHJlYWRvbmx5IGlzSW52aXNpYmxlOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZGF0YTogU3BhbkRhdGEgJiBBbnlTcGFuKSB7XG4gICAgdGhpcy5pc0ludmlzaWJsZSA9XG4gICAgICBkYXRhLmtpbmQgIT09IE9mZnNldEtpbmQuQ2hhclBvc2l0aW9uICYmIGRhdGEua2luZCAhPT0gT2Zmc2V0S2luZC5IYnNQb3NpdGlvbjtcbiAgfVxuXG4gIGdldFN0YXJ0KCk6IFNvdXJjZU9mZnNldCB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5nZXRTdGFydCgpLndyYXAoKTtcbiAgfVxuXG4gIGdldEVuZCgpOiBTb3VyY2VPZmZzZXQge1xuICAgIHJldHVybiB0aGlzLmRhdGEuZ2V0RW5kKCkud3JhcCgpO1xuICB9XG5cbiAgZ2V0IGxvYygpOiBTb3VyY2VMb2NhdGlvbiB7XG4gICAgbGV0IHNwYW4gPSB0aGlzLmRhdGEudG9IYnNTcGFuKCk7XG4gICAgcmV0dXJuIHNwYW4gPT09IG51bGwgPyBCUk9LRU5fTE9DQVRJT04gOiBzcGFuLnRvSGJzTG9jKCk7XG4gIH1cblxuICBnZXQgbW9kdWxlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5nZXRNb2R1bGUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHN0YXJ0aW5nIGBTb3VyY2VQb3NpdGlvbmAgZm9yIHRoaXMgYFNvdXJjZVNwYW5gLCBsYXppbHkgY29tcHV0aW5nIGl0IGlmIG5lZWRlZC5cbiAgICovXG4gIGdldCBzdGFydFBvc2l0aW9uKCk6IFNvdXJjZVBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5sb2Muc3RhcnQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBlbmRpbmcgYFNvdXJjZVBvc2l0aW9uYCBmb3IgdGhpcyBgU291cmNlU3BhbmAsIGxhemlseSBjb21wdXRpbmcgaXQgaWYgbmVlZGVkLlxuICAgKi9cbiAgZ2V0IGVuZFBvc2l0aW9uKCk6IFNvdXJjZVBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5sb2MuZW5kO1xuICB9XG5cbiAgLyoqXG4gICAqIFN1cHBvcnQgY29udmVydGluZyBBU1R2MSBub2RlcyBpbnRvIGEgc2VyaWFsaXplZCBmb3JtYXQgdXNpbmcgSlNPTi5zdHJpbmdpZnkuXG4gICAqL1xuICB0b0pTT04oKTogU291cmNlTG9jYXRpb24ge1xuICAgIHJldHVybiB0aGlzLmxvYztcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgc3BhbiB3aXRoIHRoZSBjdXJyZW50IHNwYW4ncyBlbmQgYW5kIGEgbmV3IGJlZ2lubmluZy5cbiAgICovXG4gIHdpdGhTdGFydChvdGhlcjogU291cmNlT2Zmc2V0KTogU291cmNlU3BhbiB7XG4gICAgcmV0dXJuIHNwYW4ob3RoZXIuZGF0YSwgdGhpcy5kYXRhLmdldEVuZCgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgc3BhbiB3aXRoIHRoZSBjdXJyZW50IHNwYW4ncyBiZWdpbm5pbmcgYW5kIGEgbmV3IGVuZGluZy5cbiAgICovXG4gIHdpdGhFbmQodGhpczogU291cmNlU3Bhbiwgb3RoZXI6IFNvdXJjZU9mZnNldCk6IFNvdXJjZVNwYW4ge1xuICAgIHJldHVybiBzcGFuKHRoaXMuZGF0YS5nZXRTdGFydCgpLCBvdGhlci5kYXRhKTtcbiAgfVxuXG4gIGFzU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5hc1N0cmluZygpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgdGhpcyBgU291cmNlU3BhbmAgaW50byBhIGBTb3VyY2VTbGljZWAuIEluIGRlYnVnIG1vZGUsIHRoaXMgbWV0aG9kIG9wdGlvbmFsbHkgY2hlY2tzXG4gICAqIHRoYXQgdGhlIGJ5dGUgb2Zmc2V0cyByZXByZXNlbnRlZCBieSB0aGlzIGBTb3VyY2VTcGFuYCBhY3R1YWxseSBjb3JyZXNwb25kIHRvIHRoZSBleHBlY3RlZFxuICAgKiBzdHJpbmcuXG4gICAqL1xuICB0b1NsaWNlKGV4cGVjdGVkPzogc3RyaW5nKTogU291cmNlU2xpY2Uge1xuICAgIGxldCBjaGFycyA9IHRoaXMuZGF0YS5hc1N0cmluZygpO1xuXG4gICAgaWYgKERFQlVHKSB7XG4gICAgICBpZiAoZXhwZWN0ZWQgIT09IHVuZGVmaW5lZCAmJiBjaGFycyAhPT0gZXhwZWN0ZWQpIHtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGB1bmV4cGVjdGVkbHkgZm91bmQgJHtKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICAgIGNoYXJzXG4gICAgICAgICAgKX0gd2hlbiBzbGljaW5nIHNvdXJjZSwgYnV0IGV4cGVjdGVkICR7SlNPTi5zdHJpbmdpZnkoZXhwZWN0ZWQpfWBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFNvdXJjZVNsaWNlKHtcbiAgICAgIGxvYzogdGhpcyxcbiAgICAgIGNoYXJzOiBleHBlY3RlZCB8fCBjaGFycyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgY29tcGF0aWJpbGl0eSB3aXRoIFNvdXJjZUxvY2F0aW9uIGluIEFTVCBwbHVnaW5zXG4gICAqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBzdGFydFBvc2l0aW9uIGluc3RlYWRcbiAgICovXG4gIGdldCBzdGFydCgpOiBTb3VyY2VQb3NpdGlvbiB7XG4gICAgcmV0dXJuIHRoaXMubG9jLnN0YXJ0O1xuICB9XG5cbiAgLyoqXG4gICAqIEZvciBjb21wYXRpYmlsaXR5IHdpdGggU291cmNlTG9jYXRpb24gaW4gQVNUIHBsdWdpbnNcbiAgICpcbiAgICogQGRlcHJlY2F0ZWQgdXNlIHdpdGhTdGFydCBpbnN0ZWFkXG4gICAqL1xuICBzZXQgc3RhcnQocG9zaXRpb246IFNvdXJjZVBvc2l0aW9uKSB7XG4gICAgdGhpcy5kYXRhLmxvY0RpZFVwZGF0ZSh7IHN0YXJ0OiBwb3NpdGlvbiB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgY29tcGF0aWJpbGl0eSB3aXRoIFNvdXJjZUxvY2F0aW9uIGluIEFTVCBwbHVnaW5zXG4gICAqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBlbmRQb3NpdGlvbiBpbnN0ZWFkXG4gICAqL1xuICBnZXQgZW5kKCk6IFNvdXJjZVBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5sb2MuZW5kO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvciBjb21wYXRpYmlsaXR5IHdpdGggU291cmNlTG9jYXRpb24gaW4gQVNUIHBsdWdpbnNcbiAgICpcbiAgICogQGRlcHJlY2F0ZWQgdXNlIHdpdGhFbmQgaW5zdGVhZFxuICAgKi9cbiAgc2V0IGVuZChwb3NpdGlvbjogU291cmNlUG9zaXRpb24pIHtcbiAgICB0aGlzLmRhdGEubG9jRGlkVXBkYXRlKHsgZW5kOiBwb3NpdGlvbiB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgY29tcGF0aWJpbGl0eSB3aXRoIFNvdXJjZUxvY2F0aW9uIGluIEFTVCBwbHVnaW5zXG4gICAqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBtb2R1bGUgaW5zdGVhZFxuICAgKi9cbiAgZ2V0IHNvdXJjZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLm1vZHVsZTtcbiAgfVxuXG4gIGNvbGxhcHNlKHdoZXJlOiAnc3RhcnQnIHwgJ2VuZCcpOiBTb3VyY2VTcGFuIHtcbiAgICBzd2l0Y2ggKHdoZXJlKSB7XG4gICAgICBjYXNlICdzdGFydCc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldFN0YXJ0KCkuY29sbGFwc2VkKCk7XG4gICAgICBjYXNlICdlbmQnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRFbmQoKS5jb2xsYXBzZWQoKTtcbiAgICB9XG4gIH1cblxuICBleHRlbmQob3RoZXI6IFNvdXJjZVNwYW4pOiBTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gc3Bhbih0aGlzLmRhdGEuZ2V0U3RhcnQoKSwgb3RoZXIuZGF0YS5nZXRFbmQoKSk7XG4gIH1cblxuICBzZXJpYWxpemUoKTogU2VyaWFsaXplZFNvdXJjZVNwYW4ge1xuICAgIHJldHVybiB0aGlzLmRhdGEuc2VyaWFsaXplKCk7XG4gIH1cblxuICBzbGljZSh7IHNraXBTdGFydCA9IDAsIHNraXBFbmQgPSAwIH06IHsgc2tpcFN0YXJ0PzogbnVtYmVyOyBza2lwRW5kPzogbnVtYmVyIH0pOiBTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gc3Bhbih0aGlzLmdldFN0YXJ0KCkubW92ZShza2lwU3RhcnQpLmRhdGEsIHRoaXMuZ2V0RW5kKCkubW92ZSgtc2tpcEVuZCkuZGF0YSk7XG4gIH1cblxuICBzbGljZVN0YXJ0Q2hhcnMoeyBza2lwU3RhcnQgPSAwLCBjaGFycyB9OiB7IHNraXBTdGFydD86IG51bWJlcjsgY2hhcnM6IG51bWJlciB9KTogU291cmNlU3BhbiB7XG4gICAgcmV0dXJuIHNwYW4odGhpcy5nZXRTdGFydCgpLm1vdmUoc2tpcFN0YXJ0KS5kYXRhLCB0aGlzLmdldFN0YXJ0KCkubW92ZShza2lwU3RhcnQgKyBjaGFycykuZGF0YSk7XG4gIH1cblxuICBzbGljZUVuZENoYXJzKHsgc2tpcEVuZCA9IDAsIGNoYXJzIH06IHsgc2tpcEVuZD86IG51bWJlcjsgY2hhcnM6IG51bWJlciB9KTogU291cmNlU3BhbiB7XG4gICAgcmV0dXJuIHNwYW4odGhpcy5nZXRFbmQoKS5tb3ZlKHNraXBFbmQgLSBjaGFycykuZGF0YSwgdGhpcy5nZXRTdGFydCgpLm1vdmUoLXNraXBFbmQpLmRhdGEpO1xuICB9XG59XG5cbnR5cGUgQW55U3BhbiA9IEhic1NwYW4gfCBDaGFyUG9zaXRpb25TcGFuIHwgSW52aXNpYmxlU3BhbjtcblxuY2xhc3MgQ2hhclBvc2l0aW9uU3BhbiBpbXBsZW1lbnRzIFNwYW5EYXRhIHtcbiAgcmVhZG9ubHkga2luZCA9IE9mZnNldEtpbmQuQ2hhclBvc2l0aW9uO1xuXG4gIF9sb2NQb3NTcGFuOiBIYnNTcGFuIHwgQlJPS0VOIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgc291cmNlOiBTb3VyY2UsXG4gICAgcmVhZG9ubHkgY2hhclBvc2l0aW9uczogeyBzdGFydDogQ2hhclBvc2l0aW9uOyBlbmQ6IENoYXJQb3NpdGlvbiB9XG4gICkge31cblxuICB3cmFwKCk6IFNvdXJjZVNwYW4ge1xuICAgIHJldHVybiBuZXcgU291cmNlU3Bhbih0aGlzKTtcbiAgfVxuXG4gIGFzU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc291cmNlLnNsaWNlKHRoaXMuY2hhclBvc2l0aW9ucy5zdGFydC5jaGFyUG9zLCB0aGlzLmNoYXJQb3NpdGlvbnMuZW5kLmNoYXJQb3MpO1xuICB9XG5cbiAgZ2V0TW9kdWxlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc291cmNlLm1vZHVsZTtcbiAgfVxuXG4gIGdldFN0YXJ0KCk6IEFueVBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5jaGFyUG9zaXRpb25zLnN0YXJ0O1xuICB9XG5cbiAgZ2V0RW5kKCk6IEFueVBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5jaGFyUG9zaXRpb25zLmVuZDtcbiAgfVxuXG4gIGxvY0RpZFVwZGF0ZSgpIHtcbiAgICBpZiAoTE9DQUxfREVCVUcpIHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGB1cGRhdGluZyBhIGxvY2F0aW9uIHRoYXQgY2FtZSBmcm9tIGEgQ2hhclBvc2l0aW9uIHNwYW4gZG9lc24ndCB3b3JrIHJlbGlhYmx5LiBEb24ndCB0cnkgdG8gdXBkYXRlIGxvY2F0aW9ucyBhZnRlciB0aGUgcGx1Z2luIHBoYXNlYFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICB0b0hic1NwYW4oKTogSGJzU3BhbiB8IG51bGwge1xuICAgIGxldCBsb2NQb3NTcGFuID0gdGhpcy5fbG9jUG9zU3BhbjtcblxuICAgIGlmIChsb2NQb3NTcGFuID09PSBudWxsKSB7XG4gICAgICBsZXQgc3RhcnQgPSB0aGlzLmNoYXJQb3NpdGlvbnMuc3RhcnQudG9IYnNQb3MoKTtcbiAgICAgIGxldCBlbmQgPSB0aGlzLmNoYXJQb3NpdGlvbnMuZW5kLnRvSGJzUG9zKCk7XG5cbiAgICAgIGlmIChzdGFydCA9PT0gbnVsbCB8fCBlbmQgPT09IG51bGwpIHtcbiAgICAgICAgbG9jUG9zU3BhbiA9IHRoaXMuX2xvY1Bvc1NwYW4gPSBCUk9LRU47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2NQb3NTcGFuID0gdGhpcy5fbG9jUG9zU3BhbiA9IG5ldyBIYnNTcGFuKHRoaXMuc291cmNlLCB7XG4gICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgZW5kLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbG9jUG9zU3BhbiA9PT0gQlJPS0VOID8gbnVsbCA6IGxvY1Bvc1NwYW47XG4gIH1cblxuICBzZXJpYWxpemUoKTogU2VyaWFsaXplZFNvdXJjZVNwYW4ge1xuICAgIGxldCB7XG4gICAgICBzdGFydDogeyBjaGFyUG9zOiBzdGFydCB9LFxuICAgICAgZW5kOiB7IGNoYXJQb3M6IGVuZCB9LFxuICAgIH0gPSB0aGlzLmNoYXJQb3NpdGlvbnM7XG5cbiAgICBpZiAoc3RhcnQgPT09IGVuZCkge1xuICAgICAgcmV0dXJuIHN0YXJ0O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gW3N0YXJ0LCBlbmRdO1xuICAgIH1cbiAgfVxuXG4gIHRvQ2hhclBvc1NwYW4oKTogQ2hhclBvc2l0aW9uU3BhbiB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEhic1NwYW4gaW1wbGVtZW50cyBTcGFuRGF0YSB7XG4gIHJlYWRvbmx5IGtpbmQgPSBPZmZzZXRLaW5kLkhic1Bvc2l0aW9uO1xuXG4gIF9jaGFyUG9zU3BhbjogQ2hhclBvc2l0aW9uU3BhbiB8IEJST0tFTiB8IG51bGwgPSBudWxsO1xuXG4gIC8vIHRoZSBzb3VyY2UgbG9jYXRpb24gZnJvbSBIYW5kbGViYXJzICsgQVNUIFBsdWdpbnMgLS0gY291bGQgYmUgd3JvbmdcbiAgX3Byb3ZpZGVkSGJzTG9jOiBTb3VyY2VMb2NhdGlvbiB8IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgc291cmNlOiBTb3VyY2UsXG4gICAgcmVhZG9ubHkgaGJzUG9zaXRpb25zOiB7IHN0YXJ0OiBIYnNQb3NpdGlvbjsgZW5kOiBIYnNQb3NpdGlvbiB9LFxuICAgIHByb3ZpZGVkSGJzTG9jOiBTb3VyY2VMb2NhdGlvbiB8IG51bGwgPSBudWxsXG4gICkge1xuICAgIHRoaXMuX3Byb3ZpZGVkSGJzTG9jID0gcHJvdmlkZWRIYnNMb2M7XG4gIH1cblxuICBzZXJpYWxpemUoKTogU2VyaWFsaXplZENvbmNyZXRlU291cmNlU3BhbiB7XG4gICAgbGV0IGNoYXJQb3MgPSB0aGlzLnRvQ2hhclBvc1NwYW4oKTtcbiAgICByZXR1cm4gY2hhclBvcyA9PT0gbnVsbCA/IE9mZnNldEtpbmQuQnJva2VuIDogY2hhclBvcy53cmFwKCkuc2VyaWFsaXplKCk7XG4gIH1cblxuICB3cmFwKCk6IFNvdXJjZVNwYW4ge1xuICAgIHJldHVybiBuZXcgU291cmNlU3Bhbih0aGlzKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlUHJvdmlkZWQocG9zOiBTb3VyY2VQb3NpdGlvbiwgZWRnZTogJ3N0YXJ0JyB8ICdlbmQnKSB7XG4gICAgaWYgKHRoaXMuX3Byb3ZpZGVkSGJzTG9jKSB7XG4gICAgICB0aGlzLl9wcm92aWRlZEhic0xvY1tlZGdlXSA9IHBvcztcbiAgICB9XG5cbiAgICAvLyBpbnZhbGlkYXRlIGNvbXB1dGVkIGNoYXJhY3RlciBvZmZzZXRzXG4gICAgdGhpcy5fY2hhclBvc1NwYW4gPSBudWxsO1xuICAgIHRoaXMuX3Byb3ZpZGVkSGJzTG9jID0ge1xuICAgICAgc3RhcnQ6IHBvcyxcbiAgICAgIGVuZDogcG9zLFxuICAgIH07XG4gIH1cblxuICBsb2NEaWRVcGRhdGUoeyBzdGFydCwgZW5kIH06IHsgc3RhcnQ/OiBTb3VyY2VQb3NpdGlvbjsgZW5kPzogU291cmNlUG9zaXRpb24gfSk6IHZvaWQge1xuICAgIGlmIChzdGFydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnVwZGF0ZVByb3ZpZGVkKHN0YXJ0LCAnc3RhcnQnKTtcbiAgICAgIHRoaXMuaGJzUG9zaXRpb25zLnN0YXJ0ID0gbmV3IEhic1Bvc2l0aW9uKHRoaXMuc291cmNlLCBzdGFydCwgbnVsbCk7XG4gICAgfVxuXG4gICAgaWYgKGVuZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnVwZGF0ZVByb3ZpZGVkKGVuZCwgJ2VuZCcpO1xuICAgICAgdGhpcy5oYnNQb3NpdGlvbnMuZW5kID0gbmV3IEhic1Bvc2l0aW9uKHRoaXMuc291cmNlLCBlbmQsIG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIGFzU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgbGV0IHNwYW4gPSB0aGlzLnRvQ2hhclBvc1NwYW4oKTtcbiAgICByZXR1cm4gc3BhbiA9PT0gbnVsbCA/ICcnIDogc3Bhbi5hc1N0cmluZygpO1xuICB9XG5cbiAgZ2V0TW9kdWxlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc291cmNlLm1vZHVsZTtcbiAgfVxuXG4gIGdldFN0YXJ0KCk6IEFueVBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5oYnNQb3NpdGlvbnMuc3RhcnQ7XG4gIH1cblxuICBnZXRFbmQoKTogQW55UG9zaXRpb24ge1xuICAgIHJldHVybiB0aGlzLmhic1Bvc2l0aW9ucy5lbmQ7XG4gIH1cblxuICB0b0hic0xvYygpOiBTb3VyY2VMb2NhdGlvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXJ0OiB0aGlzLmhic1Bvc2l0aW9ucy5zdGFydC5oYnNQb3MsXG4gICAgICBlbmQ6IHRoaXMuaGJzUG9zaXRpb25zLmVuZC5oYnNQb3MsXG4gICAgfTtcbiAgfVxuXG4gIHRvSGJzU3BhbigpOiBIYnNTcGFuIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHRvQ2hhclBvc1NwYW4oKTogQ2hhclBvc2l0aW9uU3BhbiB8IG51bGwge1xuICAgIGxldCBjaGFyUG9zU3BhbiA9IHRoaXMuX2NoYXJQb3NTcGFuO1xuXG4gICAgaWYgKGNoYXJQb3NTcGFuID09PSBudWxsKSB7XG4gICAgICBsZXQgc3RhcnQgPSB0aGlzLmhic1Bvc2l0aW9ucy5zdGFydC50b0NoYXJQb3MoKTtcbiAgICAgIGxldCBlbmQgPSB0aGlzLmhic1Bvc2l0aW9ucy5lbmQudG9DaGFyUG9zKCk7XG5cbiAgICAgIGlmIChzdGFydCAmJiBlbmQpIHtcbiAgICAgICAgY2hhclBvc1NwYW4gPSB0aGlzLl9jaGFyUG9zU3BhbiA9IG5ldyBDaGFyUG9zaXRpb25TcGFuKHRoaXMuc291cmNlLCB7XG4gICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgZW5kLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoYXJQb3NTcGFuID0gdGhpcy5fY2hhclBvc1NwYW4gPSBCUk9LRU47XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjaGFyUG9zU3BhbiA9PT0gQlJPS0VOID8gbnVsbCA6IGNoYXJQb3NTcGFuO1xuICB9XG59XG5cbmNsYXNzIEludmlzaWJsZVNwYW4gaW1wbGVtZW50cyBTcGFuRGF0YSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHJlYWRvbmx5IGtpbmQ6IE9mZnNldEtpbmQuQnJva2VuIHwgT2Zmc2V0S2luZC5JbnRlcm5hbHNTeW50aGV0aWMgfCBPZmZzZXRLaW5kLk5vbkV4aXN0ZW50LFxuICAgIC8vIHdoYXRldmVyIHdhcyBwcm92aWRlZCwgcG9zc2libHkgYnJva2VuXG4gICAgcmVhZG9ubHkgbG9jOiBTb3VyY2VMb2NhdGlvbixcbiAgICAvLyBpZiB0aGUgc3BhbiByZXByZXNlbnRzIGEgc3ludGhldGljIHN0cmluZ1xuICAgIHJlYWRvbmx5IHN0cmluZzogc3RyaW5nIHwgbnVsbCA9IG51bGxcbiAgKSB7fVxuXG4gIHNlcmlhbGl6ZSgpOiBTZXJpYWxpemVkQ29uY3JldGVTb3VyY2VTcGFuIHtcbiAgICBzd2l0Y2ggKHRoaXMua2luZCkge1xuICAgICAgY2FzZSBPZmZzZXRLaW5kLkJyb2tlbjpcbiAgICAgIGNhc2UgT2Zmc2V0S2luZC5Ob25FeGlzdGVudDpcbiAgICAgICAgcmV0dXJuIHRoaXMua2luZDtcbiAgICAgIGNhc2UgT2Zmc2V0S2luZC5JbnRlcm5hbHNTeW50aGV0aWM6XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmluZyB8fCAnJztcbiAgICB9XG4gIH1cblxuICB3cmFwKCk6IFNvdXJjZVNwYW4ge1xuICAgIHJldHVybiBuZXcgU291cmNlU3Bhbih0aGlzKTtcbiAgfVxuXG4gIGFzU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc3RyaW5nIHx8ICcnO1xuICB9XG5cbiAgbG9jRGlkVXBkYXRlKHsgc3RhcnQsIGVuZCB9OiB7IHN0YXJ0PzogU291cmNlUG9zaXRpb247IGVuZD86IFNvdXJjZVBvc2l0aW9uIH0pIHtcbiAgICBpZiAoc3RhcnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5sb2Muc3RhcnQgPSBzdGFydDtcbiAgICB9XG5cbiAgICBpZiAoZW5kICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubG9jLmVuZCA9IGVuZDtcbiAgICB9XG4gIH1cblxuICBnZXRNb2R1bGUoKTogc3RyaW5nIHtcbiAgICAvLyBUT0RPOiBNYWtlIHRoaXMgcmVmbGVjdCB0aGUgYWN0dWFsIG1vZHVsZSB0aGlzIHNwYW4gb3JpZ2luYXRlZCBmcm9tXG4gICAgcmV0dXJuICdhbiB1bmtub3duIG1vZHVsZSc7XG4gIH1cblxuICBnZXRTdGFydCgpOiBBbnlQb3NpdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBJbnZpc2libGVQb3NpdGlvbih0aGlzLmtpbmQsIHRoaXMubG9jLnN0YXJ0KTtcbiAgfVxuXG4gIGdldEVuZCgpOiBBbnlQb3NpdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBJbnZpc2libGVQb3NpdGlvbih0aGlzLmtpbmQsIHRoaXMubG9jLmVuZCk7XG4gIH1cblxuICB0b0NoYXJQb3NTcGFuKCk6IEludmlzaWJsZVNwYW4ge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdG9IYnNTcGFuKCk6IG51bGwge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdG9IYnNMb2MoKTogU291cmNlTG9jYXRpb24ge1xuICAgIHJldHVybiBCUk9LRU5fTE9DQVRJT047XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IHNwYW46IE1hdGNoRm48U291cmNlU3Bhbj4gPSBtYXRjaCgobSkgPT5cbiAgbVxuICAgIC53aGVuKE9mZnNldEtpbmQuSGJzUG9zaXRpb24sIE9mZnNldEtpbmQuSGJzUG9zaXRpb24sIChsZWZ0LCByaWdodCkgPT5cbiAgICAgIG5ldyBIYnNTcGFuKGxlZnQuc291cmNlLCB7XG4gICAgICAgIHN0YXJ0OiBsZWZ0LFxuICAgICAgICBlbmQ6IHJpZ2h0LFxuICAgICAgfSkud3JhcCgpXG4gICAgKVxuICAgIC53aGVuKE9mZnNldEtpbmQuQ2hhclBvc2l0aW9uLCBPZmZzZXRLaW5kLkNoYXJQb3NpdGlvbiwgKGxlZnQsIHJpZ2h0KSA9PlxuICAgICAgbmV3IENoYXJQb3NpdGlvblNwYW4obGVmdC5zb3VyY2UsIHtcbiAgICAgICAgc3RhcnQ6IGxlZnQsXG4gICAgICAgIGVuZDogcmlnaHQsXG4gICAgICB9KS53cmFwKClcbiAgICApXG4gICAgLndoZW4oT2Zmc2V0S2luZC5DaGFyUG9zaXRpb24sIE9mZnNldEtpbmQuSGJzUG9zaXRpb24sIChsZWZ0LCByaWdodCkgPT4ge1xuICAgICAgbGV0IHJpZ2h0Q2hhclBvcyA9IHJpZ2h0LnRvQ2hhclBvcygpO1xuXG4gICAgICBpZiAocmlnaHRDaGFyUG9zID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBuZXcgSW52aXNpYmxlU3BhbihPZmZzZXRLaW5kLkJyb2tlbiwgQlJPS0VOX0xPQ0FUSU9OKS53cmFwKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gc3BhbihsZWZ0LCByaWdodENoYXJQb3MpO1xuICAgICAgfVxuICAgIH0pXG4gICAgLndoZW4oT2Zmc2V0S2luZC5IYnNQb3NpdGlvbiwgT2Zmc2V0S2luZC5DaGFyUG9zaXRpb24sIChsZWZ0LCByaWdodCkgPT4ge1xuICAgICAgbGV0IGxlZnRDaGFyUG9zID0gbGVmdC50b0NoYXJQb3MoKTtcblxuICAgICAgaWYgKGxlZnRDaGFyUG9zID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBuZXcgSW52aXNpYmxlU3BhbihPZmZzZXRLaW5kLkJyb2tlbiwgQlJPS0VOX0xPQ0FUSU9OKS53cmFwKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gc3BhbihsZWZ0Q2hhclBvcywgcmlnaHQpO1xuICAgICAgfVxuICAgIH0pXG4gICAgLndoZW4oSXNJbnZpc2libGUsIE1hdGNoQW55LCAobGVmdCkgPT4gbmV3IEludmlzaWJsZVNwYW4obGVmdC5raW5kLCBCUk9LRU5fTE9DQVRJT04pLndyYXAoKSlcbiAgICAud2hlbihNYXRjaEFueSwgSXNJbnZpc2libGUsIChfLCByaWdodCkgPT5cbiAgICAgIG5ldyBJbnZpc2libGVTcGFuKHJpZ2h0LmtpbmQsIEJST0tFTl9MT0NBVElPTikud3JhcCgpXG4gICAgKVxuKTtcblxuZXhwb3J0IHR5cGUgU2VyaWFsaXplZENvbmNyZXRlU291cmNlU3BhbiA9XG4gIHwgLyoqIGNvbGxhcHNlZCAqLyBudW1iZXJcbiAgfCAvKiogbm9ybWFsICovIFtzdGFydDogbnVtYmVyLCBzaXplOiBudW1iZXJdXG4gIHwgLyoqIHN5bnRoZXRpYyAqLyBzdHJpbmc7XG5cbmV4cG9ydCB0eXBlIFNlcmlhbGl6ZWRTb3VyY2VTcGFuID1cbiAgfCBTZXJpYWxpemVkQ29uY3JldGVTb3VyY2VTcGFuXG4gIHwgT2Zmc2V0S2luZC5Ob25FeGlzdGVudFxuICB8IE9mZnNldEtpbmQuQnJva2VuO1xuIiwiLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llc1xuaW1wb3J0IHsgREVCVUcgfSBmcm9tICdAZ2xpbW1lci9lbnYnO1xuaW1wb3J0IHR5cGUgeyBPcHRpb24gfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gJ0BnbGltbWVyL3V0aWwnO1xuXG5pbXBvcnQgeyBTb3VyY2VMb2NhdGlvbiwgU291cmNlUG9zaXRpb24gfSBmcm9tICcuL2xvY2F0aW9uJztcbmltcG9ydCB7IFNvdXJjZU9mZnNldCwgU291cmNlU3BhbiB9IGZyb20gJy4vc3Bhbic7XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2Uge1xuICBjb25zdHJ1Y3RvcihyZWFkb25seSBzb3VyY2U6IHN0cmluZywgcmVhZG9ubHkgbW9kdWxlOiBzdHJpbmcgPSAnYW4gdW5rbm93biBtb2R1bGUnKSB7fVxuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSB0aGF0IHRoZSBjaGFyYWN0ZXIgb2Zmc2V0IHJlcHJlc2VudHMgYSBwb3NpdGlvbiBpbiB0aGUgc291cmNlIHN0cmluZy5cbiAgICovXG4gIGNoZWNrKG9mZnNldDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIG9mZnNldCA+PSAwICYmIG9mZnNldCA8PSB0aGlzLnNvdXJjZS5sZW5ndGg7XG4gIH1cblxuICBzbGljZShzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcik6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc291cmNlLnNsaWNlKHN0YXJ0LCBlbmQpO1xuICB9XG5cbiAgb2Zmc2V0Rm9yKGxpbmU6IG51bWJlciwgY29sdW1uOiBudW1iZXIpOiBTb3VyY2VPZmZzZXQge1xuICAgIHJldHVybiBTb3VyY2VPZmZzZXQuZm9ySGJzUG9zKHRoaXMsIHsgbGluZSwgY29sdW1uIH0pO1xuICB9XG5cbiAgc3BhbkZvcih7IHN0YXJ0LCBlbmQgfTogUmVhZG9ubHk8U291cmNlTG9jYXRpb24+KTogU291cmNlU3BhbiB7XG4gICAgcmV0dXJuIFNvdXJjZVNwYW4uZm9ySGJzTG9jKHRoaXMsIHtcbiAgICAgIHN0YXJ0OiB7IGxpbmU6IHN0YXJ0LmxpbmUsIGNvbHVtbjogc3RhcnQuY29sdW1uIH0sXG4gICAgICBlbmQ6IHsgbGluZTogZW5kLmxpbmUsIGNvbHVtbjogZW5kLmNvbHVtbiB9LFxuICAgIH0pO1xuICB9XG5cbiAgaGJzUG9zRm9yKG9mZnNldDogbnVtYmVyKTogT3B0aW9uPFNvdXJjZVBvc2l0aW9uPiB7XG4gICAgbGV0IHNlZW5MaW5lcyA9IDA7XG4gICAgbGV0IHNlZW5DaGFycyA9IDA7XG5cbiAgICBpZiAob2Zmc2V0ID4gdGhpcy5zb3VyY2UubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgbGV0IG5leHRMaW5lID0gdGhpcy5zb3VyY2UuaW5kZXhPZignXFxuJywgc2VlbkNoYXJzKTtcblxuICAgICAgaWYgKG9mZnNldCA8PSBuZXh0TGluZSB8fCBuZXh0TGluZSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBsaW5lOiBzZWVuTGluZXMgKyAxLFxuICAgICAgICAgIGNvbHVtbjogb2Zmc2V0IC0gc2VlbkNoYXJzLFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VlbkxpbmVzICs9IDE7XG4gICAgICAgIHNlZW5DaGFycyA9IG5leHRMaW5lICsgMTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjaGFyUG9zRm9yKHBvc2l0aW9uOiBTb3VyY2VQb3NpdGlvbik6IG51bWJlciB8IG51bGwge1xuICAgIGxldCB7IGxpbmUsIGNvbHVtbiB9ID0gcG9zaXRpb247XG4gICAgbGV0IHNvdXJjZVN0cmluZyA9IHRoaXMuc291cmNlO1xuICAgIGxldCBzb3VyY2VMZW5ndGggPSBzb3VyY2VTdHJpbmcubGVuZ3RoO1xuICAgIGxldCBzZWVuTGluZXMgPSAwO1xuICAgIGxldCBzZWVuQ2hhcnMgPSAwO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmIChzZWVuQ2hhcnMgPj0gc291cmNlTGVuZ3RoKSByZXR1cm4gc291cmNlTGVuZ3RoO1xuXG4gICAgICBsZXQgbmV4dExpbmUgPSB0aGlzLnNvdXJjZS5pbmRleE9mKCdcXG4nLCBzZWVuQ2hhcnMpO1xuICAgICAgaWYgKG5leHRMaW5lID09PSAtMSkgbmV4dExpbmUgPSB0aGlzLnNvdXJjZS5sZW5ndGg7XG5cbiAgICAgIGlmIChzZWVuTGluZXMgPT09IGxpbmUgLSAxKSB7XG4gICAgICAgIGlmIChzZWVuQ2hhcnMgKyBjb2x1bW4gPiBuZXh0TGluZSkgcmV0dXJuIG5leHRMaW5lO1xuXG4gICAgICAgIGlmIChERUJVRykge1xuICAgICAgICAgIGxldCByb3VuZFRyaXAgPSB0aGlzLmhic1Bvc0ZvcihzZWVuQ2hhcnMgKyBjb2x1bW4pO1xuICAgICAgICAgIGFzc2VydChyb3VuZFRyaXAgIT09IG51bGwsIGB0aGUgcmV0dXJuZWQgb2Zmc2V0IGZhaWxlZCB0byByb3VuZC10cmlwYCk7XG4gICAgICAgICAgYXNzZXJ0KHJvdW5kVHJpcC5saW5lID09PSBsaW5lLCBgdGhlIHJvdW5kLXRyaXBwZWQgbGluZSBkaWRuJ3QgbWF0Y2ggdGhlIG9yaWdpbmFsIGxpbmVgKTtcbiAgICAgICAgICBhc3NlcnQoXG4gICAgICAgICAgICByb3VuZFRyaXAuY29sdW1uID09PSBjb2x1bW4sXG4gICAgICAgICAgICBgdGhlIHJvdW5kLXRyaXBwZWQgY29sdW1uIGRpZG4ndCBtYXRjaCB0aGUgb3JpZ2luYWwgY29sdW1uYFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2VlbkNoYXJzICsgY29sdW1uO1xuICAgICAgfSBlbHNlIGlmIChuZXh0TGluZSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWVuTGluZXMgKz0gMTtcbiAgICAgICAgc2VlbkNoYXJzID0gbmV4dExpbmUgKyAxO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgU291cmNlU3BhbiB9IGZyb20gJy4uL3NvdXJjZS9zcGFuJztcbmltcG9ydCB7IFBhdGhFeHByZXNzaW9uLCBQYXRoSGVhZCB9IGZyb20gJy4vbm9kZXMtdjEnO1xuaW1wb3J0IGIgZnJvbSAnLi9wdWJsaWMtYnVpbGRlcnMnO1xuXG5leHBvcnQgY2xhc3MgUGF0aEV4cHJlc3Npb25JbXBsVjEgaW1wbGVtZW50cyBQYXRoRXhwcmVzc2lvbiB7XG4gIHR5cGU6ICdQYXRoRXhwcmVzc2lvbicgPSAnUGF0aEV4cHJlc3Npb24nO1xuICBwdWJsaWMgcGFydHM6IHN0cmluZ1tdO1xuICBwdWJsaWMgdGhpcyA9IGZhbHNlO1xuICBwdWJsaWMgZGF0YSA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBvcmlnaW5hbDogc3RyaW5nLCBoZWFkOiBQYXRoSGVhZCwgdGFpbDogc3RyaW5nW10sIHB1YmxpYyBsb2M6IFNvdXJjZVNwYW4pIHtcbiAgICBsZXQgcGFydHMgPSB0YWlsLnNsaWNlKCk7XG5cbiAgICBpZiAoaGVhZC50eXBlID09PSAnVGhpc0hlYWQnKSB7XG4gICAgICB0aGlzLnRoaXMgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoaGVhZC50eXBlID09PSAnQXRIZWFkJykge1xuICAgICAgdGhpcy5kYXRhID0gdHJ1ZTtcbiAgICAgIHBhcnRzLnVuc2hpZnQoaGVhZC5uYW1lLnNsaWNlKDEpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFydHMudW5zaGlmdChoZWFkLm5hbWUpO1xuICAgIH1cblxuICAgIHRoaXMucGFydHMgPSBwYXJ0cztcbiAgfVxuXG4gIC8vIENhY2hlIGZvciB0aGUgaGVhZCB2YWx1ZS5cbiAgX2hlYWQ/OiBQYXRoSGVhZCA9IHVuZGVmaW5lZDtcblxuICBnZXQgaGVhZCgpOiBQYXRoSGVhZCB7XG4gICAgaWYgKHRoaXMuX2hlYWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9oZWFkO1xuICAgIH1cblxuICAgIGxldCBmaXJzdFBhcnQ6IHN0cmluZztcblxuICAgIGlmICh0aGlzLnRoaXMpIHtcbiAgICAgIGZpcnN0UGFydCA9ICd0aGlzJztcbiAgICB9IGVsc2UgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgZmlyc3RQYXJ0ID0gYEAke3RoaXMucGFydHNbMF19YDtcbiAgICB9IGVsc2Uge1xuICAgICAgZmlyc3RQYXJ0ID0gdGhpcy5wYXJ0c1swXTtcbiAgICB9XG5cbiAgICBsZXQgZmlyc3RQYXJ0TG9jID0gdGhpcy5sb2MuY29sbGFwc2UoJ3N0YXJ0Jykuc2xpY2VTdGFydENoYXJzKHtcbiAgICAgIGNoYXJzOiBmaXJzdFBhcnQubGVuZ3RoLFxuICAgIH0pLmxvYztcblxuICAgIHJldHVybiAodGhpcy5faGVhZCA9IGIuaGVhZChmaXJzdFBhcnQsIGZpcnN0UGFydExvYykpO1xuICB9XG5cbiAgZ2V0IHRhaWwoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLnRoaXMgPyB0aGlzLnBhcnRzIDogdGhpcy5wYXJ0cy5zbGljZSgxKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgRGljdCwgT3B0aW9uIH0gZnJvbSAnQGdsaW1tZXIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBMT0NBTF9ERUJVRyB9IGZyb20gJ0BnbGltbWVyL2xvY2FsLWRlYnVnLWZsYWdzJztcbmltcG9ydCB7IGFzc2VydCwgYXNzaWduLCBkZXByZWNhdGUsIGlzUHJlc2VudCB9IGZyb20gJ0BnbGltbWVyL3V0aWwnO1xuXG5pbXBvcnQgeyBTb3VyY2VMb2NhdGlvbiwgU291cmNlUG9zaXRpb24sIFNZTlRIRVRJQ19MT0NBVElPTiB9IGZyb20gJy4uL3NvdXJjZS9sb2NhdGlvbic7XG5pbXBvcnQgeyBTb3VyY2UgfSBmcm9tICcuLi9zb3VyY2Uvc291cmNlJztcbmltcG9ydCB7IFNvdXJjZVNwYW4gfSBmcm9tICcuLi9zb3VyY2Uvc3Bhbic7XG5pbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuL2FwaSc7XG5pbXBvcnQgeyBQYXRoRXhwcmVzc2lvbkltcGxWMSB9IGZyb20gJy4vbGVnYWN5LWludGVyb3AnO1xuXG5sZXQgX1NPVVJDRTogU291cmNlIHwgdW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBTT1VSQ0UoKTogU291cmNlIHtcbiAgaWYgKCFfU09VUkNFKSB7XG4gICAgX1NPVVJDRSA9IG5ldyBTb3VyY2UoJycsICcoc3ludGhldGljKScpO1xuICB9XG5cbiAgcmV0dXJuIF9TT1VSQ0U7XG59XG5cbi8vIGNvbnN0IFNPVVJDRSA9IG5ldyBTb3VyY2UoJycsICcodGVzdHMpJyk7XG5cbi8vIFN0YXRlbWVudHNcblxuZXhwb3J0IHR5cGUgQnVpbGRlckhlYWQgPSBzdHJpbmcgfCBBU1R2MS5FeHByZXNzaW9uO1xuZXhwb3J0IHR5cGUgVGFnRGVzY3JpcHRvciA9IHN0cmluZyB8IHsgbmFtZTogc3RyaW5nOyBzZWxmQ2xvc2luZzogYm9vbGVhbiB9O1xuXG5mdW5jdGlvbiBidWlsZE11c3RhY2hlKFxuICBwYXRoOiBCdWlsZGVySGVhZCB8IEFTVHYxLkxpdGVyYWwsXG4gIHBhcmFtcz86IEFTVHYxLkV4cHJlc3Npb25bXSxcbiAgaGFzaD86IEFTVHYxLkhhc2gsXG4gIHJhdz86IGJvb2xlYW4sXG4gIGxvYz86IFNvdXJjZUxvY2F0aW9uLFxuICBzdHJpcD86IEFTVHYxLlN0cmlwRmxhZ3Ncbik6IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50IHtcbiAgaWYgKHR5cGVvZiBwYXRoID09PSAnc3RyaW5nJykge1xuICAgIHBhdGggPSBidWlsZFBhdGgocGF0aCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdNdXN0YWNoZVN0YXRlbWVudCcsXG4gICAgcGF0aCxcbiAgICBwYXJhbXM6IHBhcmFtcyB8fCBbXSxcbiAgICBoYXNoOiBoYXNoIHx8IGJ1aWxkSGFzaChbXSksXG4gICAgZXNjYXBlZDogIXJhdyxcbiAgICB0cnVzdGluZzogISFyYXcsXG4gICAgbG9jOiBidWlsZExvYyhsb2MgfHwgbnVsbCksXG4gICAgc3RyaXA6IHN0cmlwIHx8IHsgb3BlbjogZmFsc2UsIGNsb3NlOiBmYWxzZSB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZEJsb2NrKFxuICBwYXRoOiBCdWlsZGVySGVhZCxcbiAgcGFyYW1zOiBPcHRpb248QVNUdjEuRXhwcmVzc2lvbltdPixcbiAgaGFzaDogT3B0aW9uPEFTVHYxLkhhc2g+LFxuICBfZGVmYXVsdEJsb2NrOiBBU1R2MS5Qb3NzaWJseURlcHJlY2F0ZWRCbG9jayxcbiAgX2Vsc2VCbG9jaz86IE9wdGlvbjxBU1R2MS5Qb3NzaWJseURlcHJlY2F0ZWRCbG9jaz4sXG4gIGxvYz86IFNvdXJjZUxvY2F0aW9uLFxuICBvcGVuU3RyaXA/OiBBU1R2MS5TdHJpcEZsYWdzLFxuICBpbnZlcnNlU3RyaXA/OiBBU1R2MS5TdHJpcEZsYWdzLFxuICBjbG9zZVN0cmlwPzogQVNUdjEuU3RyaXBGbGFnc1xuKTogQVNUdjEuQmxvY2tTdGF0ZW1lbnQge1xuICBsZXQgZGVmYXVsdEJsb2NrOiBBU1R2MS5CbG9jaztcbiAgbGV0IGVsc2VCbG9jazogT3B0aW9uPEFTVHYxLkJsb2NrPiB8IHVuZGVmaW5lZDtcblxuICBpZiAoX2RlZmF1bHRCbG9jay50eXBlID09PSAnVGVtcGxhdGUnKSB7XG4gICAgaWYgKExPQ0FMX0RFQlVHKSB7XG4gICAgICBkZXByZWNhdGUoYGIucHJvZ3JhbSBpcyBkZXByZWNhdGVkLiBVc2UgYi5ibG9ja0l0c2VsZiBpbnN0ZWFkLmApO1xuICAgIH1cblxuICAgIGRlZmF1bHRCbG9jayA9IChhc3NpZ24oe30sIF9kZWZhdWx0QmxvY2ssIHsgdHlwZTogJ0Jsb2NrJyB9KSBhcyB1bmtub3duKSBhcyBBU1R2MS5CbG9jaztcbiAgfSBlbHNlIHtcbiAgICBkZWZhdWx0QmxvY2sgPSBfZGVmYXVsdEJsb2NrO1xuICB9XG5cbiAgaWYgKF9lbHNlQmxvY2sgIT09IHVuZGVmaW5lZCAmJiBfZWxzZUJsb2NrICE9PSBudWxsICYmIF9lbHNlQmxvY2sudHlwZSA9PT0gJ1RlbXBsYXRlJykge1xuICAgIGlmIChMT0NBTF9ERUJVRykge1xuICAgICAgZGVwcmVjYXRlKGBiLnByb2dyYW0gaXMgZGVwcmVjYXRlZC4gVXNlIGIuYmxvY2tJdHNlbGYgaW5zdGVhZC5gKTtcbiAgICB9XG5cbiAgICBlbHNlQmxvY2sgPSAoYXNzaWduKHt9LCBfZWxzZUJsb2NrLCB7IHR5cGU6ICdCbG9jaycgfSkgYXMgdW5rbm93bikgYXMgQVNUdjEuQmxvY2s7XG4gIH0gZWxzZSB7XG4gICAgZWxzZUJsb2NrID0gX2Vsc2VCbG9jaztcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0Jsb2NrU3RhdGVtZW50JyxcbiAgICBwYXRoOiBidWlsZFBhdGgocGF0aCksXG4gICAgcGFyYW1zOiBwYXJhbXMgfHwgW10sXG4gICAgaGFzaDogaGFzaCB8fCBidWlsZEhhc2goW10pLFxuICAgIHByb2dyYW06IGRlZmF1bHRCbG9jayB8fCBudWxsLFxuICAgIGludmVyc2U6IGVsc2VCbG9jayB8fCBudWxsLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICAgIG9wZW5TdHJpcDogb3BlblN0cmlwIHx8IHsgb3BlbjogZmFsc2UsIGNsb3NlOiBmYWxzZSB9LFxuICAgIGludmVyc2VTdHJpcDogaW52ZXJzZVN0cmlwIHx8IHsgb3BlbjogZmFsc2UsIGNsb3NlOiBmYWxzZSB9LFxuICAgIGNsb3NlU3RyaXA6IGNsb3NlU3RyaXAgfHwgeyBvcGVuOiBmYWxzZSwgY2xvc2U6IGZhbHNlIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkRWxlbWVudE1vZGlmaWVyKFxuICBwYXRoOiBCdWlsZGVySGVhZCB8IEFTVHYxLkV4cHJlc3Npb24sXG4gIHBhcmFtcz86IEFTVHYxLkV4cHJlc3Npb25bXSxcbiAgaGFzaD86IEFTVHYxLkhhc2gsXG4gIGxvYz86IE9wdGlvbjxTb3VyY2VMb2NhdGlvbj5cbik6IEFTVHYxLkVsZW1lbnRNb2RpZmllclN0YXRlbWVudCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0VsZW1lbnRNb2RpZmllclN0YXRlbWVudCcsXG4gICAgcGF0aDogYnVpbGRQYXRoKHBhdGgpLFxuICAgIHBhcmFtczogcGFyYW1zIHx8IFtdLFxuICAgIGhhc2g6IGhhc2ggfHwgYnVpbGRIYXNoKFtdKSxcbiAgICBsb2M6IGJ1aWxkTG9jKGxvYyB8fCBudWxsKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRQYXJ0aWFsKFxuICBuYW1lOiBBU1R2MS5QYXRoRXhwcmVzc2lvbixcbiAgcGFyYW1zPzogQVNUdjEuRXhwcmVzc2lvbltdLFxuICBoYXNoPzogQVNUdjEuSGFzaCxcbiAgaW5kZW50Pzogc3RyaW5nLFxuICBsb2M/OiBTb3VyY2VMb2NhdGlvblxuKTogQVNUdjEuUGFydGlhbFN0YXRlbWVudCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ1BhcnRpYWxTdGF0ZW1lbnQnLFxuICAgIG5hbWU6IG5hbWUsXG4gICAgcGFyYW1zOiBwYXJhbXMgfHwgW10sXG4gICAgaGFzaDogaGFzaCB8fCBidWlsZEhhc2goW10pLFxuICAgIGluZGVudDogaW5kZW50IHx8ICcnLFxuICAgIHN0cmlwOiB7IG9wZW46IGZhbHNlLCBjbG9zZTogZmFsc2UgfSxcbiAgICBsb2M6IGJ1aWxkTG9jKGxvYyB8fCBudWxsKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRDb21tZW50KHZhbHVlOiBzdHJpbmcsIGxvYz86IFNvdXJjZUxvY2F0aW9uKTogQVNUdjEuQ29tbWVudFN0YXRlbWVudCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0NvbW1lbnRTdGF0ZW1lbnQnLFxuICAgIHZhbHVlOiB2YWx1ZSxcbiAgICBsb2M6IGJ1aWxkTG9jKGxvYyB8fCBudWxsKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRNdXN0YWNoZUNvbW1lbnQodmFsdWU6IHN0cmluZywgbG9jPzogU291cmNlTG9jYXRpb24pOiBBU1R2MS5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQnLFxuICAgIHZhbHVlOiB2YWx1ZSxcbiAgICBsb2M6IGJ1aWxkTG9jKGxvYyB8fCBudWxsKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRDb25jYXQoXG4gIHBhcnRzOiAoQVNUdjEuVGV4dE5vZGUgfCBBU1R2MS5NdXN0YWNoZVN0YXRlbWVudClbXSxcbiAgbG9jPzogU291cmNlTG9jYXRpb25cbik6IEFTVHYxLkNvbmNhdFN0YXRlbWVudCB7XG4gIGlmICghaXNQcmVzZW50KHBhcnRzKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgYi5jb25jYXQgcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcnRgKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0NvbmNhdFN0YXRlbWVudCcsXG4gICAgcGFydHM6IHBhcnRzIHx8IFtdLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG4vLyBOb2Rlc1xuXG5leHBvcnQgdHlwZSBFbGVtZW50UGFydHMgPVxuICB8IFsnYXR0cnMnLCAuLi5BdHRyU2V4cFtdXVxuICB8IFsnbW9kaWZpZXJzJywgLi4uTW9kaWZpZXJTZXhwW11dXG4gIHwgWydib2R5JywgLi4uQVNUdjEuU3RhdGVtZW50W11dXG4gIHwgWydjb21tZW50cycsIC4uLkVsZW1lbnRDb21tZW50W11dXG4gIHwgWydhcycsIC4uLnN0cmluZ1tdXVxuICB8IFsnbG9jJywgU291cmNlTG9jYXRpb25dO1xuXG5leHBvcnQgdHlwZSBQYXRoU2V4cCA9IHN0cmluZyB8IFsncGF0aCcsIHN0cmluZywgTG9jU2V4cD9dO1xuXG5leHBvcnQgdHlwZSBNb2RpZmllclNleHAgPVxuICB8IHN0cmluZ1xuICB8IFtQYXRoU2V4cCwgTG9jU2V4cD9dXG4gIHwgW1BhdGhTZXhwLCBBU1R2MS5FeHByZXNzaW9uW10sIExvY1NleHA/XVxuICB8IFtQYXRoU2V4cCwgQVNUdjEuRXhwcmVzc2lvbltdLCBEaWN0PEFTVHYxLkV4cHJlc3Npb24+LCBMb2NTZXhwP107XG5cbmV4cG9ydCB0eXBlIEF0dHJTZXhwID0gW3N0cmluZywgQVNUdjEuQXR0ck5vZGVbJ3ZhbHVlJ10gfCBzdHJpbmcsIExvY1NleHA/XTtcblxuZXhwb3J0IHR5cGUgTG9jU2V4cCA9IFsnbG9jJywgU291cmNlTG9jYXRpb25dO1xuXG5leHBvcnQgdHlwZSBFbGVtZW50Q29tbWVudCA9IEFTVHYxLk11c3RhY2hlQ29tbWVudFN0YXRlbWVudCB8IFNvdXJjZUxvY2F0aW9uIHwgc3RyaW5nO1xuXG5leHBvcnQgdHlwZSBTZXhwVmFsdWUgPVxuICB8IHN0cmluZ1xuICB8IEFTVHYxLkV4cHJlc3Npb25bXVxuICB8IERpY3Q8QVNUdjEuRXhwcmVzc2lvbj5cbiAgfCBMb2NTZXhwXG4gIHwgUGF0aFNleHBcbiAgfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRFbGVtZW50T3B0aW9ucyB7XG4gIGF0dHJzPzogQVNUdjEuQXR0ck5vZGVbXTtcbiAgbW9kaWZpZXJzPzogQVNUdjEuRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50W107XG4gIGNoaWxkcmVuPzogQVNUdjEuU3RhdGVtZW50W107XG4gIGNvbW1lbnRzPzogRWxlbWVudENvbW1lbnRbXTtcbiAgYmxvY2tQYXJhbXM/OiBzdHJpbmdbXTtcbiAgbG9jPzogU291cmNlU3Bhbjtcbn1cblxuZnVuY3Rpb24gYnVpbGRFbGVtZW50KHRhZzogVGFnRGVzY3JpcHRvciwgb3B0aW9uczogQnVpbGRFbGVtZW50T3B0aW9ucyA9IHt9KTogQVNUdjEuRWxlbWVudE5vZGUge1xuICBsZXQgeyBhdHRycywgYmxvY2tQYXJhbXMsIG1vZGlmaWVycywgY29tbWVudHMsIGNoaWxkcmVuLCBsb2MgfSA9IG9wdGlvbnM7XG5cbiAgbGV0IHRhZ05hbWU6IHN0cmluZztcblxuICAvLyB0aGlzIGlzIHVzZWQgZm9yIGJhY2t3YXJkcyBjb21wYXQsIHByaW9yIHRvIGBzZWxmQ2xvc2luZ2AgYmVpbmcgcGFydCBvZiB0aGUgRWxlbWVudE5vZGUgQVNUXG4gIGxldCBzZWxmQ2xvc2luZyA9IGZhbHNlO1xuICBpZiAodHlwZW9mIHRhZyA9PT0gJ29iamVjdCcpIHtcbiAgICBzZWxmQ2xvc2luZyA9IHRhZy5zZWxmQ2xvc2luZztcbiAgICB0YWdOYW1lID0gdGFnLm5hbWU7XG4gIH0gZWxzZSBpZiAodGFnLnNsaWNlKC0xKSA9PT0gJy8nKSB7XG4gICAgdGFnTmFtZSA9IHRhZy5zbGljZSgwLCAtMSk7XG4gICAgc2VsZkNsb3NpbmcgPSB0cnVlO1xuICB9IGVsc2Uge1xuICAgIHRhZ05hbWUgPSB0YWc7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdFbGVtZW50Tm9kZScsXG4gICAgdGFnOiB0YWdOYW1lLFxuICAgIHNlbGZDbG9zaW5nOiBzZWxmQ2xvc2luZyxcbiAgICBhdHRyaWJ1dGVzOiBhdHRycyB8fCBbXSxcbiAgICBibG9ja1BhcmFtczogYmxvY2tQYXJhbXMgfHwgW10sXG4gICAgbW9kaWZpZXJzOiBtb2RpZmllcnMgfHwgW10sXG4gICAgY29tbWVudHM6IChjb21tZW50cyBhcyBBU1R2MS5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnRbXSkgfHwgW10sXG4gICAgY2hpbGRyZW46IGNoaWxkcmVuIHx8IFtdLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZEF0dHIoXG4gIG5hbWU6IHN0cmluZyxcbiAgdmFsdWU6IEFTVHYxLkF0dHJOb2RlWyd2YWx1ZSddLFxuICBsb2M/OiBTb3VyY2VMb2NhdGlvblxuKTogQVNUdjEuQXR0ck5vZGUge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdBdHRyTm9kZScsXG4gICAgbmFtZTogbmFtZSxcbiAgICB2YWx1ZTogdmFsdWUsXG4gICAgbG9jOiBidWlsZExvYyhsb2MgfHwgbnVsbCksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkVGV4dChjaGFycz86IHN0cmluZywgbG9jPzogU291cmNlTG9jYXRpb24pOiBBU1R2MS5UZXh0Tm9kZSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ1RleHROb2RlJyxcbiAgICBjaGFyczogY2hhcnMgfHwgJycsXG4gICAgbG9jOiBidWlsZExvYyhsb2MgfHwgbnVsbCksXG4gIH07XG59XG5cbi8vIEV4cHJlc3Npb25zXG5cbmZ1bmN0aW9uIGJ1aWxkU2V4cHIoXG4gIHBhdGg6IEJ1aWxkZXJIZWFkLFxuICBwYXJhbXM/OiBBU1R2MS5FeHByZXNzaW9uW10sXG4gIGhhc2g/OiBBU1R2MS5IYXNoLFxuICBsb2M/OiBTb3VyY2VMb2NhdGlvblxuKTogQVNUdjEuU3ViRXhwcmVzc2lvbiB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ1N1YkV4cHJlc3Npb24nLFxuICAgIHBhdGg6IGJ1aWxkUGF0aChwYXRoKSxcbiAgICBwYXJhbXM6IHBhcmFtcyB8fCBbXSxcbiAgICBoYXNoOiBoYXNoIHx8IGJ1aWxkSGFzaChbXSksXG4gICAgbG9jOiBidWlsZExvYyhsb2MgfHwgbnVsbCksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhlYWRUb1N0cmluZyhoZWFkOiBBU1R2MS5QYXRoSGVhZCk6IHsgb3JpZ2luYWw6IHN0cmluZzsgcGFydHM6IHN0cmluZ1tdIH0ge1xuICBzd2l0Y2ggKGhlYWQudHlwZSkge1xuICAgIGNhc2UgJ0F0SGVhZCc6XG4gICAgICByZXR1cm4geyBvcmlnaW5hbDogaGVhZC5uYW1lLCBwYXJ0czogW2hlYWQubmFtZV0gfTtcbiAgICBjYXNlICdUaGlzSGVhZCc6XG4gICAgICByZXR1cm4geyBvcmlnaW5hbDogYHRoaXNgLCBwYXJ0czogW10gfTtcbiAgICBjYXNlICdWYXJIZWFkJzpcbiAgICAgIHJldHVybiB7IG9yaWdpbmFsOiBoZWFkLm5hbWUsIHBhcnRzOiBbaGVhZC5uYW1lXSB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGJ1aWxkSGVhZChcbiAgb3JpZ2luYWw6IHN0cmluZyxcbiAgbG9jOiBTb3VyY2VMb2NhdGlvblxuKTogeyBoZWFkOiBBU1R2MS5QYXRoSGVhZDsgdGFpbDogc3RyaW5nW10gfSB7XG4gIGxldCBbaGVhZCwgLi4udGFpbF0gPSBvcmlnaW5hbC5zcGxpdCgnLicpO1xuICBsZXQgaGVhZE5vZGU6IEFTVHYxLlBhdGhIZWFkO1xuXG4gIGlmIChoZWFkID09PSAndGhpcycpIHtcbiAgICBoZWFkTm9kZSA9IHtcbiAgICAgIHR5cGU6ICdUaGlzSGVhZCcsXG4gICAgICBsb2M6IGJ1aWxkTG9jKGxvYyB8fCBudWxsKSxcbiAgICB9O1xuICB9IGVsc2UgaWYgKGhlYWRbMF0gPT09ICdAJykge1xuICAgIGhlYWROb2RlID0ge1xuICAgICAgdHlwZTogJ0F0SGVhZCcsXG4gICAgICBuYW1lOiBoZWFkLFxuICAgICAgbG9jOiBidWlsZExvYyhsb2MgfHwgbnVsbCksXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBoZWFkTm9kZSA9IHtcbiAgICAgIHR5cGU6ICdWYXJIZWFkJyxcbiAgICAgIG5hbWU6IGhlYWQsXG4gICAgICBsb2M6IGJ1aWxkTG9jKGxvYyB8fCBudWxsKSxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBoZWFkOiBoZWFkTm9kZSxcbiAgICB0YWlsLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFRoaXMobG9jOiBTb3VyY2VMb2NhdGlvbik6IEFTVHYxLlBhdGhIZWFkIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnVGhpc0hlYWQnLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZEF0TmFtZShuYW1lOiBzdHJpbmcsIGxvYzogU291cmNlTG9jYXRpb24pOiBBU1R2MS5QYXRoSGVhZCB7XG4gIC8vIHRoZSBgQGAgc2hvdWxkIGJlIGluY2x1ZGVkIHNvIHdlIGhhdmUgYSBjb21wbGV0ZSBzb3VyY2UgcmFuZ2VcbiAgYXNzZXJ0KG5hbWVbMF0gPT09ICdAJywgYGNhbGwgYnVpbGRlcnMuYXQoKSB3aXRoIGEgc3RyaW5nIHRoYXQgc3RhcnRzIHdpdGggJ0AnYCk7XG5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQXRIZWFkJyxcbiAgICBuYW1lLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFZhcihuYW1lOiBzdHJpbmcsIGxvYzogU291cmNlTG9jYXRpb24pOiBBU1R2MS5QYXRoSGVhZCB7XG4gIGFzc2VydChuYW1lICE9PSAndGhpcycsIGBZb3UgY2FsbGVkIGJ1aWxkZXJzLnZhcigpIHdpdGggJ3RoaXMnLiBDYWxsIGJ1aWxkZXJzLnRoaXMgaW5zdGVhZGApO1xuICBhc3NlcnQoXG4gICAgbmFtZVswXSAhPT0gJ0AnLFxuICAgIGBZb3UgY2FsbGVkIGJ1aWxkZXJzLnZhcigpIHdpdGggJyR7bmFtZX0nLiBDYWxsIGJ1aWxkZXJzLmF0KCcke25hbWV9JykgaW5zdGVhZGBcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdWYXJIZWFkJyxcbiAgICBuYW1lLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZEhlYWRGcm9tU3RyaW5nKGhlYWQ6IHN0cmluZywgbG9jOiBTb3VyY2VMb2NhdGlvbik6IEFTVHYxLlBhdGhIZWFkIHtcbiAgaWYgKGhlYWRbMF0gPT09ICdAJykge1xuICAgIHJldHVybiBidWlsZEF0TmFtZShoZWFkLCBsb2MpO1xuICB9IGVsc2UgaWYgKGhlYWQgPT09ICd0aGlzJykge1xuICAgIHJldHVybiBidWlsZFRoaXMobG9jKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYnVpbGRWYXIoaGVhZCwgbG9jKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBidWlsZE5hbWVkQmxvY2tOYW1lKG5hbWU6IHN0cmluZywgbG9jPzogU291cmNlTG9jYXRpb24pOiBBU1R2MS5OYW1lZEJsb2NrTmFtZSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ05hbWVkQmxvY2tOYW1lJyxcbiAgICBuYW1lLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZENsZWFuUGF0aChcbiAgaGVhZDogQVNUdjEuUGF0aEhlYWQsXG4gIHRhaWw6IHN0cmluZ1tdLFxuICBsb2M6IFNvdXJjZUxvY2F0aW9uXG4pOiBBU1R2MS5QYXRoRXhwcmVzc2lvbiB7XG4gIGxldCB7IG9yaWdpbmFsOiBvcmlnaW5hbEhlYWQsIHBhcnRzOiBoZWFkUGFydHMgfSA9IGhlYWRUb1N0cmluZyhoZWFkKTtcbiAgbGV0IHBhcnRzID0gWy4uLmhlYWRQYXJ0cywgLi4udGFpbF07XG4gIGxldCBvcmlnaW5hbCA9IFsuLi5vcmlnaW5hbEhlYWQsIC4uLnBhcnRzXS5qb2luKCcuJyk7XG5cbiAgcmV0dXJuIG5ldyBQYXRoRXhwcmVzc2lvbkltcGxWMShvcmlnaW5hbCwgaGVhZCwgdGFpbCwgYnVpbGRMb2MobG9jIHx8IG51bGwpKTtcbn1cblxuZnVuY3Rpb24gYnVpbGRQYXRoKFxuICBwYXRoOiBBU1R2MS5QYXRoRXhwcmVzc2lvbiB8IHN0cmluZyB8IHsgaGVhZDogc3RyaW5nOyB0YWlsOiBzdHJpbmdbXSB9LFxuICBsb2M/OiBTb3VyY2VMb2NhdGlvblxuKTogQVNUdjEuUGF0aEV4cHJlc3Npb247XG5mdW5jdGlvbiBidWlsZFBhdGgocGF0aDogQVNUdjEuRXhwcmVzc2lvbiwgbG9jPzogU291cmNlTG9jYXRpb24pOiBBU1R2MS5FeHByZXNzaW9uO1xuZnVuY3Rpb24gYnVpbGRQYXRoKHBhdGg6IEJ1aWxkZXJIZWFkIHwgQVNUdjEuRXhwcmVzc2lvbiwgbG9jPzogU291cmNlTG9jYXRpb24pOiBBU1R2MS5FeHByZXNzaW9uO1xuZnVuY3Rpb24gYnVpbGRQYXRoKFxuICBwYXRoOiBCdWlsZGVySGVhZCB8IEFTVHYxLkV4cHJlc3Npb24gfCB7IGhlYWQ6IHN0cmluZzsgdGFpbDogc3RyaW5nW10gfSxcbiAgbG9jPzogU291cmNlTG9jYXRpb25cbik6IEFTVHYxLkV4cHJlc3Npb24ge1xuICBpZiAodHlwZW9mIHBhdGggIT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKCd0eXBlJyBpbiBwYXRoKSB7XG4gICAgICByZXR1cm4gcGF0aDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHsgaGVhZCwgdGFpbCB9ID0gYnVpbGRIZWFkKHBhdGguaGVhZCwgU291cmNlU3Bhbi5icm9rZW4oKSk7XG5cbiAgICAgIGFzc2VydChcbiAgICAgICAgdGFpbC5sZW5ndGggPT09IDAsXG4gICAgICAgIGBidWlsZGVyLnBhdGgoeyBoZWFkLCB0YWlsIH0pIHNob3VsZCBub3QgYmUgY2FsbGVkIHdpdGggYSBoZWFkIHdpdGggZG90cyBpbiBpdGBcbiAgICAgICk7XG5cbiAgICAgIGxldCB7IG9yaWdpbmFsOiBvcmlnaW5hbEhlYWQgfSA9IGhlYWRUb1N0cmluZyhoZWFkKTtcblxuICAgICAgcmV0dXJuIG5ldyBQYXRoRXhwcmVzc2lvbkltcGxWMShcbiAgICAgICAgW29yaWdpbmFsSGVhZCwgLi4udGFpbF0uam9pbignLicpLFxuICAgICAgICBoZWFkLFxuICAgICAgICB0YWlsLFxuICAgICAgICBidWlsZExvYyhsb2MgfHwgbnVsbClcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHsgaGVhZCwgdGFpbCB9ID0gYnVpbGRIZWFkKHBhdGgsIFNvdXJjZVNwYW4uYnJva2VuKCkpO1xuXG4gIHJldHVybiBuZXcgUGF0aEV4cHJlc3Npb25JbXBsVjEocGF0aCwgaGVhZCwgdGFpbCwgYnVpbGRMb2MobG9jIHx8IG51bGwpKTtcbn1cblxuZnVuY3Rpb24gYnVpbGRMaXRlcmFsPFQgZXh0ZW5kcyBBU1R2MS5MaXRlcmFsPihcbiAgdHlwZTogVFsndHlwZSddLFxuICB2YWx1ZTogVFsndmFsdWUnXSxcbiAgbG9jPzogU291cmNlTG9jYXRpb25cbik6IFQge1xuICByZXR1cm4ge1xuICAgIHR5cGUsXG4gICAgdmFsdWUsXG4gICAgb3JpZ2luYWw6IHZhbHVlLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9IGFzIFQ7XG59XG5cbi8vIE1pc2NlbGxhbmVvdXNcblxuZnVuY3Rpb24gYnVpbGRIYXNoKHBhaXJzPzogQVNUdjEuSGFzaFBhaXJbXSwgbG9jPzogU291cmNlTG9jYXRpb24pOiBBU1R2MS5IYXNoIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnSGFzaCcsXG4gICAgcGFpcnM6IHBhaXJzIHx8IFtdLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFBhaXIoa2V5OiBzdHJpbmcsIHZhbHVlOiBBU1R2MS5FeHByZXNzaW9uLCBsb2M/OiBTb3VyY2VMb2NhdGlvbik6IEFTVHYxLkhhc2hQYWlyIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnSGFzaFBhaXInLFxuICAgIGtleToga2V5LFxuICAgIHZhbHVlLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFByb2dyYW0oXG4gIGJvZHk/OiBBU1R2MS5TdGF0ZW1lbnRbXSxcbiAgYmxvY2tQYXJhbXM/OiBzdHJpbmdbXSxcbiAgbG9jPzogU291cmNlTG9jYXRpb25cbik6IEFTVHYxLlRlbXBsYXRlIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnVGVtcGxhdGUnLFxuICAgIGJvZHk6IGJvZHkgfHwgW10sXG4gICAgYmxvY2tQYXJhbXM6IGJsb2NrUGFyYW1zIHx8IFtdLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZEJsb2NrSXRzZWxmKFxuICBib2R5PzogQVNUdjEuU3RhdGVtZW50W10sXG4gIGJsb2NrUGFyYW1zPzogc3RyaW5nW10sXG4gIGNoYWluZWQgPSBmYWxzZSxcbiAgbG9jPzogU291cmNlTG9jYXRpb25cbik6IEFTVHYxLkJsb2NrIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQmxvY2snLFxuICAgIGJvZHk6IGJvZHkgfHwgW10sXG4gICAgYmxvY2tQYXJhbXM6IGJsb2NrUGFyYW1zIHx8IFtdLFxuICAgIGNoYWluZWQsXG4gICAgbG9jOiBidWlsZExvYyhsb2MgfHwgbnVsbCksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkVGVtcGxhdGUoXG4gIGJvZHk/OiBBU1R2MS5TdGF0ZW1lbnRbXSxcbiAgYmxvY2tQYXJhbXM/OiBzdHJpbmdbXSxcbiAgbG9jPzogU291cmNlTG9jYXRpb25cbik6IEFTVHYxLlRlbXBsYXRlIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnVGVtcGxhdGUnLFxuICAgIGJvZHk6IGJvZHkgfHwgW10sXG4gICAgYmxvY2tQYXJhbXM6IGJsb2NrUGFyYW1zIHx8IFtdLFxuICAgIGxvYzogYnVpbGRMb2MobG9jIHx8IG51bGwpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZFBvc2l0aW9uKGxpbmU6IG51bWJlciwgY29sdW1uOiBudW1iZXIpOiBTb3VyY2VQb3NpdGlvbiB7XG4gIHJldHVybiB7XG4gICAgbGluZSxcbiAgICBjb2x1bW4sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkTG9jKGxvYzogT3B0aW9uPFNvdXJjZUxvY2F0aW9uPik6IFNvdXJjZVNwYW47XG5mdW5jdGlvbiBidWlsZExvYyhcbiAgc3RhcnRMaW5lOiBudW1iZXIsXG4gIHN0YXJ0Q29sdW1uOiBudW1iZXIsXG4gIGVuZExpbmU/OiBudW1iZXIsXG4gIGVuZENvbHVtbj86IG51bWJlcixcbiAgc291cmNlPzogc3RyaW5nXG4pOiBTb3VyY2VTcGFuO1xuXG5mdW5jdGlvbiBidWlsZExvYyguLi5hcmdzOiBhbnlbXSk6IFNvdXJjZVNwYW4ge1xuICBpZiAoYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICBsZXQgbG9jID0gYXJnc1swXTtcblxuICAgIGlmIChsb2MgJiYgdHlwZW9mIGxvYyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBTb3VyY2VTcGFuLmZvckhic0xvYyhTT1VSQ0UoKSwgbG9jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFNvdXJjZVNwYW4uZm9ySGJzTG9jKFNPVVJDRSgpLCBTWU5USEVUSUNfTE9DQVRJT04pO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsZXQgW3N0YXJ0TGluZSwgc3RhcnRDb2x1bW4sIGVuZExpbmUsIGVuZENvbHVtbiwgX3NvdXJjZV0gPSBhcmdzO1xuICAgIGxldCBzb3VyY2UgPSBfc291cmNlID8gbmV3IFNvdXJjZSgnJywgX3NvdXJjZSkgOiBTT1VSQ0UoKTtcblxuICAgIHJldHVybiBTb3VyY2VTcGFuLmZvckhic0xvYyhzb3VyY2UsIHtcbiAgICAgIHN0YXJ0OiB7XG4gICAgICAgIGxpbmU6IHN0YXJ0TGluZSxcbiAgICAgICAgY29sdW1uOiBzdGFydENvbHVtbixcbiAgICAgIH0sXG4gICAgICBlbmQ6IHtcbiAgICAgICAgbGluZTogZW5kTGluZSxcbiAgICAgICAgY29sdW1uOiBlbmRDb2x1bW4sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgbXVzdGFjaGU6IGJ1aWxkTXVzdGFjaGUsXG4gIGJsb2NrOiBidWlsZEJsb2NrLFxuICBwYXJ0aWFsOiBidWlsZFBhcnRpYWwsXG4gIGNvbW1lbnQ6IGJ1aWxkQ29tbWVudCxcbiAgbXVzdGFjaGVDb21tZW50OiBidWlsZE11c3RhY2hlQ29tbWVudCxcbiAgZWxlbWVudDogYnVpbGRFbGVtZW50LFxuICBlbGVtZW50TW9kaWZpZXI6IGJ1aWxkRWxlbWVudE1vZGlmaWVyLFxuICBhdHRyOiBidWlsZEF0dHIsXG4gIHRleHQ6IGJ1aWxkVGV4dCxcbiAgc2V4cHI6IGJ1aWxkU2V4cHIsXG5cbiAgY29uY2F0OiBidWlsZENvbmNhdCxcbiAgaGFzaDogYnVpbGRIYXNoLFxuICBwYWlyOiBidWlsZFBhaXIsXG4gIGxpdGVyYWw6IGJ1aWxkTGl0ZXJhbCxcbiAgcHJvZ3JhbTogYnVpbGRQcm9ncmFtLFxuICBibG9ja0l0c2VsZjogYnVpbGRCbG9ja0l0c2VsZixcbiAgdGVtcGxhdGU6IGJ1aWxkVGVtcGxhdGUsXG4gIGxvYzogYnVpbGRMb2MsXG4gIHBvczogYnVpbGRQb3NpdGlvbixcblxuICBwYXRoOiBidWlsZFBhdGgsXG5cbiAgZnVsbFBhdGg6IGJ1aWxkQ2xlYW5QYXRoLFxuICBoZWFkOiBidWlsZEhlYWRGcm9tU3RyaW5nLFxuICBhdDogYnVpbGRBdE5hbWUsXG4gIHZhcjogYnVpbGRWYXIsXG4gIHRoaXM6IGJ1aWxkVGhpcyxcbiAgYmxvY2tOYW1lOiBidWlsZE5hbWVkQmxvY2tOYW1lLFxuXG4gIHN0cmluZzogbGl0ZXJhbCgnU3RyaW5nTGl0ZXJhbCcpIGFzICh2YWx1ZTogc3RyaW5nKSA9PiBBU1R2MS5TdHJpbmdMaXRlcmFsLFxuICBib29sZWFuOiBsaXRlcmFsKCdCb29sZWFuTGl0ZXJhbCcpIGFzICh2YWx1ZTogYm9vbGVhbikgPT4gQVNUdjEuQm9vbGVhbkxpdGVyYWwsXG4gIG51bWJlcjogbGl0ZXJhbCgnTnVtYmVyTGl0ZXJhbCcpIGFzICh2YWx1ZTogbnVtYmVyKSA9PiBBU1R2MS5OdW1iZXJMaXRlcmFsLFxuICB1bmRlZmluZWQoKTogQVNUdjEuVW5kZWZpbmVkTGl0ZXJhbCB7XG4gICAgcmV0dXJuIGJ1aWxkTGl0ZXJhbCgnVW5kZWZpbmVkTGl0ZXJhbCcsIHVuZGVmaW5lZCk7XG4gIH0sXG4gIG51bGwoKTogQVNUdjEuTnVsbExpdGVyYWwge1xuICAgIHJldHVybiBidWlsZExpdGVyYWwoJ051bGxMaXRlcmFsJywgbnVsbCk7XG4gIH0sXG59O1xuXG50eXBlIEJ1aWxkTGl0ZXJhbDxUIGV4dGVuZHMgQVNUdjEuTGl0ZXJhbD4gPSAodmFsdWU6IFRbJ3ZhbHVlJ10pID0+IFQ7XG5cbmZ1bmN0aW9uIGxpdGVyYWw8VCBleHRlbmRzIEFTVHYxLkxpdGVyYWw+KHR5cGU6IFRbJ3R5cGUnXSk6IEJ1aWxkTGl0ZXJhbDxUPiB7XG4gIHJldHVybiBmdW5jdGlvbiAodmFsdWU6IFRbJ3ZhbHVlJ10sIGxvYz86IFNvdXJjZUxvY2F0aW9uKTogVCB7XG4gICAgcmV0dXJuIGJ1aWxkTGl0ZXJhbCh0eXBlLCB2YWx1ZSwgbG9jKTtcbiAgfTtcbn1cbiIsIi8qKlxuICogQSBmcmVlIHZhcmlhYmxlIGlzIHJlc29sdmVkIGFjY29yZGluZyB0byBhIHJlc29sdXRpb24gcnVsZTpcbiAqXG4gKiAxLiBTdHJpY3QgcmVzb2x1dGlvblxuICogMi4gTmFtZXNwYWNlZCByZXNvbHV0aW9uXG4gKiAzLiBGYWxsYmFjayByZXNvbHV0aW9uXG4gKi9cblxuaW1wb3J0IHsgR2V0Q29udGV4dHVhbEZyZWVPcCwgU2V4cE9wY29kZXMgfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcblxuLyoqXG4gKiBTdHJpY3QgcmVzb2x1dGlvbiBpcyB1c2VkOlxuICpcbiAqIDEuIGluIGEgc3RyaWN0IG1vZGUgdGVtcGxhdGVcbiAqIDIuIGluIGFuIHVuYW1iaWd1b3VzIGludm9jYXRpb24gd2l0aCBkb3QgcGF0aHNcbiAqL1xuZXhwb3J0IGNsYXNzIFN0cmljdFJlc29sdXRpb24ge1xuICByZXNvbHV0aW9uKCk6IEdldENvbnRleHR1YWxGcmVlT3Age1xuICAgIHJldHVybiBTZXhwT3Bjb2Rlcy5HZXRTdHJpY3RGcmVlO1xuICB9XG5cbiAgc2VyaWFsaXplKCk6IFNlcmlhbGl6ZWRSZXNvbHV0aW9uIHtcbiAgICByZXR1cm4gJ1N0cmljdCc7XG4gIH1cblxuICByZWFkb25seSBpc0FuZ2xlQnJhY2tldCA9IGZhbHNlO1xufVxuXG5leHBvcnQgY29uc3QgU1RSSUNUX1JFU09MVVRJT04gPSBuZXcgU3RyaWN0UmVzb2x1dGlvbigpO1xuXG4vKipcbiAqIEEgYExvb3NlTW9kZVJlc29sdXRpb25gIGluY2x1ZGVzOlxuICpcbiAqIC0gMCBvciBtb3JlIG5hbWVzcGFjZXMgdG8gcmVzb2x2ZSB0aGUgdmFyaWFibGUgaW5cbiAqIC0gb3B0aW9uYWwgZmFsbGJhY2sgYmVoYXZpb3JcbiAqXG4gKiBJbiBwcmFjdGljZSwgdGhlcmUgYXJlIGEgbGltaXRlZCBudW1iZXIgb2YgcG9zc2libGUgY29tYmluYXRpb25zIG9mIHRoZXNlIGRlZ3JlZXMgb2YgZnJlZWRvbSxcbiAqIGFuZCB0aGV5IGFyZSBjYXB0dXJlZCBieSB0aGUgYEFtYmlndWl0eWAgdW5pb24gYmVsb3cuXG4gKi9cbmV4cG9ydCBjbGFzcyBMb29zZU1vZGVSZXNvbHV0aW9uIHtcbiAgLyoqXG4gICAqIE5hbWVzcGFjZWQgcmVzb2x1dGlvbiBpcyB1c2VkIGluIGFuIHVuYW1iaWd1b3VzIHN5bnRheCBwb3NpdGlvbjpcbiAgICpcbiAgICogMS4gYChzZXhwKWAgKG5hbWVzcGFjZTogYEhlbHBlcmApXG4gICAqIDIuIGB7eyNibG9ja319YCAobmFtZXNwYWNlOiBgQ29tcG9uZW50YClcbiAgICogMy4gYDxhIHt7bW9kaWZpZXJ9fT5gIChuYW1lc3BhY2U6IGBNb2RpZmllcmApXG4gICAqIDQuIGA8Q29tcG9uZW50IC8+YCAobmFtZXNwYWNlOiBgQ29tcG9uZW50YClcbiAgICpcbiAgICogQHNlZSB7TmFtZXNwYWNlZEFtYmlndWl0eX1cbiAgICovXG4gIHN0YXRpYyBuYW1lc3BhY2VkKG5hbWVzcGFjZTogRnJlZVZhck5hbWVzcGFjZSwgaXNBbmdsZUJyYWNrZXQgPSBmYWxzZSk6IExvb3NlTW9kZVJlc29sdXRpb24ge1xuICAgIHJldHVybiBuZXcgTG9vc2VNb2RlUmVzb2x1dGlvbihcbiAgICAgIHtcbiAgICAgICAgbmFtZXNwYWNlczogW25hbWVzcGFjZV0sXG4gICAgICAgIGZhbGxiYWNrOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBpc0FuZ2xlQnJhY2tldFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogRmFsbGJhY2sgcmVzb2x1dGlvbiBpcyB1c2VkIHdoZW4gbm8gbmFtZXNwYWNlZCByZXNvbHV0aW9ucyBhcmUgcG9zc2libGUsIGJ1dCBmYWxsYmFja1xuICAgKiByZXNvbHV0aW9uIGlzIHN0aWxsIGFsbG93ZWQuXG4gICAqXG4gICAqIGBgYGhic1xuICAgKiB7e3gueX19XG4gICAqIGBgYFxuICAgKlxuICAgKiBAc2VlIHtGYWxsYmFja0FtYmlndWl0eX1cbiAgICovXG4gIHN0YXRpYyBmYWxsYmFjaygpOiBMb29zZU1vZGVSZXNvbHV0aW9uIHtcbiAgICByZXR1cm4gbmV3IExvb3NlTW9kZVJlc29sdXRpb24oeyBuYW1lc3BhY2VzOiBbXSwgZmFsbGJhY2s6IHRydWUgfSk7XG4gIH1cblxuICAvKipcbiAgICogQXBwZW5kIHJlc29sdXRpb24gaXMgdXNlZCB3aGVuIHRoZSB2YXJpYWJsZSBzaG91bGQgYmUgcmVzb2x2ZWQgaW4gYm90aCB0aGUgYGNvbXBvbmVudGAgYW5kXG4gICAqIGBoZWxwZXJgIG5hbWVzcGFjZXMuIEZhbGxiYWNrIHJlc29sdXRpb24gaXMgb3B0aW9uYWwuXG4gICAqXG4gICAqIGBgYGhic1xuICAgKiB7e3h9fVxuICAgKiBgYGBcbiAgICpcbiAgICogXiBgeGAgc2hvdWxkIGJlIHJlc29sdmVkIGluIHRoZSBgY29tcG9uZW50YCBhbmQgYGhlbHBlcmAgbmFtZXNwYWNlcyB3aXRoIGZhbGxiYWNrIHJlc29sdXRpb24uXG4gICAqXG4gICAqIGBgYGhic1xuICAgKiB7e3ggeX19XG4gICAqIGBgYFxuICAgKlxuICAgKiBeIGB4YCBzaG91bGQgYmUgcmVzb2x2ZWQgaW4gdGhlIGBjb21wb25lbnRgIGFuZCBgaGVscGVyYCBuYW1lc3BhY2VzIHdpdGhvdXQgZmFsbGJhY2tcbiAgICogcmVzb2x1dGlvbi5cbiAgICpcbiAgICogQHNlZSB7Q29tcG9uZW50T3JIZWxwZXJBbWJpZ3VpdHl9XG4gICAqL1xuICBzdGF0aWMgYXBwZW5kKHsgaW52b2tlIH06IHsgaW52b2tlOiBib29sZWFuIH0pOiBMb29zZU1vZGVSZXNvbHV0aW9uIHtcbiAgICByZXR1cm4gbmV3IExvb3NlTW9kZVJlc29sdXRpb24oe1xuICAgICAgbmFtZXNwYWNlczogW0ZyZWVWYXJOYW1lc3BhY2UuQ29tcG9uZW50LCBGcmVlVmFyTmFtZXNwYWNlLkhlbHBlcl0sXG4gICAgICBmYWxsYmFjazogIWludm9rZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcnVzdGluZyBhcHBlbmQgcmVzb2x1dGlvbiBpcyB1c2VkIHdoZW4gdGhlIHZhcmlhYmxlIHNob3VsZCBiZSByZXNvbHZlZCBpbiBib3RoIHRoZSBgY29tcG9uZW50YCBhbmRcbiAgICogYGhlbHBlcmAgbmFtZXNwYWNlcy4gRmFsbGJhY2sgcmVzb2x1dGlvbiBpcyBvcHRpb25hbC5cbiAgICpcbiAgICogYGBgaGJzXG4gICAqIHt7e3h9fX1cbiAgICogYGBgXG4gICAqXG4gICAqIF4gYHhgIHNob3VsZCBiZSByZXNvbHZlZCBpbiB0aGUgYGNvbXBvbmVudGAgYW5kIGBoZWxwZXJgIG5hbWVzcGFjZXMgd2l0aCBmYWxsYmFjayByZXNvbHV0aW9uLlxuICAgKlxuICAgKiBgYGBoYnNcbiAgICoge3t7eCB5fX19XG4gICAqIGBgYFxuICAgKlxuICAgKiBeIGB4YCBzaG91bGQgYmUgcmVzb2x2ZWQgaW4gdGhlIGBjb21wb25lbnRgIGFuZCBgaGVscGVyYCBuYW1lc3BhY2VzIHdpdGhvdXQgZmFsbGJhY2tcbiAgICogcmVzb2x1dGlvbi5cbiAgICpcbiAgICogQHNlZSB7SGVscGVyQW1iaWd1aXR5fVxuICAgKi9cbiAgc3RhdGljIHRydXN0aW5nQXBwZW5kKHsgaW52b2tlIH06IHsgaW52b2tlOiBib29sZWFuIH0pOiBMb29zZU1vZGVSZXNvbHV0aW9uIHtcbiAgICByZXR1cm4gbmV3IExvb3NlTW9kZVJlc29sdXRpb24oe1xuICAgICAgbmFtZXNwYWNlczogW0ZyZWVWYXJOYW1lc3BhY2UuSGVscGVyXSxcbiAgICAgIGZhbGxiYWNrOiAhaW52b2tlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dHJpYnV0ZSByZXNvbHV0aW9uIGlzIHVzZWQgd2hlbiB0aGUgdmFyaWFibGUgc2hvdWxkIGJlIHJlc29sdmVkIGFzIGEgYGhlbHBlcmAgd2l0aCBmYWxsYmFja1xuICAgKiByZXNvbHV0aW9uLlxuICAgKlxuICAgKiBgYGBoYnNcbiAgICogPGEgaHJlZj17e3h9fSAvPlxuICAgKiA8YSBocmVmPVwie3t4fX0uaHRtbFwiIC8+XG4gICAqIGBgYFxuICAgKlxuICAgKiBeIHJlc29sdmVkIGluIHRoZSBgaGVscGVyYCBuYW1lc3BhY2Ugd2l0aCBmYWxsYmFja1xuICAgKlxuICAgKiBAc2VlIHtIZWxwZXJBbWJpZ3VpdHl9XG4gICAqL1xuICBzdGF0aWMgYXR0cigpOiBMb29zZU1vZGVSZXNvbHV0aW9uIHtcbiAgICByZXR1cm4gbmV3IExvb3NlTW9kZVJlc29sdXRpb24oeyBuYW1lc3BhY2VzOiBbRnJlZVZhck5hbWVzcGFjZS5IZWxwZXJdLCBmYWxsYmFjazogdHJ1ZSB9KTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGFtYmlndWl0eTogQW1iaWd1aXR5LCByZWFkb25seSBpc0FuZ2xlQnJhY2tldCA9IGZhbHNlKSB7fVxuXG4gIHJlc29sdXRpb24oKTogR2V0Q29udGV4dHVhbEZyZWVPcCB7XG4gICAgaWYgKHRoaXMuYW1iaWd1aXR5Lm5hbWVzcGFjZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gU2V4cE9wY29kZXMuR2V0U3RyaWN0RnJlZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYW1iaWd1aXR5Lm5hbWVzcGFjZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICBpZiAodGhpcy5hbWJpZ3VpdHkuZmFsbGJhY2spIHtcbiAgICAgICAgLy8gc2ltcGxlIG5hbWVzcGFjZWQgcmVzb2x1dGlvbiB3aXRoIGZhbGxiYWNrIG11c3QgYmUgYXR0cj17e3h9fVxuICAgICAgICByZXR1cm4gU2V4cE9wY29kZXMuR2V0RnJlZUFzSGVscGVySGVhZE9yVGhpc0ZhbGxiYWNrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gc2ltcGxlIG5hbWVzcGFjZWQgcmVzb2x1dGlvbiB3aXRob3V0IGZhbGxiYWNrXG4gICAgICAgIHN3aXRjaCAodGhpcy5hbWJpZ3VpdHkubmFtZXNwYWNlc1swXSkge1xuICAgICAgICAgIGNhc2UgRnJlZVZhck5hbWVzcGFjZS5IZWxwZXI6XG4gICAgICAgICAgICByZXR1cm4gU2V4cE9wY29kZXMuR2V0RnJlZUFzSGVscGVySGVhZDtcbiAgICAgICAgICBjYXNlIEZyZWVWYXJOYW1lc3BhY2UuTW9kaWZpZXI6XG4gICAgICAgICAgICByZXR1cm4gU2V4cE9wY29kZXMuR2V0RnJlZUFzTW9kaWZpZXJIZWFkO1xuICAgICAgICAgIGNhc2UgRnJlZVZhck5hbWVzcGFjZS5Db21wb25lbnQ6XG4gICAgICAgICAgICByZXR1cm4gU2V4cE9wY29kZXMuR2V0RnJlZUFzQ29tcG9uZW50SGVhZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpcy5hbWJpZ3VpdHkuZmFsbGJhY2spIHtcbiAgICAgIC8vIGNvbXBvbmVudCBvciBoZWxwZXIgKyBmYWxsYmFjayAoe3tzb21ldGhpbmd9fSlcbiAgICAgIHJldHVybiBTZXhwT3Bjb2Rlcy5HZXRGcmVlQXNDb21wb25lbnRPckhlbHBlckhlYWRPclRoaXNGYWxsYmFjaztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY29tcG9uZW50IG9yIGhlbHBlciB3aXRob3V0IGZhbGxiYWNrICh7e3NvbWV0aGluZyBzb21ldGhpbmd9fSlcbiAgICAgIHJldHVybiBTZXhwT3Bjb2Rlcy5HZXRGcmVlQXNDb21wb25lbnRPckhlbHBlckhlYWQ7XG4gICAgfVxuICB9XG5cbiAgc2VyaWFsaXplKCk6IFNlcmlhbGl6ZWRSZXNvbHV0aW9uIHtcbiAgICBpZiAodGhpcy5hbWJpZ3VpdHkubmFtZXNwYWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAnTG9vc2UnO1xuICAgIH0gZWxzZSBpZiAodGhpcy5hbWJpZ3VpdHkubmFtZXNwYWNlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIGlmICh0aGlzLmFtYmlndWl0eS5mYWxsYmFjaykge1xuICAgICAgICAvLyBzaW1wbGUgbmFtZXNwYWNlZCByZXNvbHV0aW9uIHdpdGggZmFsbGJhY2sgbXVzdCBiZSBhdHRyPXt7eH19XG4gICAgICAgIHJldHVybiBbJ2FtYmlndW91cycsIFNlcmlhbGl6ZWRBbWJpZ3VpdHkuQXR0cl07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gWyducycsIHRoaXMuYW1iaWd1aXR5Lm5hbWVzcGFjZXNbMF1dO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpcy5hbWJpZ3VpdHkuZmFsbGJhY2spIHtcbiAgICAgIC8vIGNvbXBvbmVudCBvciBoZWxwZXIgKyBmYWxsYmFjayAoe3tzb21ldGhpbmd9fSlcbiAgICAgIHJldHVybiBbJ2FtYmlndW91cycsIFNlcmlhbGl6ZWRBbWJpZ3VpdHkuQXBwZW5kXTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY29tcG9uZW50IG9yIGhlbHBlciB3aXRob3V0IGZhbGxiYWNrICh7e3NvbWV0aGluZyBzb21ldGhpbmd9fSlcbiAgICAgIHJldHVybiBbJ2FtYmlndW91cycsIFNlcmlhbGl6ZWRBbWJpZ3VpdHkuSW52b2tlXTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IEFSR1VNRU5UX1JFU09MVVRJT04gPSBMb29zZU1vZGVSZXNvbHV0aW9uLmZhbGxiYWNrKCk7XG5cbmV4cG9ydCBjb25zdCBlbnVtIEZyZWVWYXJOYW1lc3BhY2Uge1xuICBIZWxwZXIgPSAnSGVscGVyJyxcbiAgTW9kaWZpZXIgPSAnTW9kaWZpZXInLFxuICBDb21wb25lbnQgPSAnQ29tcG9uZW50Jyxcbn1cblxuLyoqXG4gKiBBIGBDb21wb25lbnRPckhlbHBlckFtYmlndWl0eWAgbWlnaHQgYmUgYSBjb21wb25lbnQgb3IgYSBoZWxwZXIsIHdpdGggYW4gb3B0aW9uYWwgZmFsbGJhY2tcbiAqXG4gKiBgYGBoYnNcbiAqIHt7eH19XG4gKiBgYGBcbiAqXG4gKiBeIGB4YCBpcyByZXNvbHZlZCBpbiB0aGUgYGNvbXBvbmVudGAgYW5kIGBoZWxwZXJgIG5hbWVzcGFjZXMsIHdpdGggZmFsbGJhY2tcbiAqXG4gKiBgYGBoYnNcbiAqIHt7eCB5fX1cbiAqIGBgYFxuICpcbiAqIF4gYHhgIGlzIHJlc29sdmVkIGluIHRoZSBgY29tcG9uZW50YCBhbmQgYGhlbHBlcmAgbmFtZXNwYWNlcywgd2l0aG91dCBmYWxsYmFja1xuICovXG50eXBlIENvbXBvbmVudE9ySGVscGVyQW1iaWd1aXR5ID0ge1xuICBuYW1lc3BhY2VzOiBbRnJlZVZhck5hbWVzcGFjZS5Db21wb25lbnQsIEZyZWVWYXJOYW1lc3BhY2UuSGVscGVyXTtcbiAgZmFsbGJhY2s6IGJvb2xlYW47XG59O1xuXG4vKipcbiAqIEEgYEhlbHBlckFtYmlndWl0eWAgbXVzdCBiZSBhIGhlbHBlciwgYnV0IGl0IGhhcyBmYWxsYmFjay4gSWYgaXQgZGlkbid0IGhhdmUgZmFsbGJhY2ssIGl0IHdvdWxkXG4gKiBiZSBhIGBOYW1lc3BhY2VkQW1iaWd1aXR5YC5cbiAqXG4gKiBgYGBoYnNcbiAqIDxhIGhyZWY9e3t4fX0gLz5cbiAqIDxhIGhyZWY9XCJ7e3h9fS5odG1sXCIgLz5cbiAqIGBgYFxuICpcbiAqIF4gYHhgIGlzIHJlc29sdmVkIGluIHRoZSBgaGVscGVyYCBuYW1lc3BhY2Ugd2l0aCBmYWxsYmFja1xuICovXG50eXBlIEhlbHBlckFtYmlndWl0eSA9IHsgbmFtZXNwYWNlczogW0ZyZWVWYXJOYW1lc3BhY2UuSGVscGVyXTsgZmFsbGJhY2s6IGJvb2xlYW4gfTtcblxuLyoqXG4gKiBBIGBOYW1lc3BhY2VkQW1iaWd1aXR5YCBtdXN0IGJlIHJlc29sdmVkIGluIGEgcGFydGljdWxhciBuYW1lc3BhY2UsIHdpdGhvdXQgZmFsbGJhY2suXG4gKlxuICogYGBgaGJzXG4gKiA8WCAvPlxuICogYGBgXG4gKlxuICogXiBgWGAgaXMgcmVzb2x2ZWQgaW4gdGhlIGBjb21wb25lbnRgIG5hbWVzcGFjZSB3aXRob3V0IGZhbGxiYWNrXG4gKlxuICogYGBgaGJzXG4gKiAoeClcbiAqIGBgYFxuICpcbiAqIF4gYHhgIGlzIHJlc29sdmVkIGluIHRoZSBgaGVscGVyYCBuYW1lc3BhY2Ugd2l0aG91dCBmYWxsYmFja1xuICpcbiAqIGBgYGhic1xuICogPGEge3t4fX0gLz5cbiAqIGBgYFxuICpcbiAqIF4gYHhgIGlzIHJlc29sdmVkIGluIHRoZSBgbW9kaWZpZXJgIG5hbWVzcGFjZSB3aXRob3V0IGZhbGxiYWNrXG4gKi9cbnR5cGUgTmFtZXNwYWNlZEFtYmlndWl0eSA9IHtcbiAgbmFtZXNwYWNlczogW0ZyZWVWYXJOYW1lc3BhY2UuQ29tcG9uZW50IHwgRnJlZVZhck5hbWVzcGFjZS5IZWxwZXIgfCBGcmVlVmFyTmFtZXNwYWNlLk1vZGlmaWVyXTtcbiAgZmFsbGJhY2s6IGZhbHNlO1xufTtcblxudHlwZSBGYWxsYmFja0FtYmlndWl0eSA9IHtcbiAgbmFtZXNwYWNlczogW107XG4gIGZhbGxiYWNrOiB0cnVlO1xufTtcblxudHlwZSBBbWJpZ3VpdHkgPVxuICB8IENvbXBvbmVudE9ySGVscGVyQW1iaWd1aXR5XG4gIHwgSGVscGVyQW1iaWd1aXR5XG4gIHwgTmFtZXNwYWNlZEFtYmlndWl0eVxuICB8IEZhbGxiYWNrQW1iaWd1aXR5O1xuXG5leHBvcnQgdHlwZSBGcmVlVmFyUmVzb2x1dGlvbiA9IFN0cmljdFJlc29sdXRpb24gfCBMb29zZU1vZGVSZXNvbHV0aW9uO1xuXG4vLyBTZXJpYWxpemF0aW9uXG5cbmNvbnN0IGVudW0gU2VyaWFsaXplZEFtYmlndWl0eSB7XG4gIC8vIHt7eH19XG4gIEFwcGVuZCA9ICdBcHBlbmQnLFxuICAvLyBocmVmPXt7eH19XG4gIEF0dHIgPSAnQXR0cicsXG4gIC8vIHt7eCB5fX0gKG5vdCBhdHRyKVxuICBJbnZva2UgPSAnSW52b2tlJyxcbn1cblxuZXhwb3J0IHR5cGUgU2VyaWFsaXplZFJlc29sdXRpb24gPVxuICB8ICdTdHJpY3QnXG4gIHwgJ0xvb3NlJ1xuICB8IFsnbnMnLCBGcmVlVmFyTmFtZXNwYWNlXVxuICB8IFsnYW1iaWd1b3VzJywgU2VyaWFsaXplZEFtYmlndWl0eV07XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkUmVzb2x1dGlvbihyZXNvbHV0aW9uOiBTZXJpYWxpemVkUmVzb2x1dGlvbik6IEZyZWVWYXJSZXNvbHV0aW9uIHtcbiAgaWYgKHR5cGVvZiByZXNvbHV0aW9uID09PSAnc3RyaW5nJykge1xuICAgIHN3aXRjaCAocmVzb2x1dGlvbikge1xuICAgICAgY2FzZSAnTG9vc2UnOlxuICAgICAgICByZXR1cm4gTG9vc2VNb2RlUmVzb2x1dGlvbi5mYWxsYmFjaygpO1xuICAgICAgY2FzZSAnU3RyaWN0JzpcbiAgICAgICAgcmV0dXJuIFNUUklDVF9SRVNPTFVUSU9OO1xuICAgIH1cbiAgfVxuXG4gIHN3aXRjaCAocmVzb2x1dGlvblswXSkge1xuICAgIGNhc2UgJ2FtYmlndW91cyc6XG4gICAgICBzd2l0Y2ggKHJlc29sdXRpb25bMV0pIHtcbiAgICAgICAgY2FzZSBTZXJpYWxpemVkQW1iaWd1aXR5LkFwcGVuZDpcbiAgICAgICAgICByZXR1cm4gTG9vc2VNb2RlUmVzb2x1dGlvbi5hcHBlbmQoeyBpbnZva2U6IGZhbHNlIH0pO1xuICAgICAgICBjYXNlIFNlcmlhbGl6ZWRBbWJpZ3VpdHkuQXR0cjpcbiAgICAgICAgICByZXR1cm4gTG9vc2VNb2RlUmVzb2x1dGlvbi5hdHRyKCk7XG4gICAgICAgIGNhc2UgU2VyaWFsaXplZEFtYmlndWl0eS5JbnZva2U6XG4gICAgICAgICAgcmV0dXJuIExvb3NlTW9kZVJlc29sdXRpb24uYXBwZW5kKHsgaW52b2tlOiB0cnVlIH0pO1xuICAgICAgfVxuXG4gICAgY2FzZSAnbnMnOlxuICAgICAgcmV0dXJuIExvb3NlTW9kZVJlc29sdXRpb24ubmFtZXNwYWNlZChyZXNvbHV0aW9uWzFdKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgYXNzaWduIH0gZnJvbSAnQGdsaW1tZXIvdXRpbCc7XG5cbmltcG9ydCB7IFNvdXJjZVNwYW4gfSBmcm9tICcuLi8uLi9zb3VyY2Uvc3Bhbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmFzZU5vZGVGaWVsZHMge1xuICBsb2M6IFNvdXJjZVNwYW47XG59XG5cbi8qKlxuICogVGhpcyBpcyBhIGNvbnZlbmllbmNlIGZ1bmN0aW9uIGZvciBjcmVhdGluZyBBU1R2MiBub2Rlcywgd2l0aCBhbiBvcHRpb25hbCBuYW1lIGFuZCB0aGUgbm9kZSdzXG4gKiBvcHRpb25zLlxuICpcbiAqIGBgYHRzXG4gKiBleHBvcnQgY2xhc3MgSHRtbFRleHQgZXh0ZW5kcyBub2RlKCdIdG1sVGV4dCcpLmZpZWxkczx7IGNoYXJzOiBzdHJpbmcgfT4oKSB7fVxuICogYGBgXG4gKlxuICogVGhpcyBjcmVhdGVzIGEgbmV3IEFTVHYyIG5vZGUgd2l0aCB0aGUgbmFtZSBgJ0h0bWxUZXh0J2AgYW5kIG9uZSBmaWVsZCBgY2hhcnM6IHN0cmluZ2AgKGluXG4gKiBhZGRpdGlvbiB0byBhIGBsb2M6IFNvdXJjZU9mZnNldHNgIGZpZWxkLCB3aGljaCBhbGwgbm9kZXMgaGF2ZSkuXG4gKlxuICogYGBgdHNcbiAqIGV4cG9ydCBjbGFzcyBBcmdzIGV4dGVuZHMgbm9kZSgpLmZpZWxkczx7XG4gKiAgcG9zaXRpb25hbDogUG9zaXRpb25hbEFyZ3VtZW50cztcbiAqICBuYW1lZDogTmFtZWRBcmd1bWVudHNcbiAqIH0+KCkge31cbiAqIGBgYFxuICpcbiAqIFRoaXMgY3JlYXRlcyBhIG5ldyB1bi1uYW1lZCBBU1R2MiBub2RlIHdpdGggdHdvIGZpZWxkcyAoYHBvc2l0aW9uYWw6IFBvc2l0aW9uYWxgIGFuZCBgbmFtZWQ6XG4gKiBOYW1lZGAsIGluIGFkZGl0aW9uIHRvIHRoZSBnZW5lcmljIGBsb2M6IFNvdXJjZU9mZnNldHNgIGZpZWxkKS5cbiAqXG4gKiBPbmNlIHlvdSBjcmVhdGUgYSBub2RlIHVzaW5nIGBub2RlYCwgaXQgaXMgaW5zdGFudGlhdGVkIHdpdGggYWxsIG9mIGl0cyBmaWVsZHMgKGluY2x1ZGluZyBgbG9jYCk6XG4gKlxuICogYGBgdHNcbiAqIG5ldyBIdG1sVGV4dCh7IGxvYzogb2Zmc2V0cywgY2hhcnM6IHNvbWVTdHJpbmcgfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vZGUoKToge1xuICBmaWVsZHM8RmllbGRzIGV4dGVuZHMgb2JqZWN0PigpOiBOb2RlQ29uc3RydWN0b3I8RmllbGRzICYgQmFzZU5vZGVGaWVsZHM+O1xufTtcbmV4cG9ydCBmdW5jdGlvbiBub2RlPFQgZXh0ZW5kcyBzdHJpbmc+KFxuICBuYW1lOiBUXG4pOiB7XG4gIGZpZWxkczxGaWVsZHMgZXh0ZW5kcyBvYmplY3Q+KCk6IFR5cGVkTm9kZUNvbnN0cnVjdG9yPFQsIEZpZWxkcyAmIEJhc2VOb2RlRmllbGRzPjtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBub2RlPFQgZXh0ZW5kcyBzdHJpbmc+KFxuICBuYW1lPzogVFxuKTpcbiAgfCB7XG4gICAgICBmaWVsZHM8RmllbGRzIGV4dGVuZHMgb2JqZWN0PigpOiBUeXBlZE5vZGVDb25zdHJ1Y3RvcjxULCBGaWVsZHMgJiBCYXNlTm9kZUZpZWxkcz47XG4gICAgfVxuICB8IHtcbiAgICAgIGZpZWxkczxGaWVsZHMgZXh0ZW5kcyBvYmplY3Q+KCk6IE5vZGVDb25zdHJ1Y3RvcjxGaWVsZHMgJiBCYXNlTm9kZUZpZWxkcz47XG4gICAgfSB7XG4gIGlmIChuYW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCB0eXBlID0gbmFtZTtcbiAgICByZXR1cm4ge1xuICAgICAgZmllbGRzPEZpZWxkcyBleHRlbmRzIG9iamVjdD4oKTogVHlwZWROb2RlQ29uc3RydWN0b3I8VCwgQmFzZU5vZGVGaWVsZHMgJiBGaWVsZHM+IHtcbiAgICAgICAgcmV0dXJuIGNsYXNzIHtcbiAgICAgICAgICAvLyBTQUZFVFk6IGluaXRpYWxpemVkIHZpYSBgYXNzaWduYCBpbiB0aGUgY29uc3RydWN0b3IuXG4gICAgICAgICAgZGVjbGFyZSByZWFkb25seSBsb2M6IFNvdXJjZVNwYW47XG4gICAgICAgICAgcmVhZG9ubHkgdHlwZTogVDtcblxuICAgICAgICAgIGNvbnN0cnVjdG9yKGZpZWxkczogQmFzZU5vZGVGaWVsZHMgJiBGaWVsZHMpIHtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgICAgICAgICBhc3NpZ24odGhpcywgZmllbGRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gYXMgVHlwZWROb2RlQ29uc3RydWN0b3I8VCwgQmFzZU5vZGVGaWVsZHMgJiBGaWVsZHM+O1xuICAgICAgfSxcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB7XG4gICAgICBmaWVsZHM8RmllbGRzPigpOiBOb2RlQ29uc3RydWN0b3I8RmllbGRzICYgQmFzZU5vZGVGaWVsZHM+IHtcbiAgICAgICAgcmV0dXJuIGNsYXNzIHtcbiAgICAgICAgICAvLyBTQUZFVFk6IGluaXRpYWxpemVkIHZpYSBgYXNzaWduYCBpbiB0aGUgY29uc3RydWN0b3IuXG4gICAgICAgICAgZGVjbGFyZSByZWFkb25seSBsb2M6IFNvdXJjZVNwYW47XG5cbiAgICAgICAgICBjb25zdHJ1Y3RvcihmaWVsZHM6IEJhc2VOb2RlRmllbGRzICYgRmllbGRzKSB7XG4gICAgICAgICAgICBhc3NpZ24odGhpcywgZmllbGRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gYXMgTm9kZUNvbnN0cnVjdG9yPEJhc2VOb2RlRmllbGRzICYgRmllbGRzPjtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vZGVDb25zdHJ1Y3RvcjxGaWVsZHM+IHtcbiAgbmV3IChmaWVsZHM6IEZpZWxkcyk6IFJlYWRvbmx5PEZpZWxkcz47XG59XG5cbnR5cGUgVHlwZWROb2RlPFQgZXh0ZW5kcyBzdHJpbmcsIEZpZWxkcz4gPSB7IHR5cGU6IFQgfSAmIFJlYWRvbmx5PEZpZWxkcz47XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZWROb2RlQ29uc3RydWN0b3I8VCBleHRlbmRzIHN0cmluZywgRmllbGRzPiB7XG4gIG5ldyAob3B0aW9uczogRmllbGRzKTogVHlwZWROb2RlPFQsIEZpZWxkcz47XG59XG4iLCJpbXBvcnQgeyBTb3VyY2VTbGljZSB9IGZyb20gJy4uLy4uL3NvdXJjZS9zbGljZSc7XG5pbXBvcnQgeyBTb3VyY2VTcGFuIH0gZnJvbSAnLi4vLi4vc291cmNlL3NwYW4nO1xuaW1wb3J0IHR5cGUgeyBFeHByZXNzaW9uTm9kZSB9IGZyb20gJy4vZXhwcic7XG5pbXBvcnQgeyBub2RlIH0gZnJvbSAnLi9ub2RlJztcblxuLyoqXG4gKiBDb3JyZXNwb25kcyB0byBzeW50YXhlcyB3aXRoIHBvc2l0aW9uYWwgYW5kIG5hbWVkIGFyZ3VtZW50czpcbiAqXG4gKiAtIFN1YkV4cHJlc3Npb25cbiAqIC0gSW52b2tpbmcgQXBwZW5kXG4gKiAtIEludm9raW5nIGF0dHJpYnV0ZXNcbiAqIC0gSW52b2tlQmxvY2tcbiAqXG4gKiBJZiBgQXJnc2AgaXMgZW1wdHksIHRoZSBgU291cmNlT2Zmc2V0c2AgZm9yIHRoaXMgbm9kZSBzaG91bGQgYmUgdGhlIGNvbGxhcHNlZCBwb3NpdGlvblxuICogaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIHBhcmVudCBjYWxsIG5vZGUncyBgY2FsbGVlYC5cbiAqL1xuZXhwb3J0IGNsYXNzIEFyZ3MgZXh0ZW5kcyBub2RlKCkuZmllbGRzPHtcbiAgcG9zaXRpb25hbDogUG9zaXRpb25hbEFyZ3VtZW50cztcbiAgbmFtZWQ6IE5hbWVkQXJndW1lbnRzO1xufT4oKSB7XG4gIHN0YXRpYyBlbXB0eShsb2M6IFNvdXJjZVNwYW4pOiBBcmdzIHtcbiAgICByZXR1cm4gbmV3IEFyZ3Moe1xuICAgICAgbG9jLFxuICAgICAgcG9zaXRpb25hbDogUG9zaXRpb25hbEFyZ3VtZW50cy5lbXB0eShsb2MpLFxuICAgICAgbmFtZWQ6IE5hbWVkQXJndW1lbnRzLmVtcHR5KGxvYyksXG4gICAgfSk7XG4gIH1cblxuICBzdGF0aWMgbmFtZWQobmFtZWQ6IE5hbWVkQXJndW1lbnRzKTogQXJncyB7XG4gICAgcmV0dXJuIG5ldyBBcmdzKHtcbiAgICAgIGxvYzogbmFtZWQubG9jLFxuICAgICAgcG9zaXRpb25hbDogUG9zaXRpb25hbEFyZ3VtZW50cy5lbXB0eShuYW1lZC5sb2MuY29sbGFwc2UoJ2VuZCcpKSxcbiAgICAgIG5hbWVkLFxuICAgIH0pO1xuICB9XG5cbiAgbnRoKG9mZnNldDogbnVtYmVyKTogRXhwcmVzc2lvbk5vZGUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5wb3NpdGlvbmFsLm50aChvZmZzZXQpO1xuICB9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IEV4cHJlc3Npb25Ob2RlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubmFtZWQuZ2V0KG5hbWUpO1xuICB9XG5cbiAgaXNFbXB0eSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5wb3NpdGlvbmFsLmlzRW1wdHkoKSAmJiB0aGlzLm5hbWVkLmlzRW1wdHkoKTtcbiAgfVxufVxuXG4vKipcbiAqIENvcnJlc3BvbmRzIHRvIHBvc2l0aW9uYWwgYXJndW1lbnRzLlxuICpcbiAqIElmIGBQb3NpdGlvbmFsQXJndW1lbnRzYCBpcyBlbXB0eSwgdGhlIGBTb3VyY2VPZmZzZXRzYCBmb3IgdGhpcyBub2RlIHNob3VsZCBiZSB0aGUgY29sbGFwc2VkXG4gKiBwb3NpdGlvbiBpbW1lZGlhdGVseSBhZnRlciB0aGUgcGFyZW50IGNhbGwgbm9kZSdzIGBjYWxsZWVgLlxuICovXG5leHBvcnQgY2xhc3MgUG9zaXRpb25hbEFyZ3VtZW50cyBleHRlbmRzIG5vZGUoKS5maWVsZHM8e1xuICBleHByczogcmVhZG9ubHkgRXhwcmVzc2lvbk5vZGVbXTtcbn0+KCkge1xuICBzdGF0aWMgZW1wdHkobG9jOiBTb3VyY2VTcGFuKTogUG9zaXRpb25hbEFyZ3VtZW50cyB7XG4gICAgcmV0dXJuIG5ldyBQb3NpdGlvbmFsQXJndW1lbnRzKHtcbiAgICAgIGxvYyxcbiAgICAgIGV4cHJzOiBbXSxcbiAgICB9KTtcbiAgfVxuXG4gIGdldCBzaXplKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZXhwcnMubGVuZ3RoO1xuICB9XG5cbiAgbnRoKG9mZnNldDogbnVtYmVyKTogRXhwcmVzc2lvbk5vZGUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5leHByc1tvZmZzZXRdIHx8IG51bGw7XG4gIH1cblxuICBpc0VtcHR5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmV4cHJzLmxlbmd0aCA9PT0gMDtcbiAgfVxufVxuXG4vKipcbiAqIENvcnJlc3BvbmRzIHRvIG5hbWVkIGFyZ3VtZW50cy5cbiAqXG4gKiBJZiBgUG9zaXRpb25hbEFyZ3VtZW50c2AgYW5kIGBOYW1lZEFyZ3VtZW50c2AgYXJlIGVtcHR5LCB0aGUgYFNvdXJjZU9mZnNldHNgIGZvciB0aGlzIG5vZGUgc2hvdWxkXG4gKiBiZSB0aGUgc2FtZSBhcyB0aGUgYEFyZ3NgIG5vZGUgdGhhdCBjb250YWlucyB0aGlzIG5vZGUuXG4gKlxuICogSWYgYFBvc2l0aW9uYWxBcmd1bWVudHNgIGlzIG5vdCBlbXB0eSBidXQgYE5hbWVkQXJndW1lbnRzYCBpcyBlbXB0eSwgdGhlIGBTb3VyY2VPZmZzZXRzYCBmb3IgdGhpc1xuICogbm9kZSBzaG91bGQgYmUgdGhlIGNvbGxhcHNlZCBwb3NpdGlvbiBpbW1lZGlhdGVseSBhZnRlciB0aGUgbGFzdCBwb3NpdGlvbmFsIGFyZ3VtZW50LlxuICovXG5leHBvcnQgY2xhc3MgTmFtZWRBcmd1bWVudHMgZXh0ZW5kcyBub2RlKCkuZmllbGRzPHtcbiAgZW50cmllczogcmVhZG9ubHkgTmFtZWRBcmd1bWVudFtdO1xufT4oKSB7XG4gIHN0YXRpYyBlbXB0eShsb2M6IFNvdXJjZVNwYW4pOiBOYW1lZEFyZ3VtZW50cyB7XG4gICAgcmV0dXJuIG5ldyBOYW1lZEFyZ3VtZW50cyh7XG4gICAgICBsb2MsXG4gICAgICBlbnRyaWVzOiBbXSxcbiAgICB9KTtcbiAgfVxuXG4gIGdldCBzaXplKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcy5sZW5ndGg7XG4gIH1cblxuICBnZXQobmFtZTogc3RyaW5nKTogRXhwcmVzc2lvbk5vZGUgfCBudWxsIHtcbiAgICBsZXQgZW50cnkgPSB0aGlzLmVudHJpZXMuZmlsdGVyKChlKSA9PiBlLm5hbWUuY2hhcnMgPT09IG5hbWUpWzBdO1xuXG4gICAgcmV0dXJuIGVudHJ5ID8gZW50cnkudmFsdWUgOiBudWxsO1xuICB9XG5cbiAgaXNFbXB0eSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzLmxlbmd0aCA9PT0gMDtcbiAgfVxufVxuXG4vKipcbiAqIENvcnJlc3BvbmRzIHRvIGEgc2luZ2xlIG5hbWVkIGFyZ3VtZW50LlxuICpcbiAqIGBgYGhic1xuICogeD08ZXhwcj5cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgTmFtZWRBcmd1bWVudCB7XG4gIHJlYWRvbmx5IGxvYzogU291cmNlU3BhbjtcbiAgcmVhZG9ubHkgbmFtZTogU291cmNlU2xpY2U7XG4gIHJlYWRvbmx5IHZhbHVlOiBFeHByZXNzaW9uTm9kZTtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiB7IG5hbWU6IFNvdXJjZVNsaWNlOyB2YWx1ZTogRXhwcmVzc2lvbk5vZGUgfSkge1xuICAgIHRoaXMubG9jID0gb3B0aW9ucy5uYW1lLmxvYy5leHRlbmQob3B0aW9ucy52YWx1ZS5sb2MpO1xuICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLnZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgU291cmNlU2xpY2UgfSBmcm9tICcuLi8uLi9zb3VyY2Uvc2xpY2UnO1xuaW1wb3J0IHsgTmFtZWRBcmd1bWVudCB9IGZyb20gJy4vYXJncyc7XG5pbXBvcnQgdHlwZSB7IENhbGxGaWVsZHMgfSBmcm9tICcuL2Jhc2UnO1xuaW1wb3J0IHR5cGUgeyBFeHByZXNzaW9uTm9kZSB9IGZyb20gJy4vZXhwcic7XG5pbXBvcnQgeyBub2RlIH0gZnJvbSAnLi9ub2RlJztcblxuLyoqXG4gKiBBdHRyIG5vZGVzIGxvb2sgbGlrZSBIVE1MIGF0dHJpYnV0ZXMsIGJ1dCBhcmUgY2xhc3NpZmllZCBhczpcbiAqXG4gKiAxLiBgSHRtbEF0dHJgLCB3aGljaCBtZWFucyBhIHJlZ3VsYXIgSFRNTCBhdHRyaWJ1dGUgaW4gR2xpbW1lclxuICogMi4gYFNwbGF0QXR0cmAsIHdoaWNoIG1lYW5zIGAuLi5hdHRyaWJ1dGVzYFxuICogMy4gYENvbXBvbmVudEFyZ2AsIHdoaWNoIG1lYW5zIGFuIGF0dHJpYnV0ZSB3aG9zZSBuYW1lIGJlZ2lucyB3aXRoIGBAYCwgYW5kIGl0IGlzIHRoZXJlZm9yZSBhXG4gKiAgICBjb21wb25lbnQgYXJndW1lbnQuXG4gKi9cbmV4cG9ydCB0eXBlIEF0dHJOb2RlID0gSHRtbEF0dHIgfCBTcGxhdEF0dHIgfCBDb21wb25lbnRBcmc7XG5cbi8qKlxuICogYEh0bWxBdHRyYCBhbmQgYFNwbGF0QXR0cmAgYXJlIGdyb3VwZWQgdG9nZXRoZXIgYmVjYXVzZSB0aGUgb3JkZXIgb2YgdGhlIGBTcGxhdEF0dHJgIG5vZGUsXG4gKiByZWxhdGl2ZSB0byBvdGhlciBhdHRyaWJ1dGVzLCBtYXR0ZXJzLlxuICovXG5leHBvcnQgdHlwZSBIdG1sT3JTcGxhdEF0dHIgPSBIdG1sQXR0ciB8IFNwbGF0QXR0cjtcblxuLyoqXG4gKiBcIkF0dHIgQmxvY2tcIiBub2RlcyBhcmUgYWxsb3dlZCBpbnNpZGUgYW4gb3BlbiBlbGVtZW50IHRhZyBpbiB0ZW1wbGF0ZXMuIFRoZXkgaW50ZXJhY3Qgd2l0aCB0aGVcbiAqIGVsZW1lbnQgKG9yIGNvbXBvbmVudCkuXG4gKi9cbmV4cG9ydCB0eXBlIEF0dHJCbG9ja05vZGUgPSBBdHRyTm9kZSB8IEVsZW1lbnRNb2RpZmllcjtcblxuLyoqXG4gKiBgSHRtbEF0dHJgIG5vZGVzIGFyZSB2YWxpZCBIVE1MIGF0dHJpYnV0ZXMsIHdpdGggb3Igd2l0aG91dCBhIHZhbHVlLlxuICpcbiAqIEV4Y2VwdGlvbnM6XG4gKlxuICogLSBgLi4uYXR0cmlidXRlc2AgaXMgYFNwbGF0QXR0cmBcbiAqIC0gYEB4PTx2YWx1ZT5gIGlzIGBDb21wb25lbnRBcmdgXG4gKi9cbmV4cG9ydCBjbGFzcyBIdG1sQXR0ciBleHRlbmRzIG5vZGUoJ0h0bWxBdHRyJykuZmllbGRzPEF0dHJOb2RlT3B0aW9ucz4oKSB7fVxuXG5leHBvcnQgY2xhc3MgU3BsYXRBdHRyIGV4dGVuZHMgbm9kZSgnU3BsYXRBdHRyJykuZmllbGRzPHsgc3ltYm9sOiBudW1iZXIgfT4oKSB7fVxuXG4vKipcbiAqIENvcnJlc3BvbmRzIHRvIGFuIGFyZ3VtZW50IHBhc3NlZCBieSBhIGNvbXBvbmVudCAoYEB4PTx2YWx1ZT5gKVxuICovXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50QXJnIGV4dGVuZHMgbm9kZSgpLmZpZWxkczxBdHRyTm9kZU9wdGlvbnM+KCkge1xuICAvKipcbiAgICogQ29udmVydCB0aGUgY29tcG9uZW50IGFyZ3VtZW50IGludG8gYSBuYW1lZCBhcmd1bWVudCBub2RlXG4gICAqL1xuICB0b05hbWVkQXJndW1lbnQoKTogTmFtZWRBcmd1bWVudCB7XG4gICAgcmV0dXJuIG5ldyBOYW1lZEFyZ3VtZW50KHtcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIHZhbHVlOiB0aGlzLnZhbHVlLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogQW4gYEVsZW1lbnRNb2RpZmllcmAgaXMganVzdCBhIG5vcm1hbCBjYWxsIG5vZGUgaW4gbW9kaWZpZXIgcG9zaXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBFbGVtZW50TW9kaWZpZXIgZXh0ZW5kcyBub2RlKCdFbGVtZW50TW9kaWZpZXInKS5maWVsZHM8Q2FsbEZpZWxkcz4oKSB7fVxuXG5leHBvcnQgaW50ZXJmYWNlIEF0dHJOb2RlT3B0aW9ucyB7XG4gIG5hbWU6IFNvdXJjZVNsaWNlO1xuICB2YWx1ZTogRXhwcmVzc2lvbk5vZGU7XG4gIHRydXN0aW5nOiBib29sZWFuO1xufVxuIiwiLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llc1xuaW1wb3J0IHR5cGUgeyBQcmVzZW50QXJyYXkgfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcblxuaW1wb3J0IHsgTG9jYXRlZFdpdGhPcHRpb25hbFNwYW4sIExvY2F0ZWRXaXRoU3BhbiB9IGZyb20gJy4vbG9jYXRpb24nO1xuaW1wb3J0IHsgU291cmNlT2Zmc2V0LCBTb3VyY2VTcGFuIH0gZnJvbSAnLi9zcGFuJztcblxuZXhwb3J0IHR5cGUgSGFzU3BhbiA9IFNvdXJjZVNwYW4gfCBMb2NhdGVkV2l0aFNwYW4gfCBQcmVzZW50QXJyYXk8TG9jYXRlZFdpdGhTcGFuPjtcbmV4cG9ydCB0eXBlIE1heWJlSGFzU3BhbiA9IFNvdXJjZVNwYW4gfCBMb2NhdGVkV2l0aE9wdGlvbmFsU3BhbiB8IExvY2F0ZWRXaXRoT3B0aW9uYWxTcGFuW10gfCBudWxsO1xuXG5leHBvcnQgdHlwZSBUb1NvdXJjZU9mZnNldCA9IG51bWJlciB8IFNvdXJjZU9mZnNldDtcblxuZXhwb3J0IGNsYXNzIFNwYW5MaXN0IHtcbiAgc3RhdGljIHJhbmdlKHNwYW46IFByZXNlbnRBcnJheTxIYXNTb3VyY2VTcGFuPik6IFNvdXJjZVNwYW47XG4gIHN0YXRpYyByYW5nZShzcGFuOiBIYXNTb3VyY2VTcGFuW10sIGZhbGxiYWNrOiBTb3VyY2VTcGFuKTogU291cmNlU3BhbjtcbiAgc3RhdGljIHJhbmdlKHNwYW46IEhhc1NvdXJjZVNwYW5bXSwgZmFsbGJhY2s6IFNvdXJjZVNwYW4gPSBTb3VyY2VTcGFuLk5PTl9FWElTVEVOVCk6IFNvdXJjZVNwYW4ge1xuICAgIHJldHVybiBuZXcgU3Bhbkxpc3Qoc3Bhbi5tYXAobG9jKSkuZ2V0UmFuZ2VPZmZzZXQoZmFsbGJhY2spO1xuICB9XG5cbiAgX3NwYW46IFNvdXJjZVNwYW5bXTtcblxuICBjb25zdHJ1Y3RvcihzcGFuOiBTb3VyY2VTcGFuW10gPSBbXSkge1xuICAgIHRoaXMuX3NwYW4gPSBzcGFuO1xuICB9XG5cbiAgYWRkKG9mZnNldDogU291cmNlU3Bhbik6IHZvaWQge1xuICAgIHRoaXMuX3NwYW4ucHVzaChvZmZzZXQpO1xuICB9XG5cbiAgZ2V0UmFuZ2VPZmZzZXQoZmFsbGJhY2s6IFNvdXJjZVNwYW4pOiBTb3VyY2VTcGFuIHtcbiAgICBpZiAodGhpcy5fc3Bhbi5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBmYWxsYmFjaztcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGZpcnN0ID0gdGhpcy5fc3BhblswXTtcbiAgICAgIGxldCBsYXN0ID0gdGhpcy5fc3Bhblt0aGlzLl9zcGFuLmxlbmd0aCAtIDFdO1xuXG4gICAgICByZXR1cm4gZmlyc3QuZXh0ZW5kKGxhc3QpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgdHlwZSBIYXNTb3VyY2VTcGFuID0geyBsb2M6IFNvdXJjZVNwYW4gfSB8IFNvdXJjZVNwYW4gfCBbSGFzU291cmNlU3BhbiwgLi4uSGFzU291cmNlU3BhbltdXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGxvYyhzcGFuOiBIYXNTb3VyY2VTcGFuKTogU291cmNlU3BhbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KHNwYW4pKSB7XG4gICAgbGV0IGZpcnN0ID0gc3BhblswXTtcbiAgICBsZXQgbGFzdCA9IHNwYW5bc3Bhbi5sZW5ndGggLSAxXTtcblxuICAgIHJldHVybiBsb2MoZmlyc3QpLmV4dGVuZChsb2MobGFzdCkpO1xuICB9IGVsc2UgaWYgKHNwYW4gaW5zdGFuY2VvZiBTb3VyY2VTcGFuKSB7XG4gICAgcmV0dXJuIHNwYW47XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHNwYW4ubG9jO1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIE1heWJlSGFzU291cmNlU3BhbiA9IHsgbG9jOiBTb3VyY2VTcGFuIH0gfCBTb3VyY2VTcGFuIHwgTWF5YmVIYXNTb3VyY2VTcGFuW107XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNTcGFuKHNwYW46IE1heWJlSGFzU291cmNlU3Bhbik6IHNwYW4gaXMgSGFzU291cmNlU3BhbiB7XG4gIGlmIChBcnJheS5pc0FycmF5KHNwYW4pICYmIHNwYW4ubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXliZUxvYyhsb2NhdGlvbjogTWF5YmVIYXNTb3VyY2VTcGFuLCBmYWxsYmFjazogU291cmNlU3Bhbik6IFNvdXJjZVNwYW4ge1xuICBpZiAoaGFzU3Bhbihsb2NhdGlvbikpIHtcbiAgICByZXR1cm4gbG9jKGxvY2F0aW9uKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsbGJhY2s7XG4gIH1cbn1cbiIsImltcG9ydCB7IFNvdXJjZVNsaWNlIH0gZnJvbSAnLi4vLi4vc291cmNlL3NsaWNlJztcbmltcG9ydCB7IFNwYW5MaXN0IH0gZnJvbSAnLi4vLi4vc291cmNlL3NwYW4tbGlzdCc7XG5pbXBvcnQgeyBTeW1ib2xUYWJsZSB9IGZyb20gJy4uLy4uL3N5bWJvbC10YWJsZSc7XG5pbXBvcnQgeyBBcmdzLCBOYW1lZEFyZ3VtZW50cyB9IGZyb20gJy4vYXJncyc7XG5pbXBvcnQgdHlwZSB7IENvbXBvbmVudEFyZywgRWxlbWVudE1vZGlmaWVyLCBIdG1sT3JTcGxhdEF0dHIgfSBmcm9tICcuL2F0dHItYmxvY2snO1xuaW1wb3J0IHR5cGUgeyBDYWxsRmllbGRzIH0gZnJvbSAnLi9iYXNlJztcbmltcG9ydCB0eXBlIHsgRXhwcmVzc2lvbk5vZGUgfSBmcm9tICcuL2V4cHInO1xuaW1wb3J0IHR5cGUgeyBOYW1lZEJsb2NrLCBOYW1lZEJsb2NrcyB9IGZyb20gJy4vaW50ZXJuYWwtbm9kZSc7XG5pbXBvcnQgeyBCYXNlTm9kZUZpZWxkcywgbm9kZSB9IGZyb20gJy4vbm9kZSc7XG5cbi8qKlxuICogQ29udGVudCBOb2RlcyBhcmUgYWxsb3dlZCBpbiBjb250ZW50IHBvc2l0aW9ucyBpbiB0ZW1wbGF0ZXMuIFRoZXkgY29ycmVzcG9uZCB0byBiZWhhdmlvciBpbiB0aGVcbiAqIFtEYXRhXVtkYXRhXSB0b2tlbml6YXRpb24gc3RhdGUgaW4gSFRNTC5cbiAqXG4gKiBbZGF0YV06IGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3BhcnNpbmcuaHRtbCNkYXRhLXN0YXRlXG4gKi9cbmV4cG9ydCB0eXBlIENvbnRlbnROb2RlID1cbiAgfCBIdG1sVGV4dFxuICB8IEh0bWxDb21tZW50XG4gIHwgQXBwZW5kQ29udGVudFxuICB8IEludm9rZUJsb2NrXG4gIHwgSW52b2tlQ29tcG9uZW50XG4gIHwgU2ltcGxlRWxlbWVudFxuICB8IEdsaW1tZXJDb21tZW50O1xuXG5leHBvcnQgY2xhc3MgR2xpbW1lckNvbW1lbnQgZXh0ZW5kcyBub2RlKCdHbGltbWVyQ29tbWVudCcpLmZpZWxkczx7IHRleHQ6IFNvdXJjZVNsaWNlIH0+KCkge31cbmV4cG9ydCBjbGFzcyBIdG1sVGV4dCBleHRlbmRzIG5vZGUoJ0h0bWxUZXh0JykuZmllbGRzPHsgY2hhcnM6IHN0cmluZyB9PigpIHt9XG5leHBvcnQgY2xhc3MgSHRtbENvbW1lbnQgZXh0ZW5kcyBub2RlKCdIdG1sQ29tbWVudCcpLmZpZWxkczx7IHRleHQ6IFNvdXJjZVNsaWNlIH0+KCkge31cblxuZXhwb3J0IGNsYXNzIEFwcGVuZENvbnRlbnQgZXh0ZW5kcyBub2RlKCdBcHBlbmRDb250ZW50JykuZmllbGRzPHtcbiAgdmFsdWU6IEV4cHJlc3Npb25Ob2RlO1xuICB0cnVzdGluZzogYm9vbGVhbjtcbiAgdGFibGU6IFN5bWJvbFRhYmxlO1xufT4oKSB7XG4gIGdldCBjYWxsZWUoKTogRXhwcmVzc2lvbk5vZGUge1xuICAgIGlmICh0aGlzLnZhbHVlLnR5cGUgPT09ICdDYWxsJykge1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWUuY2FsbGVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgICB9XG4gIH1cblxuICBnZXQgYXJncygpOiBBcmdzIHtcbiAgICBpZiAodGhpcy52YWx1ZS50eXBlID09PSAnQ2FsbCcpIHtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlLmFyZ3M7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBBcmdzLmVtcHR5KHRoaXMudmFsdWUubG9jLmNvbGxhcHNlKCdlbmQnKSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnZva2VCbG9jayBleHRlbmRzIG5vZGUoJ0ludm9rZUJsb2NrJykuZmllbGRzPFxuICBDYWxsRmllbGRzICYgeyBibG9ja3M6IE5hbWVkQmxvY2tzIH1cbj4oKSB7fVxuXG5pbnRlcmZhY2UgSW52b2tlQ29tcG9uZW50RmllbGRzIHtcbiAgY2FsbGVlOiBFeHByZXNzaW9uTm9kZTtcbiAgYmxvY2tzOiBOYW1lZEJsb2NrcztcbiAgYXR0cnM6IHJlYWRvbmx5IEh0bWxPclNwbGF0QXR0cltdO1xuICBjb21wb25lbnRBcmdzOiByZWFkb25seSBDb21wb25lbnRBcmdbXTtcbiAgbW9kaWZpZXJzOiByZWFkb25seSBFbGVtZW50TW9kaWZpZXJbXTtcbn1cblxuLyoqXG4gKiBDb3JyZXNwb25kcyB0byBhIGNvbXBvbmVudCBpbnZvY2F0aW9uLiBXaGVuIHRoZSBjb250ZW50IG9mIGEgY29tcG9uZW50IGludm9jYXRpb24gY29udGFpbnMgbm9cbiAqIG5hbWVkIGJsb2NrcywgYGJsb2Nrc2AgY29udGFpbnMgYSBzaW5nbGUgbmFtZWQgYmxvY2sgbmFtZWQgYFwiZGVmYXVsdFwiYC4gV2hlbiBhIGNvbXBvbmVudFxuICogaW52b2NhdGlvbiBpcyBzZWxmLWNsb3NpbmcsIGBibG9ja3NgIGlzIGVtcHR5LlxuICovXG5leHBvcnQgY2xhc3MgSW52b2tlQ29tcG9uZW50IGV4dGVuZHMgbm9kZSgnSW52b2tlQ29tcG9uZW50JykuZmllbGRzPEludm9rZUNvbXBvbmVudEZpZWxkcz4oKSB7XG4gIGdldCBhcmdzKCk6IEFyZ3Mge1xuICAgIGxldCBlbnRyaWVzID0gdGhpcy5jb21wb25lbnRBcmdzLm1hcCgoYSkgPT4gYS50b05hbWVkQXJndW1lbnQoKSk7XG5cbiAgICByZXR1cm4gQXJncy5uYW1lZChcbiAgICAgIG5ldyBOYW1lZEFyZ3VtZW50cyh7XG4gICAgICAgIGxvYzogU3Bhbkxpc3QucmFuZ2UoZW50cmllcywgdGhpcy5jYWxsZWUubG9jLmNvbGxhcHNlKCdlbmQnKSksXG4gICAgICAgIGVudHJpZXMsXG4gICAgICB9KVxuICAgICk7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFNpbXBsZUVsZW1lbnRPcHRpb25zIGV4dGVuZHMgQmFzZU5vZGVGaWVsZHMge1xuICB0YWc6IFNvdXJjZVNsaWNlO1xuICBib2R5OiByZWFkb25seSBDb250ZW50Tm9kZVtdO1xuICBhdHRyczogcmVhZG9ubHkgSHRtbE9yU3BsYXRBdHRyW107XG4gIGNvbXBvbmVudEFyZ3M6IHJlYWRvbmx5IENvbXBvbmVudEFyZ1tdO1xuICBtb2RpZmllcnM6IHJlYWRvbmx5IEVsZW1lbnRNb2RpZmllcltdO1xufVxuXG4vKipcbiAqIENvcnJlc3BvbmRzIHRvIGEgc2ltcGxlIEhUTUwgZWxlbWVudC4gVGhlIEFTVCBhbGxvd3MgY29tcG9uZW50IGFyZ3VtZW50cyBhbmQgbW9kaWZpZXJzIHRvIHN1cHBvcnRcbiAqIGZ1dHVyZSBleHRlbnNpb25zLlxuICovXG5leHBvcnQgY2xhc3MgU2ltcGxlRWxlbWVudCBleHRlbmRzIG5vZGUoJ1NpbXBsZUVsZW1lbnQnKS5maWVsZHM8U2ltcGxlRWxlbWVudE9wdGlvbnM+KCkge1xuICBnZXQgYXJncygpOiBBcmdzIHtcbiAgICBsZXQgZW50cmllcyA9IHRoaXMuY29tcG9uZW50QXJncy5tYXAoKGEpID0+IGEudG9OYW1lZEFyZ3VtZW50KCkpO1xuXG4gICAgcmV0dXJuIEFyZ3MubmFtZWQoXG4gICAgICBuZXcgTmFtZWRBcmd1bWVudHMoe1xuICAgICAgICBsb2M6IFNwYW5MaXN0LnJhbmdlKGVudHJpZXMsIHRoaXMudGFnLmxvYy5jb2xsYXBzZSgnZW5kJykpLFxuICAgICAgICBlbnRyaWVzLFxuICAgICAgfSlcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIEVsZW1lbnROb2RlID0gTmFtZWRCbG9jayB8IEludm9rZUNvbXBvbmVudCB8IFNpbXBsZUVsZW1lbnQ7XG4iLCJpbXBvcnQgeyBQcmVzZW50QXJyYXkgfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcblxuaW1wb3J0IHsgU291cmNlU2xpY2UgfSBmcm9tICcuLi8uLi9zb3VyY2Uvc2xpY2UnO1xuaW1wb3J0IHR5cGUgeyBDYWxsRmllbGRzIH0gZnJvbSAnLi9iYXNlJztcbmltcG9ydCB7IG5vZGUgfSBmcm9tICcuL25vZGUnO1xuaW1wb3J0IHR5cGUgeyBGcmVlVmFyUmVmZXJlbmNlLCBWYXJpYWJsZVJlZmVyZW5jZSB9IGZyb20gJy4vcmVmcyc7XG5cbi8qKlxuICogQSBIYW5kbGViYXJzIGxpdGVyYWwuXG4gKlxuICoge0BsaW5rIGh0dHBzOi8vaGFuZGxlYmFyc2pzLmNvbS9ndWlkZS9leHByZXNzaW9ucy5odG1sI2xpdGVyYWwtc2VnbWVudHN9XG4gKi9cbmV4cG9ydCB0eXBlIExpdGVyYWxWYWx1ZSA9IHN0cmluZyB8IGJvb2xlYW4gfCBudW1iZXIgfCB1bmRlZmluZWQgfCBudWxsO1xuXG5leHBvcnQgaW50ZXJmYWNlIExpdGVyYWxUeXBlcyB7XG4gIHN0cmluZzogc3RyaW5nO1xuICBib29sZWFuOiBib29sZWFuO1xuICBudW1iZXI6IG51bWJlcjtcbiAgbnVsbDogbnVsbDtcbiAgdW5kZWZpbmVkOiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQ29ycmVzcG9uZHMgdG8gYSBIYW5kbGViYXJzIGxpdGVyYWwuXG4gKlxuICogQHNlZSB7TGl0ZXJhbFZhbHVlfVxuICovXG5leHBvcnQgY2xhc3MgTGl0ZXJhbEV4cHJlc3Npb24gZXh0ZW5kcyBub2RlKCdMaXRlcmFsJykuZmllbGRzPHsgdmFsdWU6IExpdGVyYWxWYWx1ZSB9PigpIHtcbiAgdG9TbGljZSh0aGlzOiBTdHJpbmdMaXRlcmFsKTogU291cmNlU2xpY2Uge1xuICAgIHJldHVybiBuZXcgU291cmNlU2xpY2UoeyBsb2M6IHRoaXMubG9jLCBjaGFyczogdGhpcy52YWx1ZSB9KTtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBTdHJpbmdMaXRlcmFsID0gTGl0ZXJhbEV4cHJlc3Npb24gJiB7IHZhbHVlOiBzdHJpbmcgfTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgYW4gaW5wdXQge0BzZWUgRXhwcmVzc2lvbk5vZGV9IGlzIGEgbGl0ZXJhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTGl0ZXJhbDxLIGV4dGVuZHMga2V5b2YgTGl0ZXJhbFR5cGVzID0ga2V5b2YgTGl0ZXJhbFR5cGVzPihcbiAgbm9kZTogRXhwcmVzc2lvbk5vZGUsXG4gIGtpbmQ/OiBLXG4pOiBub2RlIGlzIFN0cmluZ0xpdGVyYWwge1xuICBpZiAobm9kZS50eXBlID09PSAnTGl0ZXJhbCcpIHtcbiAgICBpZiAoa2luZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGtpbmQgPT09ICdudWxsJykge1xuICAgICAgcmV0dXJuIG5vZGUudmFsdWUgPT09IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygbm9kZS52YWx1ZSA9PT0ga2luZDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8qKlxuICogQ29ycmVzcG9uZHMgdG8gYSBwYXRoIGluIGV4cHJlc3Npb24gcG9zaXRpb24uXG4gKlxuICogYGBgaGJzXG4gKiB0aGlzXG4gKiB0aGlzLnhcbiAqIEB4XG4gKiBAeC55XG4gKiB4XG4gKiB4LnlcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgUGF0aEV4cHJlc3Npb24gZXh0ZW5kcyBub2RlKCdQYXRoJykuZmllbGRzPHtcbiAgcmVmOiBWYXJpYWJsZVJlZmVyZW5jZTtcbiAgdGFpbDogcmVhZG9ubHkgU291cmNlU2xpY2VbXTtcbn0+KCkge31cblxuLyoqXG4gKiBDb3JyZXNwb25kcyB0byBhIHBhcmVudGhlc2l6ZWQgY2FsbCBleHByZXNzaW9uLlxuICpcbiAqIGBgYGhic1xuICogKHgpXG4gKiAoeC55KVxuICogKHggeSlcbiAqICh4LnkgeilcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgQ2FsbEV4cHJlc3Npb24gZXh0ZW5kcyBub2RlKCdDYWxsJykuZmllbGRzPENhbGxGaWVsZHM+KCkge31cblxuLyoqXG4gKiBDb3JyZXNwb25kcyB0byBhIHBvc3NpYmxlIGRlcHJlY2F0ZWQgaGVscGVyIGNhbGwuIE11c3QgYmU6XG4gKlxuICogMS4gQSBmcmVlIHZhcmlhYmxlIChub3QgdGhpcy5mb28sIG5vdCBAZm9vLCBub3QgbG9jYWwpLlxuICogMi4gQXJndW1lbnQtbGVzcy5cbiAqIDMuIEluIGEgY29tcG9uZW50IGludm9jYXRpb24ncyBuYW1lZCBhcmd1bWVudCBwb3NpdGlvbi5cbiAqIDQuIE5vdCBwYXJlbnRoZXNpemVkIChub3QgQGJhcj17eyhoZWxwZXIpfX0pLlxuICogNS4gTm90IGludGVycG9sYXRlZCAobm90IEBiYXI9XCJ7e2hlbHBlcn19XCIpLlxuICpcbiAqIGBgYGhic1xuICogPEZvbyBAYmFyPXt7aGVscGVyfX0gLz5cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgRGVwcmVjYXRlZENhbGxFeHByZXNzaW9uIGV4dGVuZHMgbm9kZSgnRGVwcmVjYXRlZENhbGwnKS5maWVsZHM8e1xuICBhcmc6IFNvdXJjZVNsaWNlO1xuICBjYWxsZWU6IEZyZWVWYXJSZWZlcmVuY2U7XG59PigpIHt9XG5cbi8qKlxuICogQ29ycmVzcG9uZHMgdG8gYW4gaW50ZXJwb2xhdGlvbiBpbiBhdHRyaWJ1dGUgdmFsdWUgcG9zaXRpb24uXG4gKlxuICogYGBgaGJzXG4gKiA8YSBocmVmPVwie3t1cmx9fS5odG1sXCJcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGVFeHByZXNzaW9uIGV4dGVuZHMgbm9kZSgnSW50ZXJwb2xhdGUnKS5maWVsZHM8e1xuICBwYXJ0czogUHJlc2VudEFycmF5PEV4cHJlc3Npb25Ob2RlPjtcbn0+KCkge31cblxuZXhwb3J0IHR5cGUgRXhwcmVzc2lvbk5vZGUgPVxuICB8IExpdGVyYWxFeHByZXNzaW9uXG4gIHwgUGF0aEV4cHJlc3Npb25cbiAgfCBDYWxsRXhwcmVzc2lvblxuICB8IERlcHJlY2F0ZWRDYWxsRXhwcmVzc2lvblxuICB8IEludGVycG9sYXRlRXhwcmVzc2lvbjtcbiIsImltcG9ydCB7IFNvdXJjZVNsaWNlIH0gZnJvbSAnLi4vLi4vc291cmNlL3NsaWNlJztcbmltcG9ydCB7IG5vZGUgfSBmcm9tICcuL25vZGUnO1xuaW1wb3J0IHR5cGUgeyBGcmVlVmFyUmVzb2x1dGlvbiB9IGZyb20gJy4vcmVzb2x1dGlvbic7XG5cbi8qKlxuICogQ29ycmVzcG9uZHMgdG8gYHRoaXNgIGF0IHRoZSBoZWFkIG9mIGFuIGV4cHJlc3Npb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBUaGlzUmVmZXJlbmNlIGV4dGVuZHMgbm9kZSgnVGhpcycpLmZpZWxkcygpIHt9XG5cbi8qKlxuICogQ29ycmVzcG9uZHMgdG8gYEA8aWRlbnQ+YCBhdCB0aGUgYmVnaW5uaW5nIG9mIGFuIGV4cHJlc3Npb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBBcmdSZWZlcmVuY2UgZXh0ZW5kcyBub2RlKCdBcmcnKS5maWVsZHM8eyBuYW1lOiBTb3VyY2VTbGljZTsgc3ltYm9sOiBudW1iZXIgfT4oKSB7fVxuXG4vKipcbiAqIENvcnJlc3BvbmRzIHRvIGA8aWRlbnQ+YCBhdCB0aGUgYmVnaW5uaW5nIG9mIGFuIGV4cHJlc3Npb24sIHdoZW4gYDxpZGVudD5gIGlzIGluIHRoZSBjdXJyZW50XG4gKiBibG9jaydzIHNjb3BlLlxuICovXG5leHBvcnQgY2xhc3MgTG9jYWxWYXJSZWZlcmVuY2UgZXh0ZW5kcyBub2RlKCdMb2NhbCcpLmZpZWxkczx7XG4gIG5hbWU6IHN0cmluZztcbiAgaXNUZW1wbGF0ZUxvY2FsOiBib29sZWFuO1xuICBzeW1ib2w6IG51bWJlcjtcbn0+KCkge31cblxuLyoqXG4gKiBDb3JyZXNwb25kcyB0byBgPGlkZW50PmAgYXQgdGhlIGJlZ2lubmluZyBvZiBhbiBleHByZXNzaW9uLCB3aGVuIGA8aWRlbnQ+YCBpcyAqbm90KiBpbiB0aGVcbiAqIGN1cnJlbnQgYmxvY2sncyBzY29wZS5cbiAqXG4gKiBUaGUgYHJlc29sdXRpb246IEZyZWVWYXJSZXNvbHV0aW9uYCBmaWVsZCBkZXNjcmliZXMgaG93IHRvIHJlc29sdmUgdGhlIGZyZWUgdmFyaWFibGUuXG4gKlxuICogTm90ZTogSW4gc3RyaWN0IG1vZGUsIGl0IG11c3QgYWx3YXlzIGJlIGEgdmFyaWFibGUgdGhhdCBpcyBpbiBhIGNvbmNyZXRlIEphdmFTY3JpcHQgc2NvcGUgdGhhdFxuICogdGhlIHRlbXBsYXRlIHdpbGwgYmUgaW5zdGFsbGVkIGludG8uXG4gKi9cbmV4cG9ydCBjbGFzcyBGcmVlVmFyUmVmZXJlbmNlIGV4dGVuZHMgbm9kZSgnRnJlZScpLmZpZWxkczx7XG4gIG5hbWU6IHN0cmluZztcbiAgcmVzb2x1dGlvbjogRnJlZVZhclJlc29sdXRpb247XG4gIHN5bWJvbDogbnVtYmVyO1xufT4oKSB7fVxuXG5leHBvcnQgdHlwZSBWYXJpYWJsZVJlZmVyZW5jZSA9IFRoaXNSZWZlcmVuY2UgfCBBcmdSZWZlcmVuY2UgfCBMb2NhbFZhclJlZmVyZW5jZSB8IEZyZWVWYXJSZWZlcmVuY2U7XG4iLCJpbXBvcnQgeyBTb3VyY2VTbGljZSB9IGZyb20gJy4uLy4uL3NvdXJjZS9zbGljZSc7XG5pbXBvcnQgeyBTcGFuTGlzdCB9IGZyb20gJy4uLy4uL3NvdXJjZS9zcGFuLWxpc3QnO1xuaW1wb3J0IHsgQmxvY2tTeW1ib2xUYWJsZSwgUHJvZ3JhbVN5bWJvbFRhYmxlIH0gZnJvbSAnLi4vLi4vc3ltYm9sLXRhYmxlJztcbmltcG9ydCB7IEFyZ3MsIE5hbWVkQXJndW1lbnRzIH0gZnJvbSAnLi9hcmdzJztcbmltcG9ydCB0eXBlIHsgQ29tcG9uZW50QXJnLCBFbGVtZW50TW9kaWZpZXIsIEh0bWxPclNwbGF0QXR0ciB9IGZyb20gJy4vYXR0ci1ibG9jayc7XG5pbXBvcnQgdHlwZSB7IEdsaW1tZXJQYXJlbnROb2RlT3B0aW9ucyB9IGZyb20gJy4vYmFzZSc7XG5pbXBvcnQgeyBCYXNlTm9kZUZpZWxkcywgbm9kZSB9IGZyb20gJy4vbm9kZSc7XG5cbi8qKlxuICogQ29ycmVzcG9uZHMgdG8gYW4gZW50aXJlIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgVGVtcGxhdGUgZXh0ZW5kcyBub2RlKCkuZmllbGRzPFxuICB7XG4gICAgdGFibGU6IFByb2dyYW1TeW1ib2xUYWJsZTtcbiAgfSAmIEdsaW1tZXJQYXJlbnROb2RlT3B0aW9uc1xuPigpIHt9XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGJsb2NrLiBJbiBwcmluY2lwbGUgdGhpcyBjb3VsZCBiZSBtZXJnZWQgd2l0aCBgTmFtZWRCbG9ja2AsIGJlY2F1c2UgYWxsIGNhc2VzXG4gKiBpbnZvbHZpbmcgYmxvY2tzIGhhdmUgYXQgbGVhc3QgYSBub3Rpb25hbCBuYW1lLlxuICovXG5leHBvcnQgY2xhc3MgQmxvY2sgZXh0ZW5kcyBub2RlKCkuZmllbGRzPFxuICB7IHNjb3BlOiBCbG9ja1N5bWJvbFRhYmxlIH0gJiBHbGltbWVyUGFyZW50Tm9kZU9wdGlvbnNcbj4oKSB7fVxuXG4vKipcbiAqIENvcnJlc3BvbmRzIHRvIGEgY29sbGVjdGlvbiBvZiBuYW1lZCBibG9ja3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBOYW1lZEJsb2NrcyBleHRlbmRzIG5vZGUoKS5maWVsZHM8eyBibG9ja3M6IHJlYWRvbmx5IE5hbWVkQmxvY2tbXSB9PigpIHtcbiAgLyoqXG4gICAqIEdldCB0aGUgYE5hbWVkQmxvY2tgIGZvciBhIGdpdmVuIG5hbWUuXG4gICAqL1xuICBnZXQobmFtZTogJ2RlZmF1bHQnKTogTmFtZWRCbG9jaztcbiAgZ2V0KG5hbWU6IHN0cmluZyk6IE5hbWVkQmxvY2sgfCBudWxsO1xuICBnZXQobmFtZTogc3RyaW5nKTogTmFtZWRCbG9jayB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmJsb2Nrcy5maWx0ZXIoKGJsb2NrKSA9PiBibG9jay5uYW1lLmNoYXJzID09PSBuYW1lKVswXSB8fCBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmFtZWRCbG9ja0ZpZWxkcyBleHRlbmRzIEJhc2VOb2RlRmllbGRzIHtcbiAgbmFtZTogU291cmNlU2xpY2U7XG4gIGJsb2NrOiBCbG9jaztcblxuICAvLyB0aGVzZSBhcmUgbm90IGN1cnJlbnRseSBzdXBwb3J0ZWQsIGJ1dCBhcmUgaGVyZSBmb3IgZnV0dXJlIGV4cGFuc2lvblxuICBhdHRyczogcmVhZG9ubHkgSHRtbE9yU3BsYXRBdHRyW107XG4gIGNvbXBvbmVudEFyZ3M6IHJlYWRvbmx5IENvbXBvbmVudEFyZ1tdO1xuICBtb2RpZmllcnM6IHJlYWRvbmx5IEVsZW1lbnRNb2RpZmllcltdO1xufVxuXG4vKipcbiAqIENvcnJlc3BvbmRzIHRvIGEgc2luZ2xlIG5hbWVkIGJsb2NrLiBUaGlzIGlzIHVzZWQgZm9yIGFub255bW91cyBuYW1lZCBibG9ja3MgKGBkZWZhdWx0YCBhbmRcbiAqIGBlbHNlYCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBOYW1lZEJsb2NrIGV4dGVuZHMgbm9kZSgpLmZpZWxkczxOYW1lZEJsb2NrRmllbGRzPigpIHtcbiAgZ2V0IGFyZ3MoKTogQXJncyB7XG4gICAgbGV0IGVudHJpZXMgPSB0aGlzLmNvbXBvbmVudEFyZ3MubWFwKChhKSA9PiBhLnRvTmFtZWRBcmd1bWVudCgpKTtcblxuICAgIHJldHVybiBBcmdzLm5hbWVkKFxuICAgICAgbmV3IE5hbWVkQXJndW1lbnRzKHtcbiAgICAgICAgbG9jOiBTcGFuTGlzdC5yYW5nZShlbnRyaWVzLCB0aGlzLm5hbWUubG9jLmNvbGxhcHNlKCdlbmQnKSksXG4gICAgICAgIGVudHJpZXMsXG4gICAgICB9KVxuICAgICk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIEFTVHYxIGZyb20gJy4uL3YxL2FwaSc7XG5cbmNvbnN0IGVudW0gQ2hhciB7XG4gIE5CU1AgPSAweGEwLFxuICBRVU9UID0gMHgyMixcbiAgTFQgPSAweDNjLFxuICBHVCA9IDB4M2UsXG4gIEFNUCA9IDB4MjYsXG59XG5cbmNvbnN0IEFUVFJfVkFMVUVfUkVHRVhfVEVTVCA9IC9bXFx4QTBcIiZdLztcbmNvbnN0IEFUVFJfVkFMVUVfUkVHRVhfUkVQTEFDRSA9IG5ldyBSZWdFeHAoQVRUUl9WQUxVRV9SRUdFWF9URVNULnNvdXJjZSwgJ2cnKTtcblxuY29uc3QgVEVYVF9SRUdFWF9URVNUID0gL1tcXHhBMCY8Pl0vO1xuY29uc3QgVEVYVF9SRUdFWF9SRVBMQUNFID0gbmV3IFJlZ0V4cChURVhUX1JFR0VYX1RFU1Quc291cmNlLCAnZycpO1xuXG5mdW5jdGlvbiBhdHRyVmFsdWVSZXBsYWNlcihjaGFyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBzd2l0Y2ggKGNoYXIuY2hhckNvZGVBdCgwKSkge1xuICAgIGNhc2UgQ2hhci5OQlNQOlxuICAgICAgcmV0dXJuICcmbmJzcDsnO1xuICAgIGNhc2UgQ2hhci5RVU9UOlxuICAgICAgcmV0dXJuICcmcXVvdDsnO1xuICAgIGNhc2UgQ2hhci5BTVA6XG4gICAgICByZXR1cm4gJyZhbXA7JztcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNoYXI7XG4gIH1cbn1cblxuZnVuY3Rpb24gdGV4dFJlcGxhY2VyKGNoYXI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHN3aXRjaCAoY2hhci5jaGFyQ29kZUF0KDApKSB7XG4gICAgY2FzZSBDaGFyLk5CU1A6XG4gICAgICByZXR1cm4gJyZuYnNwOyc7XG4gICAgY2FzZSBDaGFyLkFNUDpcbiAgICAgIHJldHVybiAnJmFtcDsnO1xuICAgIGNhc2UgQ2hhci5MVDpcbiAgICAgIHJldHVybiAnJmx0Oyc7XG4gICAgY2FzZSBDaGFyLkdUOlxuICAgICAgcmV0dXJuICcmZ3Q7JztcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNoYXI7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUF0dHJWYWx1ZShhdHRyVmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChBVFRSX1ZBTFVFX1JFR0VYX1RFU1QudGVzdChhdHRyVmFsdWUpKSB7XG4gICAgcmV0dXJuIGF0dHJWYWx1ZS5yZXBsYWNlKEFUVFJfVkFMVUVfUkVHRVhfUkVQTEFDRSwgYXR0clZhbHVlUmVwbGFjZXIpO1xuICB9XG4gIHJldHVybiBhdHRyVmFsdWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVUZXh0KHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChURVhUX1JFR0VYX1RFU1QudGVzdCh0ZXh0KSkge1xuICAgIHJldHVybiB0ZXh0LnJlcGxhY2UoVEVYVF9SRUdFWF9SRVBMQUNFLCB0ZXh0UmVwbGFjZXIpO1xuICB9XG4gIHJldHVybiB0ZXh0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc29ydEJ5TG9jKGE6IEFTVHYxLk5vZGUsIGI6IEFTVHYxLk5vZGUpOiAtMSB8IDAgfCAxIHtcbiAgLy8gSWYgZWl0aGVyIGlzIGludmlzaWJsZSwgZG9uJ3QgdHJ5IHRvIG9yZGVyIHRoZW1cbiAgaWYgKGEubG9jLmlzSW52aXNpYmxlIHx8IGIubG9jLmlzSW52aXNpYmxlKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBpZiAoYS5sb2Muc3RhcnRQb3NpdGlvbi5saW5lIDwgYi5sb2Muc3RhcnRQb3NpdGlvbi5saW5lKSB7XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgaWYgKFxuICAgIGEubG9jLnN0YXJ0UG9zaXRpb24ubGluZSA9PT0gYi5sb2Muc3RhcnRQb3NpdGlvbi5saW5lICYmXG4gICAgYS5sb2Muc3RhcnRQb3NpdGlvbi5jb2x1bW4gPCBiLmxvYy5zdGFydFBvc2l0aW9uLmNvbHVtblxuICApIHtcbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBpZiAoXG4gICAgYS5sb2Muc3RhcnRQb3NpdGlvbi5saW5lID09PSBiLmxvYy5zdGFydFBvc2l0aW9uLmxpbmUgJiZcbiAgICBhLmxvYy5zdGFydFBvc2l0aW9uLmNvbHVtbiA9PT0gYi5sb2Muc3RhcnRQb3NpdGlvbi5jb2x1bW5cbiAgKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICByZXR1cm4gMTtcbn1cbiIsImltcG9ydCAqIGFzIEFTVHYxIGZyb20gJy4uL3YxL2FwaSc7XG5pbXBvcnQgeyBlc2NhcGVBdHRyVmFsdWUsIGVzY2FwZVRleHQsIHNvcnRCeUxvYyB9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBjb25zdCB2b2lkTWFwOiB7XG4gIFt0YWdOYW1lOiBzdHJpbmddOiBib29sZWFuO1xufSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbmxldCB2b2lkVGFnTmFtZXMgPVxuICAnYXJlYSBiYXNlIGJyIGNvbCBjb21tYW5kIGVtYmVkIGhyIGltZyBpbnB1dCBrZXlnZW4gbGluayBtZXRhIHBhcmFtIHNvdXJjZSB0cmFjayB3YnInO1xudm9pZFRhZ05hbWVzLnNwbGl0KCcgJykuZm9yRWFjaCgodGFnTmFtZSkgPT4ge1xuICB2b2lkTWFwW3RhZ05hbWVdID0gdHJ1ZTtcbn0pO1xuXG5jb25zdCBOT05fV0hJVEVTUEFDRSA9IC9cXFMvO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByaW50ZXJPcHRpb25zIHtcbiAgZW50aXR5RW5jb2Rpbmc6ICd0cmFuc2Zvcm1lZCcgfCAncmF3JztcblxuICAvKipcbiAgICogVXNlZCB0byBvdmVycmlkZSB0aGUgbWVjaGFuaXNtIG9mIHByaW50aW5nIGEgZ2l2ZW4gQVNULk5vZGUuXG4gICAqXG4gICAqIFRoaXMgd2lsbCBnZW5lcmFsbHkgb25seSBiZSB1c2VmdWwgdG8gc291cmNlIC0+IHNvdXJjZSBjb2RlbW9kc1xuICAgKiB3aGVyZSB5b3Ugd291bGQgbGlrZSB0byBzcGVjaWFsaXplL292ZXJyaWRlIHRoZSB3YXkgYSBnaXZlbiBub2RlIGlzXG4gICAqIHByaW50ZWQgKGUuZy4geW91IHdvdWxkIGxpa2UgdG8gcHJlc2VydmUgYXMgbXVjaCBvZiB0aGUgb3JpZ2luYWxcbiAgICogZm9ybWF0dGluZyBhcyBwb3NzaWJsZSkuXG4gICAqXG4gICAqIFdoZW4gdGhlIHByb3ZpZGVkIG92ZXJyaWRlIHJldHVybnMgdW5kZWZpbmVkLCB0aGUgZGVmYXVsdCBidWlsdCBpbiBwcmludGluZ1xuICAgKiB3aWxsIGJlIGRvbmUgZm9yIHRoZSBBU1QuTm9kZS5cbiAgICpcbiAgICogQHBhcmFtIGFzdCB0aGUgYXN0IG5vZGUgdG8gYmUgcHJpbnRlZFxuICAgKiBAcGFyYW0gb3B0aW9ucyB0aGUgb3B0aW9ucyBzcGVjaWZpZWQgZHVyaW5nIHRoZSBwcmludCgpIGludm9jYXRpb25cbiAgICovXG4gIG92ZXJyaWRlPyhhc3Q6IEFTVHYxLk5vZGUsIG9wdGlvbnM6IFByaW50ZXJPcHRpb25zKTogdm9pZCB8IHN0cmluZztcbn1cblxuLyoqXG4gKiBFeGFtcGxlcyB3aGVuIHRydWU6XG4gKiAgLSBsaW5rXG4gKiAgLSBsaU5LXG4gKlxuICogRXhhbXBsZXMgd2hlbiBmYWxzZTpcbiAqICAtIExpbmsgKGNvbXBvbmVudClcbiAqL1xuZnVuY3Rpb24gaXNWb2lkVGFnKHRhZzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB2b2lkTWFwW3RhZy50b0xvd2VyQ2FzZSgpXSAmJiB0YWdbMF0udG9Mb3dlckNhc2UoKSA9PT0gdGFnWzBdO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBQcmludGVyIHtcbiAgcHJpdmF0ZSBidWZmZXIgPSAnJztcbiAgcHJpdmF0ZSBvcHRpb25zOiBQcmludGVyT3B0aW9ucztcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBQcmludGVyT3B0aW9ucykge1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gIH1cblxuICAvKlxuICAgIFRoaXMgaXMgdXNlZCBieSBfYWxsXyBtZXRob2RzIG9uIHRoaXMgUHJpbnRlciBjbGFzcyB0aGF0IGFkZCB0byBgdGhpcy5idWZmZXJgLFxuICAgIGl0IGFsbG93cyBjb25zdW1lcnMgb2YgdGhlIHByaW50ZXIgdG8gdXNlIGFsdGVybmF0ZSBzdHJpbmcgcmVwcmVzZW50YXRpb25zIGZvclxuICAgIGEgZ2l2ZW4gbm9kZS5cblxuICAgIFRoZSBwcmltYXJ5IHVzZSBjYXNlIGZvciB0aGlzIGFyZSB0aGluZ3MgbGlrZSBzb3VyY2UgLT4gc291cmNlIGNvZGVtb2QgdXRpbGl0aWVzLlxuICAgIEZvciBleGFtcGxlLCBlbWJlci10ZW1wbGF0ZS1yZWNhc3QgYXR0ZW1wdHMgdG8gYWx3YXlzIHByZXNlcnZlIHRoZSBvcmlnaW5hbCBzdHJpbmdcbiAgICBmb3JtYXR0aW5nIGluIGVhY2ggQVNUIG5vZGUgaWYgbm8gbW9kaWZpY2F0aW9ucyBhcmUgbWFkZSB0byBpdC5cbiAgKi9cbiAgaGFuZGxlZEJ5T3ZlcnJpZGUobm9kZTogQVNUdjEuTm9kZSwgZW5zdXJlTGVhZGluZ1doaXRlc3BhY2UgPSBmYWxzZSk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm9wdGlvbnMub3ZlcnJpZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV0IHJlc3VsdCA9IHRoaXMub3B0aW9ucy5vdmVycmlkZShub2RlLCB0aGlzLm9wdGlvbnMpO1xuICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmIChlbnN1cmVMZWFkaW5nV2hpdGVzcGFjZSAmJiByZXN1bHQgIT09ICcnICYmIE5PTl9XSElURVNQQUNFLnRlc3QocmVzdWx0WzBdKSkge1xuICAgICAgICAgIHJlc3VsdCA9IGAgJHtyZXN1bHR9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYnVmZmVyICs9IHJlc3VsdDtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgTm9kZShub2RlOiBBU1R2MS5Ob2RlKTogdm9pZCB7XG4gICAgc3dpdGNoIChub2RlLnR5cGUpIHtcbiAgICAgIGNhc2UgJ011c3RhY2hlU3RhdGVtZW50JzpcbiAgICAgIGNhc2UgJ0Jsb2NrU3RhdGVtZW50JzpcbiAgICAgIGNhc2UgJ1BhcnRpYWxTdGF0ZW1lbnQnOlxuICAgICAgY2FzZSAnTXVzdGFjaGVDb21tZW50U3RhdGVtZW50JzpcbiAgICAgIGNhc2UgJ0NvbW1lbnRTdGF0ZW1lbnQnOlxuICAgICAgY2FzZSAnVGV4dE5vZGUnOlxuICAgICAgY2FzZSAnRWxlbWVudE5vZGUnOlxuICAgICAgY2FzZSAnQXR0ck5vZGUnOlxuICAgICAgY2FzZSAnQmxvY2snOlxuICAgICAgY2FzZSAnVGVtcGxhdGUnOlxuICAgICAgICByZXR1cm4gdGhpcy5Ub3BMZXZlbFN0YXRlbWVudChub2RlKTtcbiAgICAgIGNhc2UgJ1N0cmluZ0xpdGVyYWwnOlxuICAgICAgY2FzZSAnQm9vbGVhbkxpdGVyYWwnOlxuICAgICAgY2FzZSAnTnVtYmVyTGl0ZXJhbCc6XG4gICAgICBjYXNlICdVbmRlZmluZWRMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ051bGxMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ1BhdGhFeHByZXNzaW9uJzpcbiAgICAgIGNhc2UgJ1N1YkV4cHJlc3Npb24nOlxuICAgICAgICByZXR1cm4gdGhpcy5FeHByZXNzaW9uKG5vZGUpO1xuICAgICAgY2FzZSAnUHJvZ3JhbSc6XG4gICAgICAgIHJldHVybiB0aGlzLkJsb2NrKG5vZGUpO1xuICAgICAgY2FzZSAnQ29uY2F0U3RhdGVtZW50JzpcbiAgICAgICAgLy8gc2hvdWxkIGhhdmUgYW4gQXR0ck5vZGUgcGFyZW50XG4gICAgICAgIHJldHVybiB0aGlzLkNvbmNhdFN0YXRlbWVudChub2RlKTtcbiAgICAgIGNhc2UgJ0hhc2gnOlxuICAgICAgICByZXR1cm4gdGhpcy5IYXNoKG5vZGUpO1xuICAgICAgY2FzZSAnSGFzaFBhaXInOlxuICAgICAgICByZXR1cm4gdGhpcy5IYXNoUGFpcihub2RlKTtcbiAgICAgIGNhc2UgJ0VsZW1lbnRNb2RpZmllclN0YXRlbWVudCc6XG4gICAgICAgIHJldHVybiB0aGlzLkVsZW1lbnRNb2RpZmllclN0YXRlbWVudChub2RlKTtcbiAgICB9XG4gIH1cblxuICBFeHByZXNzaW9uKGV4cHJlc3Npb246IEFTVHYxLkV4cHJlc3Npb24pOiB2b2lkIHtcbiAgICBzd2l0Y2ggKGV4cHJlc3Npb24udHlwZSkge1xuICAgICAgY2FzZSAnU3RyaW5nTGl0ZXJhbCc6XG4gICAgICBjYXNlICdCb29sZWFuTGl0ZXJhbCc6XG4gICAgICBjYXNlICdOdW1iZXJMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ1VuZGVmaW5lZExpdGVyYWwnOlxuICAgICAgY2FzZSAnTnVsbExpdGVyYWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5MaXRlcmFsKGV4cHJlc3Npb24pO1xuICAgICAgY2FzZSAnUGF0aEV4cHJlc3Npb24nOlxuICAgICAgICByZXR1cm4gdGhpcy5QYXRoRXhwcmVzc2lvbihleHByZXNzaW9uKTtcbiAgICAgIGNhc2UgJ1N1YkV4cHJlc3Npb24nOlxuICAgICAgICByZXR1cm4gdGhpcy5TdWJFeHByZXNzaW9uKGV4cHJlc3Npb24pO1xuICAgIH1cbiAgfVxuXG4gIExpdGVyYWwobGl0ZXJhbDogQVNUdjEuTGl0ZXJhbCk6IHZvaWQge1xuICAgIHN3aXRjaCAobGl0ZXJhbC50eXBlKSB7XG4gICAgICBjYXNlICdTdHJpbmdMaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuU3RyaW5nTGl0ZXJhbChsaXRlcmFsKTtcbiAgICAgIGNhc2UgJ0Jvb2xlYW5MaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuQm9vbGVhbkxpdGVyYWwobGl0ZXJhbCk7XG4gICAgICBjYXNlICdOdW1iZXJMaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuTnVtYmVyTGl0ZXJhbChsaXRlcmFsKTtcbiAgICAgIGNhc2UgJ1VuZGVmaW5lZExpdGVyYWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5VbmRlZmluZWRMaXRlcmFsKGxpdGVyYWwpO1xuICAgICAgY2FzZSAnTnVsbExpdGVyYWwnOlxuICAgICAgICByZXR1cm4gdGhpcy5OdWxsTGl0ZXJhbChsaXRlcmFsKTtcbiAgICB9XG4gIH1cblxuICBUb3BMZXZlbFN0YXRlbWVudChzdGF0ZW1lbnQ6IEFTVHYxLlRvcExldmVsU3RhdGVtZW50IHwgQVNUdjEuVGVtcGxhdGUgfCBBU1R2MS5BdHRyTm9kZSk6IHZvaWQge1xuICAgIHN3aXRjaCAoc3RhdGVtZW50LnR5cGUpIHtcbiAgICAgIGNhc2UgJ011c3RhY2hlU3RhdGVtZW50JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuTXVzdGFjaGVTdGF0ZW1lbnQoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ0Jsb2NrU3RhdGVtZW50JzpcbiAgICAgICAgcmV0dXJuIHRoaXMuQmxvY2tTdGF0ZW1lbnQoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ1BhcnRpYWxTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5QYXJ0aWFsU3RhdGVtZW50KHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQoc3RhdGVtZW50KTtcbiAgICAgIGNhc2UgJ0NvbW1lbnRTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5Db21tZW50U3RhdGVtZW50KHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdUZXh0Tm9kZSc6XG4gICAgICAgIHJldHVybiB0aGlzLlRleHROb2RlKHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdFbGVtZW50Tm9kZSc6XG4gICAgICAgIHJldHVybiB0aGlzLkVsZW1lbnROb2RlKHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdCbG9jayc6XG4gICAgICBjYXNlICdUZW1wbGF0ZSc6XG4gICAgICAgIHJldHVybiB0aGlzLkJsb2NrKHN0YXRlbWVudCk7XG4gICAgICBjYXNlICdBdHRyTm9kZSc6XG4gICAgICAgIC8vIHNob3VsZCBoYXZlIGVsZW1lbnRcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0ck5vZGUoc3RhdGVtZW50KTtcbiAgICB9XG4gIH1cblxuICBCbG9jayhibG9jazogQVNUdjEuQmxvY2sgfCBBU1R2MS5Qcm9ncmFtIHwgQVNUdjEuVGVtcGxhdGUpOiB2b2lkIHtcbiAgICAvKlxuICAgICAgV2hlbiBwcm9jZXNzaW5nIGEgdGVtcGxhdGUgbGlrZTpcblxuICAgICAgYGBgaGJzXG4gICAgICB7eyNpZiB3aGF0ZXZlcn19XG4gICAgICAgIHdoYXRldmVyXG4gICAgICB7e2Vsc2UgaWYgc29tZXRoaW5nRWxzZX19XG4gICAgICAgIHNvbWV0aGluZyBlbHNlXG4gICAgICB7e2Vsc2V9fVxuICAgICAgICBmYWxsYmFja1xuICAgICAge3svaWZ9fVxuICAgICAgYGBgXG5cbiAgICAgIFRoZSBBU1Qgc3RpbGwgX2VmZmVjdGl2ZWx5XyBsb29rcyBsaWtlOlxuXG4gICAgICBgYGBoYnNcbiAgICAgIHt7I2lmIHdoYXRldmVyfX1cbiAgICAgICAgd2hhdGV2ZXJcbiAgICAgIHt7ZWxzZX19e3sjaWYgc29tZXRoaW5nRWxzZX19XG4gICAgICAgIHNvbWV0aGluZyBlbHNlXG4gICAgICB7e2Vsc2V9fVxuICAgICAgICBmYWxsYmFja1xuICAgICAge3svaWZ9fXt7L2lmfX1cbiAgICAgIGBgYFxuXG4gICAgICBUaGUgb25seSB3YXkgd2UgY2FuIHRlbGwgaWYgdGhhdCBpcyB0aGUgY2FzZSBpcyBieSBjaGVja2luZyBmb3JcbiAgICAgIGBibG9jay5jaGFpbmVkYCwgYnV0IHVuZm9ydHVuYXRlbHkgd2hlbiB0aGUgYWN0dWFsIHN0YXRlbWVudHMgYXJlXG4gICAgICBwcm9jZXNzZWQgdGhlIGBibG9jay5ib2R5WzBdYCBub2RlICh3aGljaCB3aWxsIGFsd2F5cyBiZSBhXG4gICAgICBgQmxvY2tTdGF0ZW1lbnRgKSBoYXMgbm8gY2x1ZSB0aGF0IGl0cyBhbmNlc3RvciBgQmxvY2tgIG5vZGUgd2FzXG4gICAgICBjaGFpbmVkLlxuXG4gICAgICBUaGlzIFwiZm9yd2FyZHNcIiB0aGUgYGNoYWluZWRgIHNldHRpbmcgc28gdGhhdCB3ZSBjYW4gY2hlY2tcbiAgICAgIGl0IGxhdGVyIHdoZW4gcHJvY2Vzc2luZyB0aGUgYEJsb2NrU3RhdGVtZW50YC5cbiAgICAqL1xuICAgIGlmIChibG9jay5jaGFpbmVkKSB7XG4gICAgICBsZXQgZmlyc3RDaGlsZCA9IGJsb2NrLmJvZHlbMF0gYXMgQVNUdjEuQmxvY2tTdGF0ZW1lbnQ7XG4gICAgICBmaXJzdENoaWxkLmNoYWluZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGJsb2NrKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuVG9wTGV2ZWxTdGF0ZW1lbnRzKGJsb2NrLmJvZHkpO1xuICB9XG5cbiAgVG9wTGV2ZWxTdGF0ZW1lbnRzKHN0YXRlbWVudHM6IEFTVHYxLlRvcExldmVsU3RhdGVtZW50W10pOiB2b2lkIHtcbiAgICBzdGF0ZW1lbnRzLmZvckVhY2goKHN0YXRlbWVudCkgPT4gdGhpcy5Ub3BMZXZlbFN0YXRlbWVudChzdGF0ZW1lbnQpKTtcbiAgfVxuXG4gIEVsZW1lbnROb2RlKGVsOiBBU1R2MS5FbGVtZW50Tm9kZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGVsKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuT3BlbkVsZW1lbnROb2RlKGVsKTtcbiAgICB0aGlzLlRvcExldmVsU3RhdGVtZW50cyhlbC5jaGlsZHJlbik7XG4gICAgdGhpcy5DbG9zZUVsZW1lbnROb2RlKGVsKTtcbiAgfVxuXG4gIE9wZW5FbGVtZW50Tm9kZShlbDogQVNUdjEuRWxlbWVudE5vZGUpOiB2b2lkIHtcbiAgICB0aGlzLmJ1ZmZlciArPSBgPCR7ZWwudGFnfWA7XG4gICAgY29uc3QgcGFydHMgPSBbLi4uZWwuYXR0cmlidXRlcywgLi4uZWwubW9kaWZpZXJzLCAuLi5lbC5jb21tZW50c10uc29ydChzb3J0QnlMb2MpO1xuXG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnICc7XG4gICAgICBzd2l0Y2ggKHBhcnQudHlwZSkge1xuICAgICAgICBjYXNlICdBdHRyTm9kZSc6XG4gICAgICAgICAgdGhpcy5BdHRyTm9kZShwYXJ0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50JzpcbiAgICAgICAgICB0aGlzLkVsZW1lbnRNb2RpZmllclN0YXRlbWVudChwYXJ0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnTXVzdGFjaGVDb21tZW50U3RhdGVtZW50JzpcbiAgICAgICAgICB0aGlzLk11c3RhY2hlQ29tbWVudFN0YXRlbWVudChwYXJ0KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGVsLmJsb2NrUGFyYW1zLmxlbmd0aCkge1xuICAgICAgdGhpcy5CbG9ja1BhcmFtcyhlbC5ibG9ja1BhcmFtcyk7XG4gICAgfVxuICAgIGlmIChlbC5zZWxmQ2xvc2luZykge1xuICAgICAgdGhpcy5idWZmZXIgKz0gJyAvJztcbiAgICB9XG4gICAgdGhpcy5idWZmZXIgKz0gJz4nO1xuICB9XG5cbiAgQ2xvc2VFbGVtZW50Tm9kZShlbDogQVNUdjEuRWxlbWVudE5vZGUpOiB2b2lkIHtcbiAgICBpZiAoZWwuc2VsZkNsb3NpbmcgfHwgaXNWb2lkVGFnKGVsLnRhZykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5idWZmZXIgKz0gYDwvJHtlbC50YWd9PmA7XG4gIH1cblxuICBBdHRyTm9kZShhdHRyOiBBU1R2MS5BdHRyTm9kZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGF0dHIpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHsgbmFtZSwgdmFsdWUgfSA9IGF0dHI7XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBuYW1lO1xuICAgIGlmICh2YWx1ZS50eXBlICE9PSAnVGV4dE5vZGUnIHx8IHZhbHVlLmNoYXJzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICc9JztcbiAgICAgIHRoaXMuQXR0ck5vZGVWYWx1ZSh2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgQXR0ck5vZGVWYWx1ZSh2YWx1ZTogQVNUdjEuQXR0ck5vZGVbJ3ZhbHVlJ10pOiB2b2lkIHtcbiAgICBpZiAodmFsdWUudHlwZSA9PT0gJ1RleHROb2RlJykge1xuICAgICAgdGhpcy5idWZmZXIgKz0gJ1wiJztcbiAgICAgIHRoaXMuVGV4dE5vZGUodmFsdWUsIHRydWUpO1xuICAgICAgdGhpcy5idWZmZXIgKz0gJ1wiJztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5Ob2RlKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBUZXh0Tm9kZSh0ZXh0OiBBU1R2MS5UZXh0Tm9kZSwgaXNBdHRyPzogYm9vbGVhbik6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKHRleHQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5lbnRpdHlFbmNvZGluZyA9PT0gJ3JhdycpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IHRleHQuY2hhcnM7XG4gICAgfSBlbHNlIGlmIChpc0F0dHIpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGVzY2FwZUF0dHJWYWx1ZSh0ZXh0LmNoYXJzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5idWZmZXIgKz0gZXNjYXBlVGV4dCh0ZXh0LmNoYXJzKTtcbiAgICB9XG4gIH1cblxuICBNdXN0YWNoZVN0YXRlbWVudChtdXN0YWNoZTogQVNUdjEuTXVzdGFjaGVTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShtdXN0YWNoZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBtdXN0YWNoZS5lc2NhcGVkID8gJ3t7JyA6ICd7e3snO1xuXG4gICAgaWYgKG11c3RhY2hlLnN0cmlwLm9wZW4pIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICd+JztcbiAgICB9XG5cbiAgICB0aGlzLkV4cHJlc3Npb24obXVzdGFjaGUucGF0aCk7XG4gICAgdGhpcy5QYXJhbXMobXVzdGFjaGUucGFyYW1zKTtcbiAgICB0aGlzLkhhc2gobXVzdGFjaGUuaGFzaCk7XG5cbiAgICBpZiAobXVzdGFjaGUuc3RyaXAuY2xvc2UpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9ICd+JztcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBtdXN0YWNoZS5lc2NhcGVkID8gJ319JyA6ICd9fX0nO1xuICB9XG5cbiAgQmxvY2tTdGF0ZW1lbnQoYmxvY2s6IEFTVHYxLkJsb2NrU3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoYmxvY2spKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGJsb2NrLmNoYWluZWQpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmludmVyc2VTdHJpcC5vcGVuID8gJ3t7ficgOiAne3snO1xuICAgICAgdGhpcy5idWZmZXIgKz0gJ2Vsc2UgJztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2sub3BlblN0cmlwLm9wZW4gPyAne3t+IycgOiAne3sjJztcbiAgICB9XG5cbiAgICB0aGlzLkV4cHJlc3Npb24oYmxvY2sucGF0aCk7XG4gICAgdGhpcy5QYXJhbXMoYmxvY2sucGFyYW1zKTtcbiAgICB0aGlzLkhhc2goYmxvY2suaGFzaCk7XG4gICAgaWYgKGJsb2NrLnByb2dyYW0uYmxvY2tQYXJhbXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLkJsb2NrUGFyYW1zKGJsb2NrLnByb2dyYW0uYmxvY2tQYXJhbXMpO1xuICAgIH1cblxuICAgIGlmIChibG9jay5jaGFpbmVkKSB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSBibG9jay5pbnZlcnNlU3RyaXAuY2xvc2UgPyAnfn19JyA6ICd9fSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLm9wZW5TdHJpcC5jbG9zZSA/ICd+fX0nIDogJ319JztcbiAgICB9XG5cbiAgICB0aGlzLkJsb2NrKGJsb2NrLnByb2dyYW0pO1xuXG4gICAgaWYgKGJsb2NrLmludmVyc2UpIHtcbiAgICAgIGlmICghYmxvY2suaW52ZXJzZS5jaGFpbmVkKSB7XG4gICAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmludmVyc2VTdHJpcC5vcGVuID8gJ3t7ficgOiAne3snO1xuICAgICAgICB0aGlzLmJ1ZmZlciArPSAnZWxzZSc7XG4gICAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmludmVyc2VTdHJpcC5jbG9zZSA/ICd+fX0nIDogJ319JztcbiAgICAgIH1cblxuICAgICAgdGhpcy5CbG9jayhibG9jay5pbnZlcnNlKTtcbiAgICB9XG5cbiAgICBpZiAoIWJsb2NrLmNoYWluZWQpIHtcbiAgICAgIHRoaXMuYnVmZmVyICs9IGJsb2NrLmNsb3NlU3RyaXAub3BlbiA/ICd7e34vJyA6ICd7ey8nO1xuICAgICAgdGhpcy5FeHByZXNzaW9uKGJsb2NrLnBhdGgpO1xuICAgICAgdGhpcy5idWZmZXIgKz0gYmxvY2suY2xvc2VTdHJpcC5jbG9zZSA/ICd+fX0nIDogJ319JztcbiAgICB9XG4gIH1cblxuICBCbG9ja1BhcmFtcyhibG9ja1BhcmFtczogc3RyaW5nW10pOiB2b2lkIHtcbiAgICB0aGlzLmJ1ZmZlciArPSBgIGFzIHwke2Jsb2NrUGFyYW1zLmpvaW4oJyAnKX18YDtcbiAgfVxuXG4gIFBhcnRpYWxTdGF0ZW1lbnQocGFydGlhbDogQVNUdjEuUGFydGlhbFN0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKHBhcnRpYWwpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gJ3t7Pic7XG4gICAgdGhpcy5FeHByZXNzaW9uKHBhcnRpYWwubmFtZSk7XG4gICAgdGhpcy5QYXJhbXMocGFydGlhbC5wYXJhbXMpO1xuICAgIHRoaXMuSGFzaChwYXJ0aWFsLmhhc2gpO1xuICAgIHRoaXMuYnVmZmVyICs9ICd9fSc7XG4gIH1cblxuICBDb25jYXRTdGF0ZW1lbnQoY29uY2F0OiBBU1R2MS5Db25jYXRTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShjb25jYXQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gJ1wiJztcbiAgICBjb25jYXQucGFydHMuZm9yRWFjaCgocGFydCkgPT4ge1xuICAgICAgaWYgKHBhcnQudHlwZSA9PT0gJ1RleHROb2RlJykge1xuICAgICAgICB0aGlzLlRleHROb2RlKHBhcnQsIHRydWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5Ob2RlKHBhcnQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYnVmZmVyICs9ICdcIic7XG4gIH1cblxuICBNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQoY29tbWVudDogQVNUdjEuTXVzdGFjaGVDb21tZW50U3RhdGVtZW50KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoY29tbWVudCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBge3shLS0ke2NvbW1lbnQudmFsdWV9LS19fWA7XG4gIH1cblxuICBFbGVtZW50TW9kaWZpZXJTdGF0ZW1lbnQobW9kOiBBU1R2MS5FbGVtZW50TW9kaWZpZXJTdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShtb2QpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gJ3t7JztcbiAgICB0aGlzLkV4cHJlc3Npb24obW9kLnBhdGgpO1xuICAgIHRoaXMuUGFyYW1zKG1vZC5wYXJhbXMpO1xuICAgIHRoaXMuSGFzaChtb2QuaGFzaCk7XG4gICAgdGhpcy5idWZmZXIgKz0gJ319JztcbiAgfVxuXG4gIENvbW1lbnRTdGF0ZW1lbnQoY29tbWVudDogQVNUdjEuQ29tbWVudFN0YXRlbWVudCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGNvbW1lbnQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgKz0gYDwhLS0ke2NvbW1lbnQudmFsdWV9LS0+YDtcbiAgfVxuXG4gIFBhdGhFeHByZXNzaW9uKHBhdGg6IEFTVHYxLlBhdGhFeHByZXNzaW9uKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUocGF0aCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBwYXRoLm9yaWdpbmFsO1xuICB9XG5cbiAgU3ViRXhwcmVzc2lvbihzZXhwOiBBU1R2MS5TdWJFeHByZXNzaW9uKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuaGFuZGxlZEJ5T3ZlcnJpZGUoc2V4cCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSAnKCc7XG4gICAgdGhpcy5FeHByZXNzaW9uKHNleHAucGF0aCk7XG4gICAgdGhpcy5QYXJhbXMoc2V4cC5wYXJhbXMpO1xuICAgIHRoaXMuSGFzaChzZXhwLmhhc2gpO1xuICAgIHRoaXMuYnVmZmVyICs9ICcpJztcbiAgfVxuXG4gIFBhcmFtcyhwYXJhbXM6IEFTVHYxLkV4cHJlc3Npb25bXSk6IHZvaWQge1xuICAgIC8vIFRPRE86IGltcGxlbWVudCBhIHRvcCBsZXZlbCBQYXJhbXMgQVNUIG5vZGUgKGp1c3QgbGlrZSB0aGUgSGFzaCBvYmplY3QpXG4gICAgLy8gc28gdGhhdCB0aGlzIGNhbiBhbHNvIGJlIG92ZXJyaWRkZW5cbiAgICBpZiAocGFyYW1zLmxlbmd0aCkge1xuICAgICAgcGFyYW1zLmZvckVhY2goKHBhcmFtKSA9PiB7XG4gICAgICAgIHRoaXMuYnVmZmVyICs9ICcgJztcbiAgICAgICAgdGhpcy5FeHByZXNzaW9uKHBhcmFtKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIEhhc2goaGFzaDogQVNUdjEuSGFzaCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKGhhc2gsIHRydWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaGFzaC5wYWlycy5mb3JFYWNoKChwYWlyKSA9PiB7XG4gICAgICB0aGlzLmJ1ZmZlciArPSAnICc7XG4gICAgICB0aGlzLkhhc2hQYWlyKHBhaXIpO1xuICAgIH0pO1xuICB9XG5cbiAgSGFzaFBhaXIocGFpcjogQVNUdjEuSGFzaFBhaXIpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShwYWlyKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IHBhaXIua2V5O1xuICAgIHRoaXMuYnVmZmVyICs9ICc9JztcbiAgICB0aGlzLk5vZGUocGFpci52YWx1ZSk7XG4gIH1cblxuICBTdHJpbmdMaXRlcmFsKHN0cjogQVNUdjEuU3RyaW5nTGl0ZXJhbCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKHN0cikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBKU09OLnN0cmluZ2lmeShzdHIudmFsdWUpO1xuICB9XG5cbiAgQm9vbGVhbkxpdGVyYWwoYm9vbDogQVNUdjEuQm9vbGVhbkxpdGVyYWwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShib29sKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9IGJvb2wudmFsdWU7XG4gIH1cblxuICBOdW1iZXJMaXRlcmFsKG51bWJlcjogQVNUdjEuTnVtYmVyTGl0ZXJhbCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmhhbmRsZWRCeU92ZXJyaWRlKG51bWJlcikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciArPSBudW1iZXIudmFsdWU7XG4gIH1cblxuICBVbmRlZmluZWRMaXRlcmFsKG5vZGU6IEFTVHYxLlVuZGVmaW5lZExpdGVyYWwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShub2RlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9ICd1bmRlZmluZWQnO1xuICB9XG5cbiAgTnVsbExpdGVyYWwobm9kZTogQVNUdjEuTnVsbExpdGVyYWwpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5oYW5kbGVkQnlPdmVycmlkZShub2RlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyICs9ICdudWxsJztcbiAgfVxuXG4gIHByaW50KG5vZGU6IEFTVHYxLk5vZGUpOiBzdHJpbmcge1xuICAgIGxldCB7IG9wdGlvbnMgfSA9IHRoaXM7XG5cbiAgICBpZiAob3B0aW9ucy5vdmVycmlkZSkge1xuICAgICAgbGV0IHJlc3VsdCA9IG9wdGlvbnMub3ZlcnJpZGUobm9kZSwgb3B0aW9ucyk7XG5cbiAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyID0gJyc7XG4gICAgdGhpcy5Ob2RlKG5vZGUpO1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlcjtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgQVNUdjEgZnJvbSAnLi4vdjEvYXBpJztcbmltcG9ydCBQcmludGVyLCB7IFByaW50ZXJPcHRpb25zIH0gZnJvbSAnLi9wcmludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYnVpbGQoXG4gIGFzdDogQVNUdjEuTm9kZSxcbiAgb3B0aW9uczogUHJpbnRlck9wdGlvbnMgPSB7IGVudGl0eUVuY29kaW5nOiAndHJhbnNmb3JtZWQnIH1cbik6IHN0cmluZyB7XG4gIGlmICghYXN0KSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgbGV0IHByaW50ZXIgPSBuZXcgUHJpbnRlcihvcHRpb25zKTtcbiAgcmV0dXJuIHByaW50ZXIucHJpbnQoYXN0KTtcbn1cbiIsImltcG9ydCB7IFNvdXJjZVNwYW4gfSBmcm9tICcuL3NvdXJjZS9zcGFuJztcblxuZXhwb3J0IGludGVyZmFjZSBHbGltbWVyU3ludGF4RXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGxvY2F0aW9uOiBTb3VyY2VTcGFuIHwgbnVsbDtcbiAgY29kZTogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlU3ludGF4RXJyb3IobWVzc2FnZTogc3RyaW5nLCBsb2NhdGlvbjogU291cmNlU3Bhbik6IEdsaW1tZXJTeW50YXhFcnJvciB7XG4gIGxldCB7IG1vZHVsZSwgbG9jIH0gPSBsb2NhdGlvbjtcbiAgbGV0IHsgbGluZSwgY29sdW1uIH0gPSBsb2Muc3RhcnQ7XG5cbiAgbGV0IGNvZGUgPSBsb2NhdGlvbi5hc1N0cmluZygpO1xuICBsZXQgcXVvdGVkQ29kZSA9IGNvZGUgPyBgXFxuXFxufFxcbnwgICR7Y29kZS5zcGxpdCgnXFxuJykuam9pbignXFxufCAgJyl9XFxufFxcblxcbmAgOiAnJztcblxuICBsZXQgZXJyb3IgPSBuZXcgRXJyb3IoXG4gICAgYCR7bWVzc2FnZX06ICR7cXVvdGVkQ29kZX0oZXJyb3Igb2NjdXJyZWQgaW4gJyR7bW9kdWxlfScgQCBsaW5lICR7bGluZX0gOiBjb2x1bW4gJHtjb2x1bW59KWBcbiAgKSBhcyBHbGltbWVyU3ludGF4RXJyb3I7XG5cbiAgZXJyb3IubmFtZSA9ICdTeW50YXhFcnJvcic7XG4gIGVycm9yLmxvY2F0aW9uID0gbG9jYXRpb247XG4gIGVycm9yLmNvZGUgPSBjb2RlO1xuXG4gIHJldHVybiBlcnJvcjtcbn1cbiIsImltcG9ydCB7IHR1cGxlIH0gZnJvbSAnQGdsaW1tZXIvdXRpbCc7XG5cbmltcG9ydCAqIGFzIEFTVHYxIGZyb20gJy4vYXBpJztcblxuLy8gZW5zdXJlIHN0YXlzIGluIHN5bmMgd2l0aCB0eXBpbmdcbi8vIFBhcmVudE5vZGUgYW5kIENoaWxkS2V5IHR5cGVzIGFyZSBkZXJpdmVkIGZyb20gVmlzaXRvcktleXNNYXBcbmNvbnN0IHZpc2l0b3JLZXlzID0ge1xuICBQcm9ncmFtOiB0dXBsZSgnYm9keScpLFxuICBUZW1wbGF0ZTogdHVwbGUoJ2JvZHknKSxcbiAgQmxvY2s6IHR1cGxlKCdib2R5JyksXG5cbiAgTXVzdGFjaGVTdGF0ZW1lbnQ6IHR1cGxlKCdwYXRoJywgJ3BhcmFtcycsICdoYXNoJyksXG4gIEJsb2NrU3RhdGVtZW50OiB0dXBsZSgncGF0aCcsICdwYXJhbXMnLCAnaGFzaCcsICdwcm9ncmFtJywgJ2ludmVyc2UnKSxcbiAgRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50OiB0dXBsZSgncGF0aCcsICdwYXJhbXMnLCAnaGFzaCcpLFxuICBQYXJ0aWFsU3RhdGVtZW50OiB0dXBsZSgnbmFtZScsICdwYXJhbXMnLCAnaGFzaCcpLFxuICBDb21tZW50U3RhdGVtZW50OiB0dXBsZSgpLFxuICBNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQ6IHR1cGxlKCksXG4gIEVsZW1lbnROb2RlOiB0dXBsZSgnYXR0cmlidXRlcycsICdtb2RpZmllcnMnLCAnY2hpbGRyZW4nLCAnY29tbWVudHMnKSxcbiAgQXR0ck5vZGU6IHR1cGxlKCd2YWx1ZScpLFxuICBUZXh0Tm9kZTogdHVwbGUoKSxcblxuICBDb25jYXRTdGF0ZW1lbnQ6IHR1cGxlKCdwYXJ0cycpLFxuICBTdWJFeHByZXNzaW9uOiB0dXBsZSgncGF0aCcsICdwYXJhbXMnLCAnaGFzaCcpLFxuICBQYXRoRXhwcmVzc2lvbjogdHVwbGUoKSxcbiAgUGF0aEhlYWQ6IHR1cGxlKCksXG5cbiAgU3RyaW5nTGl0ZXJhbDogdHVwbGUoKSxcbiAgQm9vbGVhbkxpdGVyYWw6IHR1cGxlKCksXG4gIE51bWJlckxpdGVyYWw6IHR1cGxlKCksXG4gIE51bGxMaXRlcmFsOiB0dXBsZSgpLFxuICBVbmRlZmluZWRMaXRlcmFsOiB0dXBsZSgpLFxuXG4gIEhhc2g6IHR1cGxlKCdwYWlycycpLFxuICBIYXNoUGFpcjogdHVwbGUoJ3ZhbHVlJyksXG5cbiAgLy8gdjIgbmV3IG5vZGVzXG4gIE5hbWVkQmxvY2s6IHR1cGxlKCdhdHRyaWJ1dGVzJywgJ21vZGlmaWVycycsICdjaGlsZHJlbicsICdjb21tZW50cycpLFxuICBTaW1wbGVFbGVtZW50OiB0dXBsZSgnYXR0cmlidXRlcycsICdtb2RpZmllcnMnLCAnY2hpbGRyZW4nLCAnY29tbWVudHMnKSxcbiAgQ29tcG9uZW50OiB0dXBsZSgnaGVhZCcsICdhdHRyaWJ1dGVzJywgJ21vZGlmaWVycycsICdjaGlsZHJlbicsICdjb21tZW50cycpLFxufTtcblxudHlwZSBWaXNpdG9yS2V5c01hcCA9IHR5cGVvZiB2aXNpdG9yS2V5cztcblxuZXhwb3J0IHR5cGUgVmlzaXRvcktleXMgPSB7IFtQIGluIGtleW9mIFZpc2l0b3JLZXlzTWFwXTogVmlzaXRvcktleXNNYXBbUF1bbnVtYmVyXSB9O1xuZXhwb3J0IHR5cGUgVmlzaXRvcktleTxOIGV4dGVuZHMgQVNUdjEuTm9kZT4gPSBWaXNpdG9yS2V5c1tOWyd0eXBlJ11dICYga2V5b2YgTjtcblxuZXhwb3J0IGRlZmF1bHQgdmlzaXRvcktleXM7XG4iLCJpbXBvcnQgeyBPcHRpb24gfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcblxuaW1wb3J0ICogYXMgQVNUdjEgZnJvbSAnLi4vdjEvYXBpJztcblxuZXhwb3J0IGludGVyZmFjZSBUcmF2ZXJzYWxFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3I6IFRyYXZlcnNhbEVycm9yQ29uc3RydWN0b3I7XG4gIGtleTogc3RyaW5nO1xuICBub2RlOiBBU1R2MS5Ob2RlO1xuICBwYXJlbnQ6IE9wdGlvbjxBU1R2MS5Ob2RlPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUcmF2ZXJzYWxFcnJvckNvbnN0cnVjdG9yIHtcbiAgbmV3IChtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IEFTVHYxLk5vZGUsIHBhcmVudDogT3B0aW9uPEFTVHYxLk5vZGU+LCBrZXk6IHN0cmluZyk6IFRyYXZlcnNhbEVycm9yO1xuICByZWFkb25seSBwcm90b3R5cGU6IFRyYXZlcnNhbEVycm9yO1xufVxuXG5jb25zdCBUcmF2ZXJzYWxFcnJvcjogVHJhdmVyc2FsRXJyb3JDb25zdHJ1Y3RvciA9IChmdW5jdGlvbiAoKSB7XG4gIFRyYXZlcnNhbEVycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlKTtcbiAgVHJhdmVyc2FsRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gVHJhdmVyc2FsRXJyb3I7XG5cbiAgZnVuY3Rpb24gVHJhdmVyc2FsRXJyb3IoXG4gICAgdGhpczogVHJhdmVyc2FsRXJyb3IsXG4gICAgbWVzc2FnZTogc3RyaW5nLFxuICAgIG5vZGU6IEFTVHYxLk5vZGUsXG4gICAgcGFyZW50OiBPcHRpb248QVNUdjEuTm9kZT4sXG4gICAga2V5OiBzdHJpbmdcbiAgKSB7XG4gICAgbGV0IGVycm9yID0gRXJyb3IuY2FsbCh0aGlzLCBtZXNzYWdlKTtcblxuICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgdGhpcy5ub2RlID0gbm9kZTtcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICB0aGlzLnN0YWNrID0gZXJyb3Iuc3RhY2s7XG4gIH1cblxuICByZXR1cm4gKFRyYXZlcnNhbEVycm9yIGFzIHVua25vd24pIGFzIFRyYXZlcnNhbEVycm9yQ29uc3RydWN0b3I7XG59KSgpO1xuXG5leHBvcnQgZGVmYXVsdCBUcmF2ZXJzYWxFcnJvcjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNhbm5vdFJlbW92ZU5vZGUoXG4gIG5vZGU6IEFTVHYxLk5vZGUsXG4gIHBhcmVudDogQVNUdjEuTm9kZSxcbiAga2V5OiBzdHJpbmdcbik6IFRyYXZlcnNhbEVycm9yIHtcbiAgcmV0dXJuIG5ldyBUcmF2ZXJzYWxFcnJvcihcbiAgICAnQ2Fubm90IHJlbW92ZSBhIG5vZGUgdW5sZXNzIGl0IGlzIHBhcnQgb2YgYW4gYXJyYXknLFxuICAgIG5vZGUsXG4gICAgcGFyZW50LFxuICAgIGtleVxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2Fubm90UmVwbGFjZU5vZGUoXG4gIG5vZGU6IEFTVHYxLk5vZGUsXG4gIHBhcmVudDogQVNUdjEuTm9kZSxcbiAga2V5OiBzdHJpbmdcbik6IFRyYXZlcnNhbEVycm9yIHtcbiAgcmV0dXJuIG5ldyBUcmF2ZXJzYWxFcnJvcihcbiAgICAnQ2Fubm90IHJlcGxhY2UgYSBub2RlIHdpdGggbXVsdGlwbGUgbm9kZXMgdW5sZXNzIGl0IGlzIHBhcnQgb2YgYW4gYXJyYXknLFxuICAgIG5vZGUsXG4gICAgcGFyZW50LFxuICAgIGtleVxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2Fubm90UmVwbGFjZU9yUmVtb3ZlSW5LZXlIYW5kbGVyWWV0KFxuICBub2RlOiBBU1R2MS5Ob2RlLFxuICBrZXk6IHN0cmluZ1xuKTogVHJhdmVyc2FsRXJyb3Ige1xuICByZXR1cm4gbmV3IFRyYXZlcnNhbEVycm9yKFxuICAgICdSZXBsYWNpbmcgYW5kIHJlbW92aW5nIGluIGtleSBoYW5kbGVycyBpcyBub3QgeWV0IHN1cHBvcnRlZC4nLFxuICAgIG5vZGUsXG4gICAgbnVsbCxcbiAgICBrZXlcbiAgKTtcbn1cbiIsImltcG9ydCAqIGFzIEFTVHYxIGZyb20gJy4uL3YxL2FwaSc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFdhbGtlclBhdGg8TiBleHRlbmRzIEFTVHYxLk5vZGU+IHtcbiAgbm9kZTogTjtcbiAgcGFyZW50OiBXYWxrZXJQYXRoPEFTVHYxLk5vZGU+IHwgbnVsbDtcbiAgcGFyZW50S2V5OiBzdHJpbmcgfCBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIG5vZGU6IE4sXG4gICAgcGFyZW50OiBXYWxrZXJQYXRoPEFTVHYxLk5vZGU+IHwgbnVsbCA9IG51bGwsXG4gICAgcGFyZW50S2V5OiBzdHJpbmcgfCBudWxsID0gbnVsbFxuICApIHtcbiAgICB0aGlzLm5vZGUgPSBub2RlO1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgIHRoaXMucGFyZW50S2V5ID0gcGFyZW50S2V5O1xuICB9XG5cbiAgZ2V0IHBhcmVudE5vZGUoKTogQVNUdjEuTm9kZSB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnBhcmVudCA/IHRoaXMucGFyZW50Lm5vZGUgOiBudWxsO1xuICB9XG5cbiAgcGFyZW50cygpOiBJdGVyYWJsZTxXYWxrZXJQYXRoPEFTVHYxLk5vZGU+IHwgbnVsbD4ge1xuICAgIHJldHVybiB7XG4gICAgICBbU3ltYm9sLml0ZXJhdG9yXTogKCkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFBhdGhQYXJlbnRzSXRlcmF0b3IodGhpcyk7XG4gICAgICB9LFxuICAgIH07XG4gIH1cbn1cblxuY2xhc3MgUGF0aFBhcmVudHNJdGVyYXRvciBpbXBsZW1lbnRzIEl0ZXJhdG9yPFdhbGtlclBhdGg8QVNUdjEuTm9kZT4gfCBudWxsPiB7XG4gIHBhdGg6IFdhbGtlclBhdGg8QVNUdjEuTm9kZT47XG5cbiAgY29uc3RydWN0b3IocGF0aDogV2Fsa2VyUGF0aDxBU1R2MS5Ob2RlPikge1xuICAgIHRoaXMucGF0aCA9IHBhdGg7XG4gIH1cblxuICBuZXh0KCkge1xuICAgIGlmICh0aGlzLnBhdGgucGFyZW50KSB7XG4gICAgICB0aGlzLnBhdGggPSB0aGlzLnBhdGgucGFyZW50O1xuICAgICAgcmV0dXJuIHsgZG9uZTogZmFsc2UsIHZhbHVlOiB0aGlzLnBhdGggfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHsgZG9uZTogdHJ1ZSwgdmFsdWU6IG51bGwgfTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IExPQ0FMX0RFQlVHIH0gZnJvbSAnQGdsaW1tZXIvbG9jYWwtZGVidWctZmxhZ3MnO1xuaW1wb3J0IHsgZGVwcmVjYXRlIH0gZnJvbSAnQGdsaW1tZXIvdXRpbCc7XG5cbmltcG9ydCAqIGFzIEFTVHYxIGZyb20gJy4uL3YxL2FwaSc7XG5pbXBvcnQgdmlzaXRvcktleXMsIHsgVmlzaXRvcktleSwgVmlzaXRvcktleXMgfSBmcm9tICcuLi92MS92aXNpdG9yLWtleXMnO1xuaW1wb3J0IHtcbiAgY2Fubm90UmVtb3ZlTm9kZSxcbiAgY2Fubm90UmVwbGFjZU5vZGUsXG4gIGNhbm5vdFJlcGxhY2VPclJlbW92ZUluS2V5SGFuZGxlcllldCxcbn0gZnJvbSAnLi9lcnJvcnMnO1xuaW1wb3J0IFdhbGtlclBhdGggZnJvbSAnLi9wYXRoJztcbmltcG9ydCB7IEtleUhhbmRsZXIsIEtleVRyYXZlcnNhbCwgTm9kZUhhbmRsZXIsIE5vZGVUcmF2ZXJzYWwsIE5vZGVWaXNpdG9yIH0gZnJvbSAnLi92aXNpdG9yJztcblxuZnVuY3Rpb24gZ2V0RW50ZXJGdW5jdGlvbjxOIGV4dGVuZHMgQVNUdjEuTm9kZT4oXG4gIGhhbmRsZXI6IE5vZGVUcmF2ZXJzYWw8Tj5cbik6IE5vZGVIYW5kbGVyPE4+IHwgdW5kZWZpbmVkO1xuZnVuY3Rpb24gZ2V0RW50ZXJGdW5jdGlvbjxOIGV4dGVuZHMgQVNUdjEuTm9kZSwgSyBleHRlbmRzIFZpc2l0b3JLZXk8Tj4+KFxuICBoYW5kbGVyOiBLZXlUcmF2ZXJzYWw8TiwgSz5cbik6IEtleUhhbmRsZXI8TiwgSz4gfCB1bmRlZmluZWQ7XG5mdW5jdGlvbiBnZXRFbnRlckZ1bmN0aW9uPE4gZXh0ZW5kcyBBU1R2MS5Ob2RlLCBLIGV4dGVuZHMgVmlzaXRvcktleTxOPj4oXG4gIGhhbmRsZXI6IE5vZGVUcmF2ZXJzYWw8Tj4gfCBLZXlUcmF2ZXJzYWw8TiwgSz5cbik6IE5vZGVIYW5kbGVyPE4+IHwgS2V5SGFuZGxlcjxOLCBLPiB8IHVuZGVmaW5lZCB7XG4gIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBoYW5kbGVyO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBoYW5kbGVyLmVudGVyIGFzIE5vZGVIYW5kbGVyPE4+IHwgS2V5SGFuZGxlcjxOLCBLPjtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRFeGl0RnVuY3Rpb248TiBleHRlbmRzIEFTVHYxLk5vZGU+KFxuICBoYW5kbGVyOiBOb2RlVHJhdmVyc2FsPE4+XG4pOiBOb2RlSGFuZGxlcjxOPiB8IHVuZGVmaW5lZDtcbmZ1bmN0aW9uIGdldEV4aXRGdW5jdGlvbjxOIGV4dGVuZHMgQVNUdjEuTm9kZSwgSyBleHRlbmRzIFZpc2l0b3JLZXk8Tj4+KFxuICBoYW5kbGVyOiBLZXlUcmF2ZXJzYWw8TiwgSz5cbik6IEtleUhhbmRsZXI8TiwgSz4gfCB1bmRlZmluZWQ7XG5mdW5jdGlvbiBnZXRFeGl0RnVuY3Rpb248TiBleHRlbmRzIEFTVHYxLk5vZGUsIEsgZXh0ZW5kcyBWaXNpdG9yS2V5PE4+PihcbiAgaGFuZGxlcjogTm9kZVRyYXZlcnNhbDxOPiB8IEtleVRyYXZlcnNhbDxOLCBLPlxuKTogTm9kZUhhbmRsZXI8Tj4gfCBLZXlIYW5kbGVyPE4sIEs+IHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gaGFuZGxlci5leGl0IGFzIE5vZGVIYW5kbGVyPE4+IHwgS2V5SGFuZGxlcjxOLCBLPjtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRLZXlIYW5kbGVyPE4gZXh0ZW5kcyBBU1R2MS5Ob2RlLCBLIGV4dGVuZHMgVmlzaXRvcktleTxOPj4oXG4gIGhhbmRsZXI6IE5vZGVUcmF2ZXJzYWw8Tj4sXG4gIGtleTogS1xuKTogS2V5VHJhdmVyc2FsPE4sIEs+IHwgS2V5VHJhdmVyc2FsPE4sIFZpc2l0b3JLZXk8Tj4+IHwgdW5kZWZpbmVkIHtcbiAgbGV0IGtleVZpc2l0b3IgPSB0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJyA/IGhhbmRsZXIua2V5cyA6IHVuZGVmaW5lZDtcbiAgaWYgKGtleVZpc2l0b3IgPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuXG4gIGxldCBrZXlIYW5kbGVyID0ga2V5VmlzaXRvcltrZXldO1xuICBpZiAoa2V5SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGtleUhhbmRsZXIgYXMgS2V5VHJhdmVyc2FsPE4sIEs+O1xuICB9XG4gIHJldHVybiBrZXlWaXNpdG9yLkFsbDtcbn1cblxuZnVuY3Rpb24gZ2V0Tm9kZUhhbmRsZXI8TiBleHRlbmRzIEFTVHYxLk5vZGU+KFxuICB2aXNpdG9yOiBOb2RlVmlzaXRvcixcbiAgbm9kZVR5cGU6IE5bJ3R5cGUnXVxuKTogTm9kZVRyYXZlcnNhbDxOPjtcbmZ1bmN0aW9uIGdldE5vZGVIYW5kbGVyKHZpc2l0b3I6IE5vZGVWaXNpdG9yLCBub2RlVHlwZTogJ0FsbCcpOiBOb2RlVHJhdmVyc2FsPEFTVHYxLk5vZGU+O1xuZnVuY3Rpb24gZ2V0Tm9kZUhhbmRsZXI8TiBleHRlbmRzIEFTVHYxLk5vZGU+KFxuICB2aXNpdG9yOiBOb2RlVmlzaXRvcixcbiAgbm9kZVR5cGU6IE5bJ3R5cGUnXVxuKTogTm9kZVRyYXZlcnNhbDxBU1R2MS5Ob2RlPiB8IHVuZGVmaW5lZCB7XG4gIGlmIChub2RlVHlwZSA9PT0gJ1RlbXBsYXRlJyB8fCBub2RlVHlwZSA9PT0gJ0Jsb2NrJykge1xuICAgIGlmICh2aXNpdG9yLlByb2dyYW0pIHtcbiAgICAgIGlmIChMT0NBTF9ERUJVRykge1xuICAgICAgICBkZXByZWNhdGUoXG4gICAgICAgICAgYFRoZSAnUHJvZ3JhbScgdmlzaXRvciBub2RlIGlzIGRlcHJlY2F0ZWQuIFVzZSAnVGVtcGxhdGUnIG9yICdCbG9jaycgaW5zdGVhZCAobm9kZSB3YXMgJyR7bm9kZVR5cGV9JykgYFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdmlzaXRvci5Qcm9ncmFtIGFzIE5vZGVUcmF2ZXJzYWw8QVNUdjEuTm9kZT47XG4gICAgfVxuICB9XG5cbiAgbGV0IGhhbmRsZXIgPSB2aXNpdG9yW25vZGVUeXBlXTtcbiAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiAoaGFuZGxlciBhcyB1bmtub3duKSBhcyBOb2RlVHJhdmVyc2FsPEFTVHYxLk5vZGU+O1xuICB9XG4gIHJldHVybiB2aXNpdG9yLkFsbDtcbn1cblxuZnVuY3Rpb24gdmlzaXROb2RlPE4gZXh0ZW5kcyBBU1R2MS5Ob2RlPihcbiAgdmlzaXRvcjogTm9kZVZpc2l0b3IsXG4gIHBhdGg6IFdhbGtlclBhdGg8Tj5cbik6IEFTVHYxLk5vZGUgfCBBU1R2MS5Ob2RlW10gfCB1bmRlZmluZWQgfCBudWxsIHwgdm9pZCB7XG4gIGxldCB7IG5vZGUsIHBhcmVudCwgcGFyZW50S2V5IH0gPSBwYXRoO1xuXG4gIGxldCBoYW5kbGVyOiBOb2RlVHJhdmVyc2FsPE4+ID0gZ2V0Tm9kZUhhbmRsZXIodmlzaXRvciwgbm9kZS50eXBlKTtcbiAgbGV0IGVudGVyO1xuICBsZXQgZXhpdDtcblxuICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZW50ZXIgPSBnZXRFbnRlckZ1bmN0aW9uKGhhbmRsZXIpO1xuICAgIGV4aXQgPSBnZXRFeGl0RnVuY3Rpb24oaGFuZGxlcik7XG4gIH1cblxuICBsZXQgcmVzdWx0OiBBU1R2MS5Ob2RlIHwgQVNUdjEuTm9kZVtdIHwgdW5kZWZpbmVkIHwgbnVsbCB8IHZvaWQ7XG4gIGlmIChlbnRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmVzdWx0ID0gZW50ZXIobm9kZSwgcGF0aCk7XG4gIH1cblxuICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQgJiYgcmVzdWx0ICE9PSBudWxsKSB7XG4gICAgaWYgKEpTT04uc3RyaW5naWZ5KG5vZGUpID09PSBKU09OLnN0cmluZ2lmeShyZXN1bHQpKSB7XG4gICAgICByZXN1bHQgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHJlc3VsdCkpIHtcbiAgICAgIHZpc2l0QXJyYXkodmlzaXRvciwgcmVzdWx0LCBwYXJlbnQsIHBhcmVudEtleSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcGF0aCA9IG5ldyBXYWxrZXJQYXRoKHJlc3VsdCwgcGFyZW50LCBwYXJlbnRLZXkpO1xuICAgICAgcmV0dXJuIHZpc2l0Tm9kZSh2aXNpdG9yLCBwYXRoKSB8fCByZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGV0IGtleXMgPSB2aXNpdG9yS2V5c1tub2RlLnR5cGVdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQga2V5ID0ga2V5c1tpXSBhcyBWaXNpdG9yS2V5c1tOWyd0eXBlJ11dICYga2V5b2YgTjtcbiAgICAgIC8vIHdlIGtub3cgaWYgaXQgaGFzIGNoaWxkIGtleXMgd2UgY2FuIHdpZGVuIHRvIGEgUGFyZW50Tm9kZVxuICAgICAgdmlzaXRLZXkodmlzaXRvciwgaGFuZGxlciwgcGF0aCwga2V5KTtcbiAgICB9XG5cbiAgICBpZiAoZXhpdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXN1bHQgPSBleGl0KG5vZGUsIHBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGdldDxOIGV4dGVuZHMgQVNUdjEuTm9kZT4oXG4gIG5vZGU6IE4sXG4gIGtleTogVmlzaXRvcktleXNbTlsndHlwZSddXSAmIGtleW9mIE5cbik6IEFTVHYxLk5vZGUgfCBBU1R2MS5Ob2RlW10ge1xuICByZXR1cm4gKG5vZGVba2V5XSBhcyB1bmtub3duKSBhcyBBU1R2MS5Ob2RlIHwgQVNUdjEuTm9kZVtdO1xufVxuXG5mdW5jdGlvbiBzZXQ8TiBleHRlbmRzIEFTVHYxLk5vZGUsIEsgZXh0ZW5kcyBrZXlvZiBOPihub2RlOiBOLCBrZXk6IEssIHZhbHVlOiBOW0tdKTogdm9pZCB7XG4gIG5vZGVba2V5XSA9IHZhbHVlO1xufVxuXG5mdW5jdGlvbiB2aXNpdEtleTxOIGV4dGVuZHMgQVNUdjEuTm9kZT4oXG4gIHZpc2l0b3I6IE5vZGVWaXNpdG9yLFxuICBoYW5kbGVyOiBOb2RlVHJhdmVyc2FsPE4+LFxuICBwYXRoOiBXYWxrZXJQYXRoPE4+LFxuICBrZXk6IFZpc2l0b3JLZXlzW05bJ3R5cGUnXV0gJiBrZXlvZiBOXG4pIHtcbiAgbGV0IHsgbm9kZSB9ID0gcGF0aDtcblxuICBsZXQgdmFsdWUgPSBnZXQobm9kZSwga2V5KTtcbiAgaWYgKCF2YWx1ZSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBrZXlFbnRlcjtcbiAgbGV0IGtleUV4aXQ7XG5cbiAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIGxldCBrZXlIYW5kbGVyID0gZ2V0S2V5SGFuZGxlcihoYW5kbGVyLCBrZXkpO1xuICAgIGlmIChrZXlIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGtleUVudGVyID0gZ2V0RW50ZXJGdW5jdGlvbihrZXlIYW5kbGVyKTtcbiAgICAgIGtleUV4aXQgPSBnZXRFeGl0RnVuY3Rpb24oa2V5SGFuZGxlcik7XG4gICAgfVxuICB9XG5cbiAgaWYgKGtleUVudGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoa2V5RW50ZXIobm9kZSwga2V5KSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBjYW5ub3RSZXBsYWNlT3JSZW1vdmVJbktleUhhbmRsZXJZZXQobm9kZSwga2V5KTtcbiAgICB9XG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICB2aXNpdEFycmF5KHZpc2l0b3IsIHZhbHVlLCBwYXRoLCBrZXkpO1xuICB9IGVsc2Uge1xuICAgIGxldCBrZXlQYXRoID0gbmV3IFdhbGtlclBhdGgodmFsdWUsIHBhdGgsIGtleSk7XG4gICAgbGV0IHJlc3VsdCA9IHZpc2l0Tm9kZSh2aXNpdG9yLCBrZXlQYXRoKTtcbiAgICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFRPRE86IGR5bmFtaWNhbGx5IGNoZWNrIHRoZSByZXN1bHRzIGJ5IGhhdmluZyBhIHRhYmxlIG9mXG4gICAgICAvLyBleHBlY3RlZCBub2RlIHR5cGVzIGluIHZhbHVlIHNwYWNlLCBub3QganVzdCB0eXBlIHNwYWNlXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgYXNzaWduS2V5KG5vZGUsIGtleSwgdmFsdWUsIHJlc3VsdCBhcyBhbnkpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChrZXlFeGl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoa2V5RXhpdChub2RlLCBrZXkpICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IGNhbm5vdFJlcGxhY2VPclJlbW92ZUluS2V5SGFuZGxlcllldChub2RlLCBrZXkpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiB2aXNpdEFycmF5KFxuICB2aXNpdG9yOiBOb2RlVmlzaXRvcixcbiAgYXJyYXk6IEFTVHYxLk5vZGVbXSxcbiAgcGFyZW50OiBXYWxrZXJQYXRoPEFTVHYxLk5vZGU+IHwgbnVsbCxcbiAgcGFyZW50S2V5OiBzdHJpbmcgfCBudWxsXG4pIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgIGxldCBub2RlID0gYXJyYXlbaV07XG4gICAgbGV0IHBhdGggPSBuZXcgV2Fsa2VyUGF0aChub2RlLCBwYXJlbnQsIHBhcmVudEtleSk7XG4gICAgbGV0IHJlc3VsdCA9IHZpc2l0Tm9kZSh2aXNpdG9yLCBwYXRoKTtcbiAgICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGkgKz0gc3BsaWNlQXJyYXkoYXJyYXksIGksIHJlc3VsdCkgLSAxO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NpZ25LZXk8TiBleHRlbmRzIEFTVHYxLk5vZGUsIEsgZXh0ZW5kcyBWaXNpdG9yS2V5PE4+PihcbiAgbm9kZTogTixcbiAga2V5OiBLLFxuICB2YWx1ZTogQVNUdjEuTm9kZSxcbiAgcmVzdWx0OiBOW0tdIHwgW05bS11dIHwgbnVsbFxuKSB7XG4gIGlmIChyZXN1bHQgPT09IG51bGwpIHtcbiAgICB0aHJvdyBjYW5ub3RSZW1vdmVOb2RlKHZhbHVlLCBub2RlLCBrZXkpO1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0KSkge1xuICAgIGlmIChyZXN1bHQubGVuZ3RoID09PSAxKSB7XG4gICAgICBzZXQobm9kZSwga2V5LCByZXN1bHRbMF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBjYW5ub3RSZW1vdmVOb2RlKHZhbHVlLCBub2RlLCBrZXkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgY2Fubm90UmVwbGFjZU5vZGUodmFsdWUsIG5vZGUsIGtleSk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHNldChub2RlLCBrZXksIHJlc3VsdCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3BsaWNlQXJyYXkoYXJyYXk6IEFTVHYxLk5vZGVbXSwgaW5kZXg6IG51bWJlciwgcmVzdWx0OiBBU1R2MS5Ob2RlIHwgQVNUdjEuTm9kZVtdIHwgbnVsbCkge1xuICBpZiAocmVzdWx0ID09PSBudWxsKSB7XG4gICAgYXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICByZXR1cm4gMDtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHJlc3VsdCkpIHtcbiAgICBhcnJheS5zcGxpY2UoaW5kZXgsIDEsIC4uLnJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdC5sZW5ndGg7XG4gIH0gZWxzZSB7XG4gICAgYXJyYXkuc3BsaWNlKGluZGV4LCAxLCByZXN1bHQpO1xuICAgIHJldHVybiAxO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHRyYXZlcnNlKG5vZGU6IEFTVHYxLk5vZGUsIHZpc2l0b3I6IE5vZGVWaXNpdG9yKTogdm9pZCB7XG4gIGxldCBwYXRoID0gbmV3IFdhbGtlclBhdGgobm9kZSk7XG4gIHZpc2l0Tm9kZSh2aXNpdG9yLCBwYXRoKTtcbn1cbiIsImltcG9ydCB7IE9wdGlvbiB9IGZyb20gJ0BnbGltbWVyL2ludGVyZmFjZXMnO1xuXG5pbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuLi92MS9hcGknO1xuXG5leHBvcnQgdHlwZSBOb2RlQ2FsbGJhY2s8TiBleHRlbmRzIEFTVHYxLk5vZGU+ID0gKG5vZGU6IE4sIHdhbGtlcjogV2Fsa2VyKSA9PiB2b2lkO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBXYWxrZXIge1xuICBwdWJsaWMgc3RhY2s6IHVua25vd25bXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgb3JkZXI/OiB1bmtub3duKSB7fVxuXG4gIHZpc2l0PE4gZXh0ZW5kcyBBU1R2MS5Ob2RlPihub2RlOiBPcHRpb248Tj4sIGNhbGxiYWNrOiBOb2RlQ2FsbGJhY2s8Tj4pOiB2b2lkIHtcbiAgICBpZiAoIW5vZGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0YWNrLnB1c2gobm9kZSk7XG5cbiAgICBpZiAodGhpcy5vcmRlciA9PT0gJ3Bvc3QnKSB7XG4gICAgICB0aGlzLmNoaWxkcmVuKG5vZGUsIGNhbGxiYWNrKTtcbiAgICAgIGNhbGxiYWNrKG5vZGUsIHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhub2RlLCB0aGlzKTtcbiAgICAgIHRoaXMuY2hpbGRyZW4obm9kZSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHRoaXMuc3RhY2sucG9wKCk7XG4gIH1cblxuICBjaGlsZHJlbjxOIGV4dGVuZHMgQVNUdjEuTm9kZT4oXG4gICAgbm9kZTogTiAmIEFTVHYxLk5vZGUsXG4gICAgY2FsbGJhY2s6IE5vZGVDYWxsYmFjazxOICYgQVNUdjEuTm9kZT5cbiAgKTogdm9pZCB7XG4gICAgc3dpdGNoIChub2RlLnR5cGUpIHtcbiAgICAgIGNhc2UgJ0Jsb2NrJzpcbiAgICAgIGNhc2UgJ1RlbXBsYXRlJzpcbiAgICAgICAgcmV0dXJuIHZpc2l0b3JzLlByb2dyYW0odGhpcywgKG5vZGUgYXMgdW5rbm93bikgYXMgQVNUdjEuUHJvZ3JhbSwgY2FsbGJhY2spO1xuICAgICAgY2FzZSAnRWxlbWVudE5vZGUnOlxuICAgICAgICByZXR1cm4gdmlzaXRvcnMuRWxlbWVudE5vZGUodGhpcywgbm9kZSwgY2FsbGJhY2spO1xuICAgICAgY2FzZSAnQmxvY2tTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdmlzaXRvcnMuQmxvY2tTdGF0ZW1lbnQodGhpcywgbm9kZSwgY2FsbGJhY2spO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCB2aXNpdG9ycyA9IHtcbiAgUHJvZ3JhbSh3YWxrZXI6IFdhbGtlciwgbm9kZTogQVNUdjEuUHJvZ3JhbSwgY2FsbGJhY2s6IE5vZGVDYWxsYmFjazxBU1R2MS5Ob2RlPikge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5ib2R5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB3YWxrZXIudmlzaXQobm9kZS5ib2R5W2ldLCBjYWxsYmFjayk7XG4gICAgfVxuICB9LFxuXG4gIFRlbXBsYXRlKHdhbGtlcjogV2Fsa2VyLCBub2RlOiBBU1R2MS5UZW1wbGF0ZSwgY2FsbGJhY2s6IE5vZGVDYWxsYmFjazxBU1R2MS5Ob2RlPikge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5ib2R5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB3YWxrZXIudmlzaXQobm9kZS5ib2R5W2ldLCBjYWxsYmFjayk7XG4gICAgfVxuICB9LFxuXG4gIEJsb2NrKHdhbGtlcjogV2Fsa2VyLCBub2RlOiBBU1R2MS5CbG9jaywgY2FsbGJhY2s6IE5vZGVDYWxsYmFjazxBU1R2MS5Ob2RlPikge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5ib2R5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB3YWxrZXIudmlzaXQobm9kZS5ib2R5W2ldLCBjYWxsYmFjayk7XG4gICAgfVxuICB9LFxuXG4gIEVsZW1lbnROb2RlKHdhbGtlcjogV2Fsa2VyLCBub2RlOiBBU1R2MS5FbGVtZW50Tm9kZSwgY2FsbGJhY2s6IE5vZGVDYWxsYmFjazxBU1R2MS5Ob2RlPikge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgd2Fsa2VyLnZpc2l0KG5vZGUuY2hpbGRyZW5baV0sIGNhbGxiYWNrKTtcbiAgICB9XG4gIH0sXG5cbiAgQmxvY2tTdGF0ZW1lbnQod2Fsa2VyOiBXYWxrZXIsIG5vZGU6IEFTVHYxLkJsb2NrU3RhdGVtZW50LCBjYWxsYmFjazogTm9kZUNhbGxiYWNrPEFTVHYxLkJsb2NrPikge1xuICAgIHdhbGtlci52aXNpdChub2RlLnByb2dyYW0sIGNhbGxiYWNrKTtcbiAgICB3YWxrZXIudmlzaXQobm9kZS5pbnZlcnNlIHx8IG51bGwsIGNhbGxiYWNrKTtcbiAgfSxcbn0gYXMgY29uc3Q7XG4iLCJpbXBvcnQgeyBPcHRpb24gfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcbmltcG9ydCB7IGV4cGVjdCB9IGZyb20gJ0BnbGltbWVyL3V0aWwnO1xuXG5pbXBvcnQgeyBnZW5lcmF0ZVN5bnRheEVycm9yIH0gZnJvbSAnLi9zeW50YXgtZXJyb3InO1xuaW1wb3J0ICogYXMgQVNUdjEgZnJvbSAnLi92MS9hcGknO1xuaW1wb3J0ICogYXMgSEJTIGZyb20gJy4vdjEvaGFuZGxlYmFycy1hc3QnO1xuXG4vLyBSZWdleCB0byB2YWxpZGF0ZSB0aGUgaWRlbnRpZmllciBmb3IgYmxvY2sgcGFyYW1ldGVycy5cbi8vIEJhc2VkIG9uIHRoZSBJRCB2YWxpZGF0aW9uIHJlZ2V4IGluIEhhbmRsZWJhcnMuXG5cbmxldCBJRF9JTlZFUlNFX1BBVFRFUk4gPSAvWyFcIiMlLSxcXC5cXC87LT5AXFxbLVxcXmBcXHstfl0vO1xuXG4vLyBDaGVja3MgdGhlIGVsZW1lbnQncyBhdHRyaWJ1dGVzIHRvIHNlZSBpZiBpdCB1c2VzIGJsb2NrIHBhcmFtcy5cbi8vIElmIGl0IGRvZXMsIHJlZ2lzdGVycyB0aGUgYmxvY2sgcGFyYW1zIHdpdGggdGhlIHByb2dyYW0gYW5kXG4vLyByZW1vdmVzIHRoZSBjb3JyZXNwb25kaW5nIGF0dHJpYnV0ZXMgZnJvbSB0aGUgZWxlbWVudC5cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRWxlbWVudEJsb2NrUGFyYW1zKGVsZW1lbnQ6IEFTVHYxLkVsZW1lbnROb2RlKTogdm9pZCB7XG4gIGxldCBwYXJhbXMgPSBwYXJzZUJsb2NrUGFyYW1zKGVsZW1lbnQpO1xuICBpZiAocGFyYW1zKSBlbGVtZW50LmJsb2NrUGFyYW1zID0gcGFyYW1zO1xufVxuXG5mdW5jdGlvbiBwYXJzZUJsb2NrUGFyYW1zKGVsZW1lbnQ6IEFTVHYxLkVsZW1lbnROb2RlKTogT3B0aW9uPHN0cmluZ1tdPiB7XG4gIGxldCBsID0gZWxlbWVudC5hdHRyaWJ1dGVzLmxlbmd0aDtcbiAgbGV0IGF0dHJOYW1lcyA9IFtdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgYXR0ck5hbWVzLnB1c2goZWxlbWVudC5hdHRyaWJ1dGVzW2ldLm5hbWUpO1xuICB9XG5cbiAgbGV0IGFzSW5kZXggPSBhdHRyTmFtZXMuaW5kZXhPZignYXMnKTtcblxuICBpZiAoYXNJbmRleCA9PT0gLTEgJiYgYXR0ck5hbWVzLmxlbmd0aCA+IDAgJiYgYXR0ck5hbWVzW2F0dHJOYW1lcy5sZW5ndGggLSAxXS5jaGFyQXQoMCkgPT09ICd8Jykge1xuICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAnQmxvY2sgcGFyYW1ldGVycyBtdXN0IGJlIHByZWNlZGVkIGJ5IHRoZSBgYXNgIGtleXdvcmQsIGRldGVjdGVkIGJsb2NrIHBhcmFtZXRlcnMgd2l0aG91dCBgYXNgJyxcbiAgICAgIGVsZW1lbnQubG9jXG4gICAgKTtcbiAgfVxuXG4gIGlmIChhc0luZGV4ICE9PSAtMSAmJiBsID4gYXNJbmRleCAmJiBhdHRyTmFtZXNbYXNJbmRleCArIDFdLmNoYXJBdCgwKSA9PT0gJ3wnKSB7XG4gICAgLy8gU29tZSBiYXNpYyB2YWxpZGF0aW9uLCBzaW5jZSB3ZSdyZSBkb2luZyB0aGUgcGFyc2luZyBvdXJzZWx2ZXNcbiAgICBsZXQgcGFyYW1zU3RyaW5nID0gYXR0ck5hbWVzLnNsaWNlKGFzSW5kZXgpLmpvaW4oJyAnKTtcbiAgICBpZiAoXG4gICAgICBwYXJhbXNTdHJpbmcuY2hhckF0KHBhcmFtc1N0cmluZy5sZW5ndGggLSAxKSAhPT0gJ3wnIHx8XG4gICAgICBleHBlY3QocGFyYW1zU3RyaW5nLm1hdGNoKC9cXHwvZyksIGBibG9jayBwYXJhbXMgbXVzdCBleGlzdCBoZXJlYCkubGVuZ3RoICE9PSAyXG4gICAgKSB7XG4gICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgICBcIkludmFsaWQgYmxvY2sgcGFyYW1ldGVycyBzeW50YXgsICdcIiArIHBhcmFtc1N0cmluZyArIFwiJ1wiLFxuICAgICAgICBlbGVtZW50LmxvY1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBsZXQgcGFyYW1zID0gW107XG4gICAgZm9yIChsZXQgaSA9IGFzSW5kZXggKyAxOyBpIDwgbDsgaSsrKSB7XG4gICAgICBsZXQgcGFyYW0gPSBhdHRyTmFtZXNbaV0ucmVwbGFjZSgvXFx8L2csICcnKTtcbiAgICAgIGlmIChwYXJhbSAhPT0gJycpIHtcbiAgICAgICAgaWYgKElEX0lOVkVSU0VfUEFUVEVSTi50ZXN0KHBhcmFtKSkge1xuICAgICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgICBcIkludmFsaWQgaWRlbnRpZmllciBmb3IgYmxvY2sgcGFyYW1ldGVycywgJ1wiICsgcGFyYW0gKyBcIidcIixcbiAgICAgICAgICAgIGVsZW1lbnQubG9jXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBwYXJhbXMucHVzaChwYXJhbSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBhcmFtcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoJ0Nhbm5vdCB1c2UgemVybyBibG9jayBwYXJhbWV0ZXJzJywgZWxlbWVudC5sb2MpO1xuICAgIH1cblxuICAgIGVsZW1lbnQuYXR0cmlidXRlcyA9IGVsZW1lbnQuYXR0cmlidXRlcy5zbGljZSgwLCBhc0luZGV4KTtcbiAgICByZXR1cm4gcGFyYW1zO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGlsZHJlbkZvcihcbiAgbm9kZTogQVNUdjEuQmxvY2sgfCBBU1R2MS5UZW1wbGF0ZSB8IEFTVHYxLkVsZW1lbnROb2RlXG4pOiBBU1R2MS5Ub3BMZXZlbFN0YXRlbWVudFtdIHtcbiAgc3dpdGNoIChub2RlLnR5cGUpIHtcbiAgICBjYXNlICdCbG9jayc6XG4gICAgY2FzZSAnVGVtcGxhdGUnOlxuICAgICAgcmV0dXJuIG5vZGUuYm9keTtcbiAgICBjYXNlICdFbGVtZW50Tm9kZSc6XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwZW5kQ2hpbGQoXG4gIHBhcmVudDogQVNUdjEuQmxvY2sgfCBBU1R2MS5UZW1wbGF0ZSB8IEFTVHYxLkVsZW1lbnROb2RlLFxuICBub2RlOiBBU1R2MS5TdGF0ZW1lbnRcbik6IHZvaWQge1xuICBjaGlsZHJlbkZvcihwYXJlbnQpLnB1c2gobm9kZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0hCU0xpdGVyYWwocGF0aDogSEJTLkV4cHJlc3Npb24pOiBwYXRoIGlzIEhCUy5MaXRlcmFsO1xuZXhwb3J0IGZ1bmN0aW9uIGlzSEJTTGl0ZXJhbChwYXRoOiBBU1R2MS5FeHByZXNzaW9uKTogcGF0aCBpcyBBU1R2MS5MaXRlcmFsO1xuZXhwb3J0IGZ1bmN0aW9uIGlzSEJTTGl0ZXJhbChcbiAgcGF0aDogSEJTLkV4cHJlc3Npb24gfCBBU1R2MS5FeHByZXNzaW9uXG4pOiBwYXRoIGlzIEhCUy5MaXRlcmFsIHwgQVNUdjEuTGl0ZXJhbCB7XG4gIHJldHVybiAoXG4gICAgcGF0aC50eXBlID09PSAnU3RyaW5nTGl0ZXJhbCcgfHxcbiAgICBwYXRoLnR5cGUgPT09ICdCb29sZWFuTGl0ZXJhbCcgfHxcbiAgICBwYXRoLnR5cGUgPT09ICdOdW1iZXJMaXRlcmFsJyB8fFxuICAgIHBhdGgudHlwZSA9PT0gJ051bGxMaXRlcmFsJyB8fFxuICAgIHBhdGgudHlwZSA9PT0gJ1VuZGVmaW5lZExpdGVyYWwnXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmludExpdGVyYWwobGl0ZXJhbDogQVNUdjEuTGl0ZXJhbCk6IHN0cmluZyB7XG4gIGlmIChsaXRlcmFsLnR5cGUgPT09ICdVbmRlZmluZWRMaXRlcmFsJykge1xuICAgIHJldHVybiAndW5kZWZpbmVkJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobGl0ZXJhbC52YWx1ZSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVXBwZXJDYXNlKHRhZzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB0YWdbMF0gPT09IHRhZ1swXS50b1VwcGVyQ2FzZSgpICYmIHRhZ1swXSAhPT0gdGFnWzBdLnRvTG93ZXJDYXNlKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0xvd2VyQ2FzZSh0YWc6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gdGFnWzBdID09PSB0YWdbMF0udG9Mb3dlckNhc2UoKSAmJiB0YWdbMF0gIT09IHRhZ1swXS50b1VwcGVyQ2FzZSgpO1xufVxuIiwiaW1wb3J0IHsgRGljdCwgT3B0aW9uLCBQcmVzZW50QXJyYXkgfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gJ0BnbGltbWVyL3V0aWwnO1xuXG5pbXBvcnQgeyBQYXJzZXJOb2RlQnVpbGRlciB9IGZyb20gJy4uL3BhcnNlcic7XG5pbXBvcnQgeyBTb3VyY2VMb2NhdGlvbiB9IGZyb20gJy4uL3NvdXJjZS9sb2NhdGlvbic7XG5pbXBvcnQgeyBTb3VyY2VPZmZzZXQsIFNvdXJjZVNwYW4gfSBmcm9tICcuLi9zb3VyY2Uvc3Bhbic7XG5pbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuL2FwaSc7XG5pbXBvcnQgeyBQYXRoRXhwcmVzc2lvbkltcGxWMSB9IGZyb20gJy4vbGVnYWN5LWludGVyb3AnO1xuXG5jb25zdCBERUZBVUxUX1NUUklQID0ge1xuICBjbG9zZTogZmFsc2UsXG4gIG9wZW46IGZhbHNlLFxufTtcblxuLyoqXG4gKiBUaGUgUGFyc2VyIEJ1aWxkZXIgZGlmZmVyZW50aWF0ZXMgZnJvbSB0aGUgcHVibGljIGJ1aWxkZXIgQVBJIGJ5OlxuICpcbiAqIDEuIE9mZmVyaW5nIGZld2VyIGRpZmZlcmVudCB3YXlzIHRvIGluc3RhbnRpYXRlIG5vZGVzXG4gKiAyLiBNYW5kYXRpbmcgc291cmNlIGxvY2F0aW9uc1xuICovXG5jbGFzcyBCdWlsZGVycyB7XG4gIHBvcyhsaW5lOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGxpbmUsXG4gICAgICBjb2x1bW4sXG4gICAgfTtcbiAgfVxuXG4gIGJsb2NrSXRzZWxmKHtcbiAgICBib2R5LFxuICAgIGJsb2NrUGFyYW1zLFxuICAgIGNoYWluZWQgPSBmYWxzZSxcbiAgICBsb2MsXG4gIH06IHtcbiAgICBib2R5PzogQVNUdjEuU3RhdGVtZW50W107XG4gICAgYmxvY2tQYXJhbXM/OiBzdHJpbmdbXTtcbiAgICBjaGFpbmVkPzogYm9vbGVhbjtcbiAgICBsb2M6IFNvdXJjZVNwYW47XG4gIH0pOiBBU1R2MS5CbG9jayB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdCbG9jaycsXG4gICAgICBib2R5OiBib2R5IHx8IFtdLFxuICAgICAgYmxvY2tQYXJhbXM6IGJsb2NrUGFyYW1zIHx8IFtdLFxuICAgICAgY2hhaW5lZCxcbiAgICAgIGxvYyxcbiAgICB9O1xuICB9XG5cbiAgdGVtcGxhdGUoe1xuICAgIGJvZHksXG4gICAgYmxvY2tQYXJhbXMsXG4gICAgbG9jLFxuICB9OiB7XG4gICAgYm9keT86IEFTVHYxLlN0YXRlbWVudFtdO1xuICAgIGJsb2NrUGFyYW1zPzogc3RyaW5nW107XG4gICAgbG9jOiBTb3VyY2VTcGFuO1xuICB9KTogQVNUdjEuVGVtcGxhdGUge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnVGVtcGxhdGUnLFxuICAgICAgYm9keTogYm9keSB8fCBbXSxcbiAgICAgIGJsb2NrUGFyYW1zOiBibG9ja1BhcmFtcyB8fCBbXSxcbiAgICAgIGxvYyxcbiAgICB9O1xuICB9XG5cbiAgbXVzdGFjaGUoe1xuICAgIHBhdGgsXG4gICAgcGFyYW1zLFxuICAgIGhhc2gsXG4gICAgdHJ1c3RpbmcsXG4gICAgbG9jLFxuICAgIHN0cmlwID0gREVGQVVMVF9TVFJJUCxcbiAgfToge1xuICAgIHBhdGg6IEFTVHYxLkV4cHJlc3Npb247XG4gICAgcGFyYW1zOiBBU1R2MS5FeHByZXNzaW9uW107XG4gICAgaGFzaDogQVNUdjEuSGFzaDtcbiAgICB0cnVzdGluZzogYm9vbGVhbjtcbiAgICBsb2M6IFNvdXJjZVNwYW47XG4gICAgc3RyaXA6IEFTVHYxLlN0cmlwRmxhZ3M7XG4gIH0pOiBBU1R2MS5NdXN0YWNoZVN0YXRlbWVudCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdNdXN0YWNoZVN0YXRlbWVudCcsXG4gICAgICBwYXRoLFxuICAgICAgcGFyYW1zLFxuICAgICAgaGFzaCxcbiAgICAgIGVzY2FwZWQ6ICF0cnVzdGluZyxcbiAgICAgIHRydXN0aW5nLFxuICAgICAgbG9jLFxuICAgICAgc3RyaXA6IHN0cmlwIHx8IHsgb3BlbjogZmFsc2UsIGNsb3NlOiBmYWxzZSB9LFxuICAgIH07XG4gIH1cblxuICBibG9jayh7XG4gICAgcGF0aCxcbiAgICBwYXJhbXMsXG4gICAgaGFzaCxcbiAgICBkZWZhdWx0QmxvY2ssXG4gICAgZWxzZUJsb2NrID0gbnVsbCxcbiAgICBsb2MsXG4gICAgb3BlblN0cmlwID0gREVGQVVMVF9TVFJJUCxcbiAgICBpbnZlcnNlU3RyaXAgPSBERUZBVUxUX1NUUklQLFxuICAgIGNsb3NlU3RyaXAgPSBERUZBVUxUX1NUUklQLFxuICB9OiB7XG4gICAgcGF0aDogQVNUdjEuUGF0aEV4cHJlc3Npb24gfCBBU1R2MS5TdWJFeHByZXNzaW9uO1xuICAgIHBhcmFtczogQVNUdjEuRXhwcmVzc2lvbltdO1xuICAgIGhhc2g6IEFTVHYxLkhhc2g7XG4gICAgZGVmYXVsdEJsb2NrOiBBU1R2MS5CbG9jaztcbiAgICBlbHNlQmxvY2s/OiBPcHRpb248QVNUdjEuQmxvY2s+O1xuICAgIGxvYzogU291cmNlU3BhbjtcbiAgICBvcGVuU3RyaXA6IEFTVHYxLlN0cmlwRmxhZ3M7XG4gICAgaW52ZXJzZVN0cmlwOiBBU1R2MS5TdHJpcEZsYWdzO1xuICAgIGNsb3NlU3RyaXA6IEFTVHYxLlN0cmlwRmxhZ3M7XG4gIH0pOiBBU1R2MS5CbG9ja1N0YXRlbWVudCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdCbG9ja1N0YXRlbWVudCcsXG4gICAgICBwYXRoOiBwYXRoLFxuICAgICAgcGFyYW1zLFxuICAgICAgaGFzaCxcbiAgICAgIHByb2dyYW06IGRlZmF1bHRCbG9jayxcbiAgICAgIGludmVyc2U6IGVsc2VCbG9jayxcbiAgICAgIGxvYzogbG9jLFxuICAgICAgb3BlblN0cmlwOiBvcGVuU3RyaXAsXG4gICAgICBpbnZlcnNlU3RyaXA6IGludmVyc2VTdHJpcCxcbiAgICAgIGNsb3NlU3RyaXA6IGNsb3NlU3RyaXAsXG4gICAgfTtcbiAgfVxuXG4gIGNvbW1lbnQodmFsdWU6IHN0cmluZywgbG9jOiBTb3VyY2VPZmZzZXQpOiBQYXJzZXJOb2RlQnVpbGRlcjxBU1R2MS5Db21tZW50U3RhdGVtZW50PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdDb21tZW50U3RhdGVtZW50JyxcbiAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgIGxvYyxcbiAgICB9O1xuICB9XG5cbiAgbXVzdGFjaGVDb21tZW50KHZhbHVlOiBzdHJpbmcsIGxvYzogU291cmNlU3Bhbik6IEFTVHYxLk11c3RhY2hlQ29tbWVudFN0YXRlbWVudCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQnLFxuICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgbG9jLFxuICAgIH07XG4gIH1cblxuICBjb25jYXQoXG4gICAgcGFydHM6IFByZXNlbnRBcnJheTxBU1R2MS5UZXh0Tm9kZSB8IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50PixcbiAgICBsb2M6IFNvdXJjZVNwYW5cbiAgKTogQVNUdjEuQ29uY2F0U3RhdGVtZW50IHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ0NvbmNhdFN0YXRlbWVudCcsXG4gICAgICBwYXJ0cyxcbiAgICAgIGxvYyxcbiAgICB9O1xuICB9XG5cbiAgZWxlbWVudCh7XG4gICAgdGFnLFxuICAgIHNlbGZDbG9zaW5nLFxuICAgIGF0dHJzLFxuICAgIGJsb2NrUGFyYW1zLFxuICAgIG1vZGlmaWVycyxcbiAgICBjb21tZW50cyxcbiAgICBjaGlsZHJlbixcbiAgICBsb2MsXG4gIH06IEJ1aWxkRWxlbWVudE9wdGlvbnMpOiBBU1R2MS5FbGVtZW50Tm9kZSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdFbGVtZW50Tm9kZScsXG4gICAgICB0YWcsXG4gICAgICBzZWxmQ2xvc2luZzogc2VsZkNsb3NpbmcsXG4gICAgICBhdHRyaWJ1dGVzOiBhdHRycyB8fCBbXSxcbiAgICAgIGJsb2NrUGFyYW1zOiBibG9ja1BhcmFtcyB8fCBbXSxcbiAgICAgIG1vZGlmaWVyczogbW9kaWZpZXJzIHx8IFtdLFxuICAgICAgY29tbWVudHM6IChjb21tZW50cyBhcyBBU1R2MS5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnRbXSkgfHwgW10sXG4gICAgICBjaGlsZHJlbjogY2hpbGRyZW4gfHwgW10sXG4gICAgICBsb2MsXG4gICAgfTtcbiAgfVxuXG4gIGVsZW1lbnRNb2RpZmllcih7XG4gICAgcGF0aCxcbiAgICBwYXJhbXMsXG4gICAgaGFzaCxcbiAgICBsb2MsXG4gIH06IHtcbiAgICBwYXRoOiBBU1R2MS5QYXRoRXhwcmVzc2lvbiB8IEFTVHYxLlN1YkV4cHJlc3Npb247XG4gICAgcGFyYW1zOiBBU1R2MS5FeHByZXNzaW9uW107XG4gICAgaGFzaDogQVNUdjEuSGFzaDtcbiAgICBsb2M6IFNvdXJjZVNwYW47XG4gIH0pOiBBU1R2MS5FbGVtZW50TW9kaWZpZXJTdGF0ZW1lbnQge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50JyxcbiAgICAgIHBhdGgsXG4gICAgICBwYXJhbXMsXG4gICAgICBoYXNoLFxuICAgICAgbG9jLFxuICAgIH07XG4gIH1cblxuICBhdHRyKHtcbiAgICBuYW1lLFxuICAgIHZhbHVlLFxuICAgIGxvYyxcbiAgfToge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICB2YWx1ZTogQVNUdjEuQXR0ck5vZGVbJ3ZhbHVlJ107XG4gICAgbG9jOiBTb3VyY2VTcGFuO1xuICB9KTogQVNUdjEuQXR0ck5vZGUge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnQXR0ck5vZGUnLFxuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgIGxvYyxcbiAgICB9O1xuICB9XG5cbiAgdGV4dCh7IGNoYXJzLCBsb2MgfTogeyBjaGFyczogc3RyaW5nOyBsb2M6IFNvdXJjZVNwYW4gfSk6IEFTVHYxLlRleHROb2RlIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ1RleHROb2RlJyxcbiAgICAgIGNoYXJzLFxuICAgICAgbG9jLFxuICAgIH07XG4gIH1cblxuICBzZXhwcih7XG4gICAgcGF0aCxcbiAgICBwYXJhbXMsXG4gICAgaGFzaCxcbiAgICBsb2MsXG4gIH06IHtcbiAgICBwYXRoOiBBU1R2MS5QYXRoRXhwcmVzc2lvbiB8IEFTVHYxLlN1YkV4cHJlc3Npb247XG4gICAgcGFyYW1zOiBBU1R2MS5FeHByZXNzaW9uW107XG4gICAgaGFzaDogQVNUdjEuSGFzaDtcbiAgICBsb2M6IFNvdXJjZVNwYW47XG4gIH0pOiBBU1R2MS5TdWJFeHByZXNzaW9uIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ1N1YkV4cHJlc3Npb24nLFxuICAgICAgcGF0aCxcbiAgICAgIHBhcmFtcyxcbiAgICAgIGhhc2gsXG4gICAgICBsb2MsXG4gICAgfTtcbiAgfVxuXG4gIHBhdGgoe1xuICAgIGhlYWQsXG4gICAgdGFpbCxcbiAgICBsb2MsXG4gIH06IHtcbiAgICBoZWFkOiBBU1R2MS5QYXRoSGVhZDtcbiAgICB0YWlsOiBzdHJpbmdbXTtcbiAgICBsb2M6IFNvdXJjZVNwYW47XG4gIH0pOiBBU1R2MS5QYXRoRXhwcmVzc2lvbiB7XG4gICAgbGV0IHsgb3JpZ2luYWw6IG9yaWdpbmFsSGVhZCB9ID0gaGVhZFRvU3RyaW5nKGhlYWQpO1xuICAgIGxldCBvcmlnaW5hbCA9IFsuLi5vcmlnaW5hbEhlYWQsIC4uLnRhaWxdLmpvaW4oJy4nKTtcblxuICAgIHJldHVybiBuZXcgUGF0aEV4cHJlc3Npb25JbXBsVjEob3JpZ2luYWwsIGhlYWQsIHRhaWwsIGxvYyk7XG4gIH1cblxuICBoZWFkKGhlYWQ6IHN0cmluZywgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjEuUGF0aEhlYWQge1xuICAgIGlmIChoZWFkWzBdID09PSAnQCcpIHtcbiAgICAgIHJldHVybiB0aGlzLmF0TmFtZShoZWFkLCBsb2MpO1xuICAgIH0gZWxzZSBpZiAoaGVhZCA9PT0gJ3RoaXMnKSB7XG4gICAgICByZXR1cm4gdGhpcy50aGlzKGxvYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnZhcihoZWFkLCBsb2MpO1xuICAgIH1cbiAgfVxuXG4gIHRoaXMobG9jOiBTb3VyY2VTcGFuKTogQVNUdjEuUGF0aEhlYWQge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnVGhpc0hlYWQnLFxuICAgICAgbG9jLFxuICAgIH07XG4gIH1cblxuICBhdE5hbWUobmFtZTogc3RyaW5nLCBsb2M6IFNvdXJjZVNwYW4pOiBBU1R2MS5QYXRoSGVhZCB7XG4gICAgLy8gdGhlIGBAYCBzaG91bGQgYmUgaW5jbHVkZWQgc28gd2UgaGF2ZSBhIGNvbXBsZXRlIHNvdXJjZSByYW5nZVxuICAgIGFzc2VydChuYW1lWzBdID09PSAnQCcsIGBjYWxsIGJ1aWxkZXJzLmF0KCkgd2l0aCBhIHN0cmluZyB0aGF0IHN0YXJ0cyB3aXRoICdAJ2ApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdBdEhlYWQnLFxuICAgICAgbmFtZSxcbiAgICAgIGxvYyxcbiAgICB9O1xuICB9XG5cbiAgdmFyKG5hbWU6IHN0cmluZywgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjEuUGF0aEhlYWQge1xuICAgIGFzc2VydChuYW1lICE9PSAndGhpcycsIGBZb3UgY2FsbGVkIGJ1aWxkZXJzLnZhcigpIHdpdGggJ3RoaXMnLiBDYWxsIGJ1aWxkZXJzLnRoaXMgaW5zdGVhZGApO1xuICAgIGFzc2VydChcbiAgICAgIG5hbWVbMF0gIT09ICdAJyxcbiAgICAgIGBZb3UgY2FsbGVkIGJ1aWxkZXJzLnZhcigpIHdpdGggJyR7bmFtZX0nLiBDYWxsIGJ1aWxkZXJzLmF0KCcke25hbWV9JykgaW5zdGVhZGBcbiAgICApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdWYXJIZWFkJyxcbiAgICAgIG5hbWUsXG4gICAgICBsb2MsXG4gICAgfTtcbiAgfVxuXG4gIGhhc2gocGFpcnM6IEFTVHYxLkhhc2hQYWlyW10sIGxvYzogU291cmNlU3Bhbik6IEFTVHYxLkhhc2gge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnSGFzaCcsXG4gICAgICBwYWlyczogcGFpcnMgfHwgW10sXG4gICAgICBsb2MsXG4gICAgfTtcbiAgfVxuXG4gIHBhaXIoe1xuICAgIGtleSxcbiAgICB2YWx1ZSxcbiAgICBsb2MsXG4gIH06IHtcbiAgICBrZXk6IHN0cmluZztcbiAgICB2YWx1ZTogQVNUdjEuRXhwcmVzc2lvbjtcbiAgICBsb2M6IFNvdXJjZVNwYW47XG4gIH0pOiBBU1R2MS5IYXNoUGFpciB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdIYXNoUGFpcicsXG4gICAgICBrZXk6IGtleSxcbiAgICAgIHZhbHVlLFxuICAgICAgbG9jLFxuICAgIH07XG4gIH1cblxuICBsaXRlcmFsPFQgZXh0ZW5kcyBBU1R2MS5MaXRlcmFsPih7XG4gICAgdHlwZSxcbiAgICB2YWx1ZSxcbiAgICBsb2MsXG4gIH06IHtcbiAgICB0eXBlOiBUWyd0eXBlJ107XG4gICAgdmFsdWU6IFRbJ3ZhbHVlJ107XG4gICAgbG9jPzogU291cmNlTG9jYXRpb247XG4gIH0pOiBUIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZSxcbiAgICAgIHZhbHVlLFxuICAgICAgb3JpZ2luYWw6IHZhbHVlLFxuICAgICAgbG9jLFxuICAgIH0gYXMgVDtcbiAgfVxuXG4gIHVuZGVmaW5lZCgpOiBBU1R2MS5VbmRlZmluZWRMaXRlcmFsIHtcbiAgICByZXR1cm4gdGhpcy5saXRlcmFsKHsgdHlwZTogJ1VuZGVmaW5lZExpdGVyYWwnLCB2YWx1ZTogdW5kZWZpbmVkIH0pO1xuICB9XG5cbiAgbnVsbCgpOiBBU1R2MS5OdWxsTGl0ZXJhbCB7XG4gICAgcmV0dXJuIHRoaXMubGl0ZXJhbCh7IHR5cGU6ICdOdWxsTGl0ZXJhbCcsIHZhbHVlOiBudWxsIH0pO1xuICB9XG5cbiAgc3RyaW5nKHZhbHVlOiBzdHJpbmcsIGxvYzogU291cmNlU3Bhbik6IEFTVHYxLlN0cmluZ0xpdGVyYWwge1xuICAgIHJldHVybiB0aGlzLmxpdGVyYWwoeyB0eXBlOiAnU3RyaW5nTGl0ZXJhbCcsIHZhbHVlLCBsb2MgfSk7XG4gIH1cblxuICBib29sZWFuKHZhbHVlOiBib29sZWFuLCBsb2M6IFNvdXJjZVNwYW4pOiBBU1R2MS5Cb29sZWFuTGl0ZXJhbCB7XG4gICAgcmV0dXJuIHRoaXMubGl0ZXJhbCh7IHR5cGU6ICdCb29sZWFuTGl0ZXJhbCcsIHZhbHVlLCBsb2MgfSk7XG4gIH1cblxuICBudW1iZXIodmFsdWU6IG51bWJlciwgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjEuTnVtYmVyTGl0ZXJhbCB7XG4gICAgcmV0dXJuIHRoaXMubGl0ZXJhbCh7IHR5cGU6ICdOdW1iZXJMaXRlcmFsJywgdmFsdWUsIGxvYyB9KTtcbiAgfVxufVxuXG4vLyBOb2Rlc1xuXG5leHBvcnQgdHlwZSBFbGVtZW50UGFydHMgPVxuICB8IFsnYXR0cnMnLCAuLi5BdHRyU2V4cFtdXVxuICB8IFsnbW9kaWZpZXJzJywgLi4uTW9kaWZpZXJTZXhwW11dXG4gIHwgWydib2R5JywgLi4uQVNUdjEuU3RhdGVtZW50W11dXG4gIHwgWydjb21tZW50cycsIC4uLkVsZW1lbnRDb21tZW50W11dXG4gIHwgWydhcycsIC4uLnN0cmluZ1tdXVxuICB8IFsnbG9jJywgU291cmNlTG9jYXRpb25dO1xuXG5leHBvcnQgdHlwZSBQYXRoU2V4cCA9IHN0cmluZyB8IFsncGF0aCcsIHN0cmluZywgTG9jU2V4cD9dO1xuXG5leHBvcnQgdHlwZSBNb2RpZmllclNleHAgPVxuICB8IHN0cmluZ1xuICB8IFtQYXRoU2V4cCwgTG9jU2V4cD9dXG4gIHwgW1BhdGhTZXhwLCBBU1R2MS5FeHByZXNzaW9uW10sIExvY1NleHA/XVxuICB8IFtQYXRoU2V4cCwgQVNUdjEuRXhwcmVzc2lvbltdLCBEaWN0PEFTVHYxLkV4cHJlc3Npb24+LCBMb2NTZXhwP107XG5cbmV4cG9ydCB0eXBlIEF0dHJTZXhwID0gW3N0cmluZywgQVNUdjEuQXR0ck5vZGVbJ3ZhbHVlJ10gfCBzdHJpbmcsIExvY1NleHA/XTtcblxuZXhwb3J0IHR5cGUgTG9jU2V4cCA9IFsnbG9jJywgU291cmNlTG9jYXRpb25dO1xuXG5leHBvcnQgdHlwZSBFbGVtZW50Q29tbWVudCA9IEFTVHYxLk11c3RhY2hlQ29tbWVudFN0YXRlbWVudCB8IFNvdXJjZUxvY2F0aW9uIHwgc3RyaW5nO1xuXG5leHBvcnQgdHlwZSBTZXhwVmFsdWUgPVxuICB8IHN0cmluZ1xuICB8IEFTVHYxLkV4cHJlc3Npb25bXVxuICB8IERpY3Q8QVNUdjEuRXhwcmVzc2lvbj5cbiAgfCBMb2NTZXhwXG4gIHwgUGF0aFNleHBcbiAgfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRFbGVtZW50T3B0aW9ucyB7XG4gIHRhZzogc3RyaW5nO1xuICBzZWxmQ2xvc2luZzogYm9vbGVhbjtcbiAgYXR0cnM6IEFTVHYxLkF0dHJOb2RlW107XG4gIG1vZGlmaWVyczogQVNUdjEuRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50W107XG4gIGNoaWxkcmVuOiBBU1R2MS5TdGF0ZW1lbnRbXTtcbiAgY29tbWVudHM6IEVsZW1lbnRDb21tZW50W107XG4gIGJsb2NrUGFyYW1zOiBzdHJpbmdbXTtcbiAgbG9jOiBTb3VyY2VTcGFuO1xufVxuXG4vLyBFeHByZXNzaW9uc1xuXG5mdW5jdGlvbiBoZWFkVG9TdHJpbmcoaGVhZDogQVNUdjEuUGF0aEhlYWQpOiB7IG9yaWdpbmFsOiBzdHJpbmc7IHBhcnRzOiBzdHJpbmdbXSB9IHtcbiAgc3dpdGNoIChoZWFkLnR5cGUpIHtcbiAgICBjYXNlICdBdEhlYWQnOlxuICAgICAgcmV0dXJuIHsgb3JpZ2luYWw6IGhlYWQubmFtZSwgcGFydHM6IFtoZWFkLm5hbWVdIH07XG4gICAgY2FzZSAnVGhpc0hlYWQnOlxuICAgICAgcmV0dXJuIHsgb3JpZ2luYWw6IGB0aGlzYCwgcGFydHM6IFtdIH07XG4gICAgY2FzZSAnVmFySGVhZCc6XG4gICAgICByZXR1cm4geyBvcmlnaW5hbDogaGVhZC5uYW1lLCBwYXJ0czogW2hlYWQubmFtZV0gfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgQnVpbGRlcnMoKTtcbiIsImltcG9ydCB7IE9wdGlvbiB9IGZyb20gJ0BnbGltbWVyL2ludGVyZmFjZXMnO1xuaW1wb3J0IHsgYXNzZXJ0LCBhc3NpZ24sIGV4cGVjdCB9IGZyb20gJ0BnbGltbWVyL3V0aWwnO1xuaW1wb3J0IHtcbiAgRW50aXR5UGFyc2VyLFxuICBFdmVudGVkVG9rZW5pemVyLFxuICBIVE1MNU5hbWVkQ2hhclJlZnMgYXMgbmFtZWRDaGFyUmVmcyxcbn0gZnJvbSAnc2ltcGxlLWh0bWwtdG9rZW5pemVyJztcblxuaW1wb3J0IHsgU291cmNlUG9zaXRpb24gfSBmcm9tICcuL3NvdXJjZS9sb2NhdGlvbic7XG5pbXBvcnQgeyBTb3VyY2UgfSBmcm9tICcuL3NvdXJjZS9zb3VyY2UnO1xuaW1wb3J0IHsgU291cmNlT2Zmc2V0LCBTb3VyY2VTcGFuIH0gZnJvbSAnLi9zb3VyY2Uvc3Bhbic7XG5pbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuL3YxL2FwaSc7XG5pbXBvcnQgKiBhcyBIQlMgZnJvbSAnLi92MS9oYW5kbGViYXJzLWFzdCc7XG5cbmV4cG9ydCB0eXBlIFBhcnNlck5vZGVCdWlsZGVyPE4gZXh0ZW5kcyB7IGxvYzogU291cmNlU3BhbiB9PiA9IE9taXQ8TiwgJ2xvYyc+ICYge1xuICBsb2M6IFNvdXJjZU9mZnNldDtcbn07XG5cbmV4cG9ydCB0eXBlIEVsZW1lbnQgPSBBU1R2MS5UZW1wbGF0ZSB8IEFTVHYxLkJsb2NrIHwgQVNUdjEuRWxlbWVudE5vZGU7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFnPFQgZXh0ZW5kcyAnU3RhcnRUYWcnIHwgJ0VuZFRhZyc+IHtcbiAgcmVhZG9ubHkgdHlwZTogVDtcbiAgbmFtZTogc3RyaW5nO1xuICByZWFkb25seSBhdHRyaWJ1dGVzOiBBU1R2MS5BdHRyTm9kZVtdO1xuICByZWFkb25seSBtb2RpZmllcnM6IEFTVHYxLkVsZW1lbnRNb2RpZmllclN0YXRlbWVudFtdO1xuICByZWFkb25seSBjb21tZW50czogQVNUdjEuTXVzdGFjaGVDb21tZW50U3RhdGVtZW50W107XG4gIHNlbGZDbG9zaW5nOiBib29sZWFuO1xuICByZWFkb25seSBsb2M6IFNvdXJjZVNwYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXR0cmlidXRlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBjdXJyZW50UGFydDogQVNUdjEuVGV4dE5vZGUgfCBudWxsO1xuICBwYXJ0czogKEFTVHYxLk11c3RhY2hlU3RhdGVtZW50IHwgQVNUdjEuVGV4dE5vZGUpW107XG4gIGlzUXVvdGVkOiBib29sZWFuO1xuICBpc0R5bmFtaWM6IGJvb2xlYW47XG4gIHN0YXJ0OiBTb3VyY2VPZmZzZXQ7XG4gIHZhbHVlU3BhbjogU291cmNlU3Bhbjtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFBhcnNlciB7XG4gIHByb3RlY3RlZCBlbGVtZW50U3RhY2s6IEVsZW1lbnRbXSA9IFtdO1xuICBwcml2YXRlIGxpbmVzOiBzdHJpbmdbXTtcbiAgcmVhZG9ubHkgc291cmNlOiBTb3VyY2U7XG4gIHB1YmxpYyBjdXJyZW50QXR0cmlidXRlOiBPcHRpb248QXR0cmlidXRlPiA9IG51bGw7XG4gIHB1YmxpYyBjdXJyZW50Tm9kZTogT3B0aW9uPFxuICAgIFJlYWRvbmx5PFxuICAgICAgfCBQYXJzZXJOb2RlQnVpbGRlcjxBU1R2MS5Db21tZW50U3RhdGVtZW50PlxuICAgICAgfCBBU1R2MS5UZXh0Tm9kZVxuICAgICAgfCBQYXJzZXJOb2RlQnVpbGRlcjxUYWc8J1N0YXJ0VGFnJz4+XG4gICAgICB8IFBhcnNlck5vZGVCdWlsZGVyPFRhZzwnRW5kVGFnJz4+XG4gICAgPlxuICA+ID0gbnVsbDtcbiAgcHVibGljIHRva2VuaXplcjogRXZlbnRlZFRva2VuaXplcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBzb3VyY2U6IFNvdXJjZSxcbiAgICBlbnRpdHlQYXJzZXIgPSBuZXcgRW50aXR5UGFyc2VyKG5hbWVkQ2hhclJlZnMpLFxuICAgIG1vZGU6ICdwcmVjb21waWxlJyB8ICdjb2RlbW9kJyA9ICdwcmVjb21waWxlJ1xuICApIHtcbiAgICB0aGlzLnNvdXJjZSA9IHNvdXJjZTtcbiAgICB0aGlzLmxpbmVzID0gc291cmNlLnNvdXJjZS5zcGxpdCgvKD86XFxyXFxuP3xcXG4pL2cpO1xuICAgIHRoaXMudG9rZW5pemVyID0gbmV3IEV2ZW50ZWRUb2tlbml6ZXIodGhpcywgZW50aXR5UGFyc2VyLCBtb2RlKTtcbiAgfVxuXG4gIG9mZnNldCgpOiBTb3VyY2VPZmZzZXQge1xuICAgIGxldCB7IGxpbmUsIGNvbHVtbiB9ID0gdGhpcy50b2tlbml6ZXI7XG4gICAgcmV0dXJuIHRoaXMuc291cmNlLm9mZnNldEZvcihsaW5lLCBjb2x1bW4pO1xuICB9XG5cbiAgcG9zKHsgbGluZSwgY29sdW1uIH06IFNvdXJjZVBvc2l0aW9uKTogU291cmNlT2Zmc2V0IHtcbiAgICByZXR1cm4gdGhpcy5zb3VyY2Uub2Zmc2V0Rm9yKGxpbmUsIGNvbHVtbik7XG4gIH1cblxuICBmaW5pc2g8VCBleHRlbmRzIHsgbG9jOiBTb3VyY2VTcGFuIH0+KG5vZGU6IFBhcnNlck5vZGVCdWlsZGVyPFQ+KTogVCB7XG4gICAgcmV0dXJuIChhc3NpZ24oe30sIG5vZGUsIHtcbiAgICAgIGxvYzogbm9kZS5sb2MudW50aWwodGhpcy5vZmZzZXQoKSksXG4gICAgfSBhcyBjb25zdCkgYXMgdW5rbm93bikgYXMgVDtcblxuICAgIC8vIG5vZGUubG9jID0gbm9kZS5sb2Mud2l0aEVuZChlbmQpO1xuICB9XG5cbiAgYWJzdHJhY3QgUHJvZ3JhbShub2RlOiBIQlMuUHJvZ3JhbSk6IEhCUy5PdXRwdXQ8J1Byb2dyYW0nPjtcbiAgYWJzdHJhY3QgTXVzdGFjaGVTdGF0ZW1lbnQobm9kZTogSEJTLk11c3RhY2hlU3RhdGVtZW50KTogSEJTLk91dHB1dDwnTXVzdGFjaGVTdGF0ZW1lbnQnPjtcbiAgYWJzdHJhY3QgRGVjb3JhdG9yKG5vZGU6IEhCUy5EZWNvcmF0b3IpOiBIQlMuT3V0cHV0PCdEZWNvcmF0b3InPjtcbiAgYWJzdHJhY3QgQmxvY2tTdGF0ZW1lbnQobm9kZTogSEJTLkJsb2NrU3RhdGVtZW50KTogSEJTLk91dHB1dDwnQmxvY2tTdGF0ZW1lbnQnPjtcbiAgYWJzdHJhY3QgRGVjb3JhdG9yQmxvY2sobm9kZTogSEJTLkRlY29yYXRvckJsb2NrKTogSEJTLk91dHB1dDwnRGVjb3JhdG9yQmxvY2snPjtcbiAgYWJzdHJhY3QgUGFydGlhbFN0YXRlbWVudChub2RlOiBIQlMuUGFydGlhbFN0YXRlbWVudCk6IEhCUy5PdXRwdXQ8J1BhcnRpYWxTdGF0ZW1lbnQnPjtcbiAgYWJzdHJhY3QgUGFydGlhbEJsb2NrU3RhdGVtZW50KFxuICAgIG5vZGU6IEhCUy5QYXJ0aWFsQmxvY2tTdGF0ZW1lbnRcbiAgKTogSEJTLk91dHB1dDwnUGFydGlhbEJsb2NrU3RhdGVtZW50Jz47XG4gIGFic3RyYWN0IENvbnRlbnRTdGF0ZW1lbnQobm9kZTogSEJTLkNvbnRlbnRTdGF0ZW1lbnQpOiBIQlMuT3V0cHV0PCdDb250ZW50U3RhdGVtZW50Jz47XG4gIGFic3RyYWN0IENvbW1lbnRTdGF0ZW1lbnQobm9kZTogSEJTLkNvbW1lbnRTdGF0ZW1lbnQpOiBIQlMuT3V0cHV0PCdDb21tZW50U3RhdGVtZW50Jz47XG4gIGFic3RyYWN0IFN1YkV4cHJlc3Npb24obm9kZTogSEJTLlN1YkV4cHJlc3Npb24pOiBIQlMuT3V0cHV0PCdTdWJFeHByZXNzaW9uJz47XG4gIGFic3RyYWN0IFBhdGhFeHByZXNzaW9uKG5vZGU6IEhCUy5QYXRoRXhwcmVzc2lvbik6IEhCUy5PdXRwdXQ8J1BhdGhFeHByZXNzaW9uJz47XG4gIGFic3RyYWN0IFN0cmluZ0xpdGVyYWwobm9kZTogSEJTLlN0cmluZ0xpdGVyYWwpOiBIQlMuT3V0cHV0PCdTdHJpbmdMaXRlcmFsJz47XG4gIGFic3RyYWN0IEJvb2xlYW5MaXRlcmFsKG5vZGU6IEhCUy5Cb29sZWFuTGl0ZXJhbCk6IEhCUy5PdXRwdXQ8J0Jvb2xlYW5MaXRlcmFsJz47XG4gIGFic3RyYWN0IE51bWJlckxpdGVyYWwobm9kZTogSEJTLk51bWJlckxpdGVyYWwpOiBIQlMuT3V0cHV0PCdOdW1iZXJMaXRlcmFsJz47XG4gIGFic3RyYWN0IFVuZGVmaW5lZExpdGVyYWwobm9kZTogSEJTLlVuZGVmaW5lZExpdGVyYWwpOiBIQlMuT3V0cHV0PCdVbmRlZmluZWRMaXRlcmFsJz47XG4gIGFic3RyYWN0IE51bGxMaXRlcmFsKG5vZGU6IEhCUy5OdWxsTGl0ZXJhbCk6IEhCUy5PdXRwdXQ8J051bGxMaXRlcmFsJz47XG5cbiAgYWJzdHJhY3QgcmVzZXQoKTogdm9pZDtcbiAgYWJzdHJhY3QgZmluaXNoRGF0YSgpOiB2b2lkO1xuICBhYnN0cmFjdCB0YWdPcGVuKCk6IHZvaWQ7XG4gIGFic3RyYWN0IGJlZ2luRGF0YSgpOiB2b2lkO1xuICBhYnN0cmFjdCBhcHBlbmRUb0RhdGEoY2hhcjogc3RyaW5nKTogdm9pZDtcbiAgYWJzdHJhY3QgYmVnaW5TdGFydFRhZygpOiB2b2lkO1xuICBhYnN0cmFjdCBhcHBlbmRUb1RhZ05hbWUoY2hhcjogc3RyaW5nKTogdm9pZDtcbiAgYWJzdHJhY3QgYmVnaW5BdHRyaWJ1dGUoKTogdm9pZDtcbiAgYWJzdHJhY3QgYXBwZW5kVG9BdHRyaWJ1dGVOYW1lKGNoYXI6IHN0cmluZyk6IHZvaWQ7XG4gIGFic3RyYWN0IGJlZ2luQXR0cmlidXRlVmFsdWUocXVvdGVkOiBib29sZWFuKTogdm9pZDtcbiAgYWJzdHJhY3QgYXBwZW5kVG9BdHRyaWJ1dGVWYWx1ZShjaGFyOiBzdHJpbmcpOiB2b2lkO1xuICBhYnN0cmFjdCBmaW5pc2hBdHRyaWJ1dGVWYWx1ZSgpOiB2b2lkO1xuICBhYnN0cmFjdCBtYXJrVGFnQXNTZWxmQ2xvc2luZygpOiB2b2lkO1xuICBhYnN0cmFjdCBiZWdpbkVuZFRhZygpOiB2b2lkO1xuICBhYnN0cmFjdCBmaW5pc2hUYWcoKTogdm9pZDtcbiAgYWJzdHJhY3QgYmVnaW5Db21tZW50KCk6IHZvaWQ7XG4gIGFic3RyYWN0IGFwcGVuZFRvQ29tbWVudERhdGEoY2hhcjogc3RyaW5nKTogdm9pZDtcbiAgYWJzdHJhY3QgZmluaXNoQ29tbWVudCgpOiB2b2lkO1xuICBhYnN0cmFjdCByZXBvcnRTeW50YXhFcnJvcihlcnJvcjogc3RyaW5nKTogdm9pZDtcblxuICBnZXQgY3VycmVudEF0dHIoKTogQXR0cmlidXRlIHtcbiAgICByZXR1cm4gZXhwZWN0KHRoaXMuY3VycmVudEF0dHJpYnV0ZSwgJ2V4cGVjdGVkIGF0dHJpYnV0ZScpO1xuICB9XG5cbiAgZ2V0IGN1cnJlbnRUYWcoKTogUGFyc2VyTm9kZUJ1aWxkZXI8VGFnPCdTdGFydFRhZycgfCAnRW5kVGFnJz4+IHtcbiAgICBsZXQgbm9kZSA9IHRoaXMuY3VycmVudE5vZGU7XG4gICAgYXNzZXJ0KG5vZGUgJiYgKG5vZGUudHlwZSA9PT0gJ1N0YXJ0VGFnJyB8fCBub2RlLnR5cGUgPT09ICdFbmRUYWcnKSwgJ2V4cGVjdGVkIHRhZycpO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgZ2V0IGN1cnJlbnRTdGFydFRhZygpOiBQYXJzZXJOb2RlQnVpbGRlcjxUYWc8J1N0YXJ0VGFnJz4+IHtcbiAgICBsZXQgbm9kZSA9IHRoaXMuY3VycmVudE5vZGU7XG4gICAgYXNzZXJ0KG5vZGUgJiYgbm9kZS50eXBlID09PSAnU3RhcnRUYWcnLCAnZXhwZWN0ZWQgc3RhcnQgdGFnJyk7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBnZXQgY3VycmVudEVuZFRhZygpOiBQYXJzZXJOb2RlQnVpbGRlcjxUYWc8J0VuZFRhZyc+PiB7XG4gICAgbGV0IG5vZGUgPSB0aGlzLmN1cnJlbnROb2RlO1xuICAgIGFzc2VydChub2RlICYmIG5vZGUudHlwZSA9PT0gJ0VuZFRhZycsICdleHBlY3RlZCBlbmQgdGFnJyk7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBnZXQgY3VycmVudENvbW1lbnQoKTogUGFyc2VyTm9kZUJ1aWxkZXI8QVNUdjEuQ29tbWVudFN0YXRlbWVudD4ge1xuICAgIGxldCBub2RlID0gdGhpcy5jdXJyZW50Tm9kZTtcbiAgICBhc3NlcnQobm9kZSAmJiBub2RlLnR5cGUgPT09ICdDb21tZW50U3RhdGVtZW50JywgJ2V4cGVjdGVkIGEgY29tbWVudCcpO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgZ2V0IGN1cnJlbnREYXRhKCk6IEFTVHYxLlRleHROb2RlIHtcbiAgICBsZXQgbm9kZSA9IHRoaXMuY3VycmVudE5vZGU7XG4gICAgYXNzZXJ0KG5vZGUgJiYgbm9kZS50eXBlID09PSAnVGV4dE5vZGUnLCAnZXhwZWN0ZWQgYSB0ZXh0IG5vZGUnKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIGFjY2VwdFRlbXBsYXRlKG5vZGU6IEhCUy5Qcm9ncmFtKTogQVNUdjEuVGVtcGxhdGUge1xuICAgIHJldHVybiB0aGlzW25vZGUudHlwZSBhcyAnUHJvZ3JhbSddKG5vZGUpIGFzIEFTVHYxLlRlbXBsYXRlO1xuICB9XG5cbiAgYWNjZXB0Tm9kZShub2RlOiBIQlMuUHJvZ3JhbSk6IEFTVHYxLkJsb2NrIHwgQVNUdjEuVGVtcGxhdGU7XG4gIGFjY2VwdE5vZGU8VSBleHRlbmRzIEhCUy5Ob2RlIHwgQVNUdjEuTm9kZT4obm9kZTogSEJTLk5vZGUpOiBVO1xuICBhY2NlcHROb2RlPFQgZXh0ZW5kcyBIQlMuTm9kZVR5cGU+KG5vZGU6IEhCUy5Ob2RlPFQ+KTogSEJTLk91dHB1dDxUPiB7XG4gICAgcmV0dXJuICh0aGlzW25vZGUudHlwZSBhcyBUXSBhcyAobm9kZTogSEJTLk5vZGU8VD4pID0+IEhCUy5PdXRwdXQ8VD4pKG5vZGUpO1xuICB9XG5cbiAgY3VycmVudEVsZW1lbnQoKTogRWxlbWVudCB7XG4gICAgcmV0dXJuIHRoaXMuZWxlbWVudFN0YWNrW3RoaXMuZWxlbWVudFN0YWNrLmxlbmd0aCAtIDFdO1xuICB9XG5cbiAgc291cmNlRm9yTm9kZShub2RlOiBIQlMuTm9kZSwgZW5kTm9kZT86IHsgbG9jOiBIQlMuU291cmNlTG9jYXRpb24gfSk6IHN0cmluZyB7XG4gICAgbGV0IGZpcnN0TGluZSA9IG5vZGUubG9jLnN0YXJ0LmxpbmUgLSAxO1xuICAgIGxldCBjdXJyZW50TGluZSA9IGZpcnN0TGluZSAtIDE7XG4gICAgbGV0IGZpcnN0Q29sdW1uID0gbm9kZS5sb2Muc3RhcnQuY29sdW1uO1xuICAgIGxldCBzdHJpbmcgPSBbXTtcbiAgICBsZXQgbGluZTtcblxuICAgIGxldCBsYXN0TGluZTogbnVtYmVyO1xuICAgIGxldCBsYXN0Q29sdW1uOiBudW1iZXI7XG5cbiAgICBpZiAoZW5kTm9kZSkge1xuICAgICAgbGFzdExpbmUgPSBlbmROb2RlLmxvYy5lbmQubGluZSAtIDE7XG4gICAgICBsYXN0Q29sdW1uID0gZW5kTm9kZS5sb2MuZW5kLmNvbHVtbjtcbiAgICB9IGVsc2Uge1xuICAgICAgbGFzdExpbmUgPSBub2RlLmxvYy5lbmQubGluZSAtIDE7XG4gICAgICBsYXN0Q29sdW1uID0gbm9kZS5sb2MuZW5kLmNvbHVtbjtcbiAgICB9XG5cbiAgICB3aGlsZSAoY3VycmVudExpbmUgPCBsYXN0TGluZSkge1xuICAgICAgY3VycmVudExpbmUrKztcbiAgICAgIGxpbmUgPSB0aGlzLmxpbmVzW2N1cnJlbnRMaW5lXTtcblxuICAgICAgaWYgKGN1cnJlbnRMaW5lID09PSBmaXJzdExpbmUpIHtcbiAgICAgICAgaWYgKGZpcnN0TGluZSA9PT0gbGFzdExpbmUpIHtcbiAgICAgICAgICBzdHJpbmcucHVzaChsaW5lLnNsaWNlKGZpcnN0Q29sdW1uLCBsYXN0Q29sdW1uKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyaW5nLnB1c2gobGluZS5zbGljZShmaXJzdENvbHVtbikpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGN1cnJlbnRMaW5lID09PSBsYXN0TGluZSkge1xuICAgICAgICBzdHJpbmcucHVzaChsaW5lLnNsaWNlKDAsIGxhc3RDb2x1bW4pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0cmluZy5wdXNoKGxpbmUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdHJpbmcuam9pbignXFxuJyk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE9wdGlvbiwgUmVjYXN0IH0gZnJvbSAnQGdsaW1tZXIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBUb2tlbml6ZXJTdGF0ZSB9IGZyb20gJ3NpbXBsZS1odG1sLXRva2VuaXplcic7XG5cbmltcG9ydCB7IFBhcnNlciwgUGFyc2VyTm9kZUJ1aWxkZXIsIFRhZyB9IGZyb20gJy4uL3BhcnNlcic7XG5pbXBvcnQgeyBOT05fRVhJU1RFTlRfTE9DQVRJT04gfSBmcm9tICcuLi9zb3VyY2UvbG9jYXRpb24nO1xuaW1wb3J0IHsgZ2VuZXJhdGVTeW50YXhFcnJvciB9IGZyb20gJy4uL3N5bnRheC1lcnJvcic7XG5pbXBvcnQgeyBhcHBlbmRDaGlsZCwgaXNIQlNMaXRlcmFsLCBwcmludExpdGVyYWwgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuLi92MS9hcGknO1xuaW1wb3J0ICogYXMgSEJTIGZyb20gJy4uL3YxL2hhbmRsZWJhcnMtYXN0JztcbmltcG9ydCB7IFBhdGhFeHByZXNzaW9uSW1wbFYxIH0gZnJvbSAnLi4vdjEvbGVnYWN5LWludGVyb3AnO1xuaW1wb3J0IGIgZnJvbSAnLi4vdjEvcGFyc2VyLWJ1aWxkZXJzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEhhbmRsZWJhcnNOb2RlVmlzaXRvcnMgZXh0ZW5kcyBQYXJzZXIge1xuICBhYnN0cmFjdCBhcHBlbmRUb0NvbW1lbnREYXRhKHM6IHN0cmluZyk6IHZvaWQ7XG4gIGFic3RyYWN0IGJlZ2luQXR0cmlidXRlVmFsdWUocXVvdGVkOiBib29sZWFuKTogdm9pZDtcbiAgYWJzdHJhY3QgZmluaXNoQXR0cmlidXRlVmFsdWUoKTogdm9pZDtcblxuICBwcml2YXRlIGdldCBpc1RvcExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmVsZW1lbnRTdGFjay5sZW5ndGggPT09IDA7XG4gIH1cblxuICBQcm9ncmFtKHByb2dyYW06IEhCUy5Qcm9ncmFtKTogQVNUdjEuQmxvY2s7XG4gIFByb2dyYW0ocHJvZ3JhbTogSEJTLlByb2dyYW0pOiBBU1R2MS5UZW1wbGF0ZTtcbiAgUHJvZ3JhbShwcm9ncmFtOiBIQlMuUHJvZ3JhbSk6IEFTVHYxLlRlbXBsYXRlIHwgQVNUdjEuQmxvY2s7XG4gIFByb2dyYW0ocHJvZ3JhbTogSEJTLlByb2dyYW0pOiBBU1R2MS5CbG9jayB8IEFTVHYxLlRlbXBsYXRlIHtcbiAgICBsZXQgYm9keTogQVNUdjEuU3RhdGVtZW50W10gPSBbXTtcbiAgICBsZXQgbm9kZTtcblxuICAgIGlmICh0aGlzLmlzVG9wTGV2ZWwpIHtcbiAgICAgIG5vZGUgPSBiLnRlbXBsYXRlKHtcbiAgICAgICAgYm9keSxcbiAgICAgICAgYmxvY2tQYXJhbXM6IHByb2dyYW0uYmxvY2tQYXJhbXMsXG4gICAgICAgIGxvYzogdGhpcy5zb3VyY2Uuc3BhbkZvcihwcm9ncmFtLmxvYyksXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZSA9IGIuYmxvY2tJdHNlbGYoe1xuICAgICAgICBib2R5LFxuICAgICAgICBibG9ja1BhcmFtczogcHJvZ3JhbS5ibG9ja1BhcmFtcyxcbiAgICAgICAgY2hhaW5lZDogcHJvZ3JhbS5jaGFpbmVkLFxuICAgICAgICBsb2M6IHRoaXMuc291cmNlLnNwYW5Gb3IocHJvZ3JhbS5sb2MpLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbGV0IGksXG4gICAgICBsID0gcHJvZ3JhbS5ib2R5Lmxlbmd0aDtcblxuICAgIHRoaXMuZWxlbWVudFN0YWNrLnB1c2gobm9kZSk7XG5cbiAgICBpZiAobCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuZWxlbWVudFN0YWNrLnBvcCgpIGFzIEFTVHYxLkJsb2NrIHwgQVNUdjEuVGVtcGxhdGU7XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgdGhpcy5hY2NlcHROb2RlKHByb2dyYW0uYm9keVtpXSk7XG4gICAgfVxuXG4gICAgLy8gRW5zdXJlIHRoYXQgdGhhdCB0aGUgZWxlbWVudCBzdGFjayBpcyBiYWxhbmNlZCBwcm9wZXJseS5cbiAgICBsZXQgcG9wcGVkTm9kZSA9IHRoaXMuZWxlbWVudFN0YWNrLnBvcCgpO1xuICAgIGlmIChwb3BwZWROb2RlICE9PSBub2RlKSB7XG4gICAgICBsZXQgZWxlbWVudE5vZGUgPSBwb3BwZWROb2RlIGFzIEFTVHYxLkVsZW1lbnROb2RlO1xuXG4gICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKGBVbmNsb3NlZCBlbGVtZW50IFxcYCR7ZWxlbWVudE5vZGUudGFnfVxcYGAsIGVsZW1lbnROb2RlLmxvYyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBCbG9ja1N0YXRlbWVudChibG9jazogSEJTLkJsb2NrU3RhdGVtZW50KTogQVNUdjEuQmxvY2tTdGF0ZW1lbnQgfCB2b2lkIHtcbiAgICBpZiAodGhpcy50b2tlbml6ZXIuc3RhdGUgPT09IFRva2VuaXplclN0YXRlLmNvbW1lbnQpIHtcbiAgICAgIHRoaXMuYXBwZW5kVG9Db21tZW50RGF0YSh0aGlzLnNvdXJjZUZvck5vZGUoYmxvY2spKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnRva2VuaXplci5zdGF0ZSAhPT0gVG9rZW5pemVyU3RhdGUuZGF0YSAmJlxuICAgICAgdGhpcy50b2tlbml6ZXIuc3RhdGUgIT09IFRva2VuaXplclN0YXRlLmJlZm9yZURhdGFcbiAgICApIHtcbiAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICdBIGJsb2NrIG1heSBvbmx5IGJlIHVzZWQgaW5zaWRlIGFuIEhUTUwgZWxlbWVudCBvciBhbm90aGVyIGJsb2NrLicsXG4gICAgICAgIHRoaXMuc291cmNlLnNwYW5Gb3IoYmxvY2subG9jKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBsZXQgeyBwYXRoLCBwYXJhbXMsIGhhc2ggfSA9IGFjY2VwdENhbGxOb2Rlcyh0aGlzLCBibG9jayk7XG5cbiAgICAvLyBUaGVzZSBhcmUgYnVncyBpbiBIYW5kbGViYXJzIHVwc3RyZWFtXG4gICAgaWYgKCFibG9jay5wcm9ncmFtLmxvYykge1xuICAgICAgYmxvY2sucHJvZ3JhbS5sb2MgPSBOT05fRVhJU1RFTlRfTE9DQVRJT047XG4gICAgfVxuXG4gICAgaWYgKGJsb2NrLmludmVyc2UgJiYgIWJsb2NrLmludmVyc2UubG9jKSB7XG4gICAgICBibG9jay5pbnZlcnNlLmxvYyA9IE5PTl9FWElTVEVOVF9MT0NBVElPTjtcbiAgICB9XG5cbiAgICBsZXQgcHJvZ3JhbSA9IHRoaXMuUHJvZ3JhbShibG9jay5wcm9ncmFtKTtcbiAgICBsZXQgaW52ZXJzZSA9IGJsb2NrLmludmVyc2UgPyB0aGlzLlByb2dyYW0oYmxvY2suaW52ZXJzZSkgOiBudWxsO1xuXG4gICAgbGV0IG5vZGUgPSBiLmJsb2NrKHtcbiAgICAgIHBhdGgsXG4gICAgICBwYXJhbXMsXG4gICAgICBoYXNoLFxuICAgICAgZGVmYXVsdEJsb2NrOiBwcm9ncmFtLFxuICAgICAgZWxzZUJsb2NrOiBpbnZlcnNlLFxuICAgICAgbG9jOiB0aGlzLnNvdXJjZS5zcGFuRm9yKGJsb2NrLmxvYyksXG4gICAgICBvcGVuU3RyaXA6IGJsb2NrLm9wZW5TdHJpcCxcbiAgICAgIGludmVyc2VTdHJpcDogYmxvY2suaW52ZXJzZVN0cmlwLFxuICAgICAgY2xvc2VTdHJpcDogYmxvY2suY2xvc2VTdHJpcCxcbiAgICB9KTtcblxuICAgIGxldCBwYXJlbnRQcm9ncmFtID0gdGhpcy5jdXJyZW50RWxlbWVudCgpO1xuXG4gICAgYXBwZW5kQ2hpbGQocGFyZW50UHJvZ3JhbSwgbm9kZSk7XG4gIH1cblxuICBNdXN0YWNoZVN0YXRlbWVudChyYXdNdXN0YWNoZTogSEJTLk11c3RhY2hlU3RhdGVtZW50KTogQVNUdjEuTXVzdGFjaGVTdGF0ZW1lbnQgfCB2b2lkIHtcbiAgICBsZXQgeyB0b2tlbml6ZXIgfSA9IHRoaXM7XG5cbiAgICBpZiAodG9rZW5pemVyLnN0YXRlID09PSAnY29tbWVudCcpIHtcbiAgICAgIHRoaXMuYXBwZW5kVG9Db21tZW50RGF0YSh0aGlzLnNvdXJjZUZvck5vZGUocmF3TXVzdGFjaGUpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgbXVzdGFjaGU6IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50O1xuICAgIGxldCB7IGVzY2FwZWQsIGxvYywgc3RyaXAgfSA9IHJhd011c3RhY2hlO1xuXG4gICAgaWYgKGlzSEJTTGl0ZXJhbChyYXdNdXN0YWNoZS5wYXRoKSkge1xuICAgICAgbXVzdGFjaGUgPSBiLm11c3RhY2hlKHtcbiAgICAgICAgcGF0aDogdGhpcy5hY2NlcHROb2RlPEFTVHYxLkxpdGVyYWw+KHJhd011c3RhY2hlLnBhdGgpLFxuICAgICAgICBwYXJhbXM6IFtdLFxuICAgICAgICBoYXNoOiBiLmhhc2goW10sIHRoaXMuc291cmNlLnNwYW5Gb3IocmF3TXVzdGFjaGUucGF0aC5sb2MpLmNvbGxhcHNlKCdlbmQnKSksXG4gICAgICAgIHRydXN0aW5nOiAhZXNjYXBlZCxcbiAgICAgICAgbG9jOiB0aGlzLnNvdXJjZS5zcGFuRm9yKGxvYyksXG4gICAgICAgIHN0cmlwLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCB7IHBhdGgsIHBhcmFtcywgaGFzaCB9ID0gYWNjZXB0Q2FsbE5vZGVzKFxuICAgICAgICB0aGlzLFxuICAgICAgICByYXdNdXN0YWNoZSBhcyBIQlMuTXVzdGFjaGVTdGF0ZW1lbnQgJiB7XG4gICAgICAgICAgcGF0aDogSEJTLlBhdGhFeHByZXNzaW9uIHwgSEJTLlN1YkV4cHJlc3Npb247XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgICBtdXN0YWNoZSA9IGIubXVzdGFjaGUoe1xuICAgICAgICBwYXRoLFxuICAgICAgICBwYXJhbXMsXG4gICAgICAgIGhhc2gsXG4gICAgICAgIHRydXN0aW5nOiAhZXNjYXBlZCxcbiAgICAgICAgbG9jOiB0aGlzLnNvdXJjZS5zcGFuRm9yKGxvYyksXG4gICAgICAgIHN0cmlwLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3dpdGNoICh0b2tlbml6ZXIuc3RhdGUpIHtcbiAgICAgIC8vIFRhZyBoZWxwZXJzXG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLnRhZ09wZW46XG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLnRhZ05hbWU6XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoYENhbm5vdCB1c2UgbXVzdGFjaGVzIGluIGFuIGVsZW1lbnRzIHRhZ25hbWVgLCBtdXN0YWNoZS5sb2MpO1xuXG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWU6XG4gICAgICAgIGFkZEVsZW1lbnRNb2RpZmllcih0aGlzLmN1cnJlbnRTdGFydFRhZywgbXVzdGFjaGUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYXR0cmlidXRlTmFtZTpcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVOYW1lOlxuICAgICAgICB0aGlzLmJlZ2luQXR0cmlidXRlVmFsdWUoZmFsc2UpO1xuICAgICAgICB0aGlzLmZpbmlzaEF0dHJpYnV0ZVZhbHVlKCk7XG4gICAgICAgIGFkZEVsZW1lbnRNb2RpZmllcih0aGlzLmN1cnJlbnRTdGFydFRhZywgbXVzdGFjaGUpO1xuICAgICAgICB0b2tlbml6ZXIudHJhbnNpdGlvblRvKFRva2VuaXplclN0YXRlLmJlZm9yZUF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYWZ0ZXJBdHRyaWJ1dGVWYWx1ZVF1b3RlZDpcbiAgICAgICAgYWRkRWxlbWVudE1vZGlmaWVyKHRoaXMuY3VycmVudFN0YXJ0VGFnLCBtdXN0YWNoZSk7XG4gICAgICAgIHRva2VuaXplci50cmFuc2l0aW9uVG8oVG9rZW5pemVyU3RhdGUuYmVmb3JlQXR0cmlidXRlTmFtZSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBBdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmJlZm9yZUF0dHJpYnV0ZVZhbHVlOlxuICAgICAgICB0aGlzLmJlZ2luQXR0cmlidXRlVmFsdWUoZmFsc2UpO1xuICAgICAgICB0aGlzLmFwcGVuZER5bmFtaWNBdHRyaWJ1dGVWYWx1ZVBhcnQobXVzdGFjaGUpO1xuICAgICAgICB0b2tlbml6ZXIudHJhbnNpdGlvblRvKFRva2VuaXplclN0YXRlLmF0dHJpYnV0ZVZhbHVlVW5xdW90ZWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgVG9rZW5pemVyU3RhdGUuYXR0cmlidXRlVmFsdWVEb3VibGVRdW90ZWQ6XG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmF0dHJpYnV0ZVZhbHVlU2luZ2xlUXVvdGVkOlxuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5hdHRyaWJ1dGVWYWx1ZVVucXVvdGVkOlxuICAgICAgICB0aGlzLmFwcGVuZER5bmFtaWNBdHRyaWJ1dGVWYWx1ZVBhcnQobXVzdGFjaGUpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gVE9ETzogT25seSBhcHBlbmQgY2hpbGQgd2hlbiB0aGUgdG9rZW5pemVyIHN0YXRlIG1ha2VzXG4gICAgICAvLyBzZW5zZSB0byBkbyBzbywgb3RoZXJ3aXNlIHRocm93IGFuIGVycm9yLlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXBwZW5kQ2hpbGQodGhpcy5jdXJyZW50RWxlbWVudCgpLCBtdXN0YWNoZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG11c3RhY2hlO1xuICB9XG5cbiAgYXBwZW5kRHluYW1pY0F0dHJpYnV0ZVZhbHVlUGFydChwYXJ0OiBBU1R2MS5NdXN0YWNoZVN0YXRlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuZmluYWxpemVUZXh0UGFydCgpO1xuICAgIGxldCBhdHRyID0gdGhpcy5jdXJyZW50QXR0cjtcbiAgICBhdHRyLmlzRHluYW1pYyA9IHRydWU7XG4gICAgYXR0ci5wYXJ0cy5wdXNoKHBhcnQpO1xuICB9XG5cbiAgZmluYWxpemVUZXh0UGFydCgpOiB2b2lkIHtcbiAgICBsZXQgYXR0ciA9IHRoaXMuY3VycmVudEF0dHI7XG4gICAgbGV0IHRleHQgPSBhdHRyLmN1cnJlbnRQYXJ0O1xuICAgIGlmICh0ZXh0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmN1cnJlbnRBdHRyLnBhcnRzLnB1c2godGV4dCk7XG4gICAgICB0aGlzLnN0YXJ0VGV4dFBhcnQoKTtcbiAgICB9XG4gIH1cblxuICBzdGFydFRleHRQYXJ0KCk6IHZvaWQge1xuICAgIHRoaXMuY3VycmVudEF0dHIuY3VycmVudFBhcnQgPSBudWxsO1xuICB9XG5cbiAgQ29udGVudFN0YXRlbWVudChjb250ZW50OiBIQlMuQ29udGVudFN0YXRlbWVudCk6IHZvaWQge1xuICAgIHVwZGF0ZVRva2VuaXplckxvY2F0aW9uKHRoaXMudG9rZW5pemVyLCBjb250ZW50KTtcblxuICAgIHRoaXMudG9rZW5pemVyLnRva2VuaXplUGFydChjb250ZW50LnZhbHVlKTtcbiAgICB0aGlzLnRva2VuaXplci5mbHVzaERhdGEoKTtcbiAgfVxuXG4gIENvbW1lbnRTdGF0ZW1lbnQocmF3Q29tbWVudDogSEJTLkNvbW1lbnRTdGF0ZW1lbnQpOiBPcHRpb248QVNUdjEuTXVzdGFjaGVDb21tZW50U3RhdGVtZW50PiB7XG4gICAgbGV0IHsgdG9rZW5pemVyIH0gPSB0aGlzO1xuXG4gICAgaWYgKHRva2VuaXplci5zdGF0ZSA9PT0gVG9rZW5pemVyU3RhdGUuY29tbWVudCkge1xuICAgICAgdGhpcy5hcHBlbmRUb0NvbW1lbnREYXRhKHRoaXMuc291cmNlRm9yTm9kZShyYXdDb21tZW50KSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgeyB2YWx1ZSwgbG9jIH0gPSByYXdDb21tZW50O1xuICAgIGxldCBjb21tZW50ID0gYi5tdXN0YWNoZUNvbW1lbnQodmFsdWUsIHRoaXMuc291cmNlLnNwYW5Gb3IobG9jKSk7XG5cbiAgICBzd2l0Y2ggKHRva2VuaXplci5zdGF0ZSkge1xuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5iZWZvcmVBdHRyaWJ1dGVOYW1lOlxuICAgICAgY2FzZSBUb2tlbml6ZXJTdGF0ZS5hZnRlckF0dHJpYnV0ZU5hbWU6XG4gICAgICAgIHRoaXMuY3VycmVudFN0YXJ0VGFnLmNvbW1lbnRzLnB1c2goY29tbWVudCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmJlZm9yZURhdGE6XG4gICAgICBjYXNlIFRva2VuaXplclN0YXRlLmRhdGE6XG4gICAgICAgIGFwcGVuZENoaWxkKHRoaXMuY3VycmVudEVsZW1lbnQoKSwgY29tbWVudCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgICAgIGBVc2luZyBhIEhhbmRsZWJhcnMgY29tbWVudCB3aGVuIGluIHRoZSBcXGAke3Rva2VuaXplclsnc3RhdGUnXX1cXGAgc3RhdGUgaXMgbm90IHN1cHBvcnRlZGAsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihyYXdDb21tZW50LmxvYylcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29tbWVudDtcbiAgfVxuXG4gIFBhcnRpYWxTdGF0ZW1lbnQocGFydGlhbDogSEJTLlBhcnRpYWxTdGF0ZW1lbnQpOiBuZXZlciB7XG4gICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgIGBIYW5kbGViYXJzIHBhcnRpYWxzIGFyZSBub3Qgc3VwcG9ydGVkYCxcbiAgICAgIHRoaXMuc291cmNlLnNwYW5Gb3IocGFydGlhbC5sb2MpXG4gICAgKTtcbiAgfVxuXG4gIFBhcnRpYWxCbG9ja1N0YXRlbWVudChwYXJ0aWFsQmxvY2s6IEhCUy5QYXJ0aWFsQmxvY2tTdGF0ZW1lbnQpOiBuZXZlciB7XG4gICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgIGBIYW5kbGViYXJzIHBhcnRpYWwgYmxvY2tzIGFyZSBub3Qgc3VwcG9ydGVkYCxcbiAgICAgIHRoaXMuc291cmNlLnNwYW5Gb3IocGFydGlhbEJsb2NrLmxvYylcbiAgICApO1xuICB9XG5cbiAgRGVjb3JhdG9yKGRlY29yYXRvcjogSEJTLkRlY29yYXRvcik6IG5ldmVyIHtcbiAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgYEhhbmRsZWJhcnMgZGVjb3JhdG9ycyBhcmUgbm90IHN1cHBvcnRlZGAsXG4gICAgICB0aGlzLnNvdXJjZS5zcGFuRm9yKGRlY29yYXRvci5sb2MpXG4gICAgKTtcbiAgfVxuXG4gIERlY29yYXRvckJsb2NrKGRlY29yYXRvckJsb2NrOiBIQlMuRGVjb3JhdG9yQmxvY2spOiBuZXZlciB7XG4gICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgIGBIYW5kbGViYXJzIGRlY29yYXRvciBibG9ja3MgYXJlIG5vdCBzdXBwb3J0ZWRgLFxuICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihkZWNvcmF0b3JCbG9jay5sb2MpXG4gICAgKTtcbiAgfVxuXG4gIFN1YkV4cHJlc3Npb24oc2V4cHI6IEhCUy5TdWJFeHByZXNzaW9uKTogQVNUdjEuU3ViRXhwcmVzc2lvbiB7XG4gICAgbGV0IHsgcGF0aCwgcGFyYW1zLCBoYXNoIH0gPSBhY2NlcHRDYWxsTm9kZXModGhpcywgc2V4cHIpO1xuICAgIHJldHVybiBiLnNleHByKHsgcGF0aCwgcGFyYW1zLCBoYXNoLCBsb2M6IHRoaXMuc291cmNlLnNwYW5Gb3Ioc2V4cHIubG9jKSB9KTtcbiAgfVxuXG4gIFBhdGhFeHByZXNzaW9uKHBhdGg6IEhCUy5QYXRoRXhwcmVzc2lvbik6IEFTVHYxLlBhdGhFeHByZXNzaW9uIHtcbiAgICBsZXQgeyBvcmlnaW5hbCB9ID0gcGF0aDtcbiAgICBsZXQgcGFydHM6IHN0cmluZ1tdO1xuXG4gICAgaWYgKG9yaWdpbmFsLmluZGV4T2YoJy8nKSAhPT0gLTEpIHtcbiAgICAgIGlmIChvcmlnaW5hbC5zbGljZSgwLCAyKSA9PT0gJy4vJykge1xuICAgICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgICAgIGBVc2luZyBcIi4vXCIgaXMgbm90IHN1cHBvcnRlZCBpbiBHbGltbWVyIGFuZCB1bm5lY2Vzc2FyeWAsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcmlnaW5hbC5zbGljZSgwLCAzKSA9PT0gJy4uLycpIHtcbiAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICBgQ2hhbmdpbmcgY29udGV4dCB1c2luZyBcIi4uL1wiIGlzIG5vdCBzdXBwb3J0ZWQgaW4gR2xpbW1lcmAsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcmlnaW5hbC5pbmRleE9mKCcuJykgIT09IC0xKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYE1peGluZyAnLicgYW5kICcvJyBpbiBwYXRocyBpcyBub3Qgc3VwcG9ydGVkIGluIEdsaW1tZXI7IHVzZSBvbmx5ICcuJyB0byBzZXBhcmF0ZSBwcm9wZXJ0eSBwYXRoc2AsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHBhcnRzID0gW3BhdGgucGFydHMuam9pbignLycpXTtcbiAgICB9IGVsc2UgaWYgKG9yaWdpbmFsID09PSAnLicpIHtcbiAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgIGAnLicgaXMgbm90IGEgc3VwcG9ydGVkIHBhdGggaW4gR2xpbW1lcjsgY2hlY2sgZm9yIGEgcGF0aCB3aXRoIGEgdHJhaWxpbmcgJy4nYCxcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcnRzID0gcGF0aC5wYXJ0cztcbiAgICB9XG5cbiAgICBsZXQgdGhpc0hlYWQgPSBmYWxzZTtcblxuICAgIC8vIFRoaXMgaXMgdG8gZml4IGEgYnVnIGluIHRoZSBIYW5kbGViYXJzIEFTVCB3aGVyZSB0aGUgcGF0aCBleHByZXNzaW9ucyBpblxuICAgIC8vIGB7e3RoaXMuZm9vfX1gIChhbmQgc2ltaWxhcmx5IGB7e2Zvby1iYXIgdGhpcy5mb28gbmFtZWQ9dGhpcy5mb299fWAgZXRjKVxuICAgIC8vIGFyZSBzaW1wbHkgdHVybmVkIGludG8gYHt7Zm9vfX1gLiBUaGUgZml4IGlzIHRvIHB1c2ggaXQgYmFjayBvbnRvIHRoZVxuICAgIC8vIHBhcnRzIGFycmF5IGFuZCBsZXQgdGhlIHJ1bnRpbWUgc2VlIHRoZSBkaWZmZXJlbmNlLiBIb3dldmVyLCB3ZSBjYW5ub3RcbiAgICAvLyBzaW1wbHkgdXNlIHRoZSBzdHJpbmcgYHRoaXNgIGFzIGl0IG1lYW5zIGxpdGVyYWxseSB0aGUgcHJvcGVydHkgY2FsbGVkXG4gICAgLy8gXCJ0aGlzXCIgaW4gdGhlIGN1cnJlbnQgY29udGV4dCAoaXQgY2FuIGJlIGV4cHJlc3NlZCBpbiB0aGUgc3ludGF4IGFzXG4gICAgLy8gYHt7W3RoaXNdfX1gLCB3aGVyZSB0aGUgc3F1YXJlIGJyYWNrZXQgYXJlIGdlbmVyYWxseSBmb3IgdGhpcyBraW5kIG9mXG4gICAgLy8gZXNjYXBpbmcg4oCTIHN1Y2ggYXMgYHt7Zm9vLltcImJhci5iYXpcIl19fWAgd291bGQgbWVhbiBsb29rdXAgYSBwcm9wZXJ0eVxuICAgIC8vIG5hbWVkIGxpdGVyYWxseSBcImJhci5iYXpcIiBvbiBgdGhpcy5mb29gKS4gQnkgY29udmVudGlvbiwgd2UgdXNlIGBudWxsYFxuICAgIC8vIGZvciB0aGlzIHB1cnBvc2UuXG4gICAgaWYgKG9yaWdpbmFsLm1hdGNoKC9edGhpcyhcXC4uKyk/JC8pKSB7XG4gICAgICB0aGlzSGVhZCA9IHRydWU7XG4gICAgfVxuXG4gICAgbGV0IHBhdGhIZWFkOiBBU1R2MS5QYXRoSGVhZDtcbiAgICBpZiAodGhpc0hlYWQpIHtcbiAgICAgIHBhdGhIZWFkID0ge1xuICAgICAgICB0eXBlOiAnVGhpc0hlYWQnLFxuICAgICAgICBsb2M6IHtcbiAgICAgICAgICBzdGFydDogcGF0aC5sb2Muc3RhcnQsXG4gICAgICAgICAgZW5kOiB7IGxpbmU6IHBhdGgubG9jLnN0YXJ0LmxpbmUsIGNvbHVtbjogcGF0aC5sb2Muc3RhcnQuY29sdW1uICsgNCB9LFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHBhdGguZGF0YSkge1xuICAgICAgbGV0IGhlYWQgPSBwYXJ0cy5zaGlmdCgpO1xuXG4gICAgICBpZiAoaGVhZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYEF0dGVtcHRlZCB0byBwYXJzZSBhIHBhdGggZXhwcmVzc2lvbiwgYnV0IGl0IHdhcyBub3QgdmFsaWQuIFBhdGhzIGJlZ2lubmluZyB3aXRoIEAgbXVzdCBzdGFydCB3aXRoIGEtei5gLFxuICAgICAgICAgIHRoaXMuc291cmNlLnNwYW5Gb3IocGF0aC5sb2MpXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHBhdGhIZWFkID0ge1xuICAgICAgICB0eXBlOiAnQXRIZWFkJyxcbiAgICAgICAgbmFtZTogYEAke2hlYWR9YCxcbiAgICAgICAgbG9jOiB7XG4gICAgICAgICAgc3RhcnQ6IHBhdGgubG9jLnN0YXJ0LFxuICAgICAgICAgIGVuZDogeyBsaW5lOiBwYXRoLmxvYy5zdGFydC5saW5lLCBjb2x1bW46IHBhdGgubG9jLnN0YXJ0LmNvbHVtbiArIGhlYWQubGVuZ3RoICsgMSB9LFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGhlYWQgPSBwYXJ0cy5zaGlmdCgpO1xuXG4gICAgICBpZiAoaGVhZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYEF0dGVtcHRlZCB0byBwYXJzZSBhIHBhdGggZXhwcmVzc2lvbiwgYnV0IGl0IHdhcyBub3QgdmFsaWQuIFBhdGhzIG11c3Qgc3RhcnQgd2l0aCBhLXogb3IgQS1aLmAsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcGF0aEhlYWQgPSB7XG4gICAgICAgIHR5cGU6ICdWYXJIZWFkJyxcbiAgICAgICAgbmFtZTogaGVhZCxcbiAgICAgICAgbG9jOiB7XG4gICAgICAgICAgc3RhcnQ6IHBhdGgubG9jLnN0YXJ0LFxuICAgICAgICAgIGVuZDogeyBsaW5lOiBwYXRoLmxvYy5zdGFydC5saW5lLCBjb2x1bW46IHBhdGgubG9jLnN0YXJ0LmNvbHVtbiArIGhlYWQubGVuZ3RoIH0sXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUGF0aEV4cHJlc3Npb25JbXBsVjEocGF0aC5vcmlnaW5hbCwgcGF0aEhlYWQsIHBhcnRzLCB0aGlzLnNvdXJjZS5zcGFuRm9yKHBhdGgubG9jKSk7XG4gIH1cblxuICBIYXNoKGhhc2g6IEhCUy5IYXNoKTogQVNUdjEuSGFzaCB7XG4gICAgbGV0IHBhaXJzOiBBU1R2MS5IYXNoUGFpcltdID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGhhc2gucGFpcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBwYWlyID0gaGFzaC5wYWlyc1tpXTtcbiAgICAgIHBhaXJzLnB1c2goXG4gICAgICAgIGIucGFpcih7XG4gICAgICAgICAga2V5OiBwYWlyLmtleSxcbiAgICAgICAgICB2YWx1ZTogdGhpcy5hY2NlcHROb2RlKHBhaXIudmFsdWUpLFxuICAgICAgICAgIGxvYzogdGhpcy5zb3VyY2Uuc3BhbkZvcihwYWlyLmxvYyksXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBiLmhhc2gocGFpcnMsIHRoaXMuc291cmNlLnNwYW5Gb3IoaGFzaC5sb2MpKTtcbiAgfVxuXG4gIFN0cmluZ0xpdGVyYWwoc3RyaW5nOiBIQlMuU3RyaW5nTGl0ZXJhbCk6IEFTVHYxLlN0cmluZ0xpdGVyYWwge1xuICAgIHJldHVybiBiLmxpdGVyYWwoeyB0eXBlOiAnU3RyaW5nTGl0ZXJhbCcsIHZhbHVlOiBzdHJpbmcudmFsdWUsIGxvYzogc3RyaW5nLmxvYyB9KTtcbiAgfVxuXG4gIEJvb2xlYW5MaXRlcmFsKGJvb2xlYW46IEhCUy5Cb29sZWFuTGl0ZXJhbCk6IEFTVHYxLkJvb2xlYW5MaXRlcmFsIHtcbiAgICByZXR1cm4gYi5saXRlcmFsKHsgdHlwZTogJ0Jvb2xlYW5MaXRlcmFsJywgdmFsdWU6IGJvb2xlYW4udmFsdWUsIGxvYzogYm9vbGVhbi5sb2MgfSk7XG4gIH1cblxuICBOdW1iZXJMaXRlcmFsKG51bWJlcjogSEJTLk51bWJlckxpdGVyYWwpOiBBU1R2MS5OdW1iZXJMaXRlcmFsIHtcbiAgICByZXR1cm4gYi5saXRlcmFsKHsgdHlwZTogJ051bWJlckxpdGVyYWwnLCB2YWx1ZTogbnVtYmVyLnZhbHVlLCBsb2M6IG51bWJlci5sb2MgfSk7XG4gIH1cblxuICBVbmRlZmluZWRMaXRlcmFsKHVuZGVmOiBIQlMuVW5kZWZpbmVkTGl0ZXJhbCk6IEFTVHYxLlVuZGVmaW5lZExpdGVyYWwge1xuICAgIHJldHVybiBiLmxpdGVyYWwoeyB0eXBlOiAnVW5kZWZpbmVkTGl0ZXJhbCcsIHZhbHVlOiB1bmRlZmluZWQsIGxvYzogdW5kZWYubG9jIH0pO1xuICB9XG5cbiAgTnVsbExpdGVyYWwobnVsOiBIQlMuTnVsbExpdGVyYWwpOiBBU1R2MS5OdWxsTGl0ZXJhbCB7XG4gICAgcmV0dXJuIGIubGl0ZXJhbCh7IHR5cGU6ICdOdWxsTGl0ZXJhbCcsIHZhbHVlOiBudWxsLCBsb2M6IG51bC5sb2MgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlUmlnaHRTdHJpcHBlZE9mZnNldHMob3JpZ2luYWw6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuICBpZiAodmFsdWUgPT09ICcnKSB7XG4gICAgLy8gaWYgaXQgaXMgZW1wdHksIGp1c3QgcmV0dXJuIHRoZSBjb3VudCBvZiBuZXdsaW5lc1xuICAgIC8vIGluIG9yaWdpbmFsXG4gICAgcmV0dXJuIHtcbiAgICAgIGxpbmVzOiBvcmlnaW5hbC5zcGxpdCgnXFxuJykubGVuZ3RoIC0gMSxcbiAgICAgIGNvbHVtbnM6IDAsXG4gICAgfTtcbiAgfVxuXG4gIC8vIG90aGVyd2lzZSwgcmV0dXJuIHRoZSBudW1iZXIgb2YgbmV3bGluZXMgcHJpb3IgdG9cbiAgLy8gYHZhbHVlYFxuICBsZXQgZGlmZmVyZW5jZSA9IG9yaWdpbmFsLnNwbGl0KHZhbHVlKVswXTtcbiAgbGV0IGxpbmVzID0gZGlmZmVyZW5jZS5zcGxpdCgvXFxuLyk7XG4gIGxldCBsaW5lQ291bnQgPSBsaW5lcy5sZW5ndGggLSAxO1xuXG4gIHJldHVybiB7XG4gICAgbGluZXM6IGxpbmVDb3VudCxcbiAgICBjb2x1bW5zOiBsaW5lc1tsaW5lQ291bnRdLmxlbmd0aCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlVG9rZW5pemVyTG9jYXRpb24odG9rZW5pemVyOiBQYXJzZXJbJ3Rva2VuaXplciddLCBjb250ZW50OiBIQlMuQ29udGVudFN0YXRlbWVudCkge1xuICBsZXQgbGluZSA9IGNvbnRlbnQubG9jLnN0YXJ0LmxpbmU7XG4gIGxldCBjb2x1bW4gPSBjb250ZW50LmxvYy5zdGFydC5jb2x1bW47XG5cbiAgbGV0IG9mZnNldHMgPSBjYWxjdWxhdGVSaWdodFN0cmlwcGVkT2Zmc2V0cyhcbiAgICBjb250ZW50Lm9yaWdpbmFsIGFzIFJlY2FzdDxIQlMuU3RyaXBGbGFncywgc3RyaW5nPixcbiAgICBjb250ZW50LnZhbHVlXG4gICk7XG5cbiAgbGluZSA9IGxpbmUgKyBvZmZzZXRzLmxpbmVzO1xuICBpZiAob2Zmc2V0cy5saW5lcykge1xuICAgIGNvbHVtbiA9IG9mZnNldHMuY29sdW1ucztcbiAgfSBlbHNlIHtcbiAgICBjb2x1bW4gPSBjb2x1bW4gKyBvZmZzZXRzLmNvbHVtbnM7XG4gIH1cblxuICB0b2tlbml6ZXIubGluZSA9IGxpbmU7XG4gIHRva2VuaXplci5jb2x1bW4gPSBjb2x1bW47XG59XG5cbmZ1bmN0aW9uIGFjY2VwdENhbGxOb2RlcyhcbiAgY29tcGlsZXI6IEhhbmRsZWJhcnNOb2RlVmlzaXRvcnMsXG4gIG5vZGU6IHtcbiAgICBwYXRoOlxuICAgICAgfCBIQlMuUGF0aEV4cHJlc3Npb25cbiAgICAgIHwgSEJTLlN1YkV4cHJlc3Npb25cbiAgICAgIHwgSEJTLlN0cmluZ0xpdGVyYWxcbiAgICAgIHwgSEJTLlVuZGVmaW5lZExpdGVyYWxcbiAgICAgIHwgSEJTLk51bGxMaXRlcmFsXG4gICAgICB8IEhCUy5OdW1iZXJMaXRlcmFsXG4gICAgICB8IEhCUy5Cb29sZWFuTGl0ZXJhbDtcbiAgICBwYXJhbXM6IEhCUy5FeHByZXNzaW9uW107XG4gICAgaGFzaDogSEJTLkhhc2g7XG4gIH1cbik6IHtcbiAgcGF0aDogQVNUdjEuUGF0aEV4cHJlc3Npb24gfCBBU1R2MS5TdWJFeHByZXNzaW9uO1xuICBwYXJhbXM6IEFTVHYxLkV4cHJlc3Npb25bXTtcbiAgaGFzaDogQVNUdjEuSGFzaDtcbn0ge1xuICBpZiAobm9kZS5wYXRoLnR5cGUuZW5kc1dpdGgoJ0xpdGVyYWwnKSkge1xuICAgIGNvbnN0IHBhdGggPSAobm9kZS5wYXRoIGFzIHVua25vd24pIGFzXG4gICAgICB8IEhCUy5TdHJpbmdMaXRlcmFsXG4gICAgICB8IEhCUy5VbmRlZmluZWRMaXRlcmFsXG4gICAgICB8IEhCUy5OdWxsTGl0ZXJhbFxuICAgICAgfCBIQlMuTnVtYmVyTGl0ZXJhbFxuICAgICAgfCBIQlMuQm9vbGVhbkxpdGVyYWw7XG5cbiAgICBsZXQgdmFsdWUgPSAnJztcbiAgICBpZiAocGF0aC50eXBlID09PSAnQm9vbGVhbkxpdGVyYWwnKSB7XG4gICAgICB2YWx1ZSA9IHBhdGgub3JpZ2luYWwudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKHBhdGgudHlwZSA9PT0gJ1N0cmluZ0xpdGVyYWwnKSB7XG4gICAgICB2YWx1ZSA9IGBcIiR7cGF0aC5vcmlnaW5hbH1cImA7XG4gICAgfSBlbHNlIGlmIChwYXRoLnR5cGUgPT09ICdOdWxsTGl0ZXJhbCcpIHtcbiAgICAgIHZhbHVlID0gJ251bGwnO1xuICAgIH0gZWxzZSBpZiAocGF0aC50eXBlID09PSAnTnVtYmVyTGl0ZXJhbCcpIHtcbiAgICAgIHZhbHVlID0gcGF0aC52YWx1ZS50b1N0cmluZygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9ICd1bmRlZmluZWQnO1xuICAgIH1cbiAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgYCR7cGF0aC50eXBlfSBcIiR7XG4gICAgICAgIHBhdGgudHlwZSA9PT0gJ1N0cmluZ0xpdGVyYWwnID8gcGF0aC5vcmlnaW5hbCA6IHZhbHVlXG4gICAgICB9XCIgY2Fubm90IGJlIGNhbGxlZCBhcyBhIHN1Yi1leHByZXNzaW9uLCByZXBsYWNlICgke3ZhbHVlfSkgd2l0aCAke3ZhbHVlfWAsXG4gICAgICBjb21waWxlci5zb3VyY2Uuc3BhbkZvcihwYXRoLmxvYylcbiAgICApO1xuICB9XG5cbiAgbGV0IHBhdGggPVxuICAgIG5vZGUucGF0aC50eXBlID09PSAnUGF0aEV4cHJlc3Npb24nXG4gICAgICA/IGNvbXBpbGVyLlBhdGhFeHByZXNzaW9uKG5vZGUucGF0aClcbiAgICAgIDogY29tcGlsZXIuU3ViRXhwcmVzc2lvbigobm9kZS5wYXRoIGFzIHVua25vd24pIGFzIEhCUy5TdWJFeHByZXNzaW9uKTtcbiAgbGV0IHBhcmFtcyA9IG5vZGUucGFyYW1zID8gbm9kZS5wYXJhbXMubWFwKChlKSA9PiBjb21waWxlci5hY2NlcHROb2RlPEFTVHYxLkV4cHJlc3Npb24+KGUpKSA6IFtdO1xuXG4gIC8vIGlmIHRoZXJlIGlzIG5vIGhhc2gsIHBvc2l0aW9uIGl0IGFzIGEgY29sbGFwc2VkIG5vZGUgaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIGxhc3QgcGFyYW0gKG9yIHRoZVxuICAvLyBwYXRoLCBpZiB0aGVyZSBhcmUgYWxzbyBubyBwYXJhbXMpXG4gIGxldCBlbmQgPSBwYXJhbXMubGVuZ3RoID4gMCA/IHBhcmFtc1twYXJhbXMubGVuZ3RoIC0gMV0ubG9jIDogcGF0aC5sb2M7XG5cbiAgbGV0IGhhc2ggPSBub2RlLmhhc2hcbiAgICA/IGNvbXBpbGVyLkhhc2gobm9kZS5oYXNoKVxuICAgIDogKHtcbiAgICAgICAgdHlwZTogJ0hhc2gnLFxuICAgICAgICBwYWlyczogW10gYXMgQVNUdjEuSGFzaFBhaXJbXSxcbiAgICAgICAgbG9jOiBjb21waWxlci5zb3VyY2Uuc3BhbkZvcihlbmQpLmNvbGxhcHNlKCdlbmQnKSxcbiAgICAgIH0gYXMgY29uc3QpO1xuXG4gIHJldHVybiB7IHBhdGgsIHBhcmFtcywgaGFzaCB9O1xufVxuXG5mdW5jdGlvbiBhZGRFbGVtZW50TW9kaWZpZXIoXG4gIGVsZW1lbnQ6IFBhcnNlck5vZGVCdWlsZGVyPFRhZzwnU3RhcnRUYWcnPj4sXG4gIG11c3RhY2hlOiBBU1R2MS5NdXN0YWNoZVN0YXRlbWVudFxuKSB7XG4gIGxldCB7IHBhdGgsIHBhcmFtcywgaGFzaCwgbG9jIH0gPSBtdXN0YWNoZTtcblxuICBpZiAoaXNIQlNMaXRlcmFsKHBhdGgpKSB7XG4gICAgbGV0IG1vZGlmaWVyID0gYHt7JHtwcmludExpdGVyYWwocGF0aCl9fX1gO1xuICAgIGxldCB0YWcgPSBgPCR7ZWxlbWVudC5uYW1lfSAuLi4gJHttb2RpZmllcn0gLi4uYDtcblxuICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoYEluICR7dGFnfSwgJHttb2RpZmllcn0gaXMgbm90IGEgdmFsaWQgbW9kaWZpZXJgLCBtdXN0YWNoZS5sb2MpO1xuICB9XG5cbiAgbGV0IG1vZGlmaWVyID0gYi5lbGVtZW50TW9kaWZpZXIoeyBwYXRoLCBwYXJhbXMsIGhhc2gsIGxvYyB9KTtcbiAgZWxlbWVudC5tb2RpZmllcnMucHVzaChtb2RpZmllcik7XG59XG4iLCJpbXBvcnQgeyBPcHRpb24gfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcbmltcG9ydCB7IGFzc2VydFByZXNlbnQsIGFzc2lnbiB9IGZyb20gJ0BnbGltbWVyL3V0aWwnO1xuaW1wb3J0IHsgcGFyc2UsIHBhcnNlV2l0aG91dFByb2Nlc3NpbmcgfSBmcm9tICdAaGFuZGxlYmFycy9wYXJzZXInO1xuaW1wb3J0IHsgRW50aXR5UGFyc2VyIH0gZnJvbSAnc2ltcGxlLWh0bWwtdG9rZW5pemVyJztcblxuaW1wb3J0IHByaW50IGZyb20gJy4uL2dlbmVyYXRpb24vcHJpbnQnO1xuaW1wb3J0IHsgdm9pZE1hcCB9IGZyb20gJy4uL2dlbmVyYXRpb24vcHJpbnRlcic7XG5pbXBvcnQgeyBUYWcgfSBmcm9tICcuLi9wYXJzZXInO1xuaW1wb3J0IHsgU291cmNlIH0gZnJvbSAnLi4vc291cmNlL3NvdXJjZSc7XG5pbXBvcnQgeyBTb3VyY2VPZmZzZXQsIFNvdXJjZVNwYW4gfSBmcm9tICcuLi9zb3VyY2Uvc3Bhbic7XG5pbXBvcnQgeyBnZW5lcmF0ZVN5bnRheEVycm9yIH0gZnJvbSAnLi4vc3ludGF4LWVycm9yJztcbmltcG9ydCB0cmF2ZXJzZSBmcm9tICcuLi90cmF2ZXJzYWwvdHJhdmVyc2UnO1xuaW1wb3J0IHsgTm9kZVZpc2l0b3IgfSBmcm9tICcuLi90cmF2ZXJzYWwvdmlzaXRvcic7XG5pbXBvcnQgV2Fsa2VyIGZyb20gJy4uL3RyYXZlcnNhbC93YWxrZXInO1xuaW1wb3J0IHsgYXBwZW5kQ2hpbGQsIHBhcnNlRWxlbWVudEJsb2NrUGFyYW1zIH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0ICogYXMgQVNUdjEgZnJvbSAnLi4vdjEvYXBpJztcbmltcG9ydCAqIGFzIEhCUyBmcm9tICcuLi92MS9oYW5kbGViYXJzLWFzdCc7XG5pbXBvcnQgYiBmcm9tICcuLi92MS9wYXJzZXItYnVpbGRlcnMnO1xuaW1wb3J0IHB1YmxpY0J1aWxkZXIgZnJvbSAnLi4vdjEvcHVibGljLWJ1aWxkZXJzJztcbmltcG9ydCB7IEhhbmRsZWJhcnNOb2RlVmlzaXRvcnMgfSBmcm9tICcuL2hhbmRsZWJhcnMtbm9kZS12aXNpdG9ycyc7XG5cbmV4cG9ydCBjbGFzcyBUb2tlbml6ZXJFdmVudEhhbmRsZXJzIGV4dGVuZHMgSGFuZGxlYmFyc05vZGVWaXNpdG9ycyB7XG4gIHByaXZhdGUgdGFnT3BlbkxpbmUgPSAwO1xuICBwcml2YXRlIHRhZ09wZW5Db2x1bW4gPSAwO1xuXG4gIHJlc2V0KCk6IHZvaWQge1xuICAgIHRoaXMuY3VycmVudE5vZGUgPSBudWxsO1xuICB9XG5cbiAgLy8gQ29tbWVudFxuXG4gIGJlZ2luQ29tbWVudCgpOiB2b2lkIHtcbiAgICB0aGlzLmN1cnJlbnROb2RlID0gYi5jb21tZW50KCcnLCB0aGlzLnNvdXJjZS5vZmZzZXRGb3IodGhpcy50YWdPcGVuTGluZSwgdGhpcy50YWdPcGVuQ29sdW1uKSk7XG4gIH1cblxuICBhcHBlbmRUb0NvbW1lbnREYXRhKGNoYXI6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuY3VycmVudENvbW1lbnQudmFsdWUgKz0gY2hhcjtcbiAgfVxuXG4gIGZpbmlzaENvbW1lbnQoKTogdm9pZCB7XG4gICAgYXBwZW5kQ2hpbGQodGhpcy5jdXJyZW50RWxlbWVudCgpLCB0aGlzLmZpbmlzaCh0aGlzLmN1cnJlbnRDb21tZW50KSk7XG4gIH1cblxuICAvLyBEYXRhXG5cbiAgYmVnaW5EYXRhKCk6IHZvaWQge1xuICAgIHRoaXMuY3VycmVudE5vZGUgPSBiLnRleHQoe1xuICAgICAgY2hhcnM6ICcnLFxuICAgICAgbG9jOiB0aGlzLm9mZnNldCgpLmNvbGxhcHNlZCgpLFxuICAgIH0pO1xuICB9XG5cbiAgYXBwZW5kVG9EYXRhKGNoYXI6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuY3VycmVudERhdGEuY2hhcnMgKz0gY2hhcjtcbiAgfVxuXG4gIGZpbmlzaERhdGEoKTogdm9pZCB7XG4gICAgdGhpcy5jdXJyZW50RGF0YS5sb2MgPSB0aGlzLmN1cnJlbnREYXRhLmxvYy53aXRoRW5kKHRoaXMub2Zmc2V0KCkpO1xuXG4gICAgYXBwZW5kQ2hpbGQodGhpcy5jdXJyZW50RWxlbWVudCgpLCB0aGlzLmN1cnJlbnREYXRhKTtcbiAgfVxuXG4gIC8vIFRhZ3MgLSBiYXNpY1xuXG4gIHRhZ09wZW4oKTogdm9pZCB7XG4gICAgdGhpcy50YWdPcGVuTGluZSA9IHRoaXMudG9rZW5pemVyLmxpbmU7XG4gICAgdGhpcy50YWdPcGVuQ29sdW1uID0gdGhpcy50b2tlbml6ZXIuY29sdW1uO1xuICB9XG5cbiAgYmVnaW5TdGFydFRhZygpOiB2b2lkIHtcbiAgICB0aGlzLmN1cnJlbnROb2RlID0ge1xuICAgICAgdHlwZTogJ1N0YXJ0VGFnJyxcbiAgICAgIG5hbWU6ICcnLFxuICAgICAgYXR0cmlidXRlczogW10sXG4gICAgICBtb2RpZmllcnM6IFtdLFxuICAgICAgY29tbWVudHM6IFtdLFxuICAgICAgc2VsZkNsb3Npbmc6IGZhbHNlLFxuICAgICAgbG9jOiB0aGlzLnNvdXJjZS5vZmZzZXRGb3IodGhpcy50YWdPcGVuTGluZSwgdGhpcy50YWdPcGVuQ29sdW1uKSxcbiAgICB9O1xuICB9XG5cbiAgYmVnaW5FbmRUYWcoKTogdm9pZCB7XG4gICAgdGhpcy5jdXJyZW50Tm9kZSA9IHtcbiAgICAgIHR5cGU6ICdFbmRUYWcnLFxuICAgICAgbmFtZTogJycsXG4gICAgICBhdHRyaWJ1dGVzOiBbXSxcbiAgICAgIG1vZGlmaWVyczogW10sXG4gICAgICBjb21tZW50czogW10sXG4gICAgICBzZWxmQ2xvc2luZzogZmFsc2UsXG4gICAgICBsb2M6IHRoaXMuc291cmNlLm9mZnNldEZvcih0aGlzLnRhZ09wZW5MaW5lLCB0aGlzLnRhZ09wZW5Db2x1bW4pLFxuICAgIH07XG4gIH1cblxuICBmaW5pc2hUYWcoKTogdm9pZCB7XG4gICAgbGV0IHRhZyA9IHRoaXMuZmluaXNoKHRoaXMuY3VycmVudFRhZyk7XG5cbiAgICBpZiAodGFnLnR5cGUgPT09ICdTdGFydFRhZycpIHtcbiAgICAgIHRoaXMuZmluaXNoU3RhcnRUYWcoKTtcblxuICAgICAgaWYgKHRhZy5uYW1lID09PSAnOicpIHtcbiAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICAnSW52YWxpZCBuYW1lZCBibG9jayBuYW1lZCBkZXRlY3RlZCwgeW91IG1heSBoYXZlIGNyZWF0ZWQgYSBuYW1lZCBibG9jayB3aXRob3V0IGEgbmFtZSwgb3IgeW91IG1heSBoYXZlIGJlZ2FuIHlvdXIgbmFtZSB3aXRoIGEgbnVtYmVyLiBOYW1lZCBibG9ja3MgbXVzdCBoYXZlIG5hbWVzIHRoYXQgYXJlIGF0IGxlYXN0IG9uZSBjaGFyYWN0ZXIgbG9uZywgYW5kIGJlZ2luIHdpdGggYSBsb3dlciBjYXNlIGxldHRlcicsXG4gICAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcih7XG4gICAgICAgICAgICBzdGFydDogdGhpcy5jdXJyZW50VGFnLmxvYy50b0pTT04oKSxcbiAgICAgICAgICAgIGVuZDogdGhpcy5vZmZzZXQoKS50b0pTT04oKSxcbiAgICAgICAgICB9KVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAodm9pZE1hcFt0YWcubmFtZV0gfHwgdGFnLnNlbGZDbG9zaW5nKSB7XG4gICAgICAgIHRoaXMuZmluaXNoRW5kVGFnKHRydWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGFnLnR5cGUgPT09ICdFbmRUYWcnKSB7XG4gICAgICB0aGlzLmZpbmlzaEVuZFRhZyhmYWxzZSk7XG4gICAgfVxuICB9XG5cbiAgZmluaXNoU3RhcnRUYWcoKTogdm9pZCB7XG4gICAgbGV0IHsgbmFtZSwgYXR0cmlidXRlczogYXR0cnMsIG1vZGlmaWVycywgY29tbWVudHMsIHNlbGZDbG9zaW5nLCBsb2MgfSA9IHRoaXMuZmluaXNoKFxuICAgICAgdGhpcy5jdXJyZW50U3RhcnRUYWdcbiAgICApO1xuXG4gICAgbGV0IGVsZW1lbnQgPSBiLmVsZW1lbnQoe1xuICAgICAgdGFnOiBuYW1lLFxuICAgICAgc2VsZkNsb3NpbmcsXG4gICAgICBhdHRycyxcbiAgICAgIG1vZGlmaWVycyxcbiAgICAgIGNvbW1lbnRzLFxuICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgYmxvY2tQYXJhbXM6IFtdLFxuICAgICAgbG9jLFxuICAgIH0pO1xuICAgIHRoaXMuZWxlbWVudFN0YWNrLnB1c2goZWxlbWVudCk7XG4gIH1cblxuICBmaW5pc2hFbmRUYWcoaXNWb2lkOiBib29sZWFuKTogdm9pZCB7XG4gICAgbGV0IHRhZyA9IHRoaXMuZmluaXNoKHRoaXMuY3VycmVudFRhZyk7XG5cbiAgICBsZXQgZWxlbWVudCA9IHRoaXMuZWxlbWVudFN0YWNrLnBvcCgpIGFzIEFTVHYxLkVsZW1lbnROb2RlO1xuICAgIGxldCBwYXJlbnQgPSB0aGlzLmN1cnJlbnRFbGVtZW50KCk7XG5cbiAgICB0aGlzLnZhbGlkYXRlRW5kVGFnKHRhZywgZWxlbWVudCwgaXNWb2lkKTtcblxuICAgIGVsZW1lbnQubG9jID0gZWxlbWVudC5sb2Mud2l0aEVuZCh0aGlzLm9mZnNldCgpKTtcbiAgICBwYXJzZUVsZW1lbnRCbG9ja1BhcmFtcyhlbGVtZW50KTtcbiAgICBhcHBlbmRDaGlsZChwYXJlbnQsIGVsZW1lbnQpO1xuICB9XG5cbiAgbWFya1RhZ0FzU2VsZkNsb3NpbmcoKTogdm9pZCB7XG4gICAgdGhpcy5jdXJyZW50VGFnLnNlbGZDbG9zaW5nID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIFRhZ3MgLSBuYW1lXG5cbiAgYXBwZW5kVG9UYWdOYW1lKGNoYXI6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuY3VycmVudFRhZy5uYW1lICs9IGNoYXI7XG4gIH1cblxuICAvLyBUYWdzIC0gYXR0cmlidXRlc1xuXG4gIGJlZ2luQXR0cmlidXRlKCk6IHZvaWQge1xuICAgIGxldCBvZmZzZXQgPSB0aGlzLm9mZnNldCgpO1xuXG4gICAgdGhpcy5jdXJyZW50QXR0cmlidXRlID0ge1xuICAgICAgbmFtZTogJycsXG4gICAgICBwYXJ0czogW10sXG4gICAgICBjdXJyZW50UGFydDogbnVsbCxcbiAgICAgIGlzUXVvdGVkOiBmYWxzZSxcbiAgICAgIGlzRHluYW1pYzogZmFsc2UsXG4gICAgICBzdGFydDogb2Zmc2V0LFxuICAgICAgdmFsdWVTcGFuOiBvZmZzZXQuY29sbGFwc2VkKCksXG4gICAgfTtcbiAgfVxuXG4gIGFwcGVuZFRvQXR0cmlidXRlTmFtZShjaGFyOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmN1cnJlbnRBdHRyLm5hbWUgKz0gY2hhcjtcbiAgfVxuXG4gIGJlZ2luQXR0cmlidXRlVmFsdWUoaXNRdW90ZWQ6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICB0aGlzLmN1cnJlbnRBdHRyLmlzUXVvdGVkID0gaXNRdW90ZWQ7XG4gICAgdGhpcy5zdGFydFRleHRQYXJ0KCk7XG4gICAgdGhpcy5jdXJyZW50QXR0ci52YWx1ZVNwYW4gPSB0aGlzLm9mZnNldCgpLmNvbGxhcHNlZCgpO1xuICB9XG5cbiAgYXBwZW5kVG9BdHRyaWJ1dGVWYWx1ZShjaGFyOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBsZXQgcGFydHMgPSB0aGlzLmN1cnJlbnRBdHRyLnBhcnRzO1xuICAgIGxldCBsYXN0UGFydCA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xuXG4gICAgbGV0IGN1cnJlbnQgPSB0aGlzLmN1cnJlbnRBdHRyLmN1cnJlbnRQYXJ0O1xuXG4gICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgIGN1cnJlbnQuY2hhcnMgKz0gY2hhcjtcblxuICAgICAgLy8gdXBkYXRlIGVuZCBsb2NhdGlvbiBmb3IgZWFjaCBhZGRlZCBjaGFyXG4gICAgICBjdXJyZW50LmxvYyA9IGN1cnJlbnQubG9jLndpdGhFbmQodGhpcy5vZmZzZXQoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGluaXRpYWxseSBhc3N1bWUgdGhlIHRleHQgbm9kZSBpcyBhIHNpbmdsZSBjaGFyXG4gICAgICBsZXQgbG9jOiBTb3VyY2VPZmZzZXQgPSB0aGlzLm9mZnNldCgpO1xuXG4gICAgICAvLyB0aGUgdG9rZW5pemVyIGxpbmUvY29sdW1uIGhhdmUgYWxyZWFkeSBiZWVuIGFkdmFuY2VkLCBjb3JyZWN0IGxvY2F0aW9uIGluZm9cbiAgICAgIGlmIChjaGFyID09PSAnXFxuJykge1xuICAgICAgICBsb2MgPSBsYXN0UGFydCA/IGxhc3RQYXJ0LmxvYy5nZXRFbmQoKSA6IHRoaXMuY3VycmVudEF0dHIudmFsdWVTcGFuLmdldFN0YXJ0KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2MgPSBsb2MubW92ZSgtMSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY3VycmVudEF0dHIuY3VycmVudFBhcnQgPSBiLnRleHQoeyBjaGFyczogY2hhciwgbG9jOiBsb2MuY29sbGFwc2VkKCkgfSk7XG4gICAgfVxuICB9XG5cbiAgZmluaXNoQXR0cmlidXRlVmFsdWUoKTogdm9pZCB7XG4gICAgdGhpcy5maW5hbGl6ZVRleHRQYXJ0KCk7XG5cbiAgICBsZXQgdGFnID0gdGhpcy5jdXJyZW50VGFnO1xuICAgIGxldCB0b2tlbml6ZXJQb3MgPSB0aGlzLm9mZnNldCgpO1xuXG4gICAgaWYgKHRhZy50eXBlID09PSAnRW5kVGFnJykge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgYEludmFsaWQgZW5kIHRhZzogY2xvc2luZyB0YWcgbXVzdCBub3QgaGF2ZSBhdHRyaWJ1dGVzYCxcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3BhbkZvcih7IHN0YXJ0OiB0YWcubG9jLnRvSlNPTigpLCBlbmQ6IHRva2VuaXplclBvcy50b0pTT04oKSB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBsZXQgeyBuYW1lLCBwYXJ0cywgc3RhcnQsIGlzUXVvdGVkLCBpc0R5bmFtaWMsIHZhbHVlU3BhbiB9ID0gdGhpcy5jdXJyZW50QXR0cjtcbiAgICBsZXQgdmFsdWUgPSB0aGlzLmFzc2VtYmxlQXR0cmlidXRlVmFsdWUocGFydHMsIGlzUXVvdGVkLCBpc0R5bmFtaWMsIHN0YXJ0LnVudGlsKHRva2VuaXplclBvcykpO1xuICAgIHZhbHVlLmxvYyA9IHZhbHVlU3Bhbi53aXRoRW5kKHRva2VuaXplclBvcyk7XG5cbiAgICBsZXQgYXR0cmlidXRlID0gYi5hdHRyKHsgbmFtZSwgdmFsdWUsIGxvYzogc3RhcnQudW50aWwodG9rZW5pemVyUG9zKSB9KTtcblxuICAgIHRoaXMuY3VycmVudFN0YXJ0VGFnLmF0dHJpYnV0ZXMucHVzaChhdHRyaWJ1dGUpO1xuICB9XG5cbiAgcmVwb3J0U3ludGF4RXJyb3IobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihtZXNzYWdlLCB0aGlzLm9mZnNldCgpLmNvbGxhcHNlZCgpKTtcbiAgfVxuXG4gIGFzc2VtYmxlQ29uY2F0ZW5hdGVkVmFsdWUoXG4gICAgcGFydHM6IChBU1R2MS5NdXN0YWNoZVN0YXRlbWVudCB8IEFTVHYxLlRleHROb2RlKVtdXG4gICk6IEFTVHYxLkNvbmNhdFN0YXRlbWVudCB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IHBhcnQ6IEFTVHYxLkJhc2VOb2RlID0gcGFydHNbaV07XG5cbiAgICAgIGlmIChwYXJ0LnR5cGUgIT09ICdNdXN0YWNoZVN0YXRlbWVudCcgJiYgcGFydC50eXBlICE9PSAnVGV4dE5vZGUnKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgJ1Vuc3VwcG9ydGVkIG5vZGUgaW4gcXVvdGVkIGF0dHJpYnV0ZSB2YWx1ZTogJyArIHBhcnRbJ3R5cGUnXSxcbiAgICAgICAgICBwYXJ0LmxvY1xuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGFzc2VydFByZXNlbnQocGFydHMsIGB0aGUgY29uY2F0ZW5hdGlvbiBwYXJ0cyBvZiBhbiBlbGVtZW50IHNob3VsZCBub3QgYmUgZW1wdHlgKTtcblxuICAgIGxldCBmaXJzdCA9IHBhcnRzWzBdO1xuICAgIGxldCBsYXN0ID0gcGFydHNbcGFydHMubGVuZ3RoIC0gMV07XG5cbiAgICByZXR1cm4gYi5jb25jYXQocGFydHMsIHRoaXMuc291cmNlLnNwYW5Gb3IoZmlyc3QubG9jKS5leHRlbmQodGhpcy5zb3VyY2Uuc3BhbkZvcihsYXN0LmxvYykpKTtcbiAgfVxuXG4gIHZhbGlkYXRlRW5kVGFnKFxuICAgIHRhZzogVGFnPCdTdGFydFRhZycgfCAnRW5kVGFnJz4sXG4gICAgZWxlbWVudDogQVNUdjEuRWxlbWVudE5vZGUsXG4gICAgc2VsZkNsb3Npbmc6IGJvb2xlYW5cbiAgKTogdm9pZCB7XG4gICAgbGV0IGVycm9yO1xuXG4gICAgaWYgKHZvaWRNYXBbdGFnLm5hbWVdICYmICFzZWxmQ2xvc2luZykge1xuICAgICAgLy8gRW5nVGFnIGlzIGFsc28gY2FsbGVkIGJ5IFN0YXJ0VGFnIGZvciB2b2lkIGFuZCBzZWxmLWNsb3NpbmcgdGFncyAoaS5lLlxuICAgICAgLy8gPGlucHV0PiBvciA8YnIgLz4sIHNvIHdlIG5lZWQgdG8gY2hlY2sgZm9yIHRoYXQgaGVyZS4gT3RoZXJ3aXNlLCB3ZSB3b3VsZFxuICAgICAgLy8gdGhyb3cgYW4gZXJyb3IgZm9yIHRob3NlIGNhc2VzLlxuICAgICAgZXJyb3IgPSBgPCR7dGFnLm5hbWV9PiBlbGVtZW50cyBkbyBub3QgbmVlZCBlbmQgdGFncy4gWW91IHNob3VsZCByZW1vdmUgaXRgO1xuICAgIH0gZWxzZSBpZiAoZWxlbWVudC50YWcgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZXJyb3IgPSBgQ2xvc2luZyB0YWcgPC8ke3RhZy5uYW1lfT4gd2l0aG91dCBhbiBvcGVuIHRhZ2A7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50LnRhZyAhPT0gdGFnLm5hbWUpIHtcbiAgICAgIGVycm9yID0gYENsb3NpbmcgdGFnIDwvJHt0YWcubmFtZX0+IGRpZCBub3QgbWF0Y2ggbGFzdCBvcGVuIHRhZyA8JHtlbGVtZW50LnRhZ30+IChvbiBsaW5lICR7ZWxlbWVudC5sb2Muc3RhcnRQb3NpdGlvbi5saW5lfSlgO1xuICAgIH1cblxuICAgIGlmIChlcnJvcikge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihlcnJvciwgdGFnLmxvYyk7XG4gICAgfVxuICB9XG5cbiAgYXNzZW1ibGVBdHRyaWJ1dGVWYWx1ZShcbiAgICBwYXJ0czogKEFTVHYxLk11c3RhY2hlU3RhdGVtZW50IHwgQVNUdjEuVGV4dE5vZGUpW10sXG4gICAgaXNRdW90ZWQ6IGJvb2xlYW4sXG4gICAgaXNEeW5hbWljOiBib29sZWFuLFxuICAgIHNwYW46IFNvdXJjZVNwYW5cbiAgKTogQVNUdjEuQ29uY2F0U3RhdGVtZW50IHwgQVNUdjEuTXVzdGFjaGVTdGF0ZW1lbnQgfCBBU1R2MS5UZXh0Tm9kZSB7XG4gICAgaWYgKGlzRHluYW1pYykge1xuICAgICAgaWYgKGlzUXVvdGVkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFzc2VtYmxlQ29uY2F0ZW5hdGVkVmFsdWUocGFydHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHBhcnRzLmxlbmd0aCA9PT0gMSB8fFxuICAgICAgICAgIChwYXJ0cy5sZW5ndGggPT09IDIgJiZcbiAgICAgICAgICAgIHBhcnRzWzFdLnR5cGUgPT09ICdUZXh0Tm9kZScgJiZcbiAgICAgICAgICAgIChwYXJ0c1sxXSBhcyBBU1R2MS5UZXh0Tm9kZSkuY2hhcnMgPT09ICcvJylcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuIHBhcnRzWzBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgICBgQW4gdW5xdW90ZWQgYXR0cmlidXRlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgb3IgYSBtdXN0YWNoZSwgYCArXG4gICAgICAgICAgICAgIGBwcmVjZWRlZCBieSB3aGl0ZXNwYWNlIG9yIGEgJz0nIGNoYXJhY3RlciwgYW5kIGAgK1xuICAgICAgICAgICAgICBgZm9sbG93ZWQgYnkgd2hpdGVzcGFjZSwgYSAnPicgY2hhcmFjdGVyLCBvciAnLz4nYCxcbiAgICAgICAgICAgIHNwYW5cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwYXJ0cy5sZW5ndGggPiAwID8gcGFydHNbMF0gOiBiLnRleHQoeyBjaGFyczogJycsIGxvYzogc3BhbiB9KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gIEFTVFBsdWdpbnMgY2FuIG1ha2UgY2hhbmdlcyB0byB0aGUgR2xpbW1lciB0ZW1wbGF0ZSBBU1QgYmVmb3JlXG4gIGNvbXBpbGF0aW9uIGJlZ2lucy5cbiovXG5leHBvcnQgaW50ZXJmYWNlIEFTVFBsdWdpbkJ1aWxkZXI8VEVudiBleHRlbmRzIEFTVFBsdWdpbkVudmlyb25tZW50ID0gQVNUUGx1Z2luRW52aXJvbm1lbnQ+IHtcbiAgKGVudjogVEVudik6IEFTVFBsdWdpbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBU1RQbHVnaW4ge1xuICBuYW1lOiBzdHJpbmc7XG4gIHZpc2l0b3I6IE5vZGVWaXNpdG9yO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFTVFBsdWdpbkVudmlyb25tZW50IHtcbiAgbWV0YT86IG9iamVjdDtcbiAgc3ludGF4OiBTeW50YXg7XG59XG5cbmludGVyZmFjZSBIYW5kbGViYXJzUGFyc2VPcHRpb25zIHtcbiAgc3JjTmFtZT86IHN0cmluZztcbiAgaWdub3JlU3RhbmRhbG9uZT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVtcGxhdGVJZEZuIHtcbiAgKHNyYzogc3RyaW5nKTogT3B0aW9uPHN0cmluZz47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJlY29tcGlsZU9wdGlvbnMgZXh0ZW5kcyBQcmVwcm9jZXNzT3B0aW9ucyB7XG4gIGlkPzogVGVtcGxhdGVJZEZuO1xuICBjdXN0b21pemVDb21wb25lbnROYW1lPyhpbnB1dDogc3RyaW5nKTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByZXByb2Nlc3NPcHRpb25zIHtcbiAgc3RyaWN0TW9kZT86IGJvb2xlYW47XG4gIGxvY2Fscz86IHN0cmluZ1tdO1xuICBtZXRhPzoge1xuICAgIG1vZHVsZU5hbWU/OiBzdHJpbmc7XG4gIH07XG4gIHBsdWdpbnM/OiB7XG4gICAgYXN0PzogQVNUUGx1Z2luQnVpbGRlcltdO1xuICB9O1xuICBwYXJzZU9wdGlvbnM/OiBIYW5kbGViYXJzUGFyc2VPcHRpb25zO1xuICBjdXN0b21pemVDb21wb25lbnROYW1lPyhpbnB1dDogc3RyaW5nKTogc3RyaW5nO1xuXG4gIC8qKlxuICAgIFVzZWZ1bCBmb3Igc3BlY2lmeWluZyBhIGdyb3VwIG9mIG9wdGlvbnMgdG9nZXRoZXIuXG5cbiAgICBXaGVuIGAnY29kZW1vZCdgIHdlIGRpc2FibGUgYWxsIHdoaXRlc3BhY2UgY29udHJvbCBpbiBoYW5kbGViYXJzXG4gICAgKHRvIHByZXNlcnZlIGFzIG11Y2ggYXMgcG9zc2libGUpIGFuZCB3ZSBhbHNvIGF2b2lkIGFueVxuICAgIGVzY2FwaW5nL3VuZXNjYXBpbmcgb2YgSFRNTCBlbnRpdHkgY29kZXMuXG4gICAqL1xuICBtb2RlPzogJ2NvZGVtb2QnIHwgJ3ByZWNvbXBpbGUnO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN5bnRheCB7XG4gIHBhcnNlOiB0eXBlb2YgcHJlcHJvY2VzcztcbiAgYnVpbGRlcnM6IHR5cGVvZiBwdWJsaWNCdWlsZGVyO1xuICBwcmludDogdHlwZW9mIHByaW50O1xuICB0cmF2ZXJzZTogdHlwZW9mIHRyYXZlcnNlO1xuICBXYWxrZXI6IHR5cGVvZiBXYWxrZXI7XG59XG5cbmNvbnN0IHN5bnRheDogU3ludGF4ID0ge1xuICBwYXJzZTogcHJlcHJvY2VzcyxcbiAgYnVpbGRlcnM6IHB1YmxpY0J1aWxkZXIsXG4gIHByaW50LFxuICB0cmF2ZXJzZSxcbiAgV2Fsa2VyLFxufTtcblxuY2xhc3MgQ29kZW1vZEVudGl0eVBhcnNlciBleHRlbmRzIEVudGl0eVBhcnNlciB7XG4gIC8vIG1hdGNoIHVwc3RyZWFtIHR5cGVzLCBidXQgbmV2ZXIgbWF0Y2ggYW4gZW50aXR5XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKHt9KTtcbiAgfVxuXG4gIHBhcnNlKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlcHJvY2VzcyhcbiAgaW5wdXQ6IHN0cmluZyB8IFNvdXJjZSB8IEhCUy5Qcm9ncmFtLFxuICBvcHRpb25zOiBQcmVwcm9jZXNzT3B0aW9ucyA9IHt9XG4pOiBBU1R2MS5UZW1wbGF0ZSB7XG4gIGxldCBtb2RlID0gb3B0aW9ucy5tb2RlIHx8ICdwcmVjb21waWxlJztcblxuICBsZXQgc291cmNlOiBTb3VyY2U7XG4gIGxldCBhc3Q6IEhCUy5Qcm9ncmFtO1xuICBpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuICAgIHNvdXJjZSA9IG5ldyBTb3VyY2UoaW5wdXQsIG9wdGlvbnMubWV0YT8ubW9kdWxlTmFtZSk7XG5cbiAgICBpZiAobW9kZSA9PT0gJ2NvZGVtb2QnKSB7XG4gICAgICBhc3QgPSBwYXJzZVdpdGhvdXRQcm9jZXNzaW5nKGlucHV0LCBvcHRpb25zLnBhcnNlT3B0aW9ucykgYXMgSEJTLlByb2dyYW07XG4gICAgfSBlbHNlIHtcbiAgICAgIGFzdCA9IHBhcnNlKGlucHV0LCBvcHRpb25zLnBhcnNlT3B0aW9ucykgYXMgSEJTLlByb2dyYW07XG4gICAgfVxuICB9IGVsc2UgaWYgKGlucHV0IGluc3RhbmNlb2YgU291cmNlKSB7XG4gICAgc291cmNlID0gaW5wdXQ7XG5cbiAgICBpZiAobW9kZSA9PT0gJ2NvZGVtb2QnKSB7XG4gICAgICBhc3QgPSBwYXJzZVdpdGhvdXRQcm9jZXNzaW5nKGlucHV0LnNvdXJjZSwgb3B0aW9ucy5wYXJzZU9wdGlvbnMpIGFzIEhCUy5Qcm9ncmFtO1xuICAgIH0gZWxzZSB7XG4gICAgICBhc3QgPSBwYXJzZShpbnB1dC5zb3VyY2UsIG9wdGlvbnMucGFyc2VPcHRpb25zKSBhcyBIQlMuUHJvZ3JhbTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgc291cmNlID0gbmV3IFNvdXJjZSgnJywgb3B0aW9ucy5tZXRhPy5tb2R1bGVOYW1lKTtcbiAgICBhc3QgPSBpbnB1dDtcbiAgfVxuXG4gIGxldCBlbnRpdHlQYXJzZXIgPSB1bmRlZmluZWQ7XG4gIGlmIChtb2RlID09PSAnY29kZW1vZCcpIHtcbiAgICBlbnRpdHlQYXJzZXIgPSBuZXcgQ29kZW1vZEVudGl0eVBhcnNlcigpO1xuICB9XG5cbiAgbGV0IG9mZnNldHMgPSBTb3VyY2VTcGFuLmZvckNoYXJQb3NpdGlvbnMoc291cmNlLCAwLCBzb3VyY2Uuc291cmNlLmxlbmd0aCk7XG4gIGFzdC5sb2MgPSB7XG4gICAgc291cmNlOiAnKHByb2dyYW0pJyxcbiAgICBzdGFydDogb2Zmc2V0cy5zdGFydFBvc2l0aW9uLFxuICAgIGVuZDogb2Zmc2V0cy5lbmRQb3NpdGlvbixcbiAgfTtcblxuICBsZXQgcHJvZ3JhbSA9IG5ldyBUb2tlbml6ZXJFdmVudEhhbmRsZXJzKHNvdXJjZSwgZW50aXR5UGFyc2VyLCBtb2RlKS5hY2NlcHRUZW1wbGF0ZShhc3QpO1xuXG4gIGlmIChvcHRpb25zLnN0cmljdE1vZGUpIHtcbiAgICBwcm9ncmFtLmJsb2NrUGFyYW1zID0gb3B0aW9ucy5sb2NhbHMgPz8gW107XG4gIH1cblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnBsdWdpbnMgJiYgb3B0aW9ucy5wbHVnaW5zLmFzdCkge1xuICAgIGZvciAobGV0IGkgPSAwLCBsID0gb3B0aW9ucy5wbHVnaW5zLmFzdC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGxldCB0cmFuc2Zvcm0gPSBvcHRpb25zLnBsdWdpbnMuYXN0W2ldO1xuICAgICAgbGV0IGVudjogQVNUUGx1Z2luRW52aXJvbm1lbnQgPSBhc3NpZ24oe30sIG9wdGlvbnMsIHsgc3ludGF4IH0sIHsgcGx1Z2luczogdW5kZWZpbmVkIH0pO1xuXG4gICAgICBsZXQgcGx1Z2luUmVzdWx0ID0gdHJhbnNmb3JtKGVudik7XG5cbiAgICAgIHRyYXZlcnNlKHByb2dyYW0sIHBsdWdpblJlc3VsdC52aXNpdG9yKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcHJvZ3JhbTtcbn1cbiIsImltcG9ydCB7IENvcmUsIERpY3QsIFNleHBPcGNvZGVzIH0gZnJvbSAnQGdsaW1tZXIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBkaWN0IH0gZnJvbSAnQGdsaW1tZXIvdXRpbCc7XG5cbmltcG9ydCB7IEFTVHYyIH0gZnJvbSAnLi4nO1xuaW1wb3J0IHsgaXNVcHBlckNhc2UgfSBmcm9tICcuL3V0aWxzJztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFN5bWJvbFRhYmxlIHtcbiAgc3RhdGljIHRvcChcbiAgICBsb2NhbHM6IHN0cmluZ1tdLFxuICAgIGN1c3RvbWl6ZUNvbXBvbmVudE5hbWU6IChpbnB1dDogc3RyaW5nKSA9PiBzdHJpbmdcbiAgKTogUHJvZ3JhbVN5bWJvbFRhYmxlIHtcbiAgICByZXR1cm4gbmV3IFByb2dyYW1TeW1ib2xUYWJsZShsb2NhbHMsIGN1c3RvbWl6ZUNvbXBvbmVudE5hbWUpO1xuICB9XG5cbiAgYWJzdHJhY3QgaGFzKG5hbWU6IHN0cmluZyk6IGJvb2xlYW47XG4gIGFic3RyYWN0IGdldChuYW1lOiBzdHJpbmcpOiBbc3ltYm9sOiBudW1iZXIsIGlzUm9vdDogYm9vbGVhbl07XG5cbiAgYWJzdHJhY3QgZ2V0TG9jYWxzTWFwKCk6IERpY3Q8bnVtYmVyPjtcbiAgYWJzdHJhY3QgZ2V0RXZhbEluZm8oKTogQ29yZS5FdmFsSW5mbztcblxuICBhYnN0cmFjdCBhbGxvY2F0ZUZyZWUobmFtZTogc3RyaW5nLCByZXNvbHV0aW9uOiBBU1R2Mi5GcmVlVmFyUmVzb2x1dGlvbik6IG51bWJlcjtcbiAgYWJzdHJhY3QgYWxsb2NhdGVOYW1lZChuYW1lOiBzdHJpbmcpOiBudW1iZXI7XG4gIGFic3RyYWN0IGFsbG9jYXRlQmxvY2sobmFtZTogc3RyaW5nKTogbnVtYmVyO1xuICBhYnN0cmFjdCBhbGxvY2F0ZShpZGVudGlmaWVyOiBzdHJpbmcpOiBudW1iZXI7XG5cbiAgYWJzdHJhY3Qgc2V0SGFzRXZhbCgpOiB2b2lkO1xuXG4gIGNoaWxkKGxvY2Fsczogc3RyaW5nW10pOiBCbG9ja1N5bWJvbFRhYmxlIHtcbiAgICBsZXQgc3ltYm9scyA9IGxvY2Fscy5tYXAoKG5hbWUpID0+IHRoaXMuYWxsb2NhdGUobmFtZSkpO1xuICAgIHJldHVybiBuZXcgQmxvY2tTeW1ib2xUYWJsZSh0aGlzLCBsb2NhbHMsIHN5bWJvbHMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQcm9ncmFtU3ltYm9sVGFibGUgZXh0ZW5kcyBTeW1ib2xUYWJsZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgdGVtcGxhdGVMb2NhbHM6IHN0cmluZ1tdLFxuICAgIHByaXZhdGUgY3VzdG9taXplQ29tcG9uZW50TmFtZTogKGlucHV0OiBzdHJpbmcpID0+IHN0cmluZ1xuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgcHVibGljIHN5bWJvbHM6IHN0cmluZ1tdID0gW107XG4gIHB1YmxpYyB1cHZhcnM6IHN0cmluZ1tdID0gW107XG5cbiAgcHJpdmF0ZSBzaXplID0gMTtcbiAgcHJpdmF0ZSBuYW1lZCA9IGRpY3Q8bnVtYmVyPigpO1xuICBwcml2YXRlIGJsb2NrcyA9IGRpY3Q8bnVtYmVyPigpO1xuICBwcml2YXRlIHVzZWRUZW1wbGF0ZUxvY2Fsczogc3RyaW5nW10gPSBbXTtcblxuICBfaGFzRXZhbCA9IGZhbHNlO1xuXG4gIGdldFVzZWRUZW1wbGF0ZUxvY2FscygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMudXNlZFRlbXBsYXRlTG9jYWxzO1xuICB9XG5cbiAgc2V0SGFzRXZhbCgpOiB2b2lkIHtcbiAgICB0aGlzLl9oYXNFdmFsID0gdHJ1ZTtcbiAgfVxuXG4gIGdldCBoYXNFdmFsKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9oYXNFdmFsO1xuICB9XG5cbiAgaGFzKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnRlbXBsYXRlTG9jYWxzLmluZGV4T2YobmFtZSkgIT09IC0xO1xuICB9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IFtudW1iZXIsIGJvb2xlYW5dIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzLnVzZWRUZW1wbGF0ZUxvY2Fscy5pbmRleE9mKG5hbWUpO1xuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgcmV0dXJuIFtpbmRleCwgdHJ1ZV07XG4gICAgfVxuXG4gICAgaW5kZXggPSB0aGlzLnVzZWRUZW1wbGF0ZUxvY2Fscy5sZW5ndGg7XG4gICAgdGhpcy51c2VkVGVtcGxhdGVMb2NhbHMucHVzaChuYW1lKTtcbiAgICByZXR1cm4gW2luZGV4LCB0cnVlXTtcbiAgfVxuXG4gIGdldExvY2Fsc01hcCgpOiBEaWN0PG51bWJlcj4ge1xuICAgIHJldHVybiBkaWN0KCk7XG4gIH1cblxuICBnZXRFdmFsSW5mbygpOiBDb3JlLkV2YWxJbmZvIHtcbiAgICBsZXQgbG9jYWxzID0gdGhpcy5nZXRMb2NhbHNNYXAoKTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMobG9jYWxzKS5tYXAoKHN5bWJvbCkgPT4gbG9jYWxzW3N5bWJvbF0pO1xuICB9XG5cbiAgYWxsb2NhdGVGcmVlKG5hbWU6IHN0cmluZywgcmVzb2x1dGlvbjogQVNUdjIuRnJlZVZhclJlc29sdXRpb24pOiBudW1iZXIge1xuICAgIC8vIElmIHRoZSBuYW1lIGluIHF1ZXN0aW9uIGlzIGFuIHVwcGVyY2FzZSAoaS5lLiBhbmdsZS1icmFja2V0KSBjb21wb25lbnQgaW52b2NhdGlvbiwgcnVuXG4gICAgLy8gdGhlIG9wdGlvbmFsIGBjdXN0b21pemVDb21wb25lbnROYW1lYCBmdW5jdGlvbiBwcm92aWRlZCB0byB0aGUgcHJlY29tcGlsZXIuXG4gICAgaWYgKFxuICAgICAgcmVzb2x1dGlvbi5yZXNvbHV0aW9uKCkgPT09IFNleHBPcGNvZGVzLkdldEZyZWVBc0NvbXBvbmVudEhlYWQgJiZcbiAgICAgIHJlc29sdXRpb24uaXNBbmdsZUJyYWNrZXQgJiZcbiAgICAgIGlzVXBwZXJDYXNlKG5hbWUpXG4gICAgKSB7XG4gICAgICBuYW1lID0gdGhpcy5jdXN0b21pemVDb21wb25lbnROYW1lKG5hbWUpO1xuICAgIH1cblxuICAgIGxldCBpbmRleCA9IHRoaXMudXB2YXJzLmluZGV4T2YobmFtZSk7XG5cbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICByZXR1cm4gaW5kZXg7XG4gICAgfVxuXG4gICAgaW5kZXggPSB0aGlzLnVwdmFycy5sZW5ndGg7XG4gICAgdGhpcy51cHZhcnMucHVzaChuYW1lKTtcbiAgICByZXR1cm4gaW5kZXg7XG4gIH1cblxuICBhbGxvY2F0ZU5hbWVkKG5hbWU6IHN0cmluZyk6IG51bWJlciB7XG4gICAgbGV0IG5hbWVkID0gdGhpcy5uYW1lZFtuYW1lXTtcblxuICAgIGlmICghbmFtZWQpIHtcbiAgICAgIG5hbWVkID0gdGhpcy5uYW1lZFtuYW1lXSA9IHRoaXMuYWxsb2NhdGUobmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5hbWVkO1xuICB9XG5cbiAgYWxsb2NhdGVCbG9jayhuYW1lOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIGlmIChuYW1lID09PSAnaW52ZXJzZScpIHtcbiAgICAgIG5hbWUgPSAnZWxzZSc7XG4gICAgfVxuXG4gICAgbGV0IGJsb2NrID0gdGhpcy5ibG9ja3NbbmFtZV07XG5cbiAgICBpZiAoIWJsb2NrKSB7XG4gICAgICBibG9jayA9IHRoaXMuYmxvY2tzW25hbWVdID0gdGhpcy5hbGxvY2F0ZShgJiR7bmFtZX1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYmxvY2s7XG4gIH1cblxuICBhbGxvY2F0ZShpZGVudGlmaWVyOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIHRoaXMuc3ltYm9scy5wdXNoKGlkZW50aWZpZXIpO1xuICAgIHJldHVybiB0aGlzLnNpemUrKztcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQmxvY2tTeW1ib2xUYWJsZSBleHRlbmRzIFN5bWJvbFRhYmxlIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBwYXJlbnQ6IFN5bWJvbFRhYmxlLCBwdWJsaWMgc3ltYm9sczogc3RyaW5nW10sIHB1YmxpYyBzbG90czogbnVtYmVyW10pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IGxvY2FscygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMuc3ltYm9scztcbiAgfVxuXG4gIGhhcyhuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xzLmluZGV4T2YobmFtZSkgIT09IC0xIHx8IHRoaXMucGFyZW50LmhhcyhuYW1lKTtcbiAgfVxuXG4gIGdldChuYW1lOiBzdHJpbmcpOiBbbnVtYmVyLCBib29sZWFuXSB7XG4gICAgbGV0IHNsb3QgPSB0aGlzLnN5bWJvbHMuaW5kZXhPZihuYW1lKTtcbiAgICByZXR1cm4gc2xvdCA9PT0gLTEgPyB0aGlzLnBhcmVudC5nZXQobmFtZSkgOiBbdGhpcy5zbG90c1tzbG90XSwgZmFsc2VdO1xuICB9XG5cbiAgZ2V0TG9jYWxzTWFwKCk6IERpY3Q8bnVtYmVyPiB7XG4gICAgbGV0IGRpY3QgPSB0aGlzLnBhcmVudC5nZXRMb2NhbHNNYXAoKTtcbiAgICB0aGlzLnN5bWJvbHMuZm9yRWFjaCgoc3ltYm9sKSA9PiAoZGljdFtzeW1ib2xdID0gdGhpcy5nZXQoc3ltYm9sKVswXSkpO1xuICAgIHJldHVybiBkaWN0O1xuICB9XG5cbiAgZ2V0RXZhbEluZm8oKTogQ29yZS5FdmFsSW5mbyB7XG4gICAgbGV0IGxvY2FscyA9IHRoaXMuZ2V0TG9jYWxzTWFwKCk7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGxvY2FscykubWFwKChzeW1ib2wpID0+IGxvY2Fsc1tzeW1ib2xdKTtcbiAgfVxuXG4gIHNldEhhc0V2YWwoKTogdm9pZCB7XG4gICAgdGhpcy5wYXJlbnQuc2V0SGFzRXZhbCgpO1xuICB9XG5cbiAgYWxsb2NhdGVGcmVlKG5hbWU6IHN0cmluZywgcmVzb2x1dGlvbjogQVNUdjIuRnJlZVZhclJlc29sdXRpb24pOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLnBhcmVudC5hbGxvY2F0ZUZyZWUobmFtZSwgcmVzb2x1dGlvbik7XG4gIH1cblxuICBhbGxvY2F0ZU5hbWVkKG5hbWU6IHN0cmluZyk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50LmFsbG9jYXRlTmFtZWQobmFtZSk7XG4gIH1cblxuICBhbGxvY2F0ZUJsb2NrKG5hbWU6IHN0cmluZyk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50LmFsbG9jYXRlQmxvY2sobmFtZSk7XG4gIH1cblxuICBhbGxvY2F0ZShpZGVudGlmaWVyOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLnBhcmVudC5hbGxvY2F0ZShpZGVudGlmaWVyKTtcbiAgfVxufVxuIiwiaW1wb3J0IHR5cGUgeyBQcmVzZW50QXJyYXkgfSBmcm9tICdAZ2xpbW1lci9pbnRlcmZhY2VzJztcbmltcG9ydCB7IGFzc2VydCwgYXNzZXJ0UHJlc2VudCwgYXNzaWduIH0gZnJvbSAnQGdsaW1tZXIvdXRpbCc7XG5cbmltcG9ydCB7IFNvdXJjZVNsaWNlIH0gZnJvbSAnLi4vc291cmNlL3NsaWNlJztcbmltcG9ydCB7IFNvdXJjZVNwYW4gfSBmcm9tICcuLi9zb3VyY2Uvc3Bhbic7XG5pbXBvcnQgeyBTcGFuTGlzdCB9IGZyb20gJy4uL3NvdXJjZS9zcGFuLWxpc3QnO1xuaW1wb3J0IHsgQmxvY2tTeW1ib2xUYWJsZSwgUHJvZ3JhbVN5bWJvbFRhYmxlLCBTeW1ib2xUYWJsZSB9IGZyb20gJy4uL3N5bWJvbC10YWJsZSc7XG5pbXBvcnQgKiBhcyBBU1R2MiBmcm9tICcuL2FwaSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FsbFBhcnRzIHtcbiAgY2FsbGVlOiBBU1R2Mi5FeHByZXNzaW9uTm9kZTtcbiAgYXJnczogQVNUdjIuQXJncztcbn1cblxuZXhwb3J0IGNsYXNzIEJ1aWxkZXIge1xuICAvLyBURU1QTEFURSAvL1xuXG4gIHRlbXBsYXRlKFxuICAgIHN5bWJvbHM6IFByb2dyYW1TeW1ib2xUYWJsZSxcbiAgICBib2R5OiBBU1R2Mi5Db250ZW50Tm9kZVtdLFxuICAgIGxvYzogU291cmNlU3BhblxuICApOiBBU1R2Mi5UZW1wbGF0ZSB7XG4gICAgcmV0dXJuIG5ldyBBU1R2Mi5UZW1wbGF0ZSh7XG4gICAgICB0YWJsZTogc3ltYm9scyxcbiAgICAgIGJvZHksXG4gICAgICBsb2MsXG4gICAgfSk7XG4gIH1cblxuICAvLyBJTlRFUk5BTCAodGhlc2Ugbm9kZXMgY2Fubm90IGJlIHJlYWNoZWQgd2hlbiBkb2luZyBnZW5lcmFsLXB1cnBvc2UgdmlzaXRpbmcpIC8vXG5cbiAgYmxvY2soc3ltYm9sczogQmxvY2tTeW1ib2xUYWJsZSwgYm9keTogQVNUdjIuQ29udGVudE5vZGVbXSwgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjIuQmxvY2sge1xuICAgIHJldHVybiBuZXcgQVNUdjIuQmxvY2soe1xuICAgICAgc2NvcGU6IHN5bWJvbHMsXG4gICAgICBib2R5LFxuICAgICAgbG9jLFxuICAgIH0pO1xuICB9XG5cbiAgbmFtZWRCbG9jayhuYW1lOiBTb3VyY2VTbGljZSwgYmxvY2s6IEFTVHYyLkJsb2NrLCBsb2M6IFNvdXJjZVNwYW4pOiBBU1R2Mi5OYW1lZEJsb2NrIHtcbiAgICByZXR1cm4gbmV3IEFTVHYyLk5hbWVkQmxvY2soe1xuICAgICAgbmFtZSxcbiAgICAgIGJsb2NrLFxuICAgICAgYXR0cnM6IFtdLFxuICAgICAgY29tcG9uZW50QXJnczogW10sXG4gICAgICBtb2RpZmllcnM6IFtdLFxuICAgICAgbG9jLFxuICAgIH0pO1xuICB9XG5cbiAgc2ltcGxlTmFtZWRCbG9jayhuYW1lOiBTb3VyY2VTbGljZSwgYmxvY2s6IEFTVHYyLkJsb2NrLCBsb2M6IFNvdXJjZVNwYW4pOiBBU1R2Mi5OYW1lZEJsb2NrIHtcbiAgICByZXR1cm4gbmV3IEJ1aWxkRWxlbWVudCh7XG4gICAgICBzZWxmQ2xvc2luZzogZmFsc2UsXG4gICAgICBhdHRyczogW10sXG4gICAgICBjb21wb25lbnRBcmdzOiBbXSxcbiAgICAgIG1vZGlmaWVyczogW10sXG4gICAgICBjb21tZW50czogW10sXG4gICAgfSkubmFtZWQobmFtZSwgYmxvY2ssIGxvYyk7XG4gIH1cblxuICBzbGljZShjaGFyczogc3RyaW5nLCBsb2M6IFNvdXJjZVNwYW4pOiBTb3VyY2VTbGljZSB7XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VTbGljZSh7XG4gICAgICBsb2MsXG4gICAgICBjaGFycyxcbiAgICB9KTtcbiAgfVxuXG4gIGFyZ3MoXG4gICAgcG9zaXRpb25hbDogQVNUdjIuUG9zaXRpb25hbEFyZ3VtZW50cyxcbiAgICBuYW1lZDogQVNUdjIuTmFtZWRBcmd1bWVudHMsXG4gICAgbG9jOiBTb3VyY2VTcGFuXG4gICk6IEFTVHYyLkFyZ3Mge1xuICAgIHJldHVybiBuZXcgQVNUdjIuQXJncyh7XG4gICAgICBsb2MsXG4gICAgICBwb3NpdGlvbmFsLFxuICAgICAgbmFtZWQsXG4gICAgfSk7XG4gIH1cblxuICBwb3NpdGlvbmFsKGV4cHJzOiBBU1R2Mi5FeHByZXNzaW9uTm9kZVtdLCBsb2M6IFNvdXJjZVNwYW4pOiBBU1R2Mi5Qb3NpdGlvbmFsQXJndW1lbnRzIHtcbiAgICByZXR1cm4gbmV3IEFTVHYyLlBvc2l0aW9uYWxBcmd1bWVudHMoe1xuICAgICAgbG9jLFxuICAgICAgZXhwcnMsXG4gICAgfSk7XG4gIH1cblxuICBuYW1lZEFyZ3VtZW50KGtleTogU291cmNlU2xpY2UsIHZhbHVlOiBBU1R2Mi5FeHByZXNzaW9uTm9kZSk6IEFTVHYyLk5hbWVkQXJndW1lbnQge1xuICAgIHJldHVybiBuZXcgQVNUdjIuTmFtZWRBcmd1bWVudCh7XG4gICAgICBuYW1lOiBrZXksXG4gICAgICB2YWx1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIG5hbWVkKGVudHJpZXM6IEFTVHYyLk5hbWVkQXJndW1lbnRbXSwgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjIuTmFtZWRBcmd1bWVudHMge1xuICAgIHJldHVybiBuZXcgQVNUdjIuTmFtZWRBcmd1bWVudHMoe1xuICAgICAgbG9jLFxuICAgICAgZW50cmllcyxcbiAgICB9KTtcbiAgfVxuXG4gIGF0dHIoXG4gICAge1xuICAgICAgbmFtZSxcbiAgICAgIHZhbHVlLFxuICAgICAgdHJ1c3RpbmcsXG4gICAgfTogeyBuYW1lOiBTb3VyY2VTbGljZTsgdmFsdWU6IEFTVHYyLkV4cHJlc3Npb25Ob2RlOyB0cnVzdGluZzogYm9vbGVhbiB9LFxuICAgIGxvYzogU291cmNlU3BhblxuICApOiBBU1R2Mi5IdG1sQXR0ciB7XG4gICAgcmV0dXJuIG5ldyBBU1R2Mi5IdG1sQXR0cih7XG4gICAgICBsb2MsXG4gICAgICBuYW1lLFxuICAgICAgdmFsdWUsXG4gICAgICB0cnVzdGluZyxcbiAgICB9KTtcbiAgfVxuXG4gIHNwbGF0QXR0cihzeW1ib2w6IG51bWJlciwgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjIuU3BsYXRBdHRyIHtcbiAgICByZXR1cm4gbmV3IEFTVHYyLlNwbGF0QXR0cih7XG4gICAgICBzeW1ib2wsXG4gICAgICBsb2MsXG4gICAgfSk7XG4gIH1cblxuICBhcmcoXG4gICAge1xuICAgICAgbmFtZSxcbiAgICAgIHZhbHVlLFxuICAgICAgdHJ1c3RpbmcsXG4gICAgfTogeyBuYW1lOiBTb3VyY2VTbGljZTsgdmFsdWU6IEFTVHYyLkV4cHJlc3Npb25Ob2RlOyB0cnVzdGluZzogYm9vbGVhbiB9LFxuICAgIGxvYzogU291cmNlU3BhblxuICApOiBBU1R2Mi5Db21wb25lbnRBcmcge1xuICAgIHJldHVybiBuZXcgQVNUdjIuQ29tcG9uZW50QXJnKHtcbiAgICAgIG5hbWUsXG4gICAgICB2YWx1ZSxcbiAgICAgIHRydXN0aW5nLFxuICAgICAgbG9jLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gRVhQUkVTU0lPTlMgLy9cblxuICBwYXRoKGhlYWQ6IEFTVHYyLlZhcmlhYmxlUmVmZXJlbmNlLCB0YWlsOiBTb3VyY2VTbGljZVtdLCBsb2M6IFNvdXJjZVNwYW4pOiBBU1R2Mi5QYXRoRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIG5ldyBBU1R2Mi5QYXRoRXhwcmVzc2lvbih7XG4gICAgICBsb2MsXG4gICAgICByZWY6IGhlYWQsXG4gICAgICB0YWlsLFxuICAgIH0pO1xuICB9XG5cbiAgc2VsZihsb2M6IFNvdXJjZVNwYW4pOiBBU1R2Mi5WYXJpYWJsZVJlZmVyZW5jZSB7XG4gICAgcmV0dXJuIG5ldyBBU1R2Mi5UaGlzUmVmZXJlbmNlKHtcbiAgICAgIGxvYyxcbiAgICB9KTtcbiAgfVxuXG4gIGF0KG5hbWU6IHN0cmluZywgc3ltYm9sOiBudW1iZXIsIGxvYzogU291cmNlU3Bhbik6IEFTVHYyLlZhcmlhYmxlUmVmZXJlbmNlIHtcbiAgICAvLyB0aGUgYEBgIHNob3VsZCBiZSBpbmNsdWRlZCBzbyB3ZSBoYXZlIGEgY29tcGxldGUgc291cmNlIHJhbmdlXG4gICAgYXNzZXJ0KG5hbWVbMF0gPT09ICdAJywgYGNhbGwgYnVpbGRlcnMuYXQoKSB3aXRoIGEgc3RyaW5nIHRoYXQgc3RhcnRzIHdpdGggJ0AnYCk7XG5cbiAgICByZXR1cm4gbmV3IEFTVHYyLkFyZ1JlZmVyZW5jZSh7XG4gICAgICBsb2MsXG4gICAgICBuYW1lOiBuZXcgU291cmNlU2xpY2UoeyBsb2MsIGNoYXJzOiBuYW1lIH0pLFxuICAgICAgc3ltYm9sLFxuICAgIH0pO1xuICB9XG5cbiAgZnJlZVZhcih7XG4gICAgbmFtZSxcbiAgICBjb250ZXh0LFxuICAgIHN5bWJvbCxcbiAgICBsb2MsXG4gIH06IHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgY29udGV4dDogQVNUdjIuRnJlZVZhclJlc29sdXRpb247XG4gICAgc3ltYm9sOiBudW1iZXI7XG4gICAgbG9jOiBTb3VyY2VTcGFuO1xuICB9KTogQVNUdjIuRnJlZVZhclJlZmVyZW5jZSB7XG4gICAgYXNzZXJ0KFxuICAgICAgbmFtZSAhPT0gJ3RoaXMnLFxuICAgICAgYFlvdSBjYWxsZWQgYnVpbGRlcnMuZnJlZVZhcigpIHdpdGggJ3RoaXMnLiBDYWxsIGJ1aWxkZXJzLnRoaXMgaW5zdGVhZGBcbiAgICApO1xuICAgIGFzc2VydChcbiAgICAgIG5hbWVbMF0gIT09ICdAJyxcbiAgICAgIGBZb3UgY2FsbGVkIGJ1aWxkZXJzLmZyZWVWYXIoKSB3aXRoICcke25hbWV9Jy4gQ2FsbCBidWlsZGVycy5hdCgnJHtuYW1lfScpIGluc3RlYWRgXG4gICAgKTtcblxuICAgIHJldHVybiBuZXcgQVNUdjIuRnJlZVZhclJlZmVyZW5jZSh7XG4gICAgICBuYW1lLFxuICAgICAgcmVzb2x1dGlvbjogY29udGV4dCxcbiAgICAgIHN5bWJvbCxcbiAgICAgIGxvYyxcbiAgICB9KTtcbiAgfVxuXG4gIGxvY2FsVmFyKFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzeW1ib2w6IG51bWJlcixcbiAgICBpc1RlbXBsYXRlTG9jYWw6IGJvb2xlYW4sXG4gICAgbG9jOiBTb3VyY2VTcGFuXG4gICk6IEFTVHYyLlZhcmlhYmxlUmVmZXJlbmNlIHtcbiAgICBhc3NlcnQobmFtZSAhPT0gJ3RoaXMnLCBgWW91IGNhbGxlZCBidWlsZGVycy52YXIoKSB3aXRoICd0aGlzJy4gQ2FsbCBidWlsZGVycy50aGlzIGluc3RlYWRgKTtcbiAgICBhc3NlcnQoXG4gICAgICBuYW1lWzBdICE9PSAnQCcsXG4gICAgICBgWW91IGNhbGxlZCBidWlsZGVycy52YXIoKSB3aXRoICcke25hbWV9Jy4gQ2FsbCBidWlsZGVycy5hdCgnJHtuYW1lfScpIGluc3RlYWRgXG4gICAgKTtcblxuICAgIHJldHVybiBuZXcgQVNUdjIuTG9jYWxWYXJSZWZlcmVuY2Uoe1xuICAgICAgbG9jLFxuICAgICAgbmFtZSxcbiAgICAgIGlzVGVtcGxhdGVMb2NhbCxcbiAgICAgIHN5bWJvbCxcbiAgICB9KTtcbiAgfVxuXG4gIHNleHAocGFydHM6IENhbGxQYXJ0cywgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjIuQ2FsbEV4cHJlc3Npb24ge1xuICAgIHJldHVybiBuZXcgQVNUdjIuQ2FsbEV4cHJlc3Npb24oe1xuICAgICAgbG9jLFxuICAgICAgY2FsbGVlOiBwYXJ0cy5jYWxsZWUsXG4gICAgICBhcmdzOiBwYXJ0cy5hcmdzLFxuICAgIH0pO1xuICB9XG5cbiAgZGVwcmVjYXRlZENhbGwoXG4gICAgYXJnOiBTb3VyY2VTbGljZSxcbiAgICBjYWxsZWU6IEFTVHYyLkZyZWVWYXJSZWZlcmVuY2UsXG4gICAgbG9jOiBTb3VyY2VTcGFuXG4gICk6IEFTVHYyLkRlcHJlY2F0ZWRDYWxsRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIG5ldyBBU1R2Mi5EZXByZWNhdGVkQ2FsbEV4cHJlc3Npb24oe1xuICAgICAgbG9jLFxuICAgICAgYXJnLFxuICAgICAgY2FsbGVlLFxuICAgIH0pO1xuICB9XG5cbiAgaW50ZXJwb2xhdGUocGFydHM6IEFTVHYyLkV4cHJlc3Npb25Ob2RlW10sIGxvYzogU291cmNlU3Bhbik6IEFTVHYyLkludGVycG9sYXRlRXhwcmVzc2lvbiB7XG4gICAgYXNzZXJ0UHJlc2VudChwYXJ0cyk7XG5cbiAgICByZXR1cm4gbmV3IEFTVHYyLkludGVycG9sYXRlRXhwcmVzc2lvbih7XG4gICAgICBsb2MsXG4gICAgICBwYXJ0cyxcbiAgICB9KTtcbiAgfVxuXG4gIGxpdGVyYWwodmFsdWU6IHN0cmluZywgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjIuTGl0ZXJhbEV4cHJlc3Npb24gJiB7IHZhbHVlOiBzdHJpbmcgfTtcbiAgbGl0ZXJhbCh2YWx1ZTogbnVtYmVyLCBsb2M6IFNvdXJjZVNwYW4pOiBBU1R2Mi5MaXRlcmFsRXhwcmVzc2lvbiAmIHsgdmFsdWU6IG51bWJlciB9O1xuICBsaXRlcmFsKHZhbHVlOiBib29sZWFuLCBsb2M6IFNvdXJjZVNwYW4pOiBBU1R2Mi5MaXRlcmFsRXhwcmVzc2lvbiAmIHsgdmFsdWU6IGJvb2xlYW4gfTtcbiAgbGl0ZXJhbCh2YWx1ZTogbnVsbCwgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjIuTGl0ZXJhbEV4cHJlc3Npb24gJiB7IHZhbHVlOiBudWxsIH07XG4gIGxpdGVyYWwodmFsdWU6IHVuZGVmaW5lZCwgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjIuTGl0ZXJhbEV4cHJlc3Npb24gJiB7IHZhbHVlOiB1bmRlZmluZWQgfTtcbiAgbGl0ZXJhbChcbiAgICB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbiB8IG51bGwgfCB1bmRlZmluZWQsXG4gICAgbG9jOiBTb3VyY2VTcGFuXG4gICk6IEFTVHYyLkxpdGVyYWxFeHByZXNzaW9uO1xuICBsaXRlcmFsKFxuICAgIHZhbHVlOiBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuIHwgbnVsbCB8IHVuZGVmaW5lZCxcbiAgICBsb2M6IFNvdXJjZVNwYW5cbiAgKTogQVNUdjIuTGl0ZXJhbEV4cHJlc3Npb24ge1xuICAgIHJldHVybiBuZXcgQVNUdjIuTGl0ZXJhbEV4cHJlc3Npb24oe1xuICAgICAgbG9jLFxuICAgICAgdmFsdWUsXG4gICAgfSk7XG4gIH1cblxuICAvLyBTVEFURU1FTlRTIC8vXG5cbiAgYXBwZW5kKFxuICAgIHtcbiAgICAgIHRhYmxlLFxuICAgICAgdHJ1c3RpbmcsXG4gICAgICB2YWx1ZSxcbiAgICB9OiB7IHRhYmxlOiBTeW1ib2xUYWJsZTsgdHJ1c3Rpbmc6IGJvb2xlYW47IHZhbHVlOiBBU1R2Mi5FeHByZXNzaW9uTm9kZSB9LFxuICAgIGxvYzogU291cmNlU3BhblxuICApOiBBU1R2Mi5BcHBlbmRDb250ZW50IHtcbiAgICByZXR1cm4gbmV3IEFTVHYyLkFwcGVuZENvbnRlbnQoe1xuICAgICAgdGFibGUsXG4gICAgICB0cnVzdGluZyxcbiAgICAgIHZhbHVlLFxuICAgICAgbG9jLFxuICAgIH0pO1xuICB9XG5cbiAgbW9kaWZpZXIoeyBjYWxsZWUsIGFyZ3MgfTogQ2FsbFBhcnRzLCBsb2M6IFNvdXJjZVNwYW4pOiBBU1R2Mi5FbGVtZW50TW9kaWZpZXIge1xuICAgIHJldHVybiBuZXcgQVNUdjIuRWxlbWVudE1vZGlmaWVyKHtcbiAgICAgIGxvYyxcbiAgICAgIGNhbGxlZSxcbiAgICAgIGFyZ3MsXG4gICAgfSk7XG4gIH1cblxuICBuYW1lZEJsb2NrcyhibG9ja3M6IEFTVHYyLk5hbWVkQmxvY2tbXSwgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjIuTmFtZWRCbG9ja3Mge1xuICAgIHJldHVybiBuZXcgQVNUdjIuTmFtZWRCbG9ja3Moe1xuICAgICAgbG9jLFxuICAgICAgYmxvY2tzLFxuICAgIH0pO1xuICB9XG5cbiAgYmxvY2tTdGF0ZW1lbnQoXG4gICAge1xuICAgICAgc3ltYm9scyxcbiAgICAgIHByb2dyYW0sXG4gICAgICBpbnZlcnNlID0gbnVsbCxcbiAgICAgIC4uLmNhbGxcbiAgICB9OiB7XG4gICAgICBzeW1ib2xzOiBTeW1ib2xUYWJsZTtcbiAgICAgIHByb2dyYW06IEFTVHYyLkJsb2NrO1xuICAgICAgaW52ZXJzZT86IEFTVHYyLkJsb2NrIHwgbnVsbDtcbiAgICB9ICYgQ2FsbFBhcnRzLFxuICAgIGxvYzogU291cmNlU3BhblxuICApOiBBU1R2Mi5JbnZva2VCbG9jayB7XG4gICAgbGV0IGJsb2Nrc0xvYyA9IHByb2dyYW0ubG9jO1xuICAgIGxldCBibG9ja3M6IFByZXNlbnRBcnJheTxBU1R2Mi5OYW1lZEJsb2NrPiA9IFtcbiAgICAgIHRoaXMubmFtZWRCbG9jayhTb3VyY2VTbGljZS5zeW50aGV0aWMoJ2RlZmF1bHQnKSwgcHJvZ3JhbSwgcHJvZ3JhbS5sb2MpLFxuICAgIF07XG4gICAgaWYgKGludmVyc2UpIHtcbiAgICAgIGJsb2Nrc0xvYyA9IGJsb2Nrc0xvYy5leHRlbmQoaW52ZXJzZS5sb2MpO1xuICAgICAgYmxvY2tzLnB1c2godGhpcy5uYW1lZEJsb2NrKFNvdXJjZVNsaWNlLnN5bnRoZXRpYygnZWxzZScpLCBpbnZlcnNlLCBpbnZlcnNlLmxvYykpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgQVNUdjIuSW52b2tlQmxvY2soe1xuICAgICAgbG9jLFxuICAgICAgYmxvY2tzOiB0aGlzLm5hbWVkQmxvY2tzKGJsb2NrcywgYmxvY2tzTG9jKSxcbiAgICAgIGNhbGxlZTogY2FsbC5jYWxsZWUsXG4gICAgICBhcmdzOiBjYWxsLmFyZ3MsXG4gICAgfSk7XG4gIH1cblxuICBlbGVtZW50KG9wdGlvbnM6IEJ1aWxkQmFzZUVsZW1lbnQpOiBCdWlsZEVsZW1lbnQge1xuICAgIHJldHVybiBuZXcgQnVpbGRFbGVtZW50KG9wdGlvbnMpO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRCYXNlRWxlbWVudCB7XG4gIHNlbGZDbG9zaW5nOiBib29sZWFuO1xuICBhdHRyczogQVNUdjIuSHRtbE9yU3BsYXRBdHRyW107XG4gIGNvbXBvbmVudEFyZ3M6IEFTVHYyLkNvbXBvbmVudEFyZ1tdO1xuICBtb2RpZmllcnM6IEFTVHYyLkVsZW1lbnRNb2RpZmllcltdO1xuICBjb21tZW50czogQVNUdjIuR2xpbW1lckNvbW1lbnRbXTtcbn1cblxuZXhwb3J0IGNsYXNzIEJ1aWxkRWxlbWVudCB7XG4gIHJlYWRvbmx5IGJ1aWxkZXI6IEJ1aWxkZXI7XG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGJhc2U6IEJ1aWxkQmFzZUVsZW1lbnQpIHtcbiAgICB0aGlzLmJ1aWxkZXIgPSBuZXcgQnVpbGRlcigpO1xuICB9XG5cbiAgc2ltcGxlKHRhZzogU291cmNlU2xpY2UsIGJvZHk6IEFTVHYyLkNvbnRlbnROb2RlW10sIGxvYzogU291cmNlU3Bhbik6IEFTVHYyLlNpbXBsZUVsZW1lbnQge1xuICAgIHJldHVybiBuZXcgQVNUdjIuU2ltcGxlRWxlbWVudChcbiAgICAgIGFzc2lnbihcbiAgICAgICAge1xuICAgICAgICAgIHRhZyxcbiAgICAgICAgICBib2R5LFxuICAgICAgICAgIGNvbXBvbmVudEFyZ3M6IFtdLFxuICAgICAgICAgIGxvYyxcbiAgICAgICAgfSxcbiAgICAgICAgdGhpcy5iYXNlXG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIG5hbWVkKG5hbWU6IFNvdXJjZVNsaWNlLCBibG9jazogQVNUdjIuQmxvY2ssIGxvYzogU291cmNlU3Bhbik6IEFTVHYyLk5hbWVkQmxvY2sge1xuICAgIHJldHVybiBuZXcgQVNUdjIuTmFtZWRCbG9jayhcbiAgICAgIGFzc2lnbihcbiAgICAgICAge1xuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgYmxvY2ssXG4gICAgICAgICAgY29tcG9uZW50QXJnczogW10sXG4gICAgICAgICAgbG9jLFxuICAgICAgICB9LFxuICAgICAgICB0aGlzLmJhc2VcbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgc2VsZkNsb3NpbmdDb21wb25lbnQoY2FsbGVlOiBBU1R2Mi5FeHByZXNzaW9uTm9kZSwgbG9jOiBTb3VyY2VTcGFuKTogQVNUdjIuSW52b2tlQ29tcG9uZW50IHtcbiAgICByZXR1cm4gbmV3IEFTVHYyLkludm9rZUNvbXBvbmVudChcbiAgICAgIGFzc2lnbihcbiAgICAgICAge1xuICAgICAgICAgIGxvYyxcbiAgICAgICAgICBjYWxsZWUsXG4gICAgICAgICAgLy8gcG9pbnQgdGhlIGVtcHR5IG5hbWVkIGJsb2NrcyBhdCB0aGUgYC9gIHNlbGYtY2xvc2luZyB0YWdcbiAgICAgICAgICBibG9ja3M6IG5ldyBBU1R2Mi5OYW1lZEJsb2Nrcyh7XG4gICAgICAgICAgICBibG9ja3M6IFtdLFxuICAgICAgICAgICAgbG9jOiBsb2Muc2xpY2VFbmRDaGFycyh7IHNraXBFbmQ6IDEsIGNoYXJzOiAxIH0pLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICB0aGlzLmJhc2VcbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgY29tcG9uZW50V2l0aERlZmF1bHRCbG9jayhcbiAgICBjYWxsZWU6IEFTVHYyLkV4cHJlc3Npb25Ob2RlLFxuICAgIGNoaWxkcmVuOiBBU1R2Mi5Db250ZW50Tm9kZVtdLFxuICAgIHN5bWJvbHM6IEJsb2NrU3ltYm9sVGFibGUsXG4gICAgbG9jOiBTb3VyY2VTcGFuXG4gICk6IEFTVHYyLkludm9rZUNvbXBvbmVudCB7XG4gICAgbGV0IGJsb2NrID0gdGhpcy5idWlsZGVyLmJsb2NrKHN5bWJvbHMsIGNoaWxkcmVuLCBsb2MpO1xuICAgIGxldCBuYW1lZEJsb2NrID0gdGhpcy5idWlsZGVyLm5hbWVkQmxvY2soU291cmNlU2xpY2Uuc3ludGhldGljKCdkZWZhdWx0JyksIGJsb2NrLCBsb2MpOyAvLyBCVUlMREVSLnNpbXBsZU5hbWVkQmxvY2soJ2RlZmF1bHQnLCBjaGlsZHJlbiwgc3ltYm9scywgbG9jKTtcblxuICAgIHJldHVybiBuZXcgQVNUdjIuSW52b2tlQ29tcG9uZW50KFxuICAgICAgYXNzaWduKFxuICAgICAgICB7XG4gICAgICAgICAgbG9jLFxuICAgICAgICAgIGNhbGxlZSxcbiAgICAgICAgICBibG9ja3M6IHRoaXMuYnVpbGRlci5uYW1lZEJsb2NrcyhbbmFtZWRCbG9ja10sIG5hbWVkQmxvY2subG9jKSxcbiAgICAgICAgfSxcbiAgICAgICAgdGhpcy5iYXNlXG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIGNvbXBvbmVudFdpdGhOYW1lZEJsb2NrcyhcbiAgICBjYWxsZWU6IEFTVHYyLkV4cHJlc3Npb25Ob2RlLFxuICAgIGJsb2NrczogUHJlc2VudEFycmF5PEFTVHYyLk5hbWVkQmxvY2s+LFxuICAgIGxvYzogU291cmNlU3BhblxuICApOiBBU1R2Mi5JbnZva2VDb21wb25lbnQge1xuICAgIHJldHVybiBuZXcgQVNUdjIuSW52b2tlQ29tcG9uZW50KFxuICAgICAgYXNzaWduKFxuICAgICAgICB7XG4gICAgICAgICAgbG9jLFxuICAgICAgICAgIGNhbGxlZSxcbiAgICAgICAgICBibG9ja3M6IHRoaXMuYnVpbGRlci5uYW1lZEJsb2NrcyhibG9ja3MsIFNwYW5MaXN0LnJhbmdlKGJsb2NrcykpLFxuICAgICAgICB9LFxuICAgICAgICB0aGlzLmJhc2VcbiAgICAgIClcbiAgICApO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuLi92MS9hcGknO1xuaW1wb3J0ICogYXMgQVNUdjIgZnJvbSAnLi9hcGknO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFzdENhbGxQYXJ0cyB7XG4gIHBhdGg6IEFTVHYxLkV4cHJlc3Npb247XG4gIHBhcmFtczogQVNUdjEuRXhwcmVzc2lvbltdO1xuICBoYXNoOiBBU1R2MS5IYXNoO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZhclBhdGggZXh0ZW5kcyBBU1R2MS5QYXRoRXhwcmVzc2lvbiB7XG4gIGhlYWQ6IEFTVHYxLlZhckhlYWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTZXhwU3ludGF4Q29udGV4dChub2RlOiBBU1R2MS5TdWJFeHByZXNzaW9uKTogQVNUdjIuRnJlZVZhclJlc29sdXRpb24gfCBudWxsIHtcbiAgaWYgKGlzU2ltcGxlQ2FsbGVlKG5vZGUpKSB7XG4gICAgcmV0dXJuIEFTVHYyLkxvb3NlTW9kZVJlc29sdXRpb24ubmFtZXNwYWNlZChBU1R2Mi5GcmVlVmFyTmFtZXNwYWNlLkhlbHBlcik7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIE1vZGlmaWVyU3ludGF4Q29udGV4dChcbiAgbm9kZTogQVNUdjEuRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50XG4pOiBBU1R2Mi5GcmVlVmFyUmVzb2x1dGlvbiB8IG51bGwge1xuICBpZiAoaXNTaW1wbGVDYWxsZWUobm9kZSkpIHtcbiAgICByZXR1cm4gQVNUdjIuTG9vc2VNb2RlUmVzb2x1dGlvbi5uYW1lc3BhY2VkKEFTVHYyLkZyZWVWYXJOYW1lc3BhY2UuTW9kaWZpZXIpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBCbG9ja1N5bnRheENvbnRleHQobm9kZTogQVNUdjEuQmxvY2tTdGF0ZW1lbnQpOiBBU1R2Mi5GcmVlVmFyUmVzb2x1dGlvbiB8IG51bGwge1xuICBpZiAoaXNTaW1wbGVDYWxsZWUobm9kZSkpIHtcbiAgICByZXR1cm4gQVNUdjIuTG9vc2VNb2RlUmVzb2x1dGlvbi5uYW1lc3BhY2VkKEFTVHYyLkZyZWVWYXJOYW1lc3BhY2UuQ29tcG9uZW50KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gQVNUdjIuTG9vc2VNb2RlUmVzb2x1dGlvbi5mYWxsYmFjaygpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wb25lbnRTeW50YXhDb250ZXh0KG5vZGU6IEFTVHYxLlBhdGhFeHByZXNzaW9uKTogQVNUdjIuRnJlZVZhclJlc29sdXRpb24gfCBudWxsIHtcbiAgaWYgKGlzU2ltcGxlUGF0aChub2RlKSkge1xuICAgIHJldHVybiBBU1R2Mi5Mb29zZU1vZGVSZXNvbHV0aW9uLm5hbWVzcGFjZWQoQVNUdjIuRnJlZVZhck5hbWVzcGFjZS5Db21wb25lbnQsIHRydWUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogVGhpcyBjb3JyZXNwb25kcyB0byBhcHBlbmQgcG9zaXRpb25zICh0ZXh0IGN1cmxpZXMgb3IgYXR0cmlidXRlXG4gKiBjdXJsaWVzKS4gSW4gc3RyaWN0IG1vZGUsIHRoaXMgYWxzbyBjb3JyZXNwb25kcyB0byBhcmcgY3VybGllcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIEF0dHJWYWx1ZVN5bnRheENvbnRleHQobm9kZTogQVNUdjEuTXVzdGFjaGVTdGF0ZW1lbnQpOiBBU1R2Mi5GcmVlVmFyUmVzb2x1dGlvbiB7XG4gIGxldCBpc1NpbXBsZSA9IGlzU2ltcGxlQ2FsbGVlKG5vZGUpO1xuICBsZXQgaXNJbnZva2UgPSBpc0ludm9rZU5vZGUobm9kZSk7XG5cbiAgaWYgKGlzU2ltcGxlKSB7XG4gICAgcmV0dXJuIGlzSW52b2tlXG4gICAgICA/IEFTVHYyLkxvb3NlTW9kZVJlc29sdXRpb24ubmFtZXNwYWNlZChBU1R2Mi5GcmVlVmFyTmFtZXNwYWNlLkhlbHBlcilcbiAgICAgIDogQVNUdjIuTG9vc2VNb2RlUmVzb2x1dGlvbi5hdHRyKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGlzSW52b2tlID8gQVNUdjIuU1RSSUNUX1JFU09MVVRJT04gOiBBU1R2Mi5Mb29zZU1vZGVSZXNvbHV0aW9uLmZhbGxiYWNrKCk7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGlzIGNvcnJlc3BvbmRzIHRvIGFwcGVuZCBwb3NpdGlvbnMgKHRleHQgY3VybGllcyBvciBhdHRyaWJ1dGVcbiAqIGN1cmxpZXMpLiBJbiBzdHJpY3QgbW9kZSwgdGhpcyBhbHNvIGNvcnJlc3BvbmRzIHRvIGFyZyBjdXJsaWVzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gQXBwZW5kU3ludGF4Q29udGV4dChub2RlOiBBU1R2MS5NdXN0YWNoZVN0YXRlbWVudCk6IEFTVHYyLkZyZWVWYXJSZXNvbHV0aW9uIHtcbiAgbGV0IGlzU2ltcGxlID0gaXNTaW1wbGVDYWxsZWUobm9kZSk7XG4gIGxldCBpc0ludm9rZSA9IGlzSW52b2tlTm9kZShub2RlKTtcbiAgbGV0IHRydXN0aW5nID0gbm9kZS50cnVzdGluZztcblxuICBpZiAoaXNTaW1wbGUpIHtcbiAgICByZXR1cm4gdHJ1c3RpbmdcbiAgICAgID8gQVNUdjIuTG9vc2VNb2RlUmVzb2x1dGlvbi50cnVzdGluZ0FwcGVuZCh7IGludm9rZTogaXNJbnZva2UgfSlcbiAgICAgIDogQVNUdjIuTG9vc2VNb2RlUmVzb2x1dGlvbi5hcHBlbmQoeyBpbnZva2U6IGlzSW52b2tlIH0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBBU1R2Mi5Mb29zZU1vZGVSZXNvbHV0aW9uLmZhbGxiYWNrKCk7XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgUmVzb2x1dGlvbjxQIGV4dGVuZHMgQXN0Q2FsbFBhcnRzIHwgQVNUdjEuUGF0aEV4cHJlc3Npb24+ID0gKFxuICBjYWxsOiBQXG4pID0+IEFTVHYyLkZyZWVWYXJSZXNvbHV0aW9uIHwgbnVsbDtcblxuLy8gVVRJTElUSUVTXG5cbi8qKlxuICogQSBjYWxsIG5vZGUgaGFzIGEgc2ltcGxlIGNhbGxlZSBpZiBpdHMgaGVhZCBpczpcbiAqXG4gKiAtIGEgYFBhdGhFeHByZXNzaW9uYFxuICogLSB0aGUgYFBhdGhFeHByZXNzaW9uYCdzIGhlYWQgaXMgYSBgVmFySGVhZGBcbiAqIC0gaXQgaGFzIG5vIHRhaWxcbiAqXG4gKiBTaW1wbGUgaGVhZHM6XG4gKlxuICogYGBgXG4gKiB7e3h9fVxuICoge3t4IHl9fVxuICogYGBgXG4gKlxuICogTm90IHNpbXBsZSBoZWFkczpcbiAqXG4gKiBgYGBcbiAqIHt7eC55fX1cbiAqIHt7eC55IHp9fVxuICoge3tAeH19XG4gKiB7e0B4IGF9fVxuICoge3t0aGlzfX1cbiAqIHt7dGhpcyBhfX1cbiAqIGBgYFxuICovXG5mdW5jdGlvbiBpc1NpbXBsZUNhbGxlZShub2RlOiBBc3RDYWxsUGFydHMpOiBib29sZWFuIHtcbiAgbGV0IHBhdGggPSBub2RlLnBhdGg7XG5cbiAgcmV0dXJuIGlzU2ltcGxlUGF0aChwYXRoKTtcbn1cblxuZnVuY3Rpb24gaXNTaW1wbGVQYXRoKG5vZGU6IEFTVHYxLkV4cHJlc3Npb24pOiBib29sZWFuIHtcbiAgaWYgKG5vZGUudHlwZSA9PT0gJ1BhdGhFeHByZXNzaW9uJyAmJiBub2RlLmhlYWQudHlwZSA9PT0gJ1ZhckhlYWQnKSB7XG4gICAgcmV0dXJuIG5vZGUudGFpbC5sZW5ndGggPT09IDA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8qKlxuICogVGhlIGNhbGwgZXhwcmVzc2lvbiBoYXMgYXQgbGVhc3Qgb25lIGFyZ3VtZW50LlxuICovXG5mdW5jdGlvbiBpc0ludm9rZU5vZGUobm9kZTogQXN0Q2FsbFBhcnRzKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlLnBhcmFtcy5sZW5ndGggPiAwIHx8IG5vZGUuaGFzaC5wYWlycy5sZW5ndGggPiAwO1xufVxuIiwiaW1wb3J0IHsgUHJlc2VudEFycmF5IH0gZnJvbSAnQGdsaW1tZXIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBhc3NlcnQsIGFzc2lnbiwgaXNQcmVzZW50IH0gZnJvbSAnQGdsaW1tZXIvdXRpbCc7XG5cbmltcG9ydCBQcmludGVyIGZyb20gJy4uL2dlbmVyYXRpb24vcHJpbnRlcic7XG5pbXBvcnQgeyBQcmVjb21waWxlT3B0aW9ucywgcHJlcHJvY2VzcyB9IGZyb20gJy4uL3BhcnNlci90b2tlbml6ZXItZXZlbnQtaGFuZGxlcnMnO1xuaW1wb3J0IHsgU291cmNlTG9jYXRpb24gfSBmcm9tICcuLi9zb3VyY2UvbG9jYXRpb24nO1xuaW1wb3J0IHsgU291cmNlU2xpY2UgfSBmcm9tICcuLi9zb3VyY2Uvc2xpY2UnO1xuaW1wb3J0IHsgU291cmNlIH0gZnJvbSAnLi4vc291cmNlL3NvdXJjZSc7XG5pbXBvcnQgeyBTb3VyY2VTcGFuIH0gZnJvbSAnLi4vc291cmNlL3NwYW4nO1xuaW1wb3J0IHsgU3Bhbkxpc3QgfSBmcm9tICcuLi9zb3VyY2Uvc3Bhbi1saXN0JztcbmltcG9ydCB7IEJsb2NrU3ltYm9sVGFibGUsIFByb2dyYW1TeW1ib2xUYWJsZSwgU3ltYm9sVGFibGUgfSBmcm9tICcuLi9zeW1ib2wtdGFibGUnO1xuaW1wb3J0IHsgZ2VuZXJhdGVTeW50YXhFcnJvciB9IGZyb20gJy4uL3N5bnRheC1lcnJvcic7XG5pbXBvcnQgeyBpc0xvd2VyQ2FzZSwgaXNVcHBlckNhc2UgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuLi92MS9hcGknO1xuaW1wb3J0IGIgZnJvbSAnLi4vdjEvcGFyc2VyLWJ1aWxkZXJzJztcbmltcG9ydCAqIGFzIEFTVHYyIGZyb20gJy4vYXBpJztcbmltcG9ydCB7IEJ1aWxkRWxlbWVudCwgQnVpbGRlciwgQ2FsbFBhcnRzIH0gZnJvbSAnLi9idWlsZGVycyc7XG5pbXBvcnQge1xuICBBcHBlbmRTeW50YXhDb250ZXh0LFxuICBBdHRyVmFsdWVTeW50YXhDb250ZXh0LFxuICBCbG9ja1N5bnRheENvbnRleHQsXG4gIENvbXBvbmVudFN5bnRheENvbnRleHQsXG4gIE1vZGlmaWVyU3ludGF4Q29udGV4dCxcbiAgUmVzb2x1dGlvbixcbiAgU2V4cFN5bnRheENvbnRleHQsXG59IGZyb20gJy4vbG9vc2UtcmVzb2x1dGlvbic7XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemUoXG4gIHNvdXJjZTogU291cmNlLFxuICBvcHRpb25zOiBQcmVjb21waWxlT3B0aW9ucyA9IHt9XG4pOiBbYXN0OiBBU1R2Mi5UZW1wbGF0ZSwgbG9jYWxzOiBzdHJpbmdbXV0ge1xuICBsZXQgYXN0ID0gcHJlcHJvY2Vzcyhzb3VyY2UsIG9wdGlvbnMpO1xuXG4gIGxldCBub3JtYWxpemVPcHRpb25zID0gYXNzaWduKFxuICAgIHtcbiAgICAgIHN0cmljdE1vZGU6IGZhbHNlLFxuICAgICAgbG9jYWxzOiBbXSxcbiAgICB9LFxuICAgIG9wdGlvbnNcbiAgKTtcblxuICBsZXQgdG9wID0gU3ltYm9sVGFibGUudG9wKFxuICAgIG5vcm1hbGl6ZU9wdGlvbnMubG9jYWxzLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvdW5ib3VuZC1tZXRob2RcbiAgICBvcHRpb25zLmN1c3RvbWl6ZUNvbXBvbmVudE5hbWUgPz8gKChuYW1lKSA9PiBuYW1lKVxuICApO1xuICBsZXQgYmxvY2sgPSBuZXcgQmxvY2tDb250ZXh0KHNvdXJjZSwgbm9ybWFsaXplT3B0aW9ucywgdG9wKTtcbiAgbGV0IG5vcm1hbGl6ZXIgPSBuZXcgU3RhdGVtZW50Tm9ybWFsaXplcihibG9jayk7XG5cbiAgbGV0IGFzdFYyID0gbmV3IFRlbXBsYXRlQ2hpbGRyZW4oXG4gICAgYmxvY2subG9jKGFzdC5sb2MpLFxuICAgIGFzdC5ib2R5Lm1hcCgoYikgPT4gbm9ybWFsaXplci5ub3JtYWxpemUoYikpLFxuICAgIGJsb2NrXG4gICkuYXNzZXJ0VGVtcGxhdGUodG9wKTtcblxuICBsZXQgbG9jYWxzID0gdG9wLmdldFVzZWRUZW1wbGF0ZUxvY2FscygpO1xuXG4gIHJldHVybiBbYXN0VjIsIGxvY2Fsc107XG59XG5cbi8qKlxuICogQSBgQmxvY2tDb250ZXh0YCByZXByZXNlbnRzIHRoZSBibG9jayB0aGF0IGEgcGFydGljdWxhciBBU1Qgbm9kZSBpcyBjb250YWluZWQgaW5zaWRlIG9mLlxuICpcbiAqIGBCbG9ja0NvbnRleHRgIGlzIGF3YXJlIG9mIHRlbXBsYXRlLXdpZGUgb3B0aW9ucyAoc3VjaCBhcyBzdHJpY3QgbW9kZSksIGFzIHdlbGwgYXMgdGhlIGJpbmRpbmdzXG4gKiB0aGF0IGFyZSBpbi1zY29wZSB3aXRoaW4gdGhhdCBibG9jay5cbiAqXG4gKiBDb25jcmV0ZWx5LCBpdCBoYXMgdGhlIGBQcmVjb21waWxlT3B0aW9uc2AgYW5kIGN1cnJlbnQgYFN5bWJvbFRhYmxlYCwgYW5kIHByb3ZpZGVzXG4gKiBmYWNpbGl0aWVzIGZvciB3b3JraW5nIHdpdGggdGhvc2Ugb3B0aW9ucy5cbiAqXG4gKiBgQmxvY2tDb250ZXh0YCBpcyBzdGF0ZWxlc3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBCbG9ja0NvbnRleHQ8VGFibGUgZXh0ZW5kcyBTeW1ib2xUYWJsZSA9IFN5bWJvbFRhYmxlPiB7XG4gIHJlYWRvbmx5IGJ1aWxkZXI6IEJ1aWxkZXI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgc291cmNlOiBTb3VyY2UsXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBQcmVjb21waWxlT3B0aW9ucyxcbiAgICByZWFkb25seSB0YWJsZTogVGFibGVcbiAgKSB7XG4gICAgdGhpcy5idWlsZGVyID0gbmV3IEJ1aWxkZXIoKTtcbiAgfVxuXG4gIGdldCBzdHJpY3QoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMub3B0aW9ucy5zdHJpY3RNb2RlIHx8IGZhbHNlO1xuICB9XG5cbiAgbG9jKGxvYzogU291cmNlTG9jYXRpb24pOiBTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gdGhpcy5zb3VyY2Uuc3BhbkZvcihsb2MpO1xuICB9XG5cbiAgcmVzb2x1dGlvbkZvcjxOIGV4dGVuZHMgQVNUdjEuQ2FsbE5vZGUgfCBBU1R2MS5QYXRoRXhwcmVzc2lvbj4oXG4gICAgbm9kZTogTixcbiAgICByZXNvbHV0aW9uOiBSZXNvbHV0aW9uPE4+XG4gICk6IHsgcmVzb2x1dGlvbjogQVNUdjIuRnJlZVZhclJlc29sdXRpb24gfSB8IHsgcmVzb2x1dGlvbjogJ2Vycm9yJzsgcGF0aDogc3RyaW5nOyBoZWFkOiBzdHJpbmcgfSB7XG4gICAgaWYgKHRoaXMuc3RyaWN0KSB7XG4gICAgICByZXR1cm4geyByZXNvbHV0aW9uOiBBU1R2Mi5TVFJJQ1RfUkVTT0xVVElPTiB9O1xuICAgIH1cblxuICAgIGlmICh0aGlzLmlzRnJlZVZhcihub2RlKSkge1xuICAgICAgbGV0IHIgPSByZXNvbHV0aW9uKG5vZGUpO1xuXG4gICAgICBpZiAociA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHJlc29sdXRpb246ICdlcnJvcicsXG4gICAgICAgICAgcGF0aDogcHJpbnRQYXRoKG5vZGUpLFxuICAgICAgICAgIGhlYWQ6IHByaW50SGVhZChub2RlKSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHsgcmVzb2x1dGlvbjogciB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4geyByZXNvbHV0aW9uOiBBU1R2Mi5TVFJJQ1RfUkVTT0xVVElPTiB9O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaXNGcmVlVmFyKGNhbGxlZTogQVNUdjEuQ2FsbE5vZGUgfCBBU1R2MS5QYXRoRXhwcmVzc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmIChjYWxsZWUudHlwZSA9PT0gJ1BhdGhFeHByZXNzaW9uJykge1xuICAgICAgaWYgKGNhbGxlZS5oZWFkLnR5cGUgIT09ICdWYXJIZWFkJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAhdGhpcy50YWJsZS5oYXMoY2FsbGVlLmhlYWQubmFtZSk7XG4gICAgfSBlbHNlIGlmIChjYWxsZWUucGF0aC50eXBlID09PSAnUGF0aEV4cHJlc3Npb24nKSB7XG4gICAgICByZXR1cm4gdGhpcy5pc0ZyZWVWYXIoY2FsbGVlLnBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaGFzQmluZGluZyhuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5oYXMobmFtZSk7XG4gIH1cblxuICBjaGlsZChibG9ja1BhcmFtczogc3RyaW5nW10pOiBCbG9ja0NvbnRleHQ8QmxvY2tTeW1ib2xUYWJsZT4ge1xuICAgIHJldHVybiBuZXcgQmxvY2tDb250ZXh0KHRoaXMuc291cmNlLCB0aGlzLm9wdGlvbnMsIHRoaXMudGFibGUuY2hpbGQoYmxvY2tQYXJhbXMpKTtcbiAgfVxuXG4gIGN1c3RvbWl6ZUNvbXBvbmVudE5hbWUoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5jdXN0b21pemVDb21wb25lbnROYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmN1c3RvbWl6ZUNvbXBvbmVudE5hbWUoaW5wdXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQW4gYEV4cHJlc3Npb25Ob3JtYWxpemVyYCBub3JtYWxpemVzIGV4cHJlc3Npb25zIHdpdGhpbiBhIGJsb2NrLlxuICpcbiAqIGBFeHByZXNzaW9uTm9ybWFsaXplcmAgaXMgc3RhdGVsZXNzLlxuICovXG5jbGFzcyBFeHByZXNzaW9uTm9ybWFsaXplciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYmxvY2s6IEJsb2NrQ29udGV4dCkge31cblxuICAvKipcbiAgICogVGhlIGBub3JtYWxpemVgIG1ldGhvZCB0YWtlcyBhbiBhcmJpdHJhcnkgZXhwcmVzc2lvbiBhbmQgaXRzIG9yaWdpbmFsIHN5bnRheCBjb250ZXh0IGFuZFxuICAgKiBub3JtYWxpemVzIGl0IHRvIGFuIEFTVHYyIGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBzZWUge1N5bnRheENvbnRleHR9XG4gICAqL1xuICBub3JtYWxpemUoZXhwcjogQVNUdjEuTGl0ZXJhbCwgcmVzb2x1dGlvbjogQVNUdjIuRnJlZVZhclJlc29sdXRpb24pOiBBU1R2Mi5MaXRlcmFsRXhwcmVzc2lvbjtcbiAgbm9ybWFsaXplKFxuICAgIGV4cHI6IEFTVHYxLk1pbmltYWxQYXRoRXhwcmVzc2lvbixcbiAgICByZXNvbHV0aW9uOiBBU1R2Mi5GcmVlVmFyUmVzb2x1dGlvblxuICApOiBBU1R2Mi5QYXRoRXhwcmVzc2lvbjtcbiAgbm9ybWFsaXplKGV4cHI6IEFTVHYxLlN1YkV4cHJlc3Npb24sIHJlc29sdXRpb246IEFTVHYyLkZyZWVWYXJSZXNvbHV0aW9uKTogQVNUdjIuQ2FsbEV4cHJlc3Npb247XG4gIG5vcm1hbGl6ZShleHByOiBBU1R2MS5FeHByZXNzaW9uLCByZXNvbHV0aW9uOiBBU1R2Mi5GcmVlVmFyUmVzb2x1dGlvbik6IEFTVHYyLkV4cHJlc3Npb25Ob2RlO1xuICBub3JtYWxpemUoXG4gICAgZXhwcjogQVNUdjEuRXhwcmVzc2lvbiB8IEFTVHYxLk1pbmltYWxQYXRoRXhwcmVzc2lvbixcbiAgICByZXNvbHV0aW9uOiBBU1R2Mi5GcmVlVmFyUmVzb2x1dGlvblxuICApOiBBU1R2Mi5FeHByZXNzaW9uTm9kZSB7XG4gICAgc3dpdGNoIChleHByLnR5cGUpIHtcbiAgICAgIGNhc2UgJ051bGxMaXRlcmFsJzpcbiAgICAgIGNhc2UgJ0Jvb2xlYW5MaXRlcmFsJzpcbiAgICAgIGNhc2UgJ051bWJlckxpdGVyYWwnOlxuICAgICAgY2FzZSAnU3RyaW5nTGl0ZXJhbCc6XG4gICAgICBjYXNlICdVbmRlZmluZWRMaXRlcmFsJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuYmxvY2suYnVpbGRlci5saXRlcmFsKGV4cHIudmFsdWUsIHRoaXMuYmxvY2subG9jKGV4cHIubG9jKSk7XG4gICAgICBjYXNlICdQYXRoRXhwcmVzc2lvbic6XG4gICAgICAgIHJldHVybiB0aGlzLnBhdGgoZXhwciwgcmVzb2x1dGlvbik7XG4gICAgICBjYXNlICdTdWJFeHByZXNzaW9uJzoge1xuICAgICAgICBsZXQgcmVzb2x1dGlvbiA9IHRoaXMuYmxvY2sucmVzb2x1dGlvbkZvcihleHByLCBTZXhwU3ludGF4Q29udGV4dCk7XG5cbiAgICAgICAgaWYgKHJlc29sdXRpb24ucmVzb2x1dGlvbiA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgICBgWW91IGF0dGVtcHRlZCB0byBpbnZva2UgYSBwYXRoIChcXGAke3Jlc29sdXRpb24ucGF0aH1cXGApIGJ1dCAke3Jlc29sdXRpb24uaGVhZH0gd2FzIG5vdCBpbiBzY29wZWAsXG4gICAgICAgICAgICBleHByLmxvY1xuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5ibG9jay5idWlsZGVyLnNleHAoXG4gICAgICAgICAgdGhpcy5jYWxsUGFydHMoZXhwciwgcmVzb2x1dGlvbi5yZXNvbHV0aW9uKSxcbiAgICAgICAgICB0aGlzLmJsb2NrLmxvYyhleHByLmxvYylcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHBhdGgoXG4gICAgZXhwcjogQVNUdjEuTWluaW1hbFBhdGhFeHByZXNzaW9uLFxuICAgIHJlc29sdXRpb246IEFTVHYyLkZyZWVWYXJSZXNvbHV0aW9uXG4gICk6IEFTVHYyLlBhdGhFeHByZXNzaW9uIHtcbiAgICBsZXQgaGVhZE9mZnNldHMgPSB0aGlzLmJsb2NrLmxvYyhleHByLmhlYWQubG9jKTtcblxuICAgIGxldCB0YWlsID0gW107XG5cbiAgICAvLyBzdGFydCB3aXRoIHRoZSBoZWFkXG4gICAgbGV0IG9mZnNldCA9IGhlYWRPZmZzZXRzO1xuXG4gICAgZm9yIChsZXQgcGFydCBvZiBleHByLnRhaWwpIHtcbiAgICAgIG9mZnNldCA9IG9mZnNldC5zbGljZVN0YXJ0Q2hhcnMoeyBjaGFyczogcGFydC5sZW5ndGgsIHNraXBTdGFydDogMSB9KTtcbiAgICAgIHRhaWwucHVzaChcbiAgICAgICAgbmV3IFNvdXJjZVNsaWNlKHtcbiAgICAgICAgICBsb2M6IG9mZnNldCxcbiAgICAgICAgICBjaGFyczogcGFydCxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuYmxvY2suYnVpbGRlci5wYXRoKHRoaXMucmVmKGV4cHIuaGVhZCwgcmVzb2x1dGlvbiksIHRhaWwsIHRoaXMuYmxvY2subG9jKGV4cHIubG9jKSk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGBjYWxsUGFydHNgIG1ldGhvZCB0YWtlcyBBU1R2MS5DYWxsUGFydHMgYXMgd2VsbCBhcyBhIHN5bnRheCBjb250ZXh0IGFuZCBub3JtYWxpemVzXG4gICAqIGl0IHRvIGFuIEFTVHYyIENhbGxQYXJ0cy5cbiAgICovXG4gIGNhbGxQYXJ0cyhwYXJ0czogQVNUdjEuQ2FsbFBhcnRzLCBjb250ZXh0OiBBU1R2Mi5GcmVlVmFyUmVzb2x1dGlvbik6IENhbGxQYXJ0cyB7XG4gICAgbGV0IHsgcGF0aCwgcGFyYW1zLCBoYXNoIH0gPSBwYXJ0cztcblxuICAgIGxldCBjYWxsZWUgPSB0aGlzLm5vcm1hbGl6ZShwYXRoLCBjb250ZXh0KTtcbiAgICBsZXQgcGFyYW1MaXN0ID0gcGFyYW1zLm1hcCgocCkgPT4gdGhpcy5ub3JtYWxpemUocCwgQVNUdjIuQVJHVU1FTlRfUkVTT0xVVElPTikpO1xuICAgIGxldCBwYXJhbUxvYyA9IFNwYW5MaXN0LnJhbmdlKHBhcmFtTGlzdCwgY2FsbGVlLmxvYy5jb2xsYXBzZSgnZW5kJykpO1xuICAgIGxldCBuYW1lZExvYyA9IHRoaXMuYmxvY2subG9jKGhhc2gubG9jKTtcbiAgICBsZXQgYXJnc0xvYyA9IFNwYW5MaXN0LnJhbmdlKFtwYXJhbUxvYywgbmFtZWRMb2NdKTtcblxuICAgIGxldCBwb3NpdGlvbmFsID0gdGhpcy5ibG9jay5idWlsZGVyLnBvc2l0aW9uYWwoXG4gICAgICBwYXJhbXMubWFwKChwKSA9PiB0aGlzLm5vcm1hbGl6ZShwLCBBU1R2Mi5BUkdVTUVOVF9SRVNPTFVUSU9OKSksXG4gICAgICBwYXJhbUxvY1xuICAgICk7XG5cbiAgICBsZXQgbmFtZWQgPSB0aGlzLmJsb2NrLmJ1aWxkZXIubmFtZWQoXG4gICAgICBoYXNoLnBhaXJzLm1hcCgocCkgPT4gdGhpcy5uYW1lZEFyZ3VtZW50KHApKSxcbiAgICAgIHRoaXMuYmxvY2subG9jKGhhc2gubG9jKVxuICAgICk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY2FsbGVlLFxuICAgICAgYXJnczogdGhpcy5ibG9jay5idWlsZGVyLmFyZ3MocG9zaXRpb25hbCwgbmFtZWQsIGFyZ3NMb2MpLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIG5hbWVkQXJndW1lbnQocGFpcjogQVNUdjEuSGFzaFBhaXIpOiBBU1R2Mi5OYW1lZEFyZ3VtZW50IHtcbiAgICBsZXQgb2Zmc2V0cyA9IHRoaXMuYmxvY2subG9jKHBhaXIubG9jKTtcblxuICAgIGxldCBrZXlPZmZzZXRzID0gb2Zmc2V0cy5zbGljZVN0YXJ0Q2hhcnMoeyBjaGFyczogcGFpci5rZXkubGVuZ3RoIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuYmxvY2suYnVpbGRlci5uYW1lZEFyZ3VtZW50KFxuICAgICAgbmV3IFNvdXJjZVNsaWNlKHsgY2hhcnM6IHBhaXIua2V5LCBsb2M6IGtleU9mZnNldHMgfSksXG4gICAgICB0aGlzLm5vcm1hbGl6ZShwYWlyLnZhbHVlLCBBU1R2Mi5BUkdVTUVOVF9SRVNPTFVUSU9OKVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGByZWZgIG1ldGhvZCBub3JtYWxpemVzIGFuIGBBU1R2MS5QYXRoSGVhZGAgaW50byBhbiBgQVNUdjIuVmFyaWFibGVSZWZlcmVuY2VgLlxuICAgKiBUaGlzIG1ldGhvZCBpcyBleHRyZW1lbHkgaW1wb3J0YW50LCBiZWNhdXNlIGl0IGlzIHJlc3BvbnNpYmxlIGZvciBub3JtYWxpemluZyBmcmVlXG4gICAqIHZhcmlhYmxlcyBpbnRvIGFuIGFuIEFTVHYyLlBhdGhIZWFkICp3aXRoIGFwcHJvcHJpYXRlIGNvbnRleHQqLlxuICAgKlxuICAgKiBUaGUgc3ludGF4IGNvbnRleHQgaXMgb3JpZ2luYWxseSBkZXRlcm1pbmVkIGJ5IHRoZSBzeW50YWN0aWMgcG9zaXRpb24gdGhhdCB0aGlzIGBQYXRoSGVhZGBcbiAgICogY2FtZSBmcm9tLCBhbmQgaXMgdWx0aW1hdGVseSBhdHRhY2hlZCB0byB0aGUgYEFTVHYyLlZhcmlhYmxlUmVmZXJlbmNlYCBoZXJlLiBJbiBBU1R2MixcbiAgICogdGhlIGBWYXJpYWJsZVJlZmVyZW5jZWAgbm9kZSBiZWFycyBmdWxsIHJlc3BvbnNpYmlsaXR5IGZvciBsb29zZSBtb2RlIHJ1bGVzIHRoYXQgY29udHJvbFxuICAgKiB0aGUgYmVoYXZpb3Igb2YgZnJlZSB2YXJpYWJsZXMuXG4gICAqL1xuICBwcml2YXRlIHJlZihoZWFkOiBBU1R2MS5QYXRoSGVhZCwgcmVzb2x1dGlvbjogQVNUdjIuRnJlZVZhclJlc29sdXRpb24pOiBBU1R2Mi5WYXJpYWJsZVJlZmVyZW5jZSB7XG4gICAgbGV0IHsgYmxvY2sgfSA9IHRoaXM7XG4gICAgbGV0IHsgYnVpbGRlciwgdGFibGUgfSA9IGJsb2NrO1xuICAgIGxldCBvZmZzZXRzID0gYmxvY2subG9jKGhlYWQubG9jKTtcblxuICAgIHN3aXRjaCAoaGVhZC50eXBlKSB7XG4gICAgICBjYXNlICdUaGlzSGVhZCc6XG4gICAgICAgIHJldHVybiBidWlsZGVyLnNlbGYob2Zmc2V0cyk7XG4gICAgICBjYXNlICdBdEhlYWQnOiB7XG4gICAgICAgIGxldCBzeW1ib2wgPSB0YWJsZS5hbGxvY2F0ZU5hbWVkKGhlYWQubmFtZSk7XG4gICAgICAgIHJldHVybiBidWlsZGVyLmF0KGhlYWQubmFtZSwgc3ltYm9sLCBvZmZzZXRzKTtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ1ZhckhlYWQnOiB7XG4gICAgICAgIGlmIChibG9jay5oYXNCaW5kaW5nKGhlYWQubmFtZSkpIHtcbiAgICAgICAgICBsZXQgW3N5bWJvbCwgaXNSb290XSA9IHRhYmxlLmdldChoZWFkLm5hbWUpO1xuXG4gICAgICAgICAgcmV0dXJuIGJsb2NrLmJ1aWxkZXIubG9jYWxWYXIoaGVhZC5uYW1lLCBzeW1ib2wsIGlzUm9vdCwgb2Zmc2V0cyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGNvbnRleHQgPSBibG9jay5zdHJpY3QgPyBBU1R2Mi5TVFJJQ1RfUkVTT0xVVElPTiA6IHJlc29sdXRpb247XG4gICAgICAgICAgbGV0IHN5bWJvbCA9IGJsb2NrLnRhYmxlLmFsbG9jYXRlRnJlZShoZWFkLm5hbWUsIGNvbnRleHQpO1xuXG4gICAgICAgICAgcmV0dXJuIGJsb2NrLmJ1aWxkZXIuZnJlZVZhcih7XG4gICAgICAgICAgICBuYW1lOiBoZWFkLm5hbWUsXG4gICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgc3ltYm9sLFxuICAgICAgICAgICAgbG9jOiBvZmZzZXRzLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogYFRlbXBsYXRlTm9ybWFsaXplcmAgbm9ybWFsaXplcyB0b3AtbGV2ZWwgQVNUdjEgc3RhdGVtZW50cyB0byBBU1R2Mi5cbiAqL1xuY2xhc3MgU3RhdGVtZW50Tm9ybWFsaXplciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgYmxvY2s6IEJsb2NrQ29udGV4dCkge31cblxuICBub3JtYWxpemUobm9kZTogQVNUdjEuU3RhdGVtZW50KTogQVNUdjIuQ29udGVudE5vZGUgfCBBU1R2Mi5OYW1lZEJsb2NrIHtcbiAgICBzd2l0Y2ggKG5vZGUudHlwZSkge1xuICAgICAgY2FzZSAnUGFydGlhbFN0YXRlbWVudCc6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSGFuZGxlYmFycyBwYXJ0aWFsIHN5bnRheCAoe3s+IC4uLn19KSBpcyBub3QgYWxsb3dlZCBpbiBHbGltbWVyYCk7XG4gICAgICBjYXNlICdCbG9ja1N0YXRlbWVudCc6XG4gICAgICAgIHJldHVybiB0aGlzLkJsb2NrU3RhdGVtZW50KG5vZGUpO1xuICAgICAgY2FzZSAnRWxlbWVudE5vZGUnOlxuICAgICAgICByZXR1cm4gbmV3IEVsZW1lbnROb3JtYWxpemVyKHRoaXMuYmxvY2spLkVsZW1lbnROb2RlKG5vZGUpO1xuICAgICAgY2FzZSAnTXVzdGFjaGVTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5NdXN0YWNoZVN0YXRlbWVudChub2RlKTtcblxuICAgICAgLy8gVGhlc2UgYXJlIHRoZSBzYW1lIGluIEFTVHYyXG4gICAgICBjYXNlICdNdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQobm9kZSk7XG5cbiAgICAgIGNhc2UgJ0NvbW1lbnRTdGF0ZW1lbnQnOiB7XG4gICAgICAgIGxldCBsb2MgPSB0aGlzLmJsb2NrLmxvYyhub2RlLmxvYyk7XG4gICAgICAgIHJldHVybiBuZXcgQVNUdjIuSHRtbENvbW1lbnQoe1xuICAgICAgICAgIGxvYyxcbiAgICAgICAgICB0ZXh0OiBsb2Muc2xpY2UoeyBza2lwU3RhcnQ6IDQsIHNraXBFbmQ6IDMgfSkudG9TbGljZShub2RlLnZhbHVlKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGNhc2UgJ1RleHROb2RlJzpcbiAgICAgICAgcmV0dXJuIG5ldyBBU1R2Mi5IdG1sVGV4dCh7XG4gICAgICAgICAgbG9jOiB0aGlzLmJsb2NrLmxvYyhub2RlLmxvYyksXG4gICAgICAgICAgY2hhcnM6IG5vZGUuY2hhcnMsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIE11c3RhY2hlQ29tbWVudFN0YXRlbWVudChub2RlOiBBU1R2MS5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQpOiBBU1R2Mi5HbGltbWVyQ29tbWVudCB7XG4gICAgbGV0IGxvYyA9IHRoaXMuYmxvY2subG9jKG5vZGUubG9jKTtcbiAgICBsZXQgdGV4dExvYzogU291cmNlU3BhbjtcblxuICAgIGlmIChsb2MuYXNTdHJpbmcoKS5zbGljZSgwLCA1KSA9PT0gJ3t7IS0tJykge1xuICAgICAgdGV4dExvYyA9IGxvYy5zbGljZSh7IHNraXBTdGFydDogNSwgc2tpcEVuZDogNCB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGV4dExvYyA9IGxvYy5zbGljZSh7IHNraXBTdGFydDogMywgc2tpcEVuZDogMiB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFTVHYyLkdsaW1tZXJDb21tZW50KHtcbiAgICAgIGxvYyxcbiAgICAgIHRleHQ6IHRleHRMb2MudG9TbGljZShub2RlLnZhbHVlKSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3JtYWxpemVzIGFuIEFTVHYxLk11c3RhY2hlU3RhdGVtZW50IHRvIGFuIEFTVHYyLkFwcGVuZFN0YXRlbWVudFxuICAgKi9cbiAgTXVzdGFjaGVTdGF0ZW1lbnQobXVzdGFjaGU6IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50KTogQVNUdjIuQXBwZW5kQ29udGVudCB7XG4gICAgbGV0IHsgZXNjYXBlZCB9ID0gbXVzdGFjaGU7XG4gICAgbGV0IGxvYyA9IHRoaXMuYmxvY2subG9jKG11c3RhY2hlLmxvYyk7XG5cbiAgICAvLyBOb3JtYWxpemUgdGhlIGNhbGwgcGFydHMgaW4gQXBwZW5kU3ludGF4Q29udGV4dFxuICAgIGxldCBjYWxsUGFydHMgPSB0aGlzLmV4cHIuY2FsbFBhcnRzKFxuICAgICAge1xuICAgICAgICBwYXRoOiBtdXN0YWNoZS5wYXRoLFxuICAgICAgICBwYXJhbXM6IG11c3RhY2hlLnBhcmFtcyxcbiAgICAgICAgaGFzaDogbXVzdGFjaGUuaGFzaCxcbiAgICAgIH0sXG4gICAgICBBcHBlbmRTeW50YXhDb250ZXh0KG11c3RhY2hlKVxuICAgICk7XG5cbiAgICBsZXQgdmFsdWUgPSBjYWxsUGFydHMuYXJncy5pc0VtcHR5KClcbiAgICAgID8gY2FsbFBhcnRzLmNhbGxlZVxuICAgICAgOiB0aGlzLmJsb2NrLmJ1aWxkZXIuc2V4cChjYWxsUGFydHMsIGxvYyk7XG5cbiAgICByZXR1cm4gdGhpcy5ibG9jay5idWlsZGVyLmFwcGVuZChcbiAgICAgIHtcbiAgICAgICAgdGFibGU6IHRoaXMuYmxvY2sudGFibGUsXG4gICAgICAgIHRydXN0aW5nOiAhZXNjYXBlZCxcbiAgICAgICAgdmFsdWUsXG4gICAgICB9LFxuICAgICAgbG9jXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3JtYWxpemVzIGEgQVNUdjEuQmxvY2tTdGF0ZW1lbnQgdG8gYW4gQVNUdjIuQmxvY2tTdGF0ZW1lbnRcbiAgICovXG4gIEJsb2NrU3RhdGVtZW50KGJsb2NrOiBBU1R2MS5CbG9ja1N0YXRlbWVudCk6IEFTVHYyLkludm9rZUJsb2NrIHtcbiAgICBsZXQgeyBwcm9ncmFtLCBpbnZlcnNlIH0gPSBibG9jaztcbiAgICBsZXQgbG9jID0gdGhpcy5ibG9jay5sb2MoYmxvY2subG9jKTtcblxuICAgIGxldCByZXNvbHV0aW9uID0gdGhpcy5ibG9jay5yZXNvbHV0aW9uRm9yKGJsb2NrLCBCbG9ja1N5bnRheENvbnRleHQpO1xuXG4gICAgaWYgKHJlc29sdXRpb24ucmVzb2x1dGlvbiA9PT0gJ2Vycm9yJykge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgYFlvdSBhdHRlbXB0ZWQgdG8gaW52b2tlIGEgcGF0aCAoXFxge3sjJHtyZXNvbHV0aW9uLnBhdGh9fX1cXGApIGJ1dCAke3Jlc29sdXRpb24uaGVhZH0gd2FzIG5vdCBpbiBzY29wZWAsXG4gICAgICAgIGxvY1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBsZXQgY2FsbFBhcnRzID0gdGhpcy5leHByLmNhbGxQYXJ0cyhibG9jaywgcmVzb2x1dGlvbi5yZXNvbHV0aW9uKTtcblxuICAgIHJldHVybiB0aGlzLmJsb2NrLmJ1aWxkZXIuYmxvY2tTdGF0ZW1lbnQoXG4gICAgICBhc3NpZ24oXG4gICAgICAgIHtcbiAgICAgICAgICBzeW1ib2xzOiB0aGlzLmJsb2NrLnRhYmxlLFxuICAgICAgICAgIHByb2dyYW06IHRoaXMuQmxvY2socHJvZ3JhbSksXG4gICAgICAgICAgaW52ZXJzZTogaW52ZXJzZSA/IHRoaXMuQmxvY2soaW52ZXJzZSkgOiBudWxsLFxuICAgICAgICB9LFxuICAgICAgICBjYWxsUGFydHNcbiAgICAgICksXG4gICAgICBsb2NcbiAgICApO1xuICB9XG5cbiAgQmxvY2soeyBib2R5LCBsb2MsIGJsb2NrUGFyYW1zIH06IEFTVHYxLkJsb2NrKTogQVNUdjIuQmxvY2sge1xuICAgIGxldCBjaGlsZCA9IHRoaXMuYmxvY2suY2hpbGQoYmxvY2tQYXJhbXMpO1xuICAgIGxldCBub3JtYWxpemVyID0gbmV3IFN0YXRlbWVudE5vcm1hbGl6ZXIoY2hpbGQpO1xuICAgIHJldHVybiBuZXcgQmxvY2tDaGlsZHJlbihcbiAgICAgIHRoaXMuYmxvY2subG9jKGxvYyksXG4gICAgICBib2R5Lm1hcCgoYikgPT4gbm9ybWFsaXplci5ub3JtYWxpemUoYikpLFxuICAgICAgdGhpcy5ibG9ja1xuICAgICkuYXNzZXJ0QmxvY2soY2hpbGQudGFibGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXQgZXhwcigpOiBFeHByZXNzaW9uTm9ybWFsaXplciB7XG4gICAgcmV0dXJuIG5ldyBFeHByZXNzaW9uTm9ybWFsaXplcih0aGlzLmJsb2NrKTtcbiAgfVxufVxuXG5jbGFzcyBFbGVtZW50Tm9ybWFsaXplciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgY3R4OiBCbG9ja0NvbnRleHQpIHt9XG5cbiAgLyoqXG4gICAqIE5vcm1hbGl6ZXMgYW4gQVNUdjEuRWxlbWVudE5vZGUgdG86XG4gICAqXG4gICAqIC0gQVNUdjIuTmFtZWRCbG9jayBpZiB0aGUgdGFnIG5hbWUgYmVnaW5zIHdpdGggYDpgXG4gICAqIC0gQVNUdjIuQ29tcG9uZW50IGlmIHRoZSB0YWcgbmFtZSBtYXRjaGVzIHRoZSBjb21wb25lbnQgaGV1cmlzdGljc1xuICAgKiAtIEFTVHYyLlNpbXBsZUVsZW1lbnQgaWYgdGhlIHRhZyBuYW1lIGRvZXNuJ3QgbWF0Y2ggdGhlIGNvbXBvbmVudCBoZXVyaXN0aWNzXG4gICAqXG4gICAqIEEgdGFnIG5hbWUgcmVwcmVzZW50cyBhIGNvbXBvbmVudCBpZjpcbiAgICpcbiAgICogLSBpdCBiZWdpbnMgd2l0aCBgQGBcbiAgICogLSBpdCBpcyBleGFjdGx5IGB0aGlzYCBvciBiZWdpbnMgd2l0aCBgdGhpcy5gXG4gICAqIC0gdGhlIHBhcnQgYmVmb3JlIHRoZSBmaXJzdCBgLmAgaXMgYSByZWZlcmVuY2UgdG8gYW4gaW4tc2NvcGUgdmFyaWFibGUgYmluZGluZ1xuICAgKiAtIGl0IGJlZ2lucyB3aXRoIGFuIHVwcGVyY2FzZSBjaGFyYWN0ZXJcbiAgICovXG4gIEVsZW1lbnROb2RlKGVsZW1lbnQ6IEFTVHYxLkVsZW1lbnROb2RlKTogQVNUdjIuRWxlbWVudE5vZGUge1xuICAgIGxldCB7IHRhZywgc2VsZkNsb3NpbmcsIGNvbW1lbnRzIH0gPSBlbGVtZW50O1xuICAgIGxldCBsb2MgPSB0aGlzLmN0eC5sb2MoZWxlbWVudC5sb2MpO1xuXG4gICAgbGV0IFt0YWdIZWFkLCAuLi5yZXN0XSA9IHRhZy5zcGxpdCgnLicpO1xuXG4gICAgLy8gdGhlIGhlYWQsIGF0dHJpYnV0ZXMgYW5kIG1vZGlmaWVycyBhcmUgaW4gdGhlIGN1cnJlbnQgc2NvcGVcbiAgICBsZXQgcGF0aCA9IHRoaXMuY2xhc3NpZnlUYWcodGFnSGVhZCwgcmVzdCwgZWxlbWVudC5sb2MpO1xuXG4gICAgbGV0IGF0dHJzID0gZWxlbWVudC5hdHRyaWJ1dGVzLmZpbHRlcigoYSkgPT4gYS5uYW1lWzBdICE9PSAnQCcpLm1hcCgoYSkgPT4gdGhpcy5hdHRyKGEpKTtcbiAgICBsZXQgYXJncyA9IGVsZW1lbnQuYXR0cmlidXRlcy5maWx0ZXIoKGEpID0+IGEubmFtZVswXSA9PT0gJ0AnKS5tYXAoKGEpID0+IHRoaXMuYXJnKGEpKTtcblxuICAgIGxldCBtb2RpZmllcnMgPSBlbGVtZW50Lm1vZGlmaWVycy5tYXAoKG0pID0+IHRoaXMubW9kaWZpZXIobSkpO1xuXG4gICAgLy8gdGhlIGVsZW1lbnQncyBibG9jayBwYXJhbXMgYXJlIGluIHNjb3BlIGZvciB0aGUgY2hpbGRyZW5cbiAgICBsZXQgY2hpbGQgPSB0aGlzLmN0eC5jaGlsZChlbGVtZW50LmJsb2NrUGFyYW1zKTtcbiAgICBsZXQgbm9ybWFsaXplciA9IG5ldyBTdGF0ZW1lbnROb3JtYWxpemVyKGNoaWxkKTtcblxuICAgIGxldCBjaGlsZE5vZGVzID0gZWxlbWVudC5jaGlsZHJlbi5tYXAoKHMpID0+IG5vcm1hbGl6ZXIubm9ybWFsaXplKHMpKTtcblxuICAgIGxldCBlbCA9IHRoaXMuY3R4LmJ1aWxkZXIuZWxlbWVudCh7XG4gICAgICBzZWxmQ2xvc2luZyxcbiAgICAgIGF0dHJzLFxuICAgICAgY29tcG9uZW50QXJnczogYXJncyxcbiAgICAgIG1vZGlmaWVycyxcbiAgICAgIGNvbW1lbnRzOiBjb21tZW50cy5tYXAoKGMpID0+IG5ldyBTdGF0ZW1lbnROb3JtYWxpemVyKHRoaXMuY3R4KS5NdXN0YWNoZUNvbW1lbnRTdGF0ZW1lbnQoYykpLFxuICAgIH0pO1xuXG4gICAgbGV0IGNoaWxkcmVuID0gbmV3IEVsZW1lbnRDaGlsZHJlbihlbCwgbG9jLCBjaGlsZE5vZGVzLCB0aGlzLmN0eCk7XG5cbiAgICBsZXQgb2Zmc2V0cyA9IHRoaXMuY3R4LmxvYyhlbGVtZW50LmxvYyk7XG4gICAgbGV0IHRhZ09mZnNldHMgPSBvZmZzZXRzLnNsaWNlU3RhcnRDaGFycyh7IGNoYXJzOiB0YWcubGVuZ3RoLCBza2lwU3RhcnQ6IDEgfSk7XG5cbiAgICBpZiAocGF0aCA9PT0gJ0VsZW1lbnRIZWFkJykge1xuICAgICAgaWYgKHRhZ1swXSA9PT0gJzonKSB7XG4gICAgICAgIHJldHVybiBjaGlsZHJlbi5hc3NlcnROYW1lZEJsb2NrKFxuICAgICAgICAgIHRhZ09mZnNldHMuc2xpY2UoeyBza2lwU3RhcnQ6IDEgfSkudG9TbGljZSh0YWcuc2xpY2UoMSkpLFxuICAgICAgICAgIGNoaWxkLnRhYmxlXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY2hpbGRyZW4uYXNzZXJ0RWxlbWVudCh0YWdPZmZzZXRzLnRvU2xpY2UodGFnKSwgZWxlbWVudC5ibG9ja1BhcmFtcy5sZW5ndGggPiAwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZWxlbWVudC5zZWxmQ2xvc2luZykge1xuICAgICAgcmV0dXJuIGVsLnNlbGZDbG9zaW5nQ29tcG9uZW50KHBhdGgsIGxvYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBibG9ja3MgPSBjaGlsZHJlbi5hc3NlcnRDb21wb25lbnQodGFnLCBjaGlsZC50YWJsZSwgZWxlbWVudC5ibG9ja1BhcmFtcy5sZW5ndGggPiAwKTtcbiAgICAgIHJldHVybiBlbC5jb21wb25lbnRXaXRoTmFtZWRCbG9ja3MocGF0aCwgYmxvY2tzLCBsb2MpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgbW9kaWZpZXIobTogQVNUdjEuRWxlbWVudE1vZGlmaWVyU3RhdGVtZW50KTogQVNUdjIuRWxlbWVudE1vZGlmaWVyIHtcbiAgICBsZXQgcmVzb2x1dGlvbiA9IHRoaXMuY3R4LnJlc29sdXRpb25Gb3IobSwgTW9kaWZpZXJTeW50YXhDb250ZXh0KTtcblxuICAgIGlmIChyZXNvbHV0aW9uLnJlc29sdXRpb24gPT09ICdlcnJvcicpIHtcbiAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgIGBZb3UgYXR0ZW1wdGVkIHRvIGludm9rZSBhIHBhdGggKFxcYHt7IyR7cmVzb2x1dGlvbi5wYXRofX19XFxgKSBhcyBhIG1vZGlmaWVyLCBidXQgJHtyZXNvbHV0aW9uLmhlYWR9IHdhcyBub3QgaW4gc2NvcGUuIFRyeSBhZGRpbmcgXFxgdGhpc1xcYCB0byB0aGUgYmVnaW5uaW5nIG9mIHRoZSBwYXRoYCxcbiAgICAgICAgbS5sb2NcbiAgICAgICk7XG4gICAgfVxuXG4gICAgbGV0IGNhbGxQYXJ0cyA9IHRoaXMuZXhwci5jYWxsUGFydHMobSwgcmVzb2x1dGlvbi5yZXNvbHV0aW9uKTtcbiAgICByZXR1cm4gdGhpcy5jdHguYnVpbGRlci5tb2RpZmllcihjYWxsUGFydHMsIHRoaXMuY3R4LmxvYyhtLmxvYykpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIGhhbmRsZXMgYXR0cmlidXRlIHZhbHVlcyB0aGF0IGFyZSBjdXJsaWVzLCBhcyB3ZWxsIGFzIGN1cmxpZXMgbmVzdGVkIGluc2lkZSBvZlxuICAgKiBpbnRlcnBvbGF0aW9uczpcbiAgICpcbiAgICogYGBgaGJzXG4gICAqIDxhIGhyZWY9e3t1cmx9fSAvPlxuICAgKiA8YSBocmVmPVwie3t1cmx9fS5odG1sXCIgLz5cbiAgICogYGBgXG4gICAqL1xuICBwcml2YXRlIG11c3RhY2hlQXR0cihtdXN0YWNoZTogQVNUdjEuTXVzdGFjaGVTdGF0ZW1lbnQpOiBBU1R2Mi5FeHByZXNzaW9uTm9kZSB7XG4gICAgLy8gTm9ybWFsaXplIHRoZSBjYWxsIHBhcnRzIGluIEF0dHJWYWx1ZVN5bnRheENvbnRleHRcbiAgICBsZXQgc2V4cCA9IHRoaXMuY3R4LmJ1aWxkZXIuc2V4cChcbiAgICAgIHRoaXMuZXhwci5jYWxsUGFydHMobXVzdGFjaGUsIEF0dHJWYWx1ZVN5bnRheENvbnRleHQobXVzdGFjaGUpKSxcbiAgICAgIHRoaXMuY3R4LmxvYyhtdXN0YWNoZS5sb2MpXG4gICAgKTtcblxuICAgIC8vIElmIHRoZXJlIGFyZSBubyBwYXJhbXMgb3IgaGFzaCwganVzdCByZXR1cm4gdGhlIGZ1bmN0aW9uIHBhcnQgYXMgaXRzIG93biBleHByZXNzaW9uXG4gICAgaWYgKHNleHAuYXJncy5pc0VtcHR5KCkpIHtcbiAgICAgIHJldHVybiBzZXhwLmNhbGxlZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHNleHA7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIGF0dHJQYXJ0IGlzIHRoZSBuYXJyb3dlZCBkb3duIGxpc3Qgb2YgdmFsaWQgYXR0cmlidXRlIHZhbHVlcyB0aGF0IGFyZSBhbHNvXG4gICAqIGFsbG93ZWQgYXMgYSBjb25jYXQgcGFydCAoeW91IGNhbid0IG5lc3QgY29uY2F0cykuXG4gICAqL1xuICBwcml2YXRlIGF0dHJQYXJ0KFxuICAgIHBhcnQ6IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50IHwgQVNUdjEuVGV4dE5vZGVcbiAgKTogeyBleHByOiBBU1R2Mi5FeHByZXNzaW9uTm9kZTsgdHJ1c3Rpbmc6IGJvb2xlYW4gfSB7XG4gICAgc3dpdGNoIChwYXJ0LnR5cGUpIHtcbiAgICAgIGNhc2UgJ011c3RhY2hlU3RhdGVtZW50JzpcbiAgICAgICAgcmV0dXJuIHsgZXhwcjogdGhpcy5tdXN0YWNoZUF0dHIocGFydCksIHRydXN0aW5nOiAhcGFydC5lc2NhcGVkIH07XG4gICAgICBjYXNlICdUZXh0Tm9kZSc6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZXhwcjogdGhpcy5jdHguYnVpbGRlci5saXRlcmFsKHBhcnQuY2hhcnMsIHRoaXMuY3R4LmxvYyhwYXJ0LmxvYykpLFxuICAgICAgICAgIHRydXN0aW5nOiB0cnVlLFxuICAgICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXR0clZhbHVlKFxuICAgIHBhcnQ6IEFTVHYxLk11c3RhY2hlU3RhdGVtZW50IHwgQVNUdjEuVGV4dE5vZGUgfCBBU1R2MS5Db25jYXRTdGF0ZW1lbnRcbiAgKTogeyBleHByOiBBU1R2Mi5FeHByZXNzaW9uTm9kZTsgdHJ1c3Rpbmc6IGJvb2xlYW4gfSB7XG4gICAgc3dpdGNoIChwYXJ0LnR5cGUpIHtcbiAgICAgIGNhc2UgJ0NvbmNhdFN0YXRlbWVudCc6IHtcbiAgICAgICAgbGV0IHBhcnRzID0gcGFydC5wYXJ0cy5tYXAoKHApID0+IHRoaXMuYXR0clBhcnQocCkuZXhwcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZXhwcjogdGhpcy5jdHguYnVpbGRlci5pbnRlcnBvbGF0ZShwYXJ0cywgdGhpcy5jdHgubG9jKHBhcnQubG9jKSksXG4gICAgICAgICAgdHJ1c3Rpbmc6IGZhbHNlLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHRoaXMuYXR0clBhcnQocGFydCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhdHRyKG06IEFTVHYxLkF0dHJOb2RlKTogQVNUdjIuSHRtbE9yU3BsYXRBdHRyIHtcbiAgICBhc3NlcnQobS5uYW1lWzBdICE9PSAnQCcsICdBbiBhdHRyIG5hbWUgbXVzdCBub3Qgc3RhcnQgd2l0aCBgQGAnKTtcblxuICAgIGlmIChtLm5hbWUgPT09ICcuLi5hdHRyaWJ1dGVzJykge1xuICAgICAgcmV0dXJuIHRoaXMuY3R4LmJ1aWxkZXIuc3BsYXRBdHRyKHRoaXMuY3R4LnRhYmxlLmFsbG9jYXRlQmxvY2soJ2F0dHJzJyksIHRoaXMuY3R4LmxvYyhtLmxvYykpO1xuICAgIH1cblxuICAgIGxldCBvZmZzZXRzID0gdGhpcy5jdHgubG9jKG0ubG9jKTtcbiAgICBsZXQgbmFtZVNsaWNlID0gb2Zmc2V0cy5zbGljZVN0YXJ0Q2hhcnMoeyBjaGFyczogbS5uYW1lLmxlbmd0aCB9KS50b1NsaWNlKG0ubmFtZSk7XG5cbiAgICBsZXQgdmFsdWUgPSB0aGlzLmF0dHJWYWx1ZShtLnZhbHVlKTtcbiAgICByZXR1cm4gdGhpcy5jdHguYnVpbGRlci5hdHRyKFxuICAgICAgeyBuYW1lOiBuYW1lU2xpY2UsIHZhbHVlOiB2YWx1ZS5leHByLCB0cnVzdGluZzogdmFsdWUudHJ1c3RpbmcgfSxcbiAgICAgIG9mZnNldHNcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXliZURlcHJlY2F0ZWRDYWxsKFxuICAgIGFyZzogU291cmNlU2xpY2UsXG4gICAgcGFydDogQVNUdjEuTXVzdGFjaGVTdGF0ZW1lbnQgfCBBU1R2MS5UZXh0Tm9kZSB8IEFTVHYxLkNvbmNhdFN0YXRlbWVudFxuICApOiB7IGV4cHI6IEFTVHYyLkRlcHJlY2F0ZWRDYWxsRXhwcmVzc2lvbjsgdHJ1c3Rpbmc6IGJvb2xlYW4gfSB8IG51bGwge1xuICAgIGlmICh0aGlzLmN0eC5zdHJpY3QpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChwYXJ0LnR5cGUgIT09ICdNdXN0YWNoZVN0YXRlbWVudCcpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCB7IHBhdGggfSA9IHBhcnQ7XG5cbiAgICBpZiAocGF0aC50eXBlICE9PSAnUGF0aEV4cHJlc3Npb24nKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAocGF0aC5oZWFkLnR5cGUgIT09ICdWYXJIZWFkJykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IHsgbmFtZSB9ID0gcGF0aC5oZWFkO1xuXG4gICAgaWYgKG5hbWUgPT09ICdoYXMtYmxvY2snIHx8IG5hbWUgPT09ICdoYXMtYmxvY2stcGFyYW1zJykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY3R4Lmhhc0JpbmRpbmcobmFtZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChwYXRoLnRhaWwubGVuZ3RoICE9PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAocGFydC5wYXJhbXMubGVuZ3RoICE9PSAwIHx8IHBhcnQuaGFzaC5wYWlycy5sZW5ndGggIT09IDApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCBjb250ZXh0ID0gQVNUdjIuTG9vc2VNb2RlUmVzb2x1dGlvbi5hdHRyKCk7XG5cbiAgICBsZXQgY2FsbGVlID0gdGhpcy5jdHguYnVpbGRlci5mcmVlVmFyKHtcbiAgICAgIG5hbWUsXG4gICAgICBjb250ZXh0LFxuICAgICAgc3ltYm9sOiB0aGlzLmN0eC50YWJsZS5hbGxvY2F0ZUZyZWUobmFtZSwgY29udGV4dCksXG4gICAgICBsb2M6IHBhdGgubG9jLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGV4cHI6IHRoaXMuY3R4LmJ1aWxkZXIuZGVwcmVjYXRlZENhbGwoYXJnLCBjYWxsZWUsIHBhcnQubG9jKSxcbiAgICAgIHRydXN0aW5nOiBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBhcmcoYXJnOiBBU1R2MS5BdHRyTm9kZSk6IEFTVHYyLkNvbXBvbmVudEFyZyB7XG4gICAgYXNzZXJ0KGFyZy5uYW1lWzBdID09PSAnQCcsICdBbiBhcmcgbmFtZSBtdXN0IHN0YXJ0IHdpdGggYEBgJyk7XG5cbiAgICBsZXQgb2Zmc2V0cyA9IHRoaXMuY3R4LmxvYyhhcmcubG9jKTtcbiAgICBsZXQgbmFtZVNsaWNlID0gb2Zmc2V0cy5zbGljZVN0YXJ0Q2hhcnMoeyBjaGFyczogYXJnLm5hbWUubGVuZ3RoIH0pLnRvU2xpY2UoYXJnLm5hbWUpO1xuXG4gICAgbGV0IHZhbHVlID0gdGhpcy5tYXliZURlcHJlY2F0ZWRDYWxsKG5hbWVTbGljZSwgYXJnLnZhbHVlKSB8fCB0aGlzLmF0dHJWYWx1ZShhcmcudmFsdWUpO1xuICAgIHJldHVybiB0aGlzLmN0eC5idWlsZGVyLmFyZyhcbiAgICAgIHsgbmFtZTogbmFtZVNsaWNlLCB2YWx1ZTogdmFsdWUuZXhwciwgdHJ1c3Rpbmc6IHZhbHVlLnRydXN0aW5nIH0sXG4gICAgICBvZmZzZXRzXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIGZ1bmN0aW9uIGNsYXNzaWZpZXMgdGhlIGhlYWQgb2YgYW4gQVNUdjEuRWxlbWVudCBpbnRvIGFuIEFTVHYyLlBhdGhIZWFkIChpZiB0aGVcbiAgICogZWxlbWVudCBpcyBhIGNvbXBvbmVudCkgb3IgYCdFbGVtZW50SGVhZCdgIChpZiB0aGUgZWxlbWVudCBpcyBhIHNpbXBsZSBlbGVtZW50KS5cbiAgICpcbiAgICogUnVsZXM6XG4gICAqXG4gICAqIDEuIElmIHRoZSB2YXJpYWJsZSBpcyBhbiBgQGFyZ2AsIHJldHVybiBhbiBgQXRIZWFkYFxuICAgKiAyLiBJZiB0aGUgdmFyaWFibGUgaXMgYHRoaXNgLCByZXR1cm4gYSBgVGhpc0hlYWRgXG4gICAqIDMuIElmIHRoZSB2YXJpYWJsZSBpcyBpbiB0aGUgY3VycmVudCBzY29wZTpcbiAgICogICBhLiBJZiB0aGUgc2NvcGUgaXMgdGhlIHJvb3Qgc2NvcGUsIHRoZW4gcmV0dXJuIGEgRnJlZSBgTG9jYWxWYXJIZWFkYFxuICAgKiAgIGIuIEVsc2UsIHJldHVybiBhIHN0YW5kYXJkIGBMb2NhbFZhckhlYWRgXG4gICAqIDQuIElmIHRoZSB0YWcgbmFtZSBpcyBhIHBhdGggYW5kIHRoZSB2YXJpYWJsZSBpcyBub3QgaW4gdGhlIGN1cnJlbnQgc2NvcGUsIFN5bnRheCBFcnJvclxuICAgKiA1LiBJZiB0aGUgdmFyaWFibGUgaXMgdXBwZXJjYXNlIHJldHVybiBhIEZyZWVWYXIoUmVzb2x2ZUFzQ29tcG9uZW50SGVhZClcbiAgICogNi4gT3RoZXJ3aXNlLCByZXR1cm4gYCdFbGVtZW50SGVhZCdgXG4gICAqL1xuICBwcml2YXRlIGNsYXNzaWZ5VGFnKFxuICAgIHZhcmlhYmxlOiBzdHJpbmcsXG4gICAgdGFpbDogc3RyaW5nW10sXG4gICAgbG9jOiBTb3VyY2VTcGFuXG4gICk6IEFTVHYyLkV4cHJlc3Npb25Ob2RlIHwgJ0VsZW1lbnRIZWFkJyB7XG4gICAgbGV0IHVwcGVyY2FzZSA9IGlzVXBwZXJDYXNlKHZhcmlhYmxlKTtcbiAgICBsZXQgaW5TY29wZSA9IHZhcmlhYmxlWzBdID09PSAnQCcgfHwgdmFyaWFibGUgPT09ICd0aGlzJyB8fCB0aGlzLmN0eC5oYXNCaW5kaW5nKHZhcmlhYmxlKTtcblxuICAgIGlmICh0aGlzLmN0eC5zdHJpY3QgJiYgIWluU2NvcGUpIHtcbiAgICAgIGlmICh1cHBlcmNhc2UpIHtcbiAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICBgQXR0ZW1wdGVkIHRvIGludm9rZSBhIGNvbXBvbmVudCB0aGF0IHdhcyBub3QgaW4gc2NvcGUgaW4gYSBzdHJpY3QgbW9kZSB0ZW1wbGF0ZSwgXFxgPCR7dmFyaWFibGV9PlxcYC4gSWYgeW91IHdhbnRlZCB0byBjcmVhdGUgYW4gZWxlbWVudCB3aXRoIHRoYXQgbmFtZSwgY29udmVydCBpdCB0byBsb3dlcmNhc2UgLSBcXGA8JHt2YXJpYWJsZS50b0xvd2VyQ2FzZSgpfT5cXGBgLFxuICAgICAgICAgIGxvY1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBJbiBzdHJpY3QgbW9kZSwgdmFsdWVzIGFyZSBhbHdheXMgZWxlbWVudHMgdW5sZXNzIHRoZXkgYXJlIGluIHNjb3BlXG4gICAgICByZXR1cm4gJ0VsZW1lbnRIZWFkJztcbiAgICB9XG5cbiAgICAvLyBTaW5jZSB0aGUgcGFyc2VyIGhhbmRlZCB1cyB0aGUgSFRNTCBlbGVtZW50IG5hbWUgYXMgYSBzdHJpbmcsIHdlIG5lZWRcbiAgICAvLyB0byBjb252ZXJ0IGl0IGludG8gYW4gQVNUdjEgcGF0aCBzbyBpdCBjYW4gYmUgcHJvY2Vzc2VkIHVzaW5nIHRoZVxuICAgIC8vIGV4cHJlc3Npb24gbm9ybWFsaXplci5cbiAgICBsZXQgaXNDb21wb25lbnQgPSBpblNjb3BlIHx8IHVwcGVyY2FzZTtcblxuICAgIGxldCB2YXJpYWJsZUxvYyA9IGxvYy5zbGljZVN0YXJ0Q2hhcnMoeyBza2lwU3RhcnQ6IDEsIGNoYXJzOiB2YXJpYWJsZS5sZW5ndGggfSk7XG5cbiAgICBsZXQgdGFpbExlbmd0aCA9IHRhaWwucmVkdWNlKChhY2N1bSwgcGFydCkgPT4gYWNjdW0gKyAxICsgcGFydC5sZW5ndGgsIDApO1xuICAgIGxldCBwYXRoRW5kID0gdmFyaWFibGVMb2MuZ2V0RW5kKCkubW92ZSh0YWlsTGVuZ3RoKTtcbiAgICBsZXQgcGF0aExvYyA9IHZhcmlhYmxlTG9jLndpdGhFbmQocGF0aEVuZCk7XG5cbiAgICBpZiAoaXNDb21wb25lbnQpIHtcbiAgICAgIGxldCBwYXRoID0gYi5wYXRoKHtcbiAgICAgICAgaGVhZDogYi5oZWFkKHZhcmlhYmxlLCB2YXJpYWJsZUxvYyksXG4gICAgICAgIHRhaWwsXG4gICAgICAgIGxvYzogcGF0aExvYyxcbiAgICAgIH0pO1xuXG4gICAgICBsZXQgcmVzb2x1dGlvbiA9IHRoaXMuY3R4LnJlc29sdXRpb25Gb3IocGF0aCwgQ29tcG9uZW50U3ludGF4Q29udGV4dCk7XG5cbiAgICAgIGlmIChyZXNvbHV0aW9uLnJlc29sdXRpb24gPT09ICdlcnJvcicpIHtcbiAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICBgWW91IGF0dGVtcHRlZCB0byBpbnZva2UgYSBwYXRoIChcXGA8JHtyZXNvbHV0aW9uLnBhdGh9PlxcYCkgYnV0ICR7cmVzb2x1dGlvbi5oZWFkfSB3YXMgbm90IGluIHNjb3BlYCxcbiAgICAgICAgICBsb2NcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG5ldyBFeHByZXNzaW9uTm9ybWFsaXplcih0aGlzLmN0eCkubm9ybWFsaXplKHBhdGgsIHJlc29sdXRpb24ucmVzb2x1dGlvbik7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHRhZyBuYW1lIHdhc24ndCBhIHZhbGlkIGNvbXBvbmVudCBidXQgY29udGFpbmVkIGEgYC5gLCBpdCdzXG4gICAgLy8gYSBzeW50YXggZXJyb3IuXG4gICAgaWYgKHRhaWwubGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgYFlvdSB1c2VkICR7dmFyaWFibGV9LiR7dGFpbC5qb2luKCcuJyl9IGFzIGEgdGFnIG5hbWUsIGJ1dCAke3ZhcmlhYmxlfSBpcyBub3QgaW4gc2NvcGVgLFxuICAgICAgICBsb2NcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuICdFbGVtZW50SGVhZCc7XG4gIH1cblxuICBwcml2YXRlIGdldCBleHByKCk6IEV4cHJlc3Npb25Ob3JtYWxpemVyIHtcbiAgICByZXR1cm4gbmV3IEV4cHJlc3Npb25Ob3JtYWxpemVyKHRoaXMuY3R4KTtcbiAgfVxufVxuXG5jbGFzcyBDaGlsZHJlbiB7XG4gIHJlYWRvbmx5IG5hbWVkQmxvY2tzOiBBU1R2Mi5OYW1lZEJsb2NrW107XG4gIHJlYWRvbmx5IGhhc1NlbWFudGljQ29udGVudDogYm9vbGVhbjtcbiAgcmVhZG9ubHkgbm9uQmxvY2tDaGlsZHJlbjogQVNUdjIuQ29udGVudE5vZGVbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICByZWFkb25seSBsb2M6IFNvdXJjZVNwYW4sXG4gICAgcmVhZG9ubHkgY2hpbGRyZW46IChBU1R2Mi5Db250ZW50Tm9kZSB8IEFTVHYyLk5hbWVkQmxvY2spW10sXG4gICAgcmVhZG9ubHkgYmxvY2s6IEJsb2NrQ29udGV4dFxuICApIHtcbiAgICB0aGlzLm5hbWVkQmxvY2tzID0gY2hpbGRyZW4uZmlsdGVyKChjKTogYyBpcyBBU1R2Mi5OYW1lZEJsb2NrID0+IGMgaW5zdGFuY2VvZiBBU1R2Mi5OYW1lZEJsb2NrKTtcbiAgICB0aGlzLmhhc1NlbWFudGljQ29udGVudCA9IEJvb2xlYW4oXG4gICAgICBjaGlsZHJlbi5maWx0ZXIoKGMpOiBjIGlzIEFTVHYyLkNvbnRlbnROb2RlID0+IHtcbiAgICAgICAgaWYgKGMgaW5zdGFuY2VvZiBBU1R2Mi5OYW1lZEJsb2NrKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHN3aXRjaCAoYy50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnR2xpbW1lckNvbW1lbnQnOlxuICAgICAgICAgIGNhc2UgJ0h0bWxDb21tZW50JzpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBjYXNlICdIdG1sVGV4dCc6XG4gICAgICAgICAgICByZXR1cm4gIS9eXFxzKiQvLmV4ZWMoYy5jaGFycyk7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KS5sZW5ndGhcbiAgICApO1xuICAgIHRoaXMubm9uQmxvY2tDaGlsZHJlbiA9IGNoaWxkcmVuLmZpbHRlcihcbiAgICAgIChjKTogYyBpcyBBU1R2Mi5Db250ZW50Tm9kZSA9PiAhKGMgaW5zdGFuY2VvZiBBU1R2Mi5OYW1lZEJsb2NrKVxuICAgICk7XG4gIH1cbn1cblxuY2xhc3MgVGVtcGxhdGVDaGlsZHJlbiBleHRlbmRzIENoaWxkcmVuIHtcbiAgYXNzZXJ0VGVtcGxhdGUodGFibGU6IFByb2dyYW1TeW1ib2xUYWJsZSk6IEFTVHYyLlRlbXBsYXRlIHtcbiAgICBpZiAoaXNQcmVzZW50KHRoaXMubmFtZWRCbG9ja3MpKSB7XG4gICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKGBVbmV4cGVjdGVkIG5hbWVkIGJsb2NrIGF0IHRoZSB0b3AtbGV2ZWwgb2YgYSB0ZW1wbGF0ZWAsIHRoaXMubG9jKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5ibG9jay5idWlsZGVyLnRlbXBsYXRlKHRhYmxlLCB0aGlzLm5vbkJsb2NrQ2hpbGRyZW4sIHRoaXMuYmxvY2subG9jKHRoaXMubG9jKSk7XG4gIH1cbn1cblxuY2xhc3MgQmxvY2tDaGlsZHJlbiBleHRlbmRzIENoaWxkcmVuIHtcbiAgYXNzZXJ0QmxvY2sodGFibGU6IEJsb2NrU3ltYm9sVGFibGUpOiBBU1R2Mi5CbG9jayB7XG4gICAgaWYgKGlzUHJlc2VudCh0aGlzLm5hbWVkQmxvY2tzKSkge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihgVW5leHBlY3RlZCBuYW1lZCBibG9jayBuZXN0ZWQgaW4gYSBub3JtYWwgYmxvY2tgLCB0aGlzLmxvYyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuYmxvY2suYnVpbGRlci5ibG9jayh0YWJsZSwgdGhpcy5ub25CbG9ja0NoaWxkcmVuLCB0aGlzLmxvYyk7XG4gIH1cbn1cblxuY2xhc3MgRWxlbWVudENoaWxkcmVuIGV4dGVuZHMgQ2hpbGRyZW4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGVsOiBCdWlsZEVsZW1lbnQsXG4gICAgbG9jOiBTb3VyY2VTcGFuLFxuICAgIGNoaWxkcmVuOiAoQVNUdjIuQ29udGVudE5vZGUgfCBBU1R2Mi5OYW1lZEJsb2NrKVtdLFxuICAgIGJsb2NrOiBCbG9ja0NvbnRleHRcbiAgKSB7XG4gICAgc3VwZXIobG9jLCBjaGlsZHJlbiwgYmxvY2spO1xuICB9XG5cbiAgYXNzZXJ0TmFtZWRCbG9jayhuYW1lOiBTb3VyY2VTbGljZSwgdGFibGU6IEJsb2NrU3ltYm9sVGFibGUpOiBBU1R2Mi5OYW1lZEJsb2NrIHtcbiAgICBpZiAodGhpcy5lbC5iYXNlLnNlbGZDbG9zaW5nKSB7XG4gICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgICBgPDoke25hbWUuY2hhcnN9Lz4gaXMgbm90IGEgdmFsaWQgbmFtZWQgYmxvY2s6IG5hbWVkIGJsb2NrcyBjYW5ub3QgYmUgc2VsZi1jbG9zaW5nYCxcbiAgICAgICAgdGhpcy5sb2NcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGlzUHJlc2VudCh0aGlzLm5hbWVkQmxvY2tzKSkge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgYFVuZXhwZWN0ZWQgbmFtZWQgYmxvY2sgaW5zaWRlIDw6JHtuYW1lLmNoYXJzfT4gbmFtZWQgYmxvY2s6IG5hbWVkIGJsb2NrcyBjYW5ub3QgY29udGFpbiBuZXN0ZWQgbmFtZWQgYmxvY2tzYCxcbiAgICAgICAgdGhpcy5sb2NcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFpc0xvd2VyQ2FzZShuYW1lLmNoYXJzKSkge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgYDw6JHtuYW1lLmNoYXJzfT4gaXMgbm90IGEgdmFsaWQgbmFtZWQgYmxvY2ssIGFuZCBuYW1lZCBibG9ja3MgbXVzdCBiZWdpbiB3aXRoIGEgbG93ZXJjYXNlIGxldHRlcmAsXG4gICAgICAgIHRoaXMubG9jXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHRoaXMuZWwuYmFzZS5hdHRycy5sZW5ndGggPiAwIHx8XG4gICAgICB0aGlzLmVsLmJhc2UuY29tcG9uZW50QXJncy5sZW5ndGggPiAwIHx8XG4gICAgICB0aGlzLmVsLmJhc2UubW9kaWZpZXJzLmxlbmd0aCA+IDBcbiAgICApIHtcbiAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgIGBuYW1lZCBibG9jayA8OiR7bmFtZS5jaGFyc30+IGNhbm5vdCBoYXZlIGF0dHJpYnV0ZXMsIGFyZ3VtZW50cywgb3IgbW9kaWZpZXJzYCxcbiAgICAgICAgdGhpcy5sb2NcbiAgICAgICk7XG4gICAgfVxuXG4gICAgbGV0IG9mZnNldHMgPSBTcGFuTGlzdC5yYW5nZSh0aGlzLm5vbkJsb2NrQ2hpbGRyZW4sIHRoaXMubG9jKTtcblxuICAgIHJldHVybiB0aGlzLmJsb2NrLmJ1aWxkZXIubmFtZWRCbG9jayhcbiAgICAgIG5hbWUsXG4gICAgICB0aGlzLmJsb2NrLmJ1aWxkZXIuYmxvY2sodGFibGUsIHRoaXMubm9uQmxvY2tDaGlsZHJlbiwgb2Zmc2V0cyksXG4gICAgICB0aGlzLmxvY1xuICAgICk7XG4gIH1cblxuICBhc3NlcnRFbGVtZW50KG5hbWU6IFNvdXJjZVNsaWNlLCBoYXNCbG9ja1BhcmFtczogYm9vbGVhbik6IEFTVHYyLlNpbXBsZUVsZW1lbnQge1xuICAgIGlmIChoYXNCbG9ja1BhcmFtcykge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgYFVuZXhwZWN0ZWQgYmxvY2sgcGFyYW1zIGluIDwke25hbWV9Pjogc2ltcGxlIGVsZW1lbnRzIGNhbm5vdCBoYXZlIGJsb2NrIHBhcmFtc2AsXG4gICAgICAgIHRoaXMubG9jXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmIChpc1ByZXNlbnQodGhpcy5uYW1lZEJsb2NrcykpIHtcbiAgICAgIGxldCBuYW1lcyA9IHRoaXMubmFtZWRCbG9ja3MubWFwKChiKSA9PiBiLm5hbWUpO1xuXG4gICAgICBpZiAobmFtZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYFVuZXhwZWN0ZWQgbmFtZWQgYmxvY2sgPDpmb28+IGluc2lkZSA8JHtuYW1lLmNoYXJzfT4gSFRNTCBlbGVtZW50YCxcbiAgICAgICAgICB0aGlzLmxvY1xuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IHByaW50ZWROYW1lcyA9IG5hbWVzLm1hcCgobikgPT4gYDw6JHtuLmNoYXJzfT5gKS5qb2luKCcsICcpO1xuICAgICAgICB0aHJvdyBnZW5lcmF0ZVN5bnRheEVycm9yKFxuICAgICAgICAgIGBVbmV4cGVjdGVkIG5hbWVkIGJsb2NrcyBpbnNpZGUgPCR7bmFtZS5jaGFyc30+IEhUTUwgZWxlbWVudCAoJHtwcmludGVkTmFtZXN9KWAsXG4gICAgICAgICAgdGhpcy5sb2NcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5lbC5zaW1wbGUobmFtZSwgdGhpcy5ub25CbG9ja0NoaWxkcmVuLCB0aGlzLmxvYyk7XG4gIH1cblxuICBhc3NlcnRDb21wb25lbnQoXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHRhYmxlOiBCbG9ja1N5bWJvbFRhYmxlLFxuICAgIGhhc0Jsb2NrUGFyYW1zOiBib29sZWFuXG4gICk6IFByZXNlbnRBcnJheTxBU1R2Mi5OYW1lZEJsb2NrPiB7XG4gICAgaWYgKGlzUHJlc2VudCh0aGlzLm5hbWVkQmxvY2tzKSAmJiB0aGlzLmhhc1NlbWFudGljQ29udGVudCkge1xuICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgYFVuZXhwZWN0ZWQgY29udGVudCBpbnNpZGUgPCR7bmFtZX0+IGNvbXBvbmVudCBpbnZvY2F0aW9uOiB3aGVuIHVzaW5nIG5hbWVkIGJsb2NrcywgdGhlIHRhZyBjYW5ub3QgY29udGFpbiBvdGhlciBjb250ZW50YCxcbiAgICAgICAgdGhpcy5sb2NcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGlzUHJlc2VudCh0aGlzLm5hbWVkQmxvY2tzKSkge1xuICAgICAgaWYgKGhhc0Jsb2NrUGFyYW1zKSB7XG4gICAgICAgIHRocm93IGdlbmVyYXRlU3ludGF4RXJyb3IoXG4gICAgICAgICAgYFVuZXhwZWN0ZWQgYmxvY2sgcGFyYW1zIGxpc3Qgb24gPCR7bmFtZX0+IGNvbXBvbmVudCBpbnZvY2F0aW9uOiB3aGVuIHBhc3NpbmcgbmFtZWQgYmxvY2tzLCB0aGUgaW52b2NhdGlvbiB0YWcgY2Fubm90IHRha2UgYmxvY2sgcGFyYW1zYCxcbiAgICAgICAgICB0aGlzLmxvY1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBsZXQgc2Vlbk5hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICAgIGZvciAobGV0IGJsb2NrIG9mIHRoaXMubmFtZWRCbG9ja3MpIHtcbiAgICAgICAgbGV0IG5hbWUgPSBibG9jay5uYW1lLmNoYXJzO1xuXG4gICAgICAgIGlmIChzZWVuTmFtZXMuaGFzKG5hbWUpKSB7XG4gICAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICAgIGBDb21wb25lbnQgaGFkIHR3byBuYW1lZCBibG9ja3Mgd2l0aCB0aGUgc2FtZSBuYW1lLCBcXGA8OiR7bmFtZX0+XFxgLiBPbmx5IG9uZSBibG9jayB3aXRoIGEgZ2l2ZW4gbmFtZSBtYXkgYmUgcGFzc2VkYCxcbiAgICAgICAgICAgIHRoaXMubG9jXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAobmFtZSA9PT0gJ2ludmVyc2UnICYmIHNlZW5OYW1lcy5oYXMoJ2Vsc2UnKSkgfHxcbiAgICAgICAgICAobmFtZSA9PT0gJ2Vsc2UnICYmIHNlZW5OYW1lcy5oYXMoJ2ludmVyc2UnKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgZ2VuZXJhdGVTeW50YXhFcnJvcihcbiAgICAgICAgICAgIGBDb21wb25lbnQgaGFzIGJvdGggPDplbHNlPiBhbmQgPDppbnZlcnNlPiBibG9jay4gPDppbnZlcnNlPiBpcyBhbiBhbGlhcyBmb3IgPDplbHNlPmAsXG4gICAgICAgICAgICB0aGlzLmxvY1xuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBzZWVuTmFtZXMuYWRkKG5hbWUpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5uYW1lZEJsb2NrcztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgdGhpcy5ibG9jay5idWlsZGVyLm5hbWVkQmxvY2soXG4gICAgICAgICAgU291cmNlU2xpY2Uuc3ludGhldGljKCdkZWZhdWx0JyksXG4gICAgICAgICAgdGhpcy5ibG9jay5idWlsZGVyLmJsb2NrKHRhYmxlLCB0aGlzLm5vbkJsb2NrQ2hpbGRyZW4sIHRoaXMubG9jKSxcbiAgICAgICAgICB0aGlzLmxvY1xuICAgICAgICApLFxuICAgICAgXTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJpbnRQYXRoKG5vZGU6IEFTVHYxLlBhdGhFeHByZXNzaW9uIHwgQVNUdjEuQ2FsbE5vZGUpOiBzdHJpbmcge1xuICBpZiAobm9kZS50eXBlICE9PSAnUGF0aEV4cHJlc3Npb24nICYmIG5vZGUucGF0aC50eXBlID09PSAnUGF0aEV4cHJlc3Npb24nKSB7XG4gICAgcmV0dXJuIHByaW50UGF0aChub2RlLnBhdGgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgUHJpbnRlcih7IGVudGl0eUVuY29kaW5nOiAncmF3JyB9KS5wcmludChub2RlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmludEhlYWQobm9kZTogQVNUdjEuUGF0aEV4cHJlc3Npb24gfCBBU1R2MS5DYWxsTm9kZSk6IHN0cmluZyB7XG4gIGlmIChub2RlLnR5cGUgPT09ICdQYXRoRXhwcmVzc2lvbicpIHtcbiAgICBzd2l0Y2ggKG5vZGUuaGVhZC50eXBlKSB7XG4gICAgICBjYXNlICdBdEhlYWQnOlxuICAgICAgY2FzZSAnVmFySGVhZCc6XG4gICAgICAgIHJldHVybiBub2RlLmhlYWQubmFtZTtcbiAgICAgIGNhc2UgJ1RoaXNIZWFkJzpcbiAgICAgICAgcmV0dXJuICd0aGlzJztcbiAgICB9XG4gIH0gZWxzZSBpZiAobm9kZS5wYXRoLnR5cGUgPT09ICdQYXRoRXhwcmVzc2lvbicpIHtcbiAgICByZXR1cm4gcHJpbnRIZWFkKG5vZGUucGF0aCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBQcmludGVyKHsgZW50aXR5RW5jb2Rpbmc6ICdyYXcnIH0pLnByaW50KG5vZGUpO1xuICB9XG59XG4iLCJleHBvcnQgdHlwZSBLZXl3b3JkVHlwZSA9ICdDYWxsJyB8ICdNb2RpZmllcicgfCAnQXBwZW5kJyB8ICdCbG9jayc7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0tleXdvcmQod29yZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB3b3JkIGluIEtFWVdPUkRTX1RZUEVTO1xufVxuXG4vKipcbiAqIFRoaXMgaW5jbHVkZXMgdGhlIGZ1bGwgbGlzdCBvZiBrZXl3b3JkcyBjdXJyZW50bHkgaW4gdXNlIGluIHRoZSB0ZW1wbGF0ZVxuICogbGFuZ3VhZ2UsIGFuZCB3aGVyZSB0aGVpciB2YWxpZCB1c2FnZXMgYXJlLlxuICovXG5leHBvcnQgY29uc3QgS0VZV09SRFNfVFlQRVM6IHsgW2tleTogc3RyaW5nXTogS2V5d29yZFR5cGVbXSB9ID0ge1xuICBjb21wb25lbnQ6IFsnQ2FsbCcsICdBcHBlbmQnLCAnQmxvY2snXSxcbiAgZGVidWdnZXI6IFsnQXBwZW5kJ10sXG4gICdlYWNoLWluJzogWydCbG9jayddLFxuICBlYWNoOiBbJ0Jsb2NrJ10sXG4gICdoYXMtYmxvY2stcGFyYW1zJzogWydDYWxsJywgJ0FwcGVuZCddLFxuICAnaGFzLWJsb2NrJzogWydDYWxsJywgJ0FwcGVuZCddLFxuICBoZWxwZXI6IFsnQ2FsbCcsICdBcHBlbmQnXSxcbiAgaWY6IFsnQ2FsbCcsICdBcHBlbmQnLCAnQmxvY2snXSxcbiAgJ2luLWVsZW1lbnQnOiBbJ0Jsb2NrJ10sXG4gIGxldDogWydCbG9jayddLFxuICAnbGluay10byc6IFsnQXBwZW5kJywgJ0Jsb2NrJ10sXG4gIGxvZzogWydDYWxsJywgJ0FwcGVuZCddLFxuICBtb2RpZmllcjogWydDYWxsJ10sXG4gIG1vdW50OiBbJ0FwcGVuZCddLFxuICBtdXQ6IFsnQ2FsbCcsICdBcHBlbmQnXSxcbiAgb3V0bGV0OiBbJ0FwcGVuZCddLFxuICAncXVlcnktcGFyYW1zJzogWydDYWxsJ10sXG4gIHJlYWRvbmx5OiBbJ0NhbGwnLCAnQXBwZW5kJ10sXG4gIHVuYm91bmQ6IFsnQ2FsbCcsICdBcHBlbmQnXSxcbiAgdW5sZXNzOiBbJ0NhbGwnLCAnQXBwZW5kJywgJ0Jsb2NrJ10sXG4gIHdpdGg6IFsnQmxvY2snXSxcbiAgeWllbGQ6IFsnQXBwZW5kJ10sXG59O1xuIiwiaW1wb3J0IHsgaXNLZXl3b3JkIH0gZnJvbSAnLi9rZXl3b3Jkcyc7XG5pbXBvcnQgeyBwcmVwcm9jZXNzIH0gZnJvbSAnLi9wYXJzZXIvdG9rZW5pemVyLWV2ZW50LWhhbmRsZXJzJztcbmltcG9ydCB0cmF2ZXJzZSBmcm9tICcuL3RyYXZlcnNhbC90cmF2ZXJzZSc7XG5pbXBvcnQgKiBhcyBBU1R2MSBmcm9tICcuL3YxL2FwaSc7XG5cbmludGVyZmFjZSBHZXRUZW1wbGF0ZUxvY2Fsc09wdGlvbnMge1xuICBpbmNsdWRlS2V5d29yZHM/OiBib29sZWFuO1xuICBpbmNsdWRlSHRtbEVsZW1lbnRzPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBjb3JyZWN0IFRva2VuIGZyb20gdGhlIE5vZGUgYmFzZWQgb24gaXQncyB0eXBlXG4gKi9cbmZ1bmN0aW9uIHRva2Vuc0Zyb21UeXBlKFxuICBub2RlOiBBU1R2MS5Ob2RlLFxuICBzY29wZWRUb2tlbnM6IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHZXRUZW1wbGF0ZUxvY2Fsc09wdGlvbnNcbik6IHN0cmluZyB8IHZvaWQge1xuICBpZiAobm9kZS50eXBlID09PSAnUGF0aEV4cHJlc3Npb24nKSB7XG4gICAgaWYgKG5vZGUuaGVhZC50eXBlID09PSAnQXRIZWFkJyB8fCBub2RlLmhlYWQudHlwZSA9PT0gJ1RoaXNIZWFkJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHBvc3NibGVUb2tlbiA9IG5vZGUuaGVhZC5uYW1lO1xuXG4gICAgaWYgKHNjb3BlZFRva2Vucy5pbmRleE9mKHBvc3NibGVUb2tlbikgPT09IC0xKSB7XG4gICAgICByZXR1cm4gcG9zc2JsZVRva2VuO1xuICAgIH1cbiAgfSBlbHNlIGlmIChub2RlLnR5cGUgPT09ICdFbGVtZW50Tm9kZScpIHtcbiAgICBjb25zdCB7IHRhZyB9ID0gbm9kZTtcblxuICAgIGNvbnN0IGNoYXIgPSB0YWcuY2hhckF0KDApO1xuXG4gICAgaWYgKGNoYXIgPT09ICc6JyB8fCBjaGFyID09PSAnQCcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMuaW5jbHVkZUh0bWxFbGVtZW50cyAmJiB0YWcuaW5kZXhPZignLicpID09PSAtMSAmJiB0YWcudG9Mb3dlckNhc2UoKSA9PT0gdGFnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRhZy5zdWJzdHIoMCwgNSkgPT09ICd0aGlzLicpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2NvcGVkVG9rZW5zLmluZGV4T2YodGFnKSAhPT0gLTEpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFnO1xuICB9XG59XG5cbi8qKlxuICogQWRkcyB0b2tlbnMgdG8gdGhlIHRva2Vuc1NldCBiYXNlZCBvbiB0aGVpciBub2RlLnR5cGVcbiAqL1xuZnVuY3Rpb24gYWRkVG9rZW5zKFxuICB0b2tlbnNTZXQ6IFNldDxzdHJpbmc+LFxuICBub2RlOiBBU1R2MS5Ob2RlLFxuICBzY29wZWRUb2tlbnM6IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHZXRUZW1wbGF0ZUxvY2Fsc09wdGlvbnNcbikge1xuICBjb25zdCBtYXliZVRva2VucyA9IHRva2Vuc0Zyb21UeXBlKG5vZGUsIHNjb3BlZFRva2Vucywgb3B0aW9ucyk7XG5cbiAgKEFycmF5LmlzQXJyYXkobWF5YmVUb2tlbnMpID8gbWF5YmVUb2tlbnMgOiBbbWF5YmVUb2tlbnNdKS5mb3JFYWNoKChtYXliZVRva2VuKSA9PiB7XG4gICAgaWYgKG1heWJlVG9rZW4gIT09IHVuZGVmaW5lZCAmJiBtYXliZVRva2VuWzBdICE9PSAnQCcpIHtcbiAgICAgIGNvbnN0IG1heWJlVG9rZW5GaXJzdFNlZ21lbnQgPSBtYXliZVRva2VuLnNwbGl0KCcuJylbMF07XG4gICAgICBpZiAoIXNjb3BlZFRva2Vucy5pbmNsdWRlcyhtYXliZVRva2VuRmlyc3RTZWdtZW50KSkge1xuICAgICAgICB0b2tlbnNTZXQuYWRkKG1heWJlVG9rZW4uc3BsaXQoJy4nKVswXSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuLyoqXG4gKiBQYXJzZXMgYW5kIHRyYXZlcnNlcyBhIGdpdmVuIGhhbmRsZWJhcnMgaHRtbCB0ZW1wbGF0ZSB0byBleHRyYWN0IGFsbCB0ZW1wbGF0ZSBsb2NhbHNcbiAqIHJlZmVyZW5jZWQgdGhhdCBjb3VsZCBwb3NzaWJsZSBjb21lIGZyb20gdGhlIHBhcmVudCBzY29wZS4gQ2FuIGV4Y2x1ZGUga25vd24ga2V5d29yZHNcbiAqIG9wdGlvbmFsbHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUZW1wbGF0ZUxvY2FscyhcbiAgaHRtbDogc3RyaW5nLFxuICBvcHRpb25zOiBHZXRUZW1wbGF0ZUxvY2Fsc09wdGlvbnMgPSB7XG4gICAgaW5jbHVkZUh0bWxFbGVtZW50czogZmFsc2UsXG4gICAgaW5jbHVkZUtleXdvcmRzOiBmYWxzZSxcbiAgfVxuKTogc3RyaW5nW10ge1xuICBjb25zdCBhc3QgPSBwcmVwcm9jZXNzKGh0bWwpO1xuICBjb25zdCB0b2tlbnNTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3Qgc2NvcGVkVG9rZW5zOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHRyYXZlcnNlKGFzdCwge1xuICAgIEJsb2NrOiB7XG4gICAgICBlbnRlcih7IGJsb2NrUGFyYW1zIH0pIHtcbiAgICAgICAgYmxvY2tQYXJhbXMuZm9yRWFjaCgocGFyYW0pID0+IHtcbiAgICAgICAgICBzY29wZWRUb2tlbnMucHVzaChwYXJhbSk7XG4gICAgICAgIH0pO1xuICAgICAgfSxcblxuICAgICAgZXhpdCh7IGJsb2NrUGFyYW1zIH0pIHtcbiAgICAgICAgYmxvY2tQYXJhbXMuZm9yRWFjaCgoKSA9PiB7XG4gICAgICAgICAgc2NvcGVkVG9rZW5zLnBvcCgpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIEVsZW1lbnROb2RlOiB7XG4gICAgICBlbnRlcihub2RlKSB7XG4gICAgICAgIG5vZGUuYmxvY2tQYXJhbXMuZm9yRWFjaCgocGFyYW0pID0+IHtcbiAgICAgICAgICBzY29wZWRUb2tlbnMucHVzaChwYXJhbSk7XG4gICAgICAgIH0pO1xuICAgICAgICBhZGRUb2tlbnModG9rZW5zU2V0LCBub2RlLCBzY29wZWRUb2tlbnMsIG9wdGlvbnMpO1xuICAgICAgfSxcblxuICAgICAgZXhpdCh7IGJsb2NrUGFyYW1zIH0pIHtcbiAgICAgICAgYmxvY2tQYXJhbXMuZm9yRWFjaCgoKSA9PiB7XG4gICAgICAgICAgc2NvcGVkVG9rZW5zLnBvcCgpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIFBhdGhFeHByZXNzaW9uKG5vZGUpIHtcbiAgICAgIGFkZFRva2Vucyh0b2tlbnNTZXQsIG5vZGUsIHNjb3BlZFRva2Vucywgb3B0aW9ucyk7XG4gICAgfSxcbiAgfSk7XG5cbiAgbGV0IHRva2Vuczogc3RyaW5nW10gPSBbXTtcblxuICB0b2tlbnNTZXQuZm9yRWFjaCgocykgPT4gdG9rZW5zLnB1c2gocykpO1xuXG4gIGlmICghb3B0aW9ucz8uaW5jbHVkZUtleXdvcmRzKSB7XG4gICAgdG9rZW5zID0gdG9rZW5zLmZpbHRlcigodG9rZW4pID0+ICFpc0tleXdvcmQodG9rZW4pKTtcbiAgfVxuXG4gIHJldHVybiB0b2tlbnM7XG59XG4iXSwibmFtZXMiOlsiaXNQcmVzZW50IiwiYXNzZXJ0TmV2ZXIiLCJERUJVRyIsImIiLCJhc3NpZ24iLCJ0dXBsZSIsImhlYWRUb1N0cmluZyIsIkVudGl0eVBhcnNlciIsIm5hbWVkQ2hhclJlZnMiLCJFdmVudGVkVG9rZW5pemVyIiwiYXNzZXJ0UHJlc2VudCIsInByaW50IiwicGFyc2VXaXRob3V0UHJvY2Vzc2luZyIsInBhcnNlIiwiZGljdCIsIkFTVHYyLlRlbXBsYXRlIiwiQVNUdjIuQmxvY2siLCJBU1R2Mi5OYW1lZEJsb2NrIiwiQVNUdjIuQXJncyIsIkFTVHYyLlBvc2l0aW9uYWxBcmd1bWVudHMiLCJBU1R2Mi5OYW1lZEFyZ3VtZW50IiwiQVNUdjIuTmFtZWRBcmd1bWVudHMiLCJBU1R2Mi5IdG1sQXR0ciIsIkFTVHYyLlNwbGF0QXR0ciIsIkFTVHYyLkNvbXBvbmVudEFyZyIsIkFTVHYyLlBhdGhFeHByZXNzaW9uIiwiQVNUdjIuVGhpc1JlZmVyZW5jZSIsIkFTVHYyLkFyZ1JlZmVyZW5jZSIsIkFTVHYyLkZyZWVWYXJSZWZlcmVuY2UiLCJBU1R2Mi5Mb2NhbFZhclJlZmVyZW5jZSIsIkFTVHYyLkNhbGxFeHByZXNzaW9uIiwiQVNUdjIuRGVwcmVjYXRlZENhbGxFeHByZXNzaW9uIiwiQVNUdjIuSW50ZXJwb2xhdGVFeHByZXNzaW9uIiwiQVNUdjIuTGl0ZXJhbEV4cHJlc3Npb24iLCJBU1R2Mi5BcHBlbmRDb250ZW50IiwiQVNUdjIuRWxlbWVudE1vZGlmaWVyIiwiQVNUdjIuTmFtZWRCbG9ja3MiLCJBU1R2Mi5JbnZva2VCbG9jayIsIkFTVHYyLlNpbXBsZUVsZW1lbnQiLCJBU1R2Mi5JbnZva2VDb21wb25lbnQiLCJBU1R2Mi5Mb29zZU1vZGVSZXNvbHV0aW9uIiwiQVNUdjIuU1RSSUNUX1JFU09MVVRJT04iLCJBU1R2Mi5BUkdVTUVOVF9SRVNPTFVUSU9OIiwiQVNUdjIuSHRtbENvbW1lbnQiLCJBU1R2Mi5IdG1sVGV4dCIsIkFTVHYyLkdsaW1tZXJDb21tZW50Il0sIm1hcHBpbmdzIjoiOztFQWlCTyxJQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBTixNQUFBLENBQWM7RUFDNUMsRUFBQSxJQUFJLEVBRHdDLENBQUE7RUFFNUMsRUFBQSxNQUFNLEVBQUU7RUFGb0MsQ0FBZCxDQUF6QjtFQUtBLElBQU0sa0JBQWtCLEdBQUcsTUFBTSxDQUFOLE1BQUEsQ0FBYztFQUM5QyxFQUFBLE1BQU0sRUFEd0MsYUFBQTtFQUU5QyxFQUFBLEtBQUssRUFGeUMsZ0JBQUE7RUFHOUMsRUFBQSxHQUFHLEVBQUU7RUFIeUMsQ0FBZCxDQUEzQjtFQVNBLElBQU0sa0JBQWtCLEdBQUcsTUFBTSxDQUFOLE1BQUEsQ0FBYztFQUM5QyxFQUFBLE1BQU0sRUFEd0MsYUFBQTtFQUU5QyxFQUFBLEtBQUssRUFGeUMsZ0JBQUE7RUFHOUMsRUFBQSxHQUFHLEVBQUU7RUFIeUMsQ0FBZCxDQUEzQjtFQU1BLElBQU0scUJBQXFCLEdBQUcsTUFBTSxDQUFOLE1BQUEsQ0FBYztFQUNqRCxFQUFBLE1BQU0sRUFEMkMsZUFBQTtFQUVqRCxFQUFBLEtBQUssRUFGNEMsZ0JBQUE7RUFHakQsRUFBQSxHQUFHLEVBQUU7RUFINEMsQ0FBZCxDQUE5QjtFQU1BLElBQU0sZUFBZSxHQUFHLE1BQU0sQ0FBTixNQUFBLENBQWM7RUFDM0MsRUFBQSxNQUFNLEVBRHFDLFVBQUE7RUFFM0MsRUFBQSxLQUFLLEVBRnNDLGdCQUFBO0VBRzNDLEVBQUEsR0FBRyxFQUFFO0VBSHNDLENBQWQsQ0FBeEI7O01DbkNELFdBQU47RUFnQkUsdUJBQUEsT0FBQSxFQUFzRDtFQUNwRCxTQUFBLEdBQUEsR0FBVyxPQUFPLENBQWxC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
