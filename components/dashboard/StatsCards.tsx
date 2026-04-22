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
    { label: 'Total Clients', value: totalClients, icon: Users, color: 'text-blue-600' },
    { label: 'Active Buyers', value: activeBuyers, icon: Home, color: 'text-green-600' },
    { label: 'Active Sellers', value: activeSellers, icon: UserCheck, color: 'text-purple-600' },
    {
      label: 'Overdue Follow-ups',
      value: overdueFollowUps,
      icon: Bell,
      color: overdueFollowUps > 0 ? 'text-red-600' : 'text-gray-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <Card key={label}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <Icon className={`w-5 h-5 mt-0.5 ${color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
