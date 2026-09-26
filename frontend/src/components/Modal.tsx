import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({ open, title, eyebrow, onClose, children, wide = false }: { open: boolean; title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${wide ? "modal-wide" : ""}`}><div className="modal-head"> <div><span className="eyebrow">{eyebrow || "STOCKSENSE"}</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>;
}
