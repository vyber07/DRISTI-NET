import { X, Shield, Plus, Clock, Network, Crosshair, MapPin, Building, Server, IndianRupee, Hash, Tag, ChevronDown, ChevronUp, CheckCircle2, User, HelpCircle, Layers } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGraphStore } from "@/stores/graphStore";
import { useRevealStore } from "@/stores/revealStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PIIField } from "@/components/intelligence/pii-field";

function getEntityIcon(type: string) {
  switch (type) {
    case "PERSON": return User;
    case "LOCATION": return MapPin;
    case "ORGANIZATION": return Building;
    case "CYBER": return Server;
    case "FINANCIAL": return IndianRupee;
    case "EVENT": return Clock;
    default: return Tag;
  }
}

export function EntityDrawer({ onFocusNode }: { onFocusNode?: (nodeId: string) => void }) {
  const navigate = useNavigate();
  const { selectedEntityDetail: entity, clearSelection, edges, nodes } = useGraphStore();
  const { openRevealModal, isRevealed, getRevealedValue } = useRevealStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);

  if (!entity) return null;

  const connectedEdges = edges.filter((e) => e.source === entity.entity_id || e.target === entity.entity_id);
  const Icon = getEntityIcon(entity.kind);

  return (
    <div
      data-testid="entity-drawer"
      className="absolute top-0 right-0 h-full w-[400px] border-l border-border-subtle bg-surface-1 shadow-panel flex flex-col z-10 animate-in slide-in-from-right duration-300"
    >
      <header className="flex h-14 items-center justify-between border-b border-border-subtle px-4 shrink-0 bg-surface-2/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-electric-blue/10 text-electric-blue shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary tracking-tight truncate">
              Entity Profile
            </h2>
            <p className="text-xs text-text-muted font-mono truncate">{entity.entity_id}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded-full p-1.5 text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-4 w-auto grid grid-cols-2 shrink-0">
          <TabsTrigger value="details">Profile</TabsTrigger>
          <TabsTrigger value="relationships">Links ({connectedEdges.length})</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="details" className="space-y-4 mt-0">
            <div className="space-y-1">
              <Badge tone="blue" className="mb-1 text-micro">{entity.kind}</Badge>
              <h3 className="text-lg font-bold text-text-primary leading-tight">
                {entity.label}
              </h3>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between py-2 text-xs text-text-muted hover:text-text-primary transition-colors border-t border-border-subtle"
              >
                <span className="font-medium">
                  {showAdvanced ? "Hide Attributes" : "Show Attributes ▾"}
                </span>
                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showAdvanced && (
                <div className="mt-2 space-y-3 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <div className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface-2 text-xs">
                      {Object.entries(entity.attributes || {}).map(([key, val]) => (
                        <div key={key} className="grid grid-cols-[minmax(85px,1fr)_minmax(0,1.4fr)] items-center gap-2 p-2.5 min-w-0">
                          <span className="text-text-muted font-medium shrink-0 truncate" title={key}>{key}</span>
                          <span className="text-text-primary text-right font-mono text-micro break-words" style={{ overflowWrap: "anywhere" }}>{String(val)}</span>
                        </div>
                      ))}
                      {Object.keys(entity.attributes || {}).length === 0 && (
                        <div className="p-2.5 text-text-muted text-center italic">No attributes</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {entity.cross_case && (
              <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2">
                 <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Case Appearances
                 </h4>
                 <div className="flex flex-wrap gap-1.5">
                    {entity.cross_case.visible_cases.map((cId: string) => (
                       <Badge key={cId} tone="neutral">{cId}</Badge>
                    ))}
                    {entity.cross_case.restricted_case_count > 0 && (
                       <Badge tone="red" className="opacity-70">
                          +{entity.cross_case.restricted_case_count} Classified Cases
                       </Badge>
                    )}
                 </div>
              </div>
            )}
            
            {entity.masked && (
               <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 text-xs flex flex-col gap-2">
                 <div className="flex items-start gap-2 text-text-muted">
                   <Shield className="h-4 w-4 text-teal-primary shrink-0 mt-0.5" />
                   <p>Personal identifiers are protected under data privacy guidelines. Unmasking creates an audit log.</p>
                 </div>
                 <PIIField
                    label={entity.kind}
                    value={entity.label}
                    maskedValue={entity.label}
                    isMasked={!isRevealed(entity.entity_id, "id")}
                    canRequestReveal={true}
                    onRequestReveal={() =>
                      openRevealModal({
                        entityId: entity.entity_id, entityLabel: entity.label, rawValue: "",
                        identifierType: "id",
                        maskedValue: entity.label,
                      })
                    }
                 />
               </div>
            )}
          </TabsContent>

          <TabsContent value="relationships" className="space-y-2 mt-0">
            {connectedEdges.length === 0 ? (
              <p className="text-xs text-text-muted">No connected clues on map.</p>
            ) : (
              <div className="space-y-1.5">
                {connectedEdges.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="w-full flex items-center justify-between rounded-md border border-border-subtle bg-surface-2 p-2.5 text-left hover:bg-surface-3 transition-colors"
                  >
                    <div className="space-y-1">
                      <Badge tone="neutral" className="text-[10px]">{e.relationshipType}</Badge>
                      <p className="text-micro font-mono text-text-muted">
                        Claims: {e.count}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
