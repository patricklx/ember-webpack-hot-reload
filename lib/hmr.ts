export default function(this: any, source: string) {
  const options = this.getOptions();
  const resourcePath = this.resourcePath.replace(/\\/g, '/');

  const supportedPaths = ['components', 'helpers', 'modifiers', 'templates'];
  // pod structure, can we get podModulePrefix instead?
  const supportedFileNames = [
    'template.hbs', 'router.js', 'router.ts', 'router.gts', 'router.gjs', 'controller.js', 'controller.ts'
  ]
  if (!supportedPaths.some(s => resourcePath.includes(`/${s}/`)) && !supportedFileNames.some(s => resourcePath.endsWith(s))) {
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
