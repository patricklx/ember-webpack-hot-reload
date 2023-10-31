import Helper from '@ember/component/helper';
import { getOwner } from '@ember/owner';
import { registerDestructor } from '@ember/destroyable';
import { service } from '@ember/service';
import { getComponentTemplate } from '@ember/component';
import Ember from 'ember';
import WebpackHotReloadService from '../services/webpack-hot-reload';

const CurriedValue = (Ember as any).__loader.require('@glimmer/runtime').CurriedValue;

export default class WebpackHotReload extends Helper {
  h: unknown;
  current: unknown;
  @service('webpack-hot-reload') webpackHotReload!: WebpackHotReloadService;
  originalCurried: unknown;
  resolver: any;
  type!: string;
  podModulePrefix: string;
  modulePrefix: string;
  resolvedPath!: string;

  constructor(...args: any[]) {
    super(...args);
    const app = (getOwner(this) as any).application;
    this.resolver = app.__registry__.resolver;
    this.modulePrefix = app.modulePrefix;
    this.podModulePrefix = app.podModulePrefix;
    const bound = this.checkAndRecompute.bind(this);
    window.emberHotReloadPlugin.subscribe(bound);
    registerDestructor(this, () => {
      window.emberHotReloadPlugin.unsubscribe(bound);
    });
  }

  checkAndRecompute(oldModule: any, newModule: any) {
    if (typeof this.current === 'string') {
      const resolvedPath = this.resolvedPath;

      if (newModule.id.startsWith(resolvedPath) && newModule.id.replace(resolvedPath, '').startsWith('.')) {
        this.current = null;
        this.recompute();
      }
      return;
    }

    if (!this.current) {
      return;
    }

    if (this.current === oldModule.exports.default) {
      this.current = newModule.exports.default;
      this.recompute();
      return;
    }

    if (
      oldModule.exports.default?.__meta &&
      oldModule.exports.default?.__id &&
      getComponentTemplate(this.current) === oldModule.exports.default
    ) {
      this.current = this.webpackHotReload.getLatestChange(this.current);
      this.recompute();
      return;
    }

    for (const [name, exp] of Object.entries(oldModule.exports)) {
      if (exp && this.current === exp) {
        this.current = newModule.exports[name];
        if (!this.current) {
          newModule.invalidate();
        }
        this.recompute();
        return;
      }
    }
  }

  compute(positional: any[], named: { type: string }) {
    if (this.current) {
      return this.current;
    }
    const type = named.type;
    if (typeof positional[0] === 'string') {
      const name = positional[0];
      const resolvedPath = this.resolver.lookupDescription(`${type}:${name}`);
      this.resolvedPath = resolvedPath
          ?.replace(new RegExp(`^${this.modulePrefix}/`), './')
          ?.replace(new RegExp(`^${this.podModulePrefix}/`), './');
      const version = window.emberHotReloadPlugin.versionMap[resolvedPath] || 0;
      if (type === 'component') {
        this.current = name;
        return `${this.current}__hot_version__${version}`;
      }
      if (type === 'modifier') {
        this.current = getOwner(this)!.factoryFor(
          `modifier:${name}__hot_version__${version}`,
        )?.class;
        return this.current;
      }
      this.current = getOwner(this)!.lookup(
        `helper:${name}__hot_version__${version}`,
      );
    } else {
      // if we are here, its a curried value
      const symb = Object.getOwnPropertySymbols(positional[0]).find(
        (s) => s.description === 'INNER',
      )!;
      this.current = this.originalCurried || positional[0][symb];
      if (!this.originalCurried) {
        this.originalCurried = this.current;
      }
      if (typeof this.originalCurried === 'string') {
        const curriedResolvedPath = this.resolver.lookupDescription(`${type}:${this.originalCurried}`);
        this.resolvedPath = curriedResolvedPath
            ?.replace(new RegExp(`^${this.modulePrefix}/`), './')
            ?.replace(new RegExp(`^${this.podModulePrefix}/`), './');
        const version = window.emberHotReloadPlugin.versionMap[curriedResolvedPath] || 0;
        const inner = `${this.originalCurried}__hot_version__${
            version
        }`;
        return new CurriedValue(
          0,
          inner,
          getOwner(this),
          { named: {}, positional: [] },
          false,
        );
      }
    }
    return this.current;
  }
}
