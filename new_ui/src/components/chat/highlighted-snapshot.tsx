import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface BBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

interface HighlightedSnapshotProps {
    imageUrl: string;
    title: string;
    bbox?: number[];  // [x0, y0, x1, y1]
    bboxes?: number[][]; // Array of [x0, y0, x1, y1]
    imageDimensions?: { width: number; height: number };
    onClose: () => void;
}

export function HighlightedSnapshot({
    imageUrl,
    title,
    bbox,
    bboxes,
    imageDimensions,
    onClose
}: HighlightedSnapshotProps) {
    const [zoom, setZoom] = useState(1);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setImageLoaded(true);
    };

    // Calculate highlight rectangle dimensions
    const getHighlightStyles = (): React.CSSProperties[] => {
        if (!naturalDimensions) return [];
        
        const boxes = bboxes || (bbox ? [bbox] : []);
        if (boxes.length === 0) return [];

        return boxes.map(box => {
             if (!box || box.length !== 4) return null;
             const [x0, y0, x1, y1] = box;
             return {
                position: 'absolute',
                left: `${(x0 / naturalDimensions.width) * 100}%`,
                top: `${(y0 / naturalDimensions.height) * 100}%`,
                width: `${((x1 - x0) / naturalDimensions.width) * 100}%`,
                height: `${((y1 - y0) / naturalDimensions.height) * 100}%`,
                border: '3px solid #10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
                pointerEvents: 'none',
                animation: 'pulse 2s ease-in-out infinite'
             } as React.CSSProperties;
        }).filter((style): style is React.CSSProperties => style !== null);
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>

            <div
                className="relative bg-gray-900 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        {(bbox || (bboxes && bboxes.length > 0)) && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                                Context Highlighted
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Zoom controls */}
                        <button
                            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                            className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition"
                            title="Zoom Out"
                        >
                            <ZoomOut className="h-5 w-5" />
                        </button>
                        <span className="text-sm text-gray-400 min-w-[4ch] text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                            className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition"
                            title="Zoom In"
                        >
                            <ZoomIn className="h-5 w-5" />
                        </button>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition ml-2"
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Image container with highlight */}
                <div className="flex-1 overflow-auto p-4 bg-gray-800/50">
                    <div className="flex items-center justify-center min-h-full">
                        <div
                            className="relative inline-block"
                            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                        >
                            <img
                                src={imageUrl}
                                alt={title}
                                className="max-w-full h-auto rounded shadow-lg"
                                onLoad={handleImageLoad}
                            />

                            {/* Highlight overlay */}
                            {imageLoaded && getHighlightStyles().map((style, i) => (
                                <div key={i} style={style} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer with instructions */}
                {(bbox || (bboxes && bboxes.length > 0)) && (
                    <div className="p-3 bg-emerald-500/10 border-t border-emerald-500/20">
                        <p className="text-sm text-emerald-400 text-center">
                            🎯 The highlighted region shows where this content was extracted from the document
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
