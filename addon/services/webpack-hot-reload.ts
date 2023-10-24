import Service, { service } from '@ember/service';
import Helper from '@ember/component/helper';
import EmberComponent, {
  getComponentTemplate,
  setComponentTemplate,
} from '@ember/component';
import Ember from 'ember';
import config from 'hot-reload/config/environment';
import Resolver from 'ember-resolver';
import GlimmerComponent from '@glimmer/component';
import { getOwner } from '@ember/owner';
import RouterService from '@ember/routing/router-service';
import Router from '@ember/routing/router';

const TemplateOnlyComponent =
  Ember.__loader.require('@glimmer/runtime').TemplateOnlyComponent;

const ChangeMap = new WeakMap();

function getLatestChange(obj) {
  while (ChangeMap.has(obj)) {
    obj = ChangeMap.get(obj);
  }
  return obj;
}


const modulePrefix = config.modulePrefix;
if (import.meta.webpackHot) {
  const resolverResolve = Resolver.prototype.resolve;
  Resolver.prototype.resolve = function (name) {
    name = name.replace(/--hot-version--.*$/, '');
    return resolverResolve.call(this, name);
  };

  const ModuleMap = new Map();

  window.emberHotReloadPlugin = {
    changed: {},
    subscribers: [],
    version: 1,

    loadNew(oldModule, newModule) {
      const id = oldModule.id
        .replace('./', modulePrefix + '/')
        .replace(/\.(hbs|ts|js|gjs|gts)/, '');
      requirejs(id);
      if (
        oldModule.exports.default?.prototype instanceof EmberComponent ||
        oldModule.exports.default?.prototype instanceof GlimmerComponent ||
        (oldModule.exports.default?.__meta && oldModule.exports.default?.__id)
      ) {
        const entry = Object.entries(requirejs.entries).find(([key, value]) => {
          const klass = value.module.exports?.default;
          return (
            klass &&
            (klass === oldModule.exports.default ||
              getComponentTemplate(klass) === oldModule.exports.default)
          );
        });
        if (entry) {
          if (
            getComponentTemplate(entry[1].module.exports.default) ===
            oldModule.exports.default
          ) {
            let klass = null;
            if (
              entry[1].module.exports.default instanceof TemplateOnlyComponent
            ) {
              klass = new TemplateOnlyComponent();
            } else {
              klass = class extends entry[1].module.exports.default {};
              klass.prototype.constructor.prototype.name =
                entry[1].module.exports.default.prototype.constructor.prototype.name;
            }
            setComponentTemplate(newModule.exports.default, klass);
            klass.__version__ = newModule.version;
            ChangeMap.set(entry[1].module.exports.default, klass);
            requirejs.entries[entry[0]].module.exports = {
              ...entry[1].module.exports,
              default: klass,
            };
            requirejs.entries[entry[0]].module.patched = oldModule;
            return;
          }
        }
      }
      // this should always be helpers or modifiers
      requirejs.entries[id].module = {
        exports: newModule.exports,
      };
    },

    canAcceptNew(module) {
      console.log('module', module);
      let ok =
        module.id.includes('/helpers/') ||
        module.id.includes('/modifiers/') ||
        module.id.includes('/routers/') ||
        module.id.includes('/templates/') ||
        module.id.includes('/controllers/') ||
        module.id.match(/controller\.(js|ts)$/) ||
        module.id.match(/route\.(js|ts|gts)$/) ||
        module.id.match(/template\.hbs$/) ||
        module.id.includes('/components/');
      ok =
        ok ||
        Object.values(module.exports).every((exp) => {
          return (
            exp &&
            exp.prototype &&
            (exp.prototype instanceof EmberComponent ||
              exp.prototype instanceof GlimmerComponent ||
              exp.prototype instanceof Helper)
          );
        });

      if (!ok) {
        return false;
      }

      if (ModuleMap.get(module.id)) {
        this.changed[module.id] = {
          old: ModuleMap.get(module.id),
          new: module,
        };
      }
      module.version = this.version;
      ModuleMap.set(module.id, module);
      return true;
    },

    notifyNew() {
      this.version += 1;
      Object.values(this.changed).forEach((change) => {
        this.loadNew(change.old, change.new);
        this.subscribers.forEach((fn) => fn(change.old, change.new));
      });
      this.changed = {};
    },

    subscribe(fn) {
      this.subscribers.push(fn);
    },

    unsubscribe(fn) {
      const idx = this.subscribers.indexOf(fn);
      if (idx >= 0) {
        this.subscribers.splice(idx, 1);
      }
    },
  };

  import.meta.webpackHot.addStatusHandler((status) => {
    if (status === 'idle') {
      window.emberHotReloadPlugin.notifyNew();
    }
    if (status === 'fail') {
      window.location.reload();
    }
  });
}

export default class WebpackHotReloadService extends Service {
  declare container: any;
  @service() router!: RouterService;

  init() {
    super.init();
    this.router._router;
    Object.defineProperty(this.router._router, '_routerMicrolib', {
      set(v) {
        const getRoute = v.getRoute;
        v.getRoute = function (name) {
          return getRoute.call(this, `${name}--hot-version--${window.emberHotReloadPlugin.version}`);
        }
        this.___routerMicrolib = v;
      },
      get() {
        return this.___routerMicrolib
      }
    })
    this.container = getOwner(this)?.__container__;
    window.emberHotReloadPlugin.subscribe((oldModule, newModule) => {
      const owner = getOwner(this);
      const types = ['route', 'controller', 'template', 'modifier', 'helper', 'component'];
      Object.keys(this.container.cache).forEach((k) => {
        if (types.some(t => k.startsWith(`${t}:`))) {
          delete this.container.cache[k];
        }
      })
      Object.keys(this.container.factoryManagerCache).forEach((k) => {
        if (types.some(t => k.startsWith(`${t}:`))) {
          delete this.container.factoryManagerCache[k];
        }
      })
      Object.keys(this.container.registry._resolveCache).forEach((k) => {
        if (types.some(t => k.startsWith(`${t}:`))) {
          delete this.container.registry._resolveCache[k];
        }
      })
      Object.keys(this.container.validationCache).forEach((k) => {
        if (types.some(t => k.startsWith(`${t}:`))) {
          delete this.container.validationCache[k];
        }
      })
      Object.keys(this.container.registry.registrations).forEach((k) => {
        if (types.some(t => k.startsWith(`${t}:`))) {
          delete this.container.registry.registrations[k];
        }
      })

      if (oldModule.exports.default && oldModule.exports.default instanceof Router) {
        this.router.refresh();
      }
      if (oldModule.id.startsWith('./templates/') && !oldModule.id.startsWith('./templates/components/')) {
        this.router.refresh();
      }
      if (oldModule.id.startsWith(`./${config.podModulePrefix}/`)) {
        this.router.refresh();
      }
    })
  }
  getLatestChange(obj) {
    return getLatestChange(obj);
  }
}

// Don't remove this declaration: this is what enables TypeScript to resolve
// this service using `Owner.lookup('service:hot-reload')`, as well
// as to check when you pass the service name as an argument to the decorator,
// like `@service('hot-reload') declare altName: HotReloadService;`.
declare module '@ember/service' {
  interface Registry {
    'webpack-hot-reload': WebpackHotReloadService;
  }
}
