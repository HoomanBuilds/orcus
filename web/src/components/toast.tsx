"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  title: string;
  description?: string;
  txHash?: string;
}

interface ToastCtx { toast: (t: Omit<Toast, "id">) => void; }

const Ctx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const borderColor = (type: Toast["type"]) =>
    type === "success" ? "border-l-[#16a34a]" : type === "error" ? "border-l-red-400" : "border-l-black/10";

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {mounted && createPortal(
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id}
              className={`pointer-events-auto animate-[slide-up_0.3s_ease-out] rounded-2xl border border-black/[0.07] border-l-4 ${borderColor(t.type)} bg-white shadow-lg px-5 py-4 min-w-[280px] max-w-[360px]`}>
              <p className="text-sm font-medium text-[#111]">{t.title}</p>
              {t.description && <p className="text-[12px] text-black/40 mt-1">{t.description}</p>}
              {t.txHash && (
                <a href={`https://chainscan-galileo.0g.ai/tx/${t.txHash}`} target="_blank" rel="noreferrer"
                  className="text-[11px] text-black/40 underline hover:text-black/70 mt-1.5 inline-block">
                  View tx ↗
                </a>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}
