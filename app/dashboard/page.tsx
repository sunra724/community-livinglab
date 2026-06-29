import { LivingLabDashboard } from "@/components/living-lab-dashboard";
import { getDashboardData } from "@/lib/dashboard-data";
import { getCurrentUserContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [data, userContext] = await Promise.all([
    getDashboardData(),
    getCurrentUserContext()
  ]);
  const showConnectionStatus = userContext.role === "super_admin";
  const dashboardData = showConnectionStatus
    ? data
    : {
        ...data,
        connection: {
          mode: "sample" as const,
          label: "",
          detail: ""
        }
      };

  return <LivingLabDashboard data={dashboardData} showConnectionStatus={showConnectionStatus} />;
}
