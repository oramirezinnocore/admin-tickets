interface LoadingSkeletonProps {
  variant?: 'text' | 'card' | 'table' | 'metric';
  rows?: number;
}

export default function LoadingSkeleton({ variant = 'text', rows = 3 }: LoadingSkeletonProps) {
  if (variant === 'text') {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: `${90 - i * 10}%` }} />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>
          <div className="h-12 w-12 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (variant === 'metric') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-8 bg-gray-200 rounded w-3/4" />
              </div>
              <div className="h-12 w-12 bg-gray-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
        <div className="border-b border-gray-200 p-4">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-b border-gray-100 p-4 flex gap-4">
            <div className="h-4 bg-gray-200 rounded w-1/6" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded w-1/5" />
            <div className="h-4 bg-gray-200 rounded w-1/6" />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
