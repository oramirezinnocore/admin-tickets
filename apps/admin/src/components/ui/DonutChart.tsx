'use client';

import { useEffect, useState, useRef } from 'react';

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string | number;
  size?: number;
  thickness?: number;
  showLegend?: boolean;
  onSegmentClick?: (segment: DonutSegment) => void;
}

export default function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 200,
  thickness = 30,
  showLegend = true,
  onSegmentClick
}: DonutChartProps) {
  const [mounted, setMounted] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotion.current = mediaQuery.matches;
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || prefersReducedMotion.current) {
      setAnimationProgress(1);
      return;
    }

    const duration = 1000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function: easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);

      setAnimationProgress(eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [mounted, segments]);

  const total = segments.reduce((sum, seg) => sum + seg.value, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ height: size }}>
        <div className="text-gray-400 text-center">
          <p className="text-sm">Sin datos</p>
        </div>
      </div>
    );
  }

  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercentage = 0;

  const arcs = segments.map((segment) => {
    const percentage = (segment.value / total);
    const arcLength = circumference * percentage;
    const arcOffset = circumference - (circumference * accumulatedPercentage * animationProgress);

    const result = {
      segment,
      arcLength,
      arcOffset,
      rotation: accumulatedPercentage * 360
    };

    accumulatedPercentage += percentage;

    return result;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={thickness}
          />

          {/* Segments */}
          {arcs.map(({ segment, arcLength, arcOffset, rotation }, index) => (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${arcLength * animationProgress} ${circumference}`}
              strokeDashoffset={-arcOffset}
              strokeLinecap="round"
              className={onSegmentClick ? 'cursor-pointer transition-opacity hover:opacity-75' : ''}
              style={{
                transformOrigin: 'center',
                transform: `rotate(${rotation}deg)`,
                transition: prefersReducedMotion.current ? 'none' : 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onClick={() => onSegmentClick?.(segment)}
            />
          ))}
        </svg>

        {/* Center label */}
        {(centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-gray-900">{centerValue || total}</div>
            {centerLabel && (
              <div className="text-sm text-gray-600 mt-1">{centerLabel}</div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
          {segments.map((segment, index) => {
            const percentage = ((segment.value / total) * 100).toFixed(1);
            return (
              <button
                key={index}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                  onSegmentClick
                    ? 'hover:bg-gray-50 cursor-pointer'
                    : ''
                }`}
                onClick={() => onSegmentClick?.(segment)}
                disabled={!onSegmentClick}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-sm text-gray-700">{segment.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{segment.value}</span>
                  <span className="text-xs text-gray-500">({percentage}%)</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
