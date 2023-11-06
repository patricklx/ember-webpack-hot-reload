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
{{#let (helper 'print-number' x=1) as |output|}}
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
      filename: '.embroider/rewritten-app/file.hbs',
      plugins: [plugin]
    });
    expect(result.code).toMatchSnapshot();
  })

  it('should convert basic-dropdown', () => {
    const tpl = `
    {{#let
  (hash
    uniqueId=this.publicAPI.uniqueId
    isOpen=this.publicAPI.isOpen
    disabled=this.publicAPI.disabled
    actions=this.publicAPI.actions
    Trigger=(if
      (eq @triggerComponent undefined)
      (component
        'basic-dropdown-trigger'
        dropdown=(readonly this.publicAPI)
        hPosition=(readonly this.hPosition)
        renderInPlace=(readonly this.renderInPlace)
        vPosition=(readonly this.vPosition)
      )
      (component
        (ensure-safe-component @triggerComponent)
        dropdown=(readonly this.publicAPI)
        hPosition=(readonly this.hPosition)
        renderInPlace=(readonly this.renderInPlace)
        vPosition=(readonly this.vPosition)
      )
    )
    Content=(if
      ((helper 'eq') @contentComponent undefined)
      (component
        'basic-dropdown-content'
        dropdown=(readonly this.publicAPI)
        hPosition=(readonly this.hPosition)
        renderInPlace=(readonly this.renderInPlace)
        preventScroll=(readonly @preventScroll)
        rootEventType=(or @rootEventType 'click')
        vPosition=(readonly this.vPosition)
        destination=(readonly this.destination)
        top=(readonly this.top)
        left=(readonly this.left)
        right=(readonly this.right)
        width=(readonly this.width)
        height=(readonly this.height)
        otherStyles=(readonly this.otherStyles)
      )
      (component
        (ensure-safe-component @contentComponent)
        dropdown=(readonly this.publicAPI)
        hPosition=(readonly this.hPosition)
        renderInPlace=(readonly this.renderInPlace)
        preventScroll=(readonly @preventScroll)
        rootEventType=(or @rootEventType 'click')
        vPosition=(readonly this.vPosition)
        destination=(readonly this.destination)
        top=(readonly this.top)
        left=(readonly this.left)
        right=(readonly this.right)
        width=(readonly this.width)
        height=(readonly this.height)
        otherStyles=(readonly this.otherStyles)
      )
    )
  )
as |api|
}}
  {{#if this.renderInPlace}}
    <div class='ember-basic-dropdown' ...attributes>{{yield api}}</div>
  {{else}}
    {{yield api}}
  {{/if}}
{{/let}}`;
    const code = `
    import precompileTemplate from '@ember/template-compilation';
    precompileTemplate(\`${tpl}\`);
    `;
    const result = babel.transform(code, {
      filename: '.embroider/rewritten-app/file.hbs',
      plugins: [plugin]
    });
    expect(result.code).toMatchSnapshot();
  })

  it('should convert this', () => {
    const tpl = `
    {{#let (helper (ember-hbs-imports/helpers/lookup-helper this "ember-bscomponents/helpers/size-support")) as |imported_size|}}{{#let (helper (ember-hbs-imports/helpers/lookup-helper this "ember-bscomponents/helpers/or")) as |imported_or|}}



<button {{on "click" this.onClick}} type="{{if @btnType @btnType "button"}}" class="btn {{imported_size "btn" this.args}} btn-{{if @type @type "default"}} {{if @isBlock "btn-block"}} {{if @isActive "active"}}" disabled={{imported_or this.isLoading @disabled}} ...attributes>
{{#if @icon}}    <i class={{@icon}}></i>
{{/if}}  {{@title}}
  {{yield}}
</button>

{{/let}}{{/let}}
`;
    const code = `
    import precompileTemplate from '@ember/template-compilation';
    precompileTemplate(\`${tpl}\`);
    `;
    const result = babel.transform(code, {
      filename: '.embroider/rewritten-app/file.hbs',
      plugins: [plugin]
    });
    expect(result.code).toMatchSnapshot();
  })
});