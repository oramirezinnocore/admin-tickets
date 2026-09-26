'use client';

import { useEffect, useState, useRef } from 'react';

interface AnimatedMetricProps {
  value: number;
  max: number;
  label: string;
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export default function AnimatedMetric({
  value,
  max,
  label,
  subtitle,
  variant = 'default',
  size = 'md'
}: AnimatedMetricProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    // Check for prefers-reduced-motion
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotion.current = mediaQuery.matches;
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (prefersReducedMotion.current) {
      // No animation for users who prefer reduced motion
      setDisplayValue(value);
      return;
    }

    // Animate from current value to new value
    const duration = 1000;
    const start = displayValue;
    const diff = value - start;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function: easeOutQuad
      const eased = 1 - (1 - progress) * (1 - progress);

      setDisplayValue(Math.round(start + diff * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, mounted]);

  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;

  const sizeConfig = {
    sm: { radius: 40, strokeWidth: 6, fontSize: 'text-xl', containerSize: 'w-24 h-24' },
    md: { radius: 50, strokeWidth: 8, fontSize: 'text-2xl', containerSize: 'w-32 h-32' },
    lg: { radius: 60, strokeWidth: 10, fontSize: 'text-3xl', containerSize: 'w-40 h-40' }
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const variantColors = {
    default: {
      stroke: 'var(--wisper-blue)',
      bg: '#e5e7eb',
      text: 'text-gray-900'
    },
    success: {
      stroke: 'var(--color-sla-green)',
      bg: '#d1fae5',
      text: 'text-green-900'
    },
    warning: {
      stroke: 'var(--color-sla-yellow)',
      bg: '#fef3c7',
      text: 'text-yellow-900'
    },
    danger: {
      stroke: 'var(--color-sla-red)',
      bg: '#fee2e2',
      text: 'text-red-900'
    }
  };

  const colors = variantColors[variant];
  const svgSize = (config.radius + config.strokeWidth) * 2;

  // Prevent hydration mismatch by not rendering animation on server
  if (!mounted) {
    return (
      <div className="flex flex-col items-center">
        <div className={`${config.containerSize} relative flex items-center justify-center`}>
          <svg width={svgSize} height={svgSize} className="transform -rotate-90">
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={config.radius}
              fill="none"
              stroke={colors.bg}
              strokeWidth={config.strokeWidth}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-bold ${config.fontSize} ${colors.text}`}>{value}</span>
          </div>
        </div>
        <div className="mt-3 text-center">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className={`${config.containerSize} relative flex items-center justify-center`}>
        <svg width={svgSize} height={svgSize} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={config.radius}
            fill="none"
            stroke={colors.bg}
            strokeWidth={config.strokeWidth}
          />
          {/* Animated progress circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={config.radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: prefersReducedMotion.current ? 'none' : 'stroke-dashoffset 1000ms cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${config.fontSize} ${colors.text}`}>{displayValue}</span>
        </div>
      </div>
      <div className="mt-3 text-center">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
