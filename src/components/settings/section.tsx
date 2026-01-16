/**
 * Settings Section Wrapper - standardized section layout with header and description
 */

import type { ReactNode } from "react"

interface SettingsSectionProps {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}

export function SettingsSection({ icon, title, description, children }: SettingsSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {description}
      </p>

      {children}
    </section>
  )
}
