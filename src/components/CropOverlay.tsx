import React, { useState, useRef, useEffect } from 'react';

interface CropOverlayProps {
  mediaWidth: number; // Natural/Video width
  mediaHeight: number; // Natural/Video height
  crop: { x: number; y: number; width: number; height: number };
  setCrop: (crop: { x: number; y: number; width: number; height: number }) => void;
  mediaRef: React.RefObject<HTMLElement>;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({
  mediaWidth,
  mediaHeight,
  crop,
  setCrop,
  mediaRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // UI coordinates (in pixels, relative to the media element's visual size)
  const [uiBox, setUiBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [dragState, setDragState] = useState<{
    mode: 'create' | 'move' | 't' | 'b' | 'l' | 'r' | 'tl' | 'tr' | 'bl' | 'br' | null;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    startWidth: 0,
    startHeight: 0,
  });

  // Track the actual visual bounding rect of the media element
  const [mediaRect, setMediaRect] = useState({ width: 0, height: 0 });

  const updateMediaDimensions = () => {
    if (!mediaRef.current) return;
    const rect = mediaRef.current.getBoundingClientRect();
    setMediaRect({ width: rect.width, height: rect.height });
  };

  useEffect(() => {
    updateMediaDimensions();
    window.addEventListener('resize', updateMediaDimensions);
    return () => window.removeEventListener('resize', updateMediaDimensions);
  }, [mediaWidth, mediaHeight, mediaRef.current]);

  // Sync UI Box coordinates from actual crop coordinates
  useEffect(() => {
    if (mediaRect.width === 0 || mediaWidth === 0) return;
    const scaleX = mediaRect.width / mediaWidth;
    const scaleY = mediaRect.height / mediaHeight;

    setUiBox({
      left: crop.x * scaleX,
      top: crop.y * scaleY,
      width: crop.width * scaleX,
      height: crop.height * scaleY,
    });
  }, [crop, mediaRect, mediaWidth, mediaHeight]);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    mode: typeof dragState.mode
  ) => {
    e.stopPropagation();
    if (!mediaRef.current) return;

    // Capture pointer events so they follow even when drag leaves container
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = mediaRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (mode === 'create') {
      setDragState({
        mode: 'create',
        startX: clientX,
        startY: clientY,
        startLeft: clientX,
        startTop: clientY,
        startWidth: 0,
        startHeight: 0,
      });
      setUiBox({ left: clientX, top: clientY, width: 0, height: 0 });
    } else {
      setDragState({
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: uiBox.left,
        startTop: uiBox.top,
        startWidth: uiBox.width,
        startHeight: uiBox.height,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.mode === null || !mediaRef.current) return;
    e.stopPropagation();

    const rect = mediaRef.current.getBoundingClientRect();
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    let newLeft = uiBox.left;
    let newTop = uiBox.top;
    let newWidth = uiBox.width;
    let newHeight = uiBox.height;

    const minSize = 20;

    if (dragState.mode === 'create') {
      const currentX = Math.max(0, Math.min(e.clientX - rect.left, mediaRect.width));
      const currentY = Math.max(0, Math.min(e.clientY - rect.top, mediaRect.height));
      newLeft = Math.min(dragState.startX, currentX);
      newTop = Math.min(dragState.startY, currentY);
      newWidth = Math.abs(dragState.startX - currentX);
      newHeight = Math.abs(dragState.startY - currentY);
    } else if (dragState.mode === 'move') {
      newLeft = Math.max(0, Math.min(dragState.startLeft + dx, mediaRect.width - dragState.startWidth));
      newTop = Math.max(0, Math.min(dragState.startTop + dy, mediaRect.height - dragState.startHeight));
    } else {
      // Resizing edges & corners
      const mode = dragState.mode;

      // Vertical resizing
      if (mode.includes('t')) {
        const potentialTop = dragState.startTop + dy;
        if (potentialTop >= 0 && potentialTop <= dragState.startTop + dragState.startHeight - minSize) {
          newTop = potentialTop;
          newHeight = dragState.startHeight - dy;
        }
      } else if (mode.includes('b')) {
        const potentialHeight = dragState.startHeight + dy;
        if (dragState.startTop + potentialHeight <= mediaRect.height) {
          newHeight = Math.max(minSize, potentialHeight);
        }
      }

      // Horizontal resizing
      if (mode.includes('l')) {
        const potentialLeft = dragState.startLeft + dx;
        if (potentialLeft >= 0 && potentialLeft <= dragState.startLeft + dragState.startWidth - minSize) {
          newLeft = potentialLeft;
          newWidth = dragState.startWidth - dx;
        }
      } else if (mode.includes('r')) {
        const potentialWidth = dragState.startWidth + dx;
        if (dragState.startLeft + potentialWidth <= mediaRect.width) {
          newWidth = Math.max(minSize, potentialWidth);
        }
      }
    }

    setUiBox({
      left: Math.round(newLeft),
      top: Math.round(newTop),
      width: Math.round(newWidth),
      height: Math.round(newHeight),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (dragState.mode === null || !mediaRef.current) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragState({ ...dragState, mode: null });

    // Map UI pixels back to natural media coordinates
    const scaleX = mediaWidth / mediaRect.width;
    const scaleY = mediaHeight / mediaRect.height;

    // If drag is too small, fallback to full screen
    if (uiBox.width < 15 || uiBox.height < 15) {
      setCrop({
        x: 0,
        y: 0,
        width: mediaWidth,
        height: mediaHeight,
      });
      return;
    }

    setCrop({
      x: Math.max(0, Math.min(Math.round(uiBox.left * scaleX), mediaWidth)),
      y: Math.max(0, Math.min(Math.round(uiBox.top * scaleY), mediaHeight)),
      width: Math.max(10, Math.min(Math.round(uiBox.width * scaleX), mediaWidth)),
      height: Math.max(10, Math.min(Math.round(uiBox.height * scaleY), mediaHeight)),
    });
  };

  return (
    <div
      ref={containerRef}
      className="absolute cursor-crosshair select-none"
      style={{
        width: `${mediaRect.width}px`,
        height: `${mediaRect.height}px`,
      }}
      onPointerDown={(e) => handlePointerDown(e, 'create')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Selection Box UI Overlay */}
      {uiBox.width > 0 && uiBox.height > 0 && (
        <div
          className="absolute border-2 border-dashed border-purple-400 bg-purple-500/5 group"
          style={{
            left: `${uiBox.left}px`,
            top: `${uiBox.top}px`,
            width: `${uiBox.width}px`,
            height: `${uiBox.height}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()} // Prevent creating new box when clicking inside
        >
          {/* Inner Drag to Move area */}
          <div
            className="w-full h-full cursor-move"
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {/* Dimension tag */}
          <div className="absolute top-0 left-0 bg-purple-500 text-white text-[10px] px-1 font-mono select-none pointer-events-none">
            {crop.width}x{crop.height}
          </div>

          {/* Corner Resizing Handles */}
          <div
            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-purple-500 rounded-full border border-white cursor-nwse-resize z-10"
            onPointerDown={(e) => handlePointerDown(e, 'tl')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          <div
            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-purple-500 rounded-full border border-white cursor-nesw-resize z-10"
            onPointerDown={(e) => handlePointerDown(e, 'tr')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          <div
            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-purple-500 rounded-full border border-white cursor-nesw-resize z-10"
            onPointerDown={(e) => handlePointerDown(e, 'bl')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-purple-500 rounded-full border border-white cursor-nwse-resize z-10"
            onPointerDown={(e) => handlePointerDown(e, 'br')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {/* Edge Resizing Handles (Lines) */}
          <div
            className="absolute -top-1 left-1.5 right-1.5 h-2 cursor-ns-resize"
            onPointerDown={(e) => handlePointerDown(e, 't')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          <div
            className="absolute -bottom-1 left-1.5 right-1.5 h-2 cursor-ns-resize"
            onPointerDown={(e) => handlePointerDown(e, 'b')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          <div
            className="absolute -left-1 top-1.5 bottom-1.5 w-2 cursor-ew-resize"
            onPointerDown={(e) => handlePointerDown(e, 'l')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          <div
            className="absolute -right-1 top-1.5 bottom-1.5 w-2 cursor-ew-resize"
            onPointerDown={(e) => handlePointerDown(e, 'r')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
      )}
    </div>
  );
};
