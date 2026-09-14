import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";

export function useAppShortcuts() {
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNewTransactionOpen(true);
      }
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (event.key === "Escape") {
        setNewTransactionOpen(false);
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setCommandPaletteOpen, setNewTransactionOpen]);
}
