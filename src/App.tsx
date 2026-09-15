import { AppRoutes } from "@/routes";
import { ThemeController } from "@/components/theme-controller";

export default function App() {
  return (
    <ThemeController>
      <AppRoutes />
    </ThemeController>
  );
}
