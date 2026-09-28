import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function useAppShortcuts() {
  const navigate=useNavigate();
  const authenticated=useAuthStore(s=>s.isAuthenticated);
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if(!authenticated)return;
      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        navigate("/finance/transactions");
        setNewTransactionOpen(true);
      }
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(false);
        navigate("/search");
      }
      if (event.key === "Escape") {
        setNewTransactionOpen(false);
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setCommandPaletteOpen, setNewTransactionOpen,navigate,authenticated]);
}
