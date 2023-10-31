# ember-webpack-hot-reload

Ember Webpack server with hot reload.

this can hot reload
* helpers
* modifiers
* components + templates, fcct components and its deps
* routes/controllers/route-templates (although it refreshes the whole route and thus looses all state)

it cannot hot reload local properties that turn out to be helpers/modifiers/components.
will be worked on soon...

this will not work:
```hbs
<this.MyComponent  {{this.myModifier}} />
{{this.myHelper}}
{{#let (component 'x') as |comp|}}
  {{comp}} -- will no hot reload, not sure if this is a bug
  <comp /> -- will hot reload
  {{#comp}}{{/comp}} -- will hot reload
{{/let}}
```

## Compatibility

- Ember.js v4.8 or above
- Embroider or ember-auto-import v2

## Installation

```
ember install ember-webpack-hot-reload
```

## Usage

update your `ember-cli-build.js` with

```js
return require('@embroider/compat').compatBuild(app, require('ember-webpack-hot-reload').Webpack, {...});
```

can be disabled by setting 

devServer.enabled = false;

or just disable hot reload by setting

devServer.hot = false

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.

## License

This project is licensed under the [MIT License](LICENSE.md).
