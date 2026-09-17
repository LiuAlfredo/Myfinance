import { AppRoutes } from "@/routes";
import { ThemeController } from "@/components/theme-controller";
import { SessionLock } from "@/components/session-lock";

export default function App() {
  return (
    <ThemeController>
      <SessionLock />
      <AppRoutes />
    </ThemeController>
  );
}
