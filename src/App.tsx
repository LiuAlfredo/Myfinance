import { AppRoutes } from "@/routes";
import { ThemeController } from "@/components/theme-controller";
import { SessionLock } from "@/components/session-lock";
import { BackgroundMaintenance } from "@/features/life/background-maintenance";
import { useAppShortcuts } from "@/hooks/use-app-shortcuts";
import { ToastRegion } from "@/components/toast-region";

export default function App() {
  useAppShortcuts();
  return (
    <ThemeController>
      <SessionLock />
      <BackgroundMaintenance />
      <AppRoutes />
      <ToastRegion />
    </ThemeController>
  );
}
