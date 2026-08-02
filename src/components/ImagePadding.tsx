import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, ImagePlus, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatBytes } from '@/lib/utils';

interface ImagePaddingProps {
  onSuccess: (size: number) => void;
}

type BackgroundMode = 'transparent' | 'white';

interface ImageDimensions {
  width: number;
  height: number;
  outputHeight: number;
}

const getOutputDimensions = (width: number, height: number): ImageDimensions => ({
  width,
  height,
  // Keep the original width and place the original at the top of a 9:16 canvas.
  // max() keeps unusually tall images from being cropped.
  outputHeight: Math.max(Math.ceil((width * 16) / 9), height),
});

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('이미지 변환 결과를 만들 수 없습니다.'));
      }
    }, 'image/png');
  });

export const ImagePadding: React.FC<ImagePaddingProps> = ({ onSuccess }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState('');
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [background, setBackground] = useState<BackgroundMode>('transparent');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [resultSize, setResultSize] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [imageSrc, resultUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    if (imageSrc) URL.revokeObjectURL(imageSrc);
    if (resultUrl) URL.revokeObjectURL(resultUrl);

    setImageFile(file);
    setImageSrc(URL.createObjectURL(file));
    setImageDimensions(null);
    setResultUrl('');
    setResultSize(0);
  };

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) return;

    setImageDimensions(getOutputDimensions(image.naturalWidth, image.naturalHeight));
  };

  const createPaddedImage = async () => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !imageDimensions || isProcessing) return;

    setIsProcessing(true);
    try {
      canvas.width = imageDimensions.width;
      canvas.height = imageDimensions.outputHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas를 사용할 수 없습니다.');

      context.clearRect(0, 0, canvas.width, canvas.height);
      if (background === 'white') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      context.drawImage(image, 0, 0, imageDimensions.width, imageDimensions.height);
      const blob = await canvasToBlob(canvas);
      const nextResultUrl = URL.createObjectURL(blob);

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(nextResultUrl);
      setResultSize(blob.size);
      onSuccess(blob.size);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
    } catch (error) {
      console.error(error);
      alert('이미지 변환 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setImageFile(null);
    setImageSrc('');
    setImageDimensions(null);
    setResultUrl('');
    setResultSize(0);
  };

  const outputSize = imageDimensions
    ? `${imageDimensions.width} × ${imageDimensions.outputHeight}px`
    : '원본을 선택하면 자동 계산됩니다';
  const hasExtraHeight = imageDimensions && imageDimensions.outputHeight > imageDimensions.width * (16 / 9);

  return (
    <div className="space-y-8">
      {!imageSrc ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-purple-500/20 hover:border-purple-500/50 rounded-2xl p-12 bg-white/5 transition duration-300">
          <ImagePlus className="w-16 h-16 text-purple-400 mb-4 animate-pulse" />
          <h3 className="text-xl font-medium mb-1">Upload Image</h3>
          <p className="text-gray-400 text-sm mb-6 text-center max-w-sm">
            이미지를 상단에 그대로 배치하고 아래 빈 공간을 추가해 9:16 PNG로 변환합니다.
          </p>
          <label className="px-6 py-3 bg-purple-600 hover:bg-purple-700 font-medium rounded-xl cursor-pointer shadow-lg hover:shadow-purple-500/20 transition">
            Choose Image File
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20">
                  Step 1
                </span>
                <span className="font-medium text-gray-200">Original image at the top</span>
              </div>
              <button
                onClick={reset}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Choose Another</span>
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden glass-panel select-none flex items-start justify-center bg-[#252733] p-4 min-h-[300px]">
              <img
                ref={imageRef}
                src={imageSrc}
                onLoad={handleImageLoad}
                className="max-h-[500px] w-auto max-w-full object-contain"
                alt="Uploaded original"
              />
            </div>
            <div className="text-xs text-gray-500 flex justify-between px-1">
              <span>Original: {imageDimensions ? `${imageDimensions.width} × ${imageDimensions.height}px` : 'Loading...'}</span>
              <span>Output: {outputSize}</span>
            </div>
            {hasExtraHeight && (
              <p className="text-xs text-amber-300/80">
                원본 높이가 9:16 캔버스보다 커서 원본이 잘리지 않도록 높이를 유지했습니다.
              </p>
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel-glow rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-semibold flex items-center space-x-2 border-b border-white/5 pb-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>Image 9:16 Settings</span>
              </h3>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-2">Empty Area</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setBackground('transparent')}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        background === 'transparent'
                          ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Transparent
                    </button>
                    <button
                      onClick={() => setBackground('white')}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        background === 'white'
                          ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      White
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-500 block mt-2">
                    기본값은 투명한 빈 공간이며 PNG로 저장됩니다.
                  </span>
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Canvas size</span>
                    <span className="text-purple-300 font-mono">{outputSize}</span>
                  </div>
                  <p className="text-xs text-gray-500">원본은 가로 폭을 유지하고 캔버스의 가장 위에 배치됩니다.</p>
                </div>
              </div>

              {isProcessing ? (
                <div className="w-full py-4 bg-[#121318] border border-white/10 rounded-xl flex items-center justify-center space-x-3 text-purple-400 font-medium">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating 9:16 Image...</span>
                </div>
              ) : (
                <button
                  onClick={createPaddedImage}
                  disabled={!imageDimensions}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-medium rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition duration-300 flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  <span>Make 9:16 Image</span>
                </button>
              )}
            </div>

            {resultUrl && (
              <div className="glass-panel rounded-2xl p-6 space-y-4 border border-green-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-green-400 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>9:16 Image Ready!</span>
                  </span>
                  <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                    {formatBytes(resultSize)}
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden bg-black/40 p-2 flex justify-center border border-white/5 max-h-[300px]">
                  <img src={resultUrl} alt="9:16 result" className="max-h-[280px] object-contain rounded" />
                </div>
                <a
                  href={resultUrl}
                  download={`9x16_${imageFile?.name.replace(/\.[^.]+$/, '') || 'image'}.png`}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-500 font-medium rounded-xl text-center flex items-center justify-center space-x-2 shadow-lg shadow-green-500/10 hover:shadow-green-500/20 transition"
                >
                  <Download className="w-5 h-5" />
                  <span>Download PNG</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
};
