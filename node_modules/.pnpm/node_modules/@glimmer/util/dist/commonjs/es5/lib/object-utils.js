"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fillNulls = fillNulls;
exports.values = values;
exports.assign = void 0;
var assign = Object.assign;
exports.assign = assign;

function fillNulls(count) {
  var arr = new Array(count);

  for (var i = 0; i < count; i++) {
    arr[i] = null;
  }

  return arr;
}

function values(obj) {
  var vals = [];

  for (var key in obj) {
    vals.push(obj[key]);
  }

  return vals;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3BhY2thZ2VzL0BnbGltbWVyL3V0aWwvbGliL29iamVjdC11dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFPLElBQUksTUFBTSxHQUFHLE1BQU0sQ0FBbkIsTUFBQTs7O0FBRUQsU0FBQSxTQUFBLENBQUEsS0FBQSxFQUFvQztBQUN4QyxNQUFJLEdBQUcsR0FBRyxJQUFBLEtBQUEsQ0FBVixLQUFVLENBQVY7O0FBRUEsT0FBSyxJQUFJLENBQUMsR0FBVixDQUFBLEVBQWdCLENBQUMsR0FBakIsS0FBQSxFQUEyQixDQUEzQixFQUFBLEVBQWdDO0FBQzlCLElBQUEsR0FBRyxDQUFILENBQUcsQ0FBSCxHQUFBLElBQUE7QUFDRDs7QUFFRCxTQUFBLEdBQUE7QUFDRDs7QUFFSyxTQUFBLE1BQUEsQ0FBQSxHQUFBLEVBQTJDO0FBQy9DLE1BQU0sSUFBSSxHQUFWLEVBQUE7O0FBQ0EsT0FBSyxJQUFMLEdBQUEsSUFBQSxHQUFBLEVBQXVCO0FBQ3JCLElBQUEsSUFBSSxDQUFKLElBQUEsQ0FBVSxHQUFHLENBQWIsR0FBYSxDQUFiO0FBQ0Q7O0FBQ0QsU0FBQSxJQUFBO0FBQ0QiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgbGV0IGFzc2lnbiA9IE9iamVjdC5hc3NpZ247XG5cbmV4cG9ydCBmdW5jdGlvbiBmaWxsTnVsbHM8VD4oY291bnQ6IG51bWJlcik6IFRbXSB7XG4gIGxldCBhcnIgPSBuZXcgQXJyYXkoY291bnQpO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgIGFycltpXSA9IG51bGw7XG4gIH1cblxuICByZXR1cm4gYXJyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsdWVzPFQ+KG9iajogeyBbczogc3RyaW5nXTogVCB9KTogVFtdIHtcbiAgY29uc3QgdmFscyA9IFtdO1xuICBmb3IgKGNvbnN0IGtleSBpbiBvYmopIHtcbiAgICB2YWxzLnB1c2gob2JqW2tleV0pO1xuICB9XG4gIHJldHVybiB2YWxzO1xufVxuIl0sInNvdXJjZVJvb3QiOiIifQ==