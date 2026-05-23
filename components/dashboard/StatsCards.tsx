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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon, alert }) => (
        <Card key={label} className="border-[#d9d9dd]">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#93939f] uppercase tracking-widest font-mono">{label}</p>
                <p className="text-3xl font-bold text-black mt-2 tracking-tight">{value}</p>
              </div>
              <Icon className={`w-4 h-4 mt-1 ${alert ? 'text-black' : 'text-[#d9d9dd]'}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
