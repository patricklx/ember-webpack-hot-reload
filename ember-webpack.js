"use strict";
/*
  Most of the work this module does is putting an HTML-oriented facade around
  Webpack. That is, we want both the input and output to be primarily HTML files
  with proper spec semantics, and we use webpack to optimize the assets referred
  to by those files.

  While there are webpack plugins for handling HTML, none of them handle
  multiple HTML entrypoints and apply correct HTML semantics (for example,
  getting script vs module context correct).
*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Webpack = void 0;
const core_1 = require("@embroider/core");
const shared_internals_1 = require("@embroider/shared-internals");
const webpack_1 = __importDefault(require("webpack"));
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const isEqual_1 = __importDefault(require("lodash/isEqual"));
const mergeWith_1 = __importDefault(require("lodash/mergeWith"));
const flatMap_1 = __importDefault(require("lodash/flatMap"));
const mini_css_extract_plugin_1 = __importDefault(require("mini-css-extract-plugin"));
const debug_1 = __importDefault(require("debug"));
const util_1 = require("util");
const thread_loader_1 = require("thread-loader");
const crypto_1 = __importDefault(require("crypto"));
const satisfies_1 = __importDefault(require("semver/functions/satisfies"));
const supports_color_1 = __importDefault(require("supports-color"));
const webpack_resolver_plugin_1 = require("./webpack-resolver-plugin");
const debug = (0, debug_1.default)('embroider:debug');
const WebpackDevServer = require('webpack-dev-server');
// AppInfos are equal if they result in the same webpack config.
function equalAppInfo(left, right) {
    return ((0, isEqual_1.default)(left.babel, right.babel) &&
        left.entrypoints.length === right.entrypoints.length &&
        left.entrypoints.every((e, index) => (0, isEqual_1.default)(e.modules, right.entrypoints[index].modules)));
}
function createBarrier() {
    const barriers = [];
    let done = true;
    let limit = 0;
    return [begin, increment];
    function begin(newLimit) {
        if (!done)
            flush(new Error('begin called before limit reached'));
        done = false;
        limit = newLimit;
    }
    async function increment() {
        if (done) {
            throw new Error('increment after limit reach');
        }
        const promise = new Promise((resolve, reject) => {
            barriers.push([resolve, reject]);
        });
        if (barriers.length === limit) {
            flush();
        }
        await promise;
    }
    function flush(err) {
        for (const [resolve, reject] of barriers) {
            if (err)
                reject(err);
            else
                resolve();
        }
        barriers.length = 0;
        done = true;
    }
}
// we want to ensure that not only does our instance conform to
// PackagerInstance, but our constructor conforms to Packager. So instead of
// just exporting our class directly, we export a const constructor of the
// correct type.
const Webpack = (_a = class Webpack {
        constructor(appRoot, outputPath, variants, consoleWrite, options) {
            this.appRoot = appRoot;
            this.outputPath = outputPath;
            this.variants = variants;
            this.consoleWrite = consoleWrite;
            this.passthroughCache = new Map();
            this.lastContents = new Map();
            if (!(0, satisfies_1.default)(webpack_1.default.version, '^5.0.0')) {
                throw new Error(`@embroider/webpack requires webpack@^5.0.0, but found version ${webpack_1.default.version}`);
            }
            let packageCache = shared_internals_1.RewrittenPackageCache.shared('embroider', appRoot);
            this.pathToVanillaApp = packageCache.maybeMoved(packageCache.get(appRoot)).root;
            this.extraConfig = options === null || options === void 0 ? void 0 : options.webpackConfig;
            this.publicAssetURL = options === null || options === void 0 ? void 0 : options.publicAssetURL;
            this.extraThreadLoaderOptions = options === null || options === void 0 ? void 0 : options.threadLoaderOptions;
            this.extraBabelLoaderOptions = options === null || options === void 0 ? void 0 : options.babelLoaderOptions;
            this.extraCssLoaderOptions = options === null || options === void 0 ? void 0 : options.cssLoaderOptions;
            this.extraStyleLoaderOptions = options === null || options === void 0 ? void 0 : options.styleLoaderOptions;
            [this.beginBarrier, this.incrementBarrier] = createBarrier();
            warmUp(this.extraThreadLoaderOptions);
        }
        get bundleSummary() {
            let bundleSummary = this._bundleSummary;
            if (bundleSummary === undefined) {
                this._bundleSummary = bundleSummary = {
                    entrypoints: new Map(),
                    lazyBundles: new Map(),
                    variants: this.variants,
                };
            }
            return bundleSummary;
        }
        async build() {
            this._bundleSummary = undefined;
            this.beginBarrier(this.variants.length);
            let appInfo = this.examineApp();
            let webpack = this.getWebpack(appInfo);
            if (webpack instanceof WebpackDevServer) {
              return new Promise((resolve) => {
                this.currentBuildPromiseResolve = resolve;
              })
              return
            }
            await this.runWebpack(webpack);
        }
        examineApp() {
            let meta = (0, core_1.getAppMeta)(this.pathToVanillaApp);
            let rootURL = meta['ember-addon']['root-url'];
            let babel = meta['ember-addon']['babel'];
            let entrypoints = [];
            let otherAssets = [];
            let publicAssetURL = this.publicAssetURL || rootURL;
            for (let relativePath of meta['ember-addon'].assets) {
                if (/\.html/i.test(relativePath)) {
                    entrypoints.push(new core_1.HTMLEntrypoint(this.pathToVanillaApp, rootURL, publicAssetURL, relativePath));
                }
                else {
                    otherAssets.push(relativePath);
                }
            }
            let resolverConfig = (0, fs_extra_1.readJSONSync)((0, path_1.join)((0, shared_internals_1.locateEmbroiderWorkingDir)(this.appRoot), 'resolver.json'));
            return { entrypoints, otherAssets, babel, rootURL, resolverConfig, publicAssetURL, packageName: meta.name };
        }
        configureWebpack(appInfo, variant, variantIndex) {
            const { entrypoints, babel, publicAssetURL, packageName, resolverConfig } = appInfo;
            let entry = {};
            for (let entrypoint of entrypoints) {
                for (let moduleName of entrypoint.modules) {
                    entry[moduleName] = './' + moduleName;
                }
            }
            let { plugins: stylePlugins, loaders: styleLoaders } = this.setupStyleConfig(variant);
            let babelLoaderOptions = makeBabelLoaderOptions(babel.majorVersion, variant, (0, path_1.join)(this.pathToVanillaApp, babel.filename), this.extraBabelLoaderOptions);
            let babelLoaderPrefix = `babel-loader-9?${JSON.stringify(babelLoaderOptions.options)}!`;
            return {
                mode: variant.optimizeForProduction ? 'production' : 'development',
                context: this.pathToVanillaApp,
                entry,
                performance: {
                    hints: false,
                },
                plugins: [
                    ...stylePlugins,
                    new webpack_resolver_plugin_1.EmbroiderPlugin(resolverConfig, babelLoaderPrefix),
                    compiler => {
                        compiler.hooks.done.tapPromise('EmbroiderPlugin', async (stats) => {
                            this.summarizeStats(stats, variant, variantIndex);
                            this.currentBuildPromiseResolve?.();
                            let appInfo = this.examineApp();
                            const webpack = this.getWebpack(appInfo);
                            if (webpack instanceof WebpackDevServer) {
                              return;
                            }
                            await this.writeFiles(this.bundleSummary, this.lastAppInfo, variantIndex);
                        });
                    },
                ],
                node: false,
                module: {
                    rules: [
                        {
                            test: /\.hbs$/,
                            use: nonNullArray([
                                maybeThreadLoader(babel.isParallelSafe, this.extraThreadLoaderOptions),
                                babelLoaderOptions,
                                {
                                    loader: require.resolve('@embroider/hbs-loader'),
                                    options: (() => {
                                        let options = {
                                            compatModuleNaming: {
                                                rootDir: this.pathToVanillaApp,
                                                modulePrefix: packageName,
                                            },
                                        };
                                        return options;
                                    })(),
                                },
                            ]),
                        },
                        {
                            // eslint-disable-next-line @typescript-eslint/no-require-imports
                            test: require((0, path_1.join)(this.pathToVanillaApp, babel.fileFilter)),
                            use: nonNullArray([
                                maybeThreadLoader(babel.isParallelSafe, this.extraThreadLoaderOptions),
                                makeBabelLoaderOptions(babel.majorVersion, variant, (0, path_1.join)(this.pathToVanillaApp, babel.filename), this.extraBabelLoaderOptions),
                            ]),
                        },
                        {
                            test: isCSS,
                            use: styleLoaders,
                        },
                    ],
                },
                output: {
                    path: (0, path_1.join)(this.outputPath),
                    filename: `assets/chunk.[chunkhash].js`,
                    chunkFilename: `assets/chunk.[chunkhash].js`,
                    publicPath: publicAssetURL,
                },
                optimization: {
                    splitChunks: {
                        chunks: 'all',
                    },
                },
                resolve: {
                    extensions: resolverConfig.resolvableExtensions,
                },
                resolveLoader: {
                    alias: {
                        // these loaders are our dependencies, not the app's dependencies. I'm
                        // not overriding the default loader resolution rules in case the app also
                        // wants to control those.
                        'thread-loader': require.resolve('thread-loader'),
                        'babel-loader-9': require.resolve('@embroider/babel-loader-9'),
                        'css-loader': require.resolve('css-loader'),
                        'style-loader': require.resolve('style-loader'),
                    },
                },
            };
        }
        getWebpack(appInfo) {
            if (this.lastWebpack && this.lastAppInfo && equalAppInfo(appInfo, this.lastAppInfo)) {
                debug(`reusing webpack config`);
                // the appInfos result in equal webpack configs so we don't need to
                // reconfigure webpack. But they may contain other changes (like HTML
                // content changes that don't alter the webpack config) so we still want
                // lastAppInfo to update so that the latest one will be seen in the
                // webpack post-build.
                this.lastAppInfo = appInfo;
                return this.lastWebpackServer || this.lastWebpack;
            }
            this.lastWebpackServer?.stop();
            debug(`configuring webpack`);
            let config = this.variants.map((variant, variantIndex) => (0, mergeWith_1.default)({}, this.configureWebpack(appInfo, variant, variantIndex), this.extraConfig, appendArrays));
            this.lastAppInfo = appInfo;
            const devServerOptions = { ...this.extraConfig.devServer, open: true };
            console.log('devServerOptions', devServerOptions);
            this.lastWebpack = (0, webpack_1.default)(config)
            const server = new WebpackDevServer(devServerOptions, this.lastWebpack);
            server.start();
            this.lastWebpackServer = server;
            return this.lastWebpackServer;
        }
        async writeScript(script, written, variant) {
            if (!variant.optimizeForProduction) {
                this.copyThrough(script);
                return script;
            }
            // loading these lazily here so they never load in non-production builds.
            // The node cache will ensures we only load them once.
            const [Terser, srcURL] = await Promise.all([Promise.resolve().then(() => __importStar(require('terser'))), Promise.resolve().then(() => __importStar(require('source-map-url')))]);
            let inCode = (0, fs_extra_1.readFileSync)((0, path_1.join)(this.pathToVanillaApp, script), 'utf8');
            let terserOpts = {};
            let fileRelativeSourceMapURL;
            let appRelativeSourceMapURL;
            if (srcURL.default.existsIn(inCode)) {
                fileRelativeSourceMapURL = srcURL.default.getFrom(inCode);
                appRelativeSourceMapURL = (0, path_1.join)((0, path_1.dirname)(script), fileRelativeSourceMapURL);
                let content;
                try {
                    content = (0, fs_extra_1.readJSONSync)((0, path_1.join)(this.pathToVanillaApp, appRelativeSourceMapURL));
                }
                catch (err) {
                    // the script refers to a sourcemap that doesn't exist, so we just leave
                    // the map out.
                }
                if (content) {
                    terserOpts.sourceMap = { content, url: fileRelativeSourceMapURL };
                }
            }
            let { code: outCode, map: outMap } = await Terser.default.minify(inCode, terserOpts);
            let finalFilename = this.getFingerprintedFilename(script, outCode);
            (0, fs_extra_1.outputFileSync)((0, path_1.join)(this.outputPath, finalFilename), outCode);
            written.add(script);
            if (appRelativeSourceMapURL && outMap) {
                (0, fs_extra_1.outputFileSync)((0, path_1.join)(this.outputPath, appRelativeSourceMapURL), outMap);
                written.add(appRelativeSourceMapURL);
            }
            return finalFilename;
        }
        async writeStyle(style, written, variant) {
            if (!variant.optimizeForProduction) {
                this.copyThrough(style);
                written.add(style);
                return style;
            }
            const csso = await Promise.resolve().then(() => __importStar(require('csso')));
            const cssContent = (0, fs_extra_1.readFileSync)((0, path_1.join)(this.pathToVanillaApp, style), 'utf8');
            const minifiedCss = csso.minify(cssContent).css;
            let finalFilename = this.getFingerprintedFilename(style, minifiedCss);
            (0, fs_extra_1.outputFileSync)((0, path_1.join)(this.outputPath, finalFilename), minifiedCss);
            written.add(style);
            return finalFilename;
        }
        async provideErrorContext(message, messageParams, fn) {
            try {
                return await fn();
            }
            catch (err) {
                let context = (0, util_1.format)(message, ...messageParams);
                err.message = context + ': ' + err.message;
                throw err;
            }
        }
        async writeFiles(stats, { entrypoints, otherAssets }, variantIndex) {
            // we're doing this ourselves because I haven't seen a webpack 4 HTML plugin
            // that handles multiple HTML entrypoints correctly.
            let written = new Set();
            // scripts (as opposed to modules) and stylesheets (as opposed to CSS
            // modules that are imported from JS modules) get passed through without
            // going through webpack.
            for (let entrypoint of entrypoints) {
                await this.provideErrorContext('needed by %s', [entrypoint.filename], async () => {
                    for (let script of entrypoint.scripts) {
                        if (!stats.entrypoints.has(script)) {
                            const mapping = [];
                            try {
                                // zero here means we always attribute passthrough scripts to the
                                // first build variant
                                stats.entrypoints.set(script, new Map([[0, mapping]]));
                                mapping.push(await this.writeScript(script, written, this.variants[0]));
                            }
                            catch (err) {
                                if (err.code === 'ENOENT' && err.path === (0, path_1.join)(this.pathToVanillaApp, script)) {
                                    this.consoleWrite(`warning: in ${entrypoint.filename} <script src="${script
                                        .split(path_1.sep)
                                        .join('/')}"> does not exist on disk. If this is intentional, use a data-embroider-ignore attribute.`);
                                }
                                else {
                                    throw err;
                                }
                            }
                        }
                    }
                    for (let style of entrypoint.styles) {
                        if (!stats.entrypoints.has(style)) {
                            const mapping = [];
                            try {
                                // zero here means we always attribute passthrough styles to the
                                // first build variant
                                stats.entrypoints.set(style, new Map([[0, mapping]]));
                                mapping.push(await this.writeStyle(style, written, this.variants[0]));
                            }
                            catch (err) {
                                if (err.code === 'ENOENT' && err.path === (0, path_1.join)(this.pathToVanillaApp, style)) {
                                    this.consoleWrite(`warning: in ${entrypoint.filename}  <link rel="stylesheet" href="${style
                                        .split(path_1.sep)
                                        .join('/')}"> does not exist on disk. If this is intentional, use a data-embroider-ignore attribute.`);
                                }
                                else {
                                    throw err;
                                }
                            }
                        }
                    }
                });
            }
            // we need to wait for both compilers before writing html entrypoint
            await this.incrementBarrier();
            // only the first variant should write it.
            if (variantIndex === 0) {
                for (let entrypoint of entrypoints) {
                    this.writeIfChanged((0, path_1.join)(this.outputPath, entrypoint.filename), entrypoint.render(stats));
                    written.add(entrypoint.filename);
                }
            }
            for (let relativePath of otherAssets) {
                if (!written.has(relativePath)) {
                    written.add(relativePath);
                    await this.provideErrorContext(`while copying app's assets`, [], async () => {
                        this.copyThrough(relativePath);
                    });
                }
            }
        }
        // The point of this caching isn't really performance (we generate the
        // contents either way, and the actual write is unlikely to be expensive).
        // It's helping ember-cli's traditional livereload system to avoid triggering
        // a full page reload when that wasn't really necessary.
        writeIfChanged(filename, content) {
            if (this.lastContents.get(filename) !== content) {
                (0, fs_extra_1.outputFileSync)(filename, content, 'utf8');
                this.lastContents.set(filename, content);
            }
        }
        copyThrough(relativePath) {
            let sourcePath = (0, path_1.join)(this.pathToVanillaApp, relativePath);
            let newStats = (0, fs_extra_1.statSync)(sourcePath);
            let oldStats = this.passthroughCache.get(sourcePath);
            if (!oldStats || oldStats.mtimeMs !== newStats.mtimeMs || oldStats.size !== newStats.size) {
                debug(`emitting ${relativePath}`);
                (0, fs_extra_1.copySync)(sourcePath, (0, path_1.join)(this.outputPath, relativePath));
                this.passthroughCache.set(sourcePath, newStats);
            }
        }
        getFingerprintedFilename(filename, content) {
            let md5 = crypto_1.default.createHash('md5');
            md5.update(content);
            let hash = md5.digest('hex');
            let fileParts = filename.split('.');
            fileParts.splice(fileParts.length - 1, 0, hash);
            return fileParts.join('.');
        }
        summarizeStats(stats, variant, variantIndex) {
            let output = this.bundleSummary;
            let { entrypoints, chunks } = stats.toJson({
                all: false,
                entrypoints: true,
                chunks: true,
            });
            // webpack's types are written rather loosely, implying that these two
            // properties may not be present. They really always are, as far as I can
            // tell, but we need to check here anyway to satisfy the type checker.
            if (!entrypoints) {
                throw new Error(`unexpected webpack output: no entrypoints`);
            }
            if (!chunks) {
                throw new Error(`unexpected webpack output: no chunks`);
            }
            for (let id of Object.keys(entrypoints)) {
                let { assets: entrypointAssets } = entrypoints[id];
                if (!entrypointAssets) {
                    throw new Error(`unexpected webpack output: no entrypoint.assets`);
                }
                (0, core_1.getOrCreate)(output.entrypoints, id, () => new Map()).set(variantIndex, entrypointAssets.map(asset => asset.name));
                if (variant.runtime !== 'browser') {
                    // in the browser we don't need to worry about lazy assets (they will be
                    // handled automatically by webpack as needed), but in any other runtime
                    // we need the ability to preload them
                    output.lazyBundles.set(id, (0, flatMap_1.default)(chunks.filter(chunk => { var _a; return (_a = chunk.runtime) === null || _a === void 0 ? void 0 : _a.includes(id); }), chunk => chunk.files).filter(file => !(entrypointAssets === null || entrypointAssets === void 0 ? void 0 : entrypointAssets.find(a => a.name === file))));
                }
            }
        }
        runWebpack(webpack) {
          return Promise.resolve();
            return new Promise((resolve, reject) => {
              webpack.run((err, stats) => {
                    try {
                        if (err) {
                            if (stats) {
                                this.consoleWrite(stats.toString());
                            }
                            throw err;
                        }
                        if (!stats) {
                            // this doesn't really happen, but webpack's types imply that it
                            // could, so we just satisfy typescript here
                            throw new Error('bug: no stats and no err');
                        }
                        if (stats.hasErrors()) {
                            // write all the stats output to the console
                            this.consoleWrite(stats.toString({
                                color: Boolean(supports_color_1.default.stdout),
                            }));
                            // the typing for MultiCompiler are all foobared.
                            throw this.findBestError((0, flatMap_1.default)(stats.stats, s => s.compilation.errors));
                        }
                        if (stats.hasWarnings() || process.env.VANILLA_VERBOSE) {
                            this.consoleWrite(stats.toString({
                                color: Boolean(supports_color_1.default.stdout),
                            }));
                        }
                        resolve(stats);
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            });
        }
        setupStyleConfig(variant) {
            let cssLoader = {
                loader: 'css-loader',
                options: {
                    url: true,
                    import: true,
                    modules: 'global',
                    ...this.extraCssLoaderOptions,
                },
            };
            if (!variant.optimizeForProduction && variant.runtime === 'browser') {
                // in development builds that only need to work in the browser (not
                // fastboot), we can use style-loader because it's fast
                return {
                    loaders: [
                        { loader: 'style-loader', options: { injectType: 'styleTag', ...this.extraStyleLoaderOptions } },
                        cssLoader,
                    ],
                    plugins: [],
                };
            }
            else {
                // in any other build, we separate the CSS into its own bundles
                return {
                    loaders: [mini_css_extract_plugin_1.default.loader, cssLoader],
                    plugins: [
                        new mini_css_extract_plugin_1.default({
                            filename: `assets/chunk.[chunkhash].css`,
                            chunkFilename: `assets/chunk.[chunkhash].css`,
                            // in the browser, MiniCssExtractPlugin can manage it's own runtime
                            // lazy loading of stylesheets.
                            //
                            // but in fastboot, we need to disable that in favor of doing our
                            // own insertion of `<link>` tags in the HTML
                            runtime: variant.runtime === 'browser',
                        }),
                    ],
                };
            }
        }
        findBestError(errors) {
            var _a, _b;
            let error = errors[0];
            let file;
            if ((_a = error.module) === null || _a === void 0 ? void 0 : _a.userRequest) {
                file = (0, path_1.relative)(this.pathToVanillaApp, error.module.userRequest);
            }
            if (!error.file) {
                error.file = file || (error.loc ? error.loc.file : null) || (error.location ? error.location.file : null);
            }
            if (error.line == null) {
                error.line = (error.loc ? error.loc.line : null) || (error.location ? error.location.line : null);
            }
            if (typeof error.message === 'string') {
                if ((_b = error.module) === null || _b === void 0 ? void 0 : _b.context) {
                    error.message = error.message.replace(error.module.context, error.module.userRequest);
                }
                // the tmpdir on OSX is horribly long and makes error messages hard to
                // read. This is doing the same as String.prototype.replaceAll, which node
                // doesn't have yet.
                error.message = error.message.split(shared_internals_1.tmpdir).join('$TMPDIR');
            }
            return error;
        }
    },
    _a.annotation = '@embroider/webpack',
    _a);
exports.Webpack = Webpack;
const threadLoaderOptions = {
    workers: 'JOBS' in process.env && Number(process.env.JOBS),
    // poolTimeout shuts down idle workers. The problem is, for
    // interactive rebuilds that means your startup cost for the
    // next rebuild is at least 600ms worse. So we insist on
    // keeping workers alive always.
    poolTimeout: Infinity,
};
function canUseThreadLoader(extraOptions) {
    // If the environment sets JOBS to 0, or if our extraOptions are set to false,
    // we have been explicitly configured not to use thread-loader
    if (process.env.JOBS === '0' || extraOptions === false) {
        return false;
    }
    else {
        return true;
    }
}
function warmUp(extraOptions) {
    // We don't know if we'll be parallel-safe or not, but if we've been
    // configured to not use thread-loader, then there is no need to consume extra
    // resources warming the worker pool
    if (!canUseThreadLoader(extraOptions)) {
        return null;
    }
    (0, thread_loader_1.warmup)(Object.assign({}, threadLoaderOptions, extraOptions), [
        require.resolve('@embroider/hbs-loader'),
        require.resolve('@embroider/babel-loader-9'),
    ]);
}
function maybeThreadLoader(isParallelSafe, extraOptions) {
    if (!canUseThreadLoader(extraOptions) || !isParallelSafe) {
        return null;
    }
    return {
        loader: 'thread-loader',
        options: Object.assign({}, threadLoaderOptions, extraOptions),
    };
}
function appendArrays(objValue, srcValue) {
    if (Array.isArray(objValue)) {
        return objValue.concat(srcValue);
    }
}
function isCSS(filename) {
    return /\.css$/i.test(filename);
}
// typescript doesn't understand that regular use of array.filter(Boolean) does
// this.
function nonNullArray(array) {
    return array.filter(Boolean);
}
function makeBabelLoaderOptions(_majorVersion, variant, appBabelConfigPath, extraOptions) {
    const cacheDirectory = (0, core_1.getPackagerCacheDir)('webpack-babel-loader');
    const options = {
        variant,
        appBabelConfigPath,
        cacheDirectory,
        ...extraOptions,
    };
    return {
        loader: 'babel-loader-9',
        options,
    };
}
//# sourceMappingURL=ember-webpack.js.map
