import { Card, CardContent } from '@/components/ui/card'
import { Users, UserCheck, Home, Bell } from 'lucide-react'

/**
 * Props for the StatsCards component.
 */
interface StatsCardsProps {
  /** Total number of clients across all statuses. */
  totalClients: number
  /** Number of active buyer clients. */
  activeBuyers: number
  /** Number of active seller clients. */
  activeSellers: number
  /** Number of incomplete follow-ups scheduled before today. */
  overdueFollowUps: number
}

/**
 * Grid of four KPI cards shown at the top of the dashboard.
 *
 * The overdue follow-ups card icon turns black (high-contrast alert) when
 * there are overdue items, drawing the realtor's attention.
 *
 * @param props - StatsCardsProps with the four aggregate counts.
 * @returns A 2-column (mobile) / 4-column (desktop) grid of stat cards.
 */
export default function StatsCards({
  totalClients,
  activeBuyers,
  activeSellers,
  overdueFollowUps,
}: StatsCardsProps) {
  const stats = [
    { label: 'Total Clients', value: totalClients, icon: Users },
    { label: 'Active Buyers', value: activeBuyers, icon: Home },
    { label: 'Active Sellers', value: activeSellers, icon: UserCheck },
    { label: 'Overdue Follow-ups', value: overdueFollowUps, icon: Bell, alert: overdueFollowUps > 0 },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, alert }) => (
        <Card
          key={label}
          className="ring-hairline transition-shadow duration-200 ease-fluid hover:shadow-hairline"
        >
          <CardContent className="px-5 pb-1 pt-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[10.5px] uppercase leading-[1.4] tracking-[0.14em] text-ink-subtle">
                {label}
              </p>
              <Icon
                className={alert ? 'h-4 w-4 shrink-0 text-ink' : 'h-4 w-4 shrink-0 text-hairline'}
                strokeWidth={1.75}
                aria-hidden
              />
            </div>
            {/* data-numeric locks tabular figures so the four values stay on a common
                vertical rhythm as counts change. */}
            <p
              data-numeric
              className="mt-3 text-[2rem] font-normal leading-none tracking-[-0.02em] text-ink"
            >
              {value}
            </p>
            {/* The alert is stated, not just implied by an icon colour shift -- colour
                alone is not an accessible signal. */}
            {alert && (
              <p className="mt-2 text-xs text-ink-subtle">Needs attention today</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
