module.exports = function(source) {
  const options = this.getOptions();
  const testTag = `<script src="/assets/test.js" type="module"></script>`;
  const appTag = `<script src="/assets/${options.appName}.js" type="module"></script>`;
  return source
    .replace(testTag, '')
    .replace(appTag, '');
}
