const path = require('path');

module.exports = function(source) {
  const options = this.getOptions();
  const resourcePath = this.resourcePath.replace(/\\/g, '/');

  const supportedPaths = ['components', 'helpers', 'modifiers'];
  if (!supportedPaths.some(s => resourcePath.includes(`/${s}/`))) {
    return source;
  }
  return `${source}
  if (import.meta.webpackHot && window.emberHotReloadPlugin) {
      const result = window.emberHotReloadPlugin.canAcceptNew(__webpack_module__.id);
      if (!result) {
        import.meta.webpackHot.decline();
      } else {
        import.meta.webpackHot.accept()
      }
      import.meta.webpackHot.addStatusHandler((status) => {
        if (stats === 'ready') {
          const r = window.emberHotReloadPlugin.loadNew(__webpack_module__.id);
          if (!r) {
            import.meta.webpackHot.invalidate();
          }
        }
      });
  }
  `;
}
