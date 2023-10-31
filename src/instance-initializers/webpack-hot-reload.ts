export function initialize(applicationInstance) {
  applicationInstance.lookup('service:webpack-hot-reload');
  const Resolver = applicationInstance.application.Resolver;
  const resolverResolve = Resolver.prototype.resolve;
  Resolver.prototype.resolve = function(name: string) {
    name = name.replace(/--hot-version--.*$/, '');
    return resolverResolve.call(this, name);
  };
}

export default {
  initialize,
};
