import { cp, mkdir, writeFile } from 'node:fs/promises';

await mkdir('public/vendor/ffmpeg', { recursive: true });
await cp('node_modules/@ffmpeg/ffmpeg/dist', 'public/vendor/ffmpeg', { recursive: true });
await cp('node_modules/@ffmpeg/core-st/dist', 'public/vendor/ffmpeg', { recursive: true });
await cp('node_modules/@ffmpeg/ffmpeg/LICENSE', 'public/vendor/ffmpeg/WRAPPER-LICENSE');
await cp('scripts/licenses/FFMPEG-GPL-2.0.txt', 'public/vendor/ffmpeg/COPYING.GPLv2');
await writeFile('public/vendor/ffmpeg/SOURCE.txt', [
  'Wrapper: @ffmpeg/ffmpeg 0.11.6 (MIT) — https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.11.6',
  'Core: @ffmpeg/core-st 0.11.1 — https://github.com/ffmpegwasm/FFmpeg',
  'Core includes FFmpeg and libx264, distributed under GPL-2.0-or-later.',
  'Corresponding source/build scripts and component licenses: see the core repository.',
  '',
].join('\n'));
