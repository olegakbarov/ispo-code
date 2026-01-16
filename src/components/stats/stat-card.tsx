/**
 * StatCard Component
 *
 * Displays a single KPI metric with icon, value, label, and optional subtitle.
 */

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  subtitle?: string
  iconColor?: string
}

export function StatCard({ icon, label, value, subtitle, iconColor = "text-primary" }: StatCardProps) {
  const displayValue = typeof value === "number" ? value.toLocaleString() : value
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold">{displayValue}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
    </div>
  )
}
