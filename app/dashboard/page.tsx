import { LivingLabDashboard } from "@/components/living-lab-dashboard";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return <LivingLabDashboard data={data} />;
}
