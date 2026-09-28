interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  stats?: { label: string; value: string | number }[];
}

export default function PageHeader({ title, description, actions, stats }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="flex gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-gray-900">{stat.value}</span>
              <span className="text-sm text-gray-600">{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
