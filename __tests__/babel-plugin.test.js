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

  it('should convert power-select', () => {
    const tpl = `
    <BasicDropdown
  @horizontalPosition={{@horizontalPosition}}
  @destination={{@destination}}
  @initiallyOpened={{@initiallyOpened}}
  @matchTriggerWidth={{this.matchTriggerWidth}}
  @preventScroll={{or @preventScroll false}}
  @onClose={{this.handleClose}}
  @onOpen={{this.handleOpen}}
  @renderInPlace={{@renderInPlace}}
  @verticalPosition={{@verticalPosition}}
  @disabled={{@disabled}}
  @calculatePosition={{@calculatePosition}}
  @triggerComponent={{ensure-safe-component @ebdTriggerComponent}}
  @contentComponent={{ensure-safe-component @ebdContentComponent}}
  as |dropdown|>
  {{#let (assign dropdown (hash
    selected=this.selected
    highlighted=this.highlighted
    options=this.options
    results=this.results
    resultsCount=this.resultsCount
    loading=this.loading
    isActive=this.isActive
    searchText=this.searchText
    lastSearchedText=this.lastSearchedText
    actions=(assign dropdown.actions this._publicAPIActions)
  )) (concat "ember-power-select-options-" dropdown.uniqueId) as |publicAPI listboxId|}}
    <dropdown.Trigger
      @eventType={{or @eventType "mousedown"}}
      {{did-insert this._updateOptions @options}}
      {{did-update this._updateOptions @options}}
      {{did-insert this._updateSelected @selected}}
      {{did-update this._updateSelected @selected}}
      {{did-insert this._registerAPI publicAPI}}
      {{did-update this._registerAPI publicAPI}}
      {{did-update this._performSearch this.searchText}}
      {{on "keydown" this.handleTriggerKeydown}}
      {{on "focus" this.handleFocus}}
      {{on "blur" this.handleBlur}}
      class="ember-power-select-trigger {{@triggerClass}}{{if publicAPI.isActive " ember-power-select-trigger--active"}}"
      aria-activedescendant={{if dropdown.isOpen (unless @searchEnabled (concat publicAPI.uniqueId "-" this.highlightedIndex))}}
      aria-controls={{unless @searchEnabled listboxId}}
      aria-describedby={{@ariaDescribedBy}}
      aria-haspopup={{unless @searchEnabled "listbox"}}
      aria-invalid={{@ariaInvalid}}
      aria-label={{@ariaLabel}}
      aria-labelledby={{@ariaLabelledBy}}
      aria-owns=""
      aria-required={{@required}}
      role={{or @triggerRole "button"}}
      title={{@title}}
      id={{@triggerId}}
      tabindex={{and (not @disabled) (or @tabindex "0")}}
      ...attributes
    >
      {{#let 
        (if 
          @triggerComponent 
          (component (ensure-safe-component @triggerComponent)) 
          (component 'power-select/trigger')
        ) 
      as |Trigger|}}
        <Trigger
          @allowClear={{@allowClear}}
          @buildSelection={{@buildSelection}}
          @loadingMessage={{or @loadingMessage "Loading options..."}}
          @selectedItemComponent={{ensure-safe-component @selectedItemComponent}}
          @select={{publicAPI}}
          @searchEnabled={{@searchEnabled}}
          @searchField={{@searchField}}
          @onFocus={{this.handleFocus}}
          @onBlur={{this.handleBlur}}
          @extra={{@extra}}
          @listboxId={{listboxId}}
          @onInput={{this.handleInput}}
          @onKeydown={{this.handleKeydown}}
          @placeholder={{@placeholder}}
          @placeholderComponent={{if 
            @placeholderComponent 
            (ensure-safe-component @placeholderComponent) 
            (component 'power-select/placeholder')
          }}
          @ariaActiveDescendant={{concat publicAPI.uniqueId "-" this.highlightedIndex}}
          @ariaLabelledBy={{@ariaLabelledBy}}
          @ariaLabel={{@ariaLabel}}
          as |opt term|>
          {{yield opt term}}
        </Trigger>
      {{/let}}
    </dropdown.Trigger>
    <dropdown.Content
      class="ember-power-select-dropdown{{if publicAPI.isActive " ember-power-select-dropdown--active"}} {{@dropdownClass}}"
      @animationEnabled={{@animationEnabled}}
    >
      {{#if (not-eq @beforeOptionsComponent null)}}
        {{#let 
          (if 
            @beforeOptionsComponent 
            (component (ensure-safe-component @beforeOptionsComponent))
            (component 'power-select/before-options')
          ) 
        as |BeforeOptions|}}
          <BeforeOptions
            @select={{publicAPI}}
            @searchEnabled={{@searchEnabled}}
            @onInput={{this.handleInput}}
            @onKeydown={{this.handleKeydown}}
            @onFocus={{this.handleFocus}}
            @onBlur={{this.handleBlur}}
            @placeholder={{@placeholder}}
            @placeholderComponent={{or @placeholderComponent (component 'power-select/placeholder')}}
            @extra={{@extra}}
            @listboxId={{listboxId}}
            @ariaActiveDescendant={{concat publicAPI.uniqueId "-" this.highlightedIndex}}
            @selectedItemComponent={{ensure-safe-component @selectedItemComponent}}
            @searchPlaceholder={{@searchPlaceholder}}
            @ariaLabel={{@ariaLabel}}
            @ariaLabelledBy={{@ariaLabelledBy}}
          />
        {{/let}}
      {{/if}}
      {{#if this.mustShowSearchMessage}}
        {{#let 
          (if 
            @searchMessageComponent 
            (component (ensure-safe-component @searchMessageComponent))
            (component 'power-select/search-message')
          ) 
        as |SearchMessage|}}
          <SearchMessage 
            @searchMessage={{this.searchMessage}}
            @select={{publicAPI}}
            id={{listboxId}} 
            aria-label={{@ariaLabel}}
            aria-labelledby={{@ariaLabelledBy}} 
          /> 
        {{/let}}
      {{else if this.mustShowNoMessages}}
        {{#let 
          (if 
            @noMatchesMessageComponent
            (component (ensure-safe-component @noMatchesMessageComponent))
            (component 'power-select/no-matches-message')
          ) 
         as |NoMatchesMessage|}}
          <NoMatchesMessage 
            @noMatchesMessage={{this.noMatchesMessage}} 
            @select={{publicAPI}} 
            id={{listboxId}} 
            aria-label={{@ariaLabel}}
            aria-labelledby={{@ariaLabelledBy}} 
          />
        {{/let}}
      {{else}}
        {{#let 
          (if 
            @optionsComponent
            (component (ensure-safe-component @optionsComponent))
            (component 'power-select/options')
          ) 
          (if 
            @groupComponent
            (component (ensure-safe-component @groupComponent))
            (component 'power-select/power-select-group')
          ) 
        as |Options Group|}}
          <Options
            @loadingMessage={{or @loadingMessage "Loading options..."}}
            @select={{publicAPI}}
            @options={{publicAPI.results}}
            @groupIndex=""
            @optionsComponent={{Options}}
            @extra={{@extra}}
            @highlightOnHover={{this.highlightOnHover}}
            @groupComponent={{Group}}
            id={{listboxId}}
            class="ember-power-select-options" as |option select|>
            {{yield option select}}
          </Options>
        {{/let}}
      {{/if}}
      
      {{#if @afterOptionsComponent}}
        {{#let (component (ensure-safe-component @afterOptionsComponent)) as |AfterOptions|}}
          <AfterOptions
            @extra={{@extra}}
            @select={{publicAPI}}
          />
        {{/let}}
      {{/if}}
    </dropdown.Content>
  {{/let}}
</BasicDropdown>
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