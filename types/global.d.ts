declare module 'thread-loader' {
    export function warmup(options: any, loaders: string[]): void;
}

interface ImportMeta {
    url: string;
    webpackHot: any;
}

interface Window {
    emberHotReloadPlugin: any;
}

declare const requirejs: any