import { useState } from "react";
import { X, FileText, Lock, AlertOctagon, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { cn } from "@/lib/utils";

export function ProvenanceViewer() {
  const { isModalOpen, record, closeModal, revealContext, isRevealing, revealError } = useProvenanceStore();
  const [reason, setReason] = useState("");

  if (!isModalOpen || !record) return null;

  const handleReveal = async () => {
    if (!reason.trim()) return;
    await revealContext(reason);
  };

  return (
    <div data-testid="provenance-viewer" className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md">
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-electric-blue/20 text-electric-blue">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Source Context Viewer</h2>
            <p className="text-xs text-text-muted">{record.filename}</p>
          </div>
        </div>
        <button type="button" onClick={closeModal} className="rounded-full p-2 hover:bg-surface-2 transition-colors">
          <X className="h-5 w-5 text-text-muted hover:text-text-primary" />
        </button>
      </header>

      <div className="flex flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
          
          <div className="flex items-center justify-between bg-surface-1 border border-border-subtle rounded-lg p-4">
             <div className="flex items-center gap-2">
                {record.hash_match ? (
                   <CheckCircle2 className="h-5 w-5 text-verified-emerald" />
                ) : (
                   <AlertOctagon className="h-5 w-5 text-critical-red" />
                )}
                <span className="text-sm font-medium">Integrity Hash Match: {record.hash_match ? "Verified" : "Failed"}</span>
             </div>
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-lg p-4 space-y-4 shadow-sm">
             <h3 className="text-sm font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-text-muted" />
                Evidence Context Lines
             </h3>
             
             <div className="bg-surface-2 border border-border-subtle rounded-md p-3 overflow-x-auto">
                <pre className="text-xs font-mono">
                   {record.lines.map((line, i) => (
                      <div key={i} className={cn("px-2 py-1 flex", line.hit && "bg-amber-500/20 border-l-2 border-amber-500 text-amber-500 font-bold")}>
                         <span className="w-8 text-text-muted select-none">{line.n}</span>
                         <span>{line.text}</span>
                      </div>
                   ))}
                </pre>
             </div>

             <div className="border-t border-border-subtle pt-4 mt-4">
                <h4 className="text-xs font-medium text-text-secondary mb-2">Authorized Unmasking (Role-Gated)</h4>
                <div className="flex gap-2">
                   <input 
                      type="text" 
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for revealing context (creates audit log)" 
                      className="flex-1 bg-surface-2 border border-border-subtle rounded px-3 py-1.5 text-sm focus:outline-none"
                   />
                   <Button onClick={handleReveal} disabled={isRevealing || !reason.trim()}>
                      {isRevealing ? "Revealing..." : "Reveal Context"}
                   </Button>
                </div>
                {revealError && <p className="text-critical-red text-xs mt-2">{revealError}</p>}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
