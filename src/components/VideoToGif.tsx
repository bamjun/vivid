import React, { useState, useRef, useEffect } from 'react';
import { formatBytes } from '@/lib/utils';
import { fetchFile } from '@ffmpeg/util';
import { Film, Download, Sparkles, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CropOverlay } from './CropOverlay';
import ffmpeg, { loadFFmpeg as initFFmpeg } from '@/lib/ffmpeg';
interface VideoToGifProps {
  onSuccess: (size: number) => void;
}

export const VideoToGif: React.FC<VideoToGifProps> = ({ onSuccess }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoWidth, setVideoWidth] = useState<number>(0);
  const [videoHeight, setVideoHeight] = useState<number>(0);

  // Settings
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [fps, setFps] = useState<number>(12);
  const [scale, setScale] = useState<number>(0.75); // higher default scale for better resolution
  const [dither, setDither] = useState<string>('bayer'); // bayer, floyd_steinberg, none

  // Processing states
  const [isWasmLoading, setIsWasmLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [gifResult, setGifResult] = useState<string>('');
  const [gifSize, setGifSize] = useState<number>(0);

  // Crop State
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);

  // Cleanup Object URL on unmount
  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      if (gifResult) URL.revokeObjectURL(gifResult);
    };
  }, [videoSrc, gifResult]);

  const loadFFmpeg = async () => {
    setIsWasmLoading(true);
    try {
      await initFFmpeg(
        (msg) => setProgressMsg(msg),
        () => {}
      );
    } catch (err: any) {
      console.error('Failed to load FFmpeg WASM', err);
      alert(`Failed to load FFmpeg: ${err?.message || err}. Please ensure the Vite server was restarted to apply Cross-Origin Isolation headers.`);
    } finally {
      setIsWasmLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setGifResult('');
    setGifSize(0);

    // Eager load FFmpeg when a file is selected
    await loadFFmpeg();
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    setVideoDuration(video.duration);
    setEndTime(Math.min(video.duration, 4)); // default to first 4 seconds
    setVideoWidth(video.videoWidth);
    setVideoHeight(video.videoHeight);

    // Initial Crop (full screen)
    setCrop({
      x: 0,
      y: 0,
      width: video.videoWidth,
      height: video.videoHeight,
    });
  };

  const convertToGif = async () => {
    if (!videoFile || !videoRef.current || isProcessing) return;
    
    // Ensure FFmpeg is fully loaded
    if (!ffmpeg.loaded) {
      await loadFFmpeg();
    }

    setIsProcessing(true);
    setGifResult('');

    const targetW = Math.round(crop.width * scale);
    const targetH = Math.round(crop.height * scale);

    try {
      // 1. Write the source video file to FFmpeg WASM virtual filesystem
      setProgressMsg('Step 1/3: Reading video file...');
      const videoData = await fetchFile(videoFile);
      await ffmpeg.writeFile('input.mp4', videoData);

      // FFmpeg filter string representing cropping and scaling operations
      const filterString = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${targetW}:${targetH},fps=${fps}`;

      // 2. Pass 1: Generate high quality 256-color palette specifically for the video contents
      setProgressMsg('Step 2/3: Generating high-fidelity color palette (Pass 1)...');
      await ffmpeg.exec([
        '-ss', startTime.toString(),
        '-to', endTime.toString(),
        '-i', 'input.mp4',
        '-vf', `${filterString},palettegen=stats_mode=diff`,
        'palette.png',
      ]);

      // 3. Pass 2: Compile video to GIF utilizing the custom generated palette and dithering
      setProgressMsg('Step 3/3: Rendering professional quality GIF (Pass 2)...');
      const ditherConfig = dither === 'none' ? 'dither=none' : `dither=${dither}`;
      
      await ffmpeg.exec([
        '-ss', startTime.toString(),
        '-to', endTime.toString(),
        '-i', 'input.mp4',
        '-i', 'palette.png',
        '-filter_complex', `[0:v]${filterString}[v];[v][1:v]paletteuse=${ditherConfig}`,
        'output.gif',
      ]);

      // 4. Read output gif from FFmpeg filesystem
      setProgressMsg('Finalizing...');
      const data = await ffmpeg.readFile('output.gif');
      const gifBlob = new Blob([data as any], { type: 'image/gif' });
      const gifUrl = URL.createObjectURL(gifBlob);

      setGifResult(gifUrl);
      setGifSize(gifBlob.size);
      onSuccess(gifBlob.size);

      // Clean up local virtual files to save memory
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('palette.png');
      await ffmpeg.deleteFile('output.gif');

      // Celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.8 },
      });
    } catch (err) {
      console.error(err);
      alert('Error during conversion. Check console.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const resetCrop = () => {
    setCrop({
      x: 0,
      y: 0,
      width: videoWidth,
      height: videoHeight,
    });
  };

  return (
    <div className="space-y-8">
      {/* File Selector */}
      {!videoSrc ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-purple-500/20 hover:border-purple-500/50 rounded-2xl p-12 bg-white/5 transition duration-300">
          <Film className="w-16 h-16 text-purple-400 mb-4 animate-pulse" />
          <h3 className="text-xl font-medium mb-1">Upload MP4 Video</h3>
          <p className="text-gray-400 text-sm mb-6 text-center max-w-xs">
            Select a video file to convert to a high-quality GIF using client-side FFmpeg WebAssembly.
          </p>
          <label className="px-6 py-3 bg-purple-600 hover:bg-purple-700 font-medium rounded-xl cursor-pointer shadow-lg hover:shadow-purple-500/20 transition">
            Choose Video File
            <input type="file" accept="video/mp4" onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Video Preview & Cropper */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20">
                  Step 1
                </span>
                <span className="font-medium text-gray-200">Adjust borders/drag box to crop video</span>
              </div>
              <button 
                onClick={resetCrop}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset Crop</span>
              </button>
            </div>

            {/* Video Container with New CropOverlay */}
            <div 
              className="relative rounded-2xl overflow-hidden glass-panel select-none flex items-center justify-center bg-black"
              style={{ minHeight: '300px' }}
            >
              <video
                ref={videoRef}
                src={videoSrc}
                onLoadedMetadata={handleLoadedMetadata}
                className="max-h-[500px] w-auto max-w-full relative z-0"
                controls
                playsInline
              />

              {/* CropOverlay Wrapper */}
              {videoWidth > 0 && (
                <CropOverlay
                  mediaWidth={videoWidth}
                  mediaHeight={videoHeight}
                  crop={crop}
                  setCrop={setCrop}
                  mediaRef={videoRef}
                />
              )}
            </div>
            <div className="text-xs text-gray-500 flex justify-between px-1">
              <span>Original size: {videoWidth}x{videoHeight}</span>
              <span>Crop: X:{crop.x}, Y:{crop.y}, {crop.width}x{crop.height}</span>
            </div>
          </div>

          {/* Right Column - Custom Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel-glow rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-semibold flex items-center space-x-2 border-b border-white/5 pb-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>Conversion Settings (FFmpeg)</span>
              </h3>

              {/* Settings Inputs */}
              <div className="space-y-5">
                {/* Trim Range Slider / Inputs */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-2">
                    Trim Duration
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">Start Time (sec)</span>
                      <input
                        type="number"
                        min={0}
                        max={videoDuration}
                        step={0.1}
                        value={startTime}
                        onChange={(e) => setStartTime(Math.max(0, Math.min(Number(e.target.value), endTime)))}
                        className="w-full bg-[#121318] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">End Time (sec)</span>
                      <input
                        type="number"
                        min={startTime}
                        max={videoDuration}
                        step={0.1}
                        value={endTime}
                        onChange={(e) => setEndTime(Math.max(startTime, Math.min(Number(e.target.value), videoDuration)))}
                        className="w-full bg-[#121318] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">
                    Total duration: {(endTime - startTime).toFixed(1)}s (Video length: {videoDuration.toFixed(1)}s)
                  </div>
                </div>

                {/* Scale Slider */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-semibold uppercase text-gray-400">Scale (Output Resolution)</label>
                    <span className="text-xs font-mono text-purple-400">{Math.round(scale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-full accent-purple-500 bg-white/5 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    Output GIF Size: {Math.round(crop.width * scale)}x{Math.round(crop.height * scale)} px
                  </span>
                </div>

                {/* FPS Selector */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-semibold uppercase text-gray-400">Frame Rate (FPS)</label>
                    <span className="text-xs font-mono text-purple-400">{fps} FPS</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={25}
                    step={1}
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full accent-purple-500 bg-white/5 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1">
                    Higher FPS yields smoother results but larger file size.
                  </span>
                </div>

                {/* Dithering Mode */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-2">
                    Dithering Method (Color blending)
                  </label>
                  <select
                    value={dither}
                    onChange={(e) => setDither(e.target.value)}
                    className="w-full bg-[#121318] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-purple-500 transition"
                  >
                    <option value="bayer">Bayer (Dithered patterns - recommended)</option>
                    <option value="floyd_steinberg">Floyd-Steinberg (Diffusion - premium smooth)</option>
                    <option value="none">None (Clean colors, sharp edges)</option>
                  </select>
                  <span className="text-[10px] text-gray-500 block mt-1">
                    Floyd-Steinberg reduces color bands on gradients. Bayer produces smaller file sizes.
                  </span>
                </div>
              </div>

              {/* Action Button */}
              {isWasmLoading ? (
                <div className="w-full py-4 bg-[#121318] border border-white/10 rounded-xl flex items-center justify-center space-x-3 text-purple-400 font-medium">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Loading FFmpeg WebAssembly...</span>
                </div>
              ) : !isProcessing ? (
                <button
                  onClick={convertToGif}
                  disabled={endTime - startTime <= 0}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-medium rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition duration-300 flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  <span>Convert using FFmpeg</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="w-full bg-[#121318] border border-white/10 rounded-xl px-4 py-3 flex flex-col items-center justify-center space-y-2">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                      <span className="text-sm font-medium text-purple-400">Processing in Browser</span>
                    </div>
                    <span className="text-xs text-gray-400 text-center">{progressMsg}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Results Render Box */}
            {gifResult && (
              <div className="glass-panel rounded-2xl p-6 space-y-4 border border-green-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-green-400 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>Conversion Ready!</span>
                  </span>
                  <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                    {formatBytes(gifSize)}
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden bg-black/40 p-2 flex justify-center border border-white/5 max-h-[300px]">
                  <img src={gifResult} alt="Generated GIF" className="max-h-[280px] object-contain rounded" />
                </div>
                <a
                  href={gifResult}
                  download={`${videoFile?.name.replace('.mp4', '') || 'converted'}.gif`}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-500 font-medium rounded-xl text-center flex items-center justify-center space-x-2 shadow-lg shadow-green-500/10 hover:shadow-green-500/20 transition"
                >
                  <Download className="w-5 h-5" />
                  <span>Download GIF</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
