import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { flushAllNotes, hasPendingNotes } from "./note-save-queue";
export function NoteSaveGuard() {
    useEffect(() => {
        if (!("__TAURI_INTERNALS__" in window))
            return;
        const current = getCurrentWindow();
        let closing = false;
        const listener = current.onCloseRequested(async (event) => {
            if (!hasPendingNotes())
                return;
            event.preventDefault();
            if (closing)
                return;
            closing = true;
            try {
                await flushAllNotes();
                await current.close();
            }
            catch {
                window.alert("笔记尚未保存成功，请返回生活资料重试或导出内容后再关闭。");
            }
            finally {
                closing = false;
            }
        });
        return () => { void listener.then(unlisten => unlisten()); };
    }, []);
    return null;
}
