// Minimal Node stubs for local type checking when @types/node is unavailable.

declare var process: any;
declare var __dirname: string;
declare var module: any;
declare var require: any;
declare var exports: any;

declare module 'path' {
  const anything: any;
  export = anything;
}

declare module 'fs' {
  const anything: any;
  export = anything;
}

declare module 'url' {
  const anything: any;
  export = anything;
}

declare module 'os' {
  const anything: any;
  export = anything;
}

declare module '*' {
  const anything: any;
  export = anything;
}
