// Minimal Node stubs for local type checking when @types/node is unavailable.

declare let process: any;
declare let __dirname: string;
declare let module: any;
declare let require: any;
declare let exports: any;

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
