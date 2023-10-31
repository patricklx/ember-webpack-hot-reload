# ember-webpack-hot-reload

Ember Webpack server with hot reload.

this can hot reload
* helpers
* modifiers
* components + templates, fcct components
* routes/controllers/route-templates (although it refreshes the whole route and thus looses all state)

it cannot hot reload local properties that turn out to be helpers/modifiers/components

this will not work:
```hbs
<this.MyComponent  {{this.myModifier}} />
{{this.myHelper}}
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

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.

## License

This project is licensed under the [MIT License](LICENSE.md).
