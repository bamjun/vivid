import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

export async function loadFFmpeg(
  onProgress?: (msg: string) => void,
  onLoaded?: () => void
): Promise<FFmpeg> {
  if (ffmpeg.loaded) {
    if (onLoaded) onLoaded();
    return ffmpeg;
  }

  if (onProgress) onProgress('Loading FFmpeg WebAssembly...');
  
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  if (onLoaded) onLoaded();
  return ffmpeg;
}

export default ffmpeg;
