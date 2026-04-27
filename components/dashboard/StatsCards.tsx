import { Card, CardContent } from '@/components/ui/card'
import { Users, UserCheck, Home, Bell } from 'lucide-react'

interface StatsCardsProps {
  totalClients: number
  activeBuyers: number
  activeSellers: number
  overdueFollowUps: number
}

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
