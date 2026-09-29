import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/stores/ui-store";
import { TransactionDialog } from "@/features/finance/transaction-dialog";

export function AppDialogs() {
  const isNewTransactionOpen = useUiStore((state) => state.isNewTransactionOpen);
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const isCommandPaletteOpen = useUiStore((state) => state.isCommandPaletteOpen);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const showToast = useUiStore((state) => state.showToast);
  const navigate = useNavigate();
  useEffect(() => { if (isCommandPaletteOpen) { setCommandPaletteOpen(false); navigate("/search"); } }, [isCommandPaletteOpen, navigate, setCommandPaletteOpen]);

  return (
    <>
      <TransactionDialog open={isNewTransactionOpen} onOpenChange={setNewTransactionOpen} onSaved={() => { setNewTransactionOpen(false); showToast("交易已保存"); window.dispatchEvent(new Event("finance-data-changed")); }} />
    </>
  );
}
