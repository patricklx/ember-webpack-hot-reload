const plugin = require('../dist/lib/babel-plugin').default;
const babel = require('@babel/core');


describe('convert template with hot reload helpers', () => {
  it('should convert correctly', () => {
    const template = `
  import precompileTemplate from '@ember/template-compilation';
  precompileTemplate(\`
  {{page-title "HotReload"}}

{{! The following component displays Ember's default welcome message. }}
<br />
{{#let (helper 'print-number') as |output|}}
  helpler {{output}}
{{/let}}
{{! Feel free to remove this! }}

{{component 'my-comp' rootEventType=(or @rootEventType 'click')}}


{{#let this.FirstComponent as |output|}}
  {{output}}
{{/let}}

<div {{this.myModifier}}></div>

{{FirstComponent}}

<br />
26

<br />

{{this.x}}


{{outlet}}
  \`);`
    const result = babel.transform(template, {
      filename: 'file.hbs',
      plugins: [plugin]
    });
    expect(result.code).toMatchSnapshot();
  })
});