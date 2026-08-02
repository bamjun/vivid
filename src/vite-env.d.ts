/// <reference types="vite/client" />

declare module 'gifshot' {
  const content: any;
  export default content;
}

declare module 'gifuct-js' {
  export function parseGIF(buffer: ArrayBuffer): any;
  export function decompressFrames(gif: any, buildPatch: boolean): any[];
}
