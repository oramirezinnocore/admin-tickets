import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  onClick
}: MetricCardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200',
    primary: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    danger: 'bg-red-50 border-red-200'
  };

  const iconStyles = {
    default: 'text-gray-600',
    primary: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600'
  };

  return (
    <div
      className={`rounded-xl border p-6 transition-all duration-200 ${variantStyles[variant]} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && onClick()}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-sm font-medium ${
                  trend.value > 0 ? 'text-green-600' : trend.value < 0 ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`rounded-lg bg-white/50 p-3 ${iconStyles[variant]}`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
}
