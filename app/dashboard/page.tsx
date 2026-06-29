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
  const showBudgetData = userContext.role === "super_admin";
  const dashboardData = {
    ...data,
    connection: showConnectionStatus
      ? data.connection
      : {
          mode: "sample" as const,
          label: "",
          detail: ""
        },
    project: {
      ...data.project,
      budget: showBudgetData ? data.project.budget : 0
    },
    kpis: showBudgetData ? data.kpis : data.kpis.filter((kpi) => kpi.key !== "budget"),
    budget: showBudgetData ? data.budget : []
  };

  return (
    <LivingLabDashboard
      data={dashboardData}
      showBudgetData={showBudgetData}
      showConnectionStatus={showConnectionStatus}
    />
  );
}
