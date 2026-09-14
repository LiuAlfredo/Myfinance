import { AppShell } from "@/layouts/app-shell";
import { AppRoutes } from "@/routes";
import { ThemeController } from "@/components/theme-controller";

export default function App() {
  return (
    <ThemeController>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </ThemeController>
  );
}
