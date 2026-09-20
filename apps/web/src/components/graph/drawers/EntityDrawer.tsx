import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Crosshair,
  Plus,
  Tag,
  Network,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EntityBadge } from "@/components/intelligence/entity-badge";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { PIIField } from "@/components/intelligence/pii-field";
import { RelationshipBadge } from "@/components/intelligence/relationship-badge";
import { useGraphStore } from "@/stores/graphStore";
import { useRevealStore } from "@/stores/revealStore";
import { maskPersonName, maskSensitiveText } from "@/lib/pii";

interface EntityDrawerProps {
  onFocusNode?: (nodeId: string) => void;
}

export function EntityDrawer({ onFocusNode }: EntityDrawerProps) {
  const navigate = useNavigate();
  const {
    selectedEntityDetail,
    clearSelection,
    edges,
    selectEdge,
    expandNeighbors,
    caseId,
  } = useGraphStore();

  const {
    isRevealed,
    getRevealedValue,
    openRevealModal,
    revokeReveal,
  } = useRevealStore();

  const [activeTab, setActiveTab] = useState("overview");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionResult, setExpansionResult] = useState<string | null>(null);

  const handleExpandNeighbors = async (entityId: string) => {
    if (isExpanding) return;
    setIsExpanding(true);
    setExpansionResult(null);
    try {
      const result = await expandNeighbors(entityId);
      if (result.addedNodes > 0 || result.addedEdges > 0) {
        setExpansionResult(`+${result.addedNodes} clues, +${result.addedEdges} connections added to map`);
      } else {
        setExpansionResult("All immediate clues are already visible on the map");
      }
    } catch {
      setExpansionResult("Expansion failed");
    } finally {
      setIsExpanding(false);
      setTimeout(() => setExpansionResult(null), 4000);
    }
  };

  if (!selectedEntityDetail) return null;

  const entity = selectedEntityDetail;

  const isNameRevealed = isRevealed(entity.id, "NAME");
  const displayedDisplayName = isNameRevealed
    ? (getRevealedValue(entity.id, "NAME") ?? entity.displayName)
    : (entity.type === "PERSON"
        ? maskPersonName(entity.maskedName || entity.displayName)
        : maskSensitiveText(entity.maskedName || entity.displayName));

  // Find connected relationships
  const connectedEdges = edges.filter(
    (e) => e.source === entity.id || e.target === entity.id,
  );

  return (
    <div className="flex h-full flex-col bg-surface-1 text-text-primary">
      {/* Drawer Header */}
      <div className="border-b border-border-subtle p-4 space-y-2 bg-surface-2/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EntityBadge type={entity.type} />
            <span className="text-micro font-mono text-text-muted">
              {entity.jurisdiction}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-text-primary"
            onClick={clearSelection}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-primary tracking-tight">
            {displayedDisplayName}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge tone="neutral" className="text-micro font-medium">
              Role: {entity.caseRole}
            </Badge>
            {entity.riskTags.map((tag) => (
              <Badge key={tag} tone="amber" className="text-micro">
                <Tag className="h-2.5 w-2.5" />
                {tag.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-2 border-b border-border-subtle bg-surface-1">
          <TabsList className="w-full justify-start gap-1">
            <TabsTrigger value="overview" className="text-xs px-2.5">Summary</TabsTrigger>
            <TabsTrigger value="identifiers" className="text-xs px-2.5">Identifiers</TabsTrigger>
            <TabsTrigger value="relationships" className="text-xs px-2.5 whitespace-nowrap">
              Connections ({connectedEdges.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <TabsContent value="overview" className="space-y-4 mt-0">
            {/* Investigator Assessment */}
            {entity.notes && (
              <div className="rounded-lg border border-teal-primary/30 bg-teal-primary/5 p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Investigator Assessment</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {maskSensitiveText(entity.notes)}
                </p>
              </div>
            )}

            {/* Aliases */}
            {entity.aliases.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-micro font-semibold uppercase tracking-wider text-text-muted">
                  Known Aliases &amp; Vernacular Names
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {entity.aliases.map((alias) => (
                    <Badge key={alias} tone="neutral" className="font-devanagari text-xs">
                      {alias}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Connected Highlights */}
            <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2">
              <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
                Connection Highlights
              </span>
              <p className="text-xs text-text-secondary">
                Linked to <strong>{connectedEdges.length}</strong> other clues across this case dossier.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs justify-center"
                onClick={() => setActiveTab("relationships")}
              >
                <span>View all {connectedEdges.length} connections</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>

            {/* Progressive Disclosure: Collapsible Advanced Technical Details */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between py-2 px-1 text-xs text-text-muted hover:text-text-primary transition-colors border-t border-border-subtle"
              >
                <span className="font-medium">
                  {showAdvanced ? "Hide Technical Details" : "Show Technical Details ▾"}
                </span>
                {showAdvanced ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showAdvanced && (
                <div className="mt-2 space-y-3 animate-in fade-in duration-200">
                  {/* Confidence & Tier */}
                  <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-micro font-semibold uppercase tracking-wider text-text-muted shrink-0">
                        Evidence Tier
                      </span>
                      <EvidenceTierBadge tier={entity.evidenceTier} short className="text-micro" />
                    </div>
                    <ConfidenceMeter confidence={entity.confidence} flagManualReview label="Correlation Confidence" />
                  </div>

                  {/* Attributes List */}
                  <div className="space-y-1.5">
                    <h4 className="text-micro font-semibold uppercase tracking-wider text-text-muted">
                      Entity Attributes
                    </h4>
                    <div className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface-2 text-xs">
                      <div className="grid grid-cols-[minmax(85px,1fr)_minmax(0,1.4fr)] items-center gap-2 p-2.5 min-w-0">
                        <span className="text-text-muted font-medium shrink-0">Entity ID</span>
                        <span className="text-text-primary text-right font-mono text-micro">{entity.id}</span>
                      </div>
                      {Object.entries(entity.attributes).map(([key, val]) => (
                        <div key={key} className="grid grid-cols-[minmax(85px,1fr)_minmax(0,1.4fr)] items-center gap-2 p-2.5 min-w-0">
                          <span className="text-text-muted font-medium shrink-0 truncate" title={key}>{key}</span>
                          <span className="text-text-primary text-right font-mono text-micro break-words" style={{ overflowWrap: "anywhere" }}>{maskSensitiveText(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="identifiers" className="space-y-3 mt-0">
            <div className="rounded-md border border-border-subtle bg-surface-2/50 p-2.5 text-micro text-text-muted flex items-start gap-2">
              <Shield className="h-4 w-4 text-teal-primary shrink-0 mt-0.5" />
              <span>
                Personal identifiers are protected by default under data privacy guidelines.
                Authorized officers may reveal data under Section 91 BNSS with permanent audit logging.
              </span>
            </div>

            <div className="space-y-3">
              {entity.identifiers.map((ident) => {
                const isUnmasked = isRevealed(entity.id, ident.type);
                const displayValue = isUnmasked
                  ? (getRevealedValue(entity.id, ident.type) ?? ident.value)
                  : ident.value;

                return (
                  <div
                    key={ident.type + ident.value}
                    className="rounded-md border border-border-subtle bg-surface-2 p-3"
                  >
                    <PIIField
                      label={ident.type}
                      value={displayValue}
                      maskedValue={ident.maskedValue}
                      isMasked={!isUnmasked}
                      canRequestReveal={true}
                      onRequestReveal={() =>
                        openRevealModal({
                          entityId: entity.id,
                          entityLabel: entity.displayName,
                          identifierType: ident.type,
                          maskedValue: ident.maskedValue,
                          rawValue: ident.value,
                        })
                      }
                      onRevokeReveal={() => revokeReveal(entity.id, ident.type)}
                    />
                  </div>
                );
              })}
            </div>
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
                    onClick={() => selectEdge(e.id)}
                    className="w-full flex items-center justify-between rounded-md border border-border-subtle bg-surface-2 p-2.5 text-left hover:bg-surface-3 transition-colors"
                  >
                    <div className="space-y-1">
                      <RelationshipBadge
                        type={e.relationshipType}
                        hasContradiction={e.hasContradiction}
                      />
                      <p className="text-micro font-mono text-text-muted">
                        {maskSensitiveText(e.label)}
                      </p>
                    </div>
                    <EvidenceTierBadge tier={e.evidenceTier} compact />
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Drawer Actions Footer */}
      <div className="border-t border-border-subtle p-3 bg-surface-1 space-y-2">
        {expansionResult && (
          <div className="text-micro font-mono text-center text-teal-primary bg-teal-primary/10 border border-teal-primary/30 rounded py-1 px-2">
            {expansionResult}
          </div>
        )}
        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs px-2 gap-1"
            onClick={() => onFocusNode?.(entity.id)}
          >
            <Crosshair className="h-3.5 w-3.5 shrink-0" />
            <span>Focus</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs px-2 gap-1"
            onClick={() => handleExpandNeighbors(entity.id)}
            disabled={isExpanding}
          >
            {isExpanding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-primary shrink-0" />
            ) : (
              <Network className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">Find Clues</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs px-2 gap-1 shrink-0 text-text-secondary hover:text-text-primary"
            onClick={() => navigate(`/cases/${caseId}/timeline?entityId=${entity.id}`)}
            title="View timeline events"
          >
            <Clock className="h-3.5 w-3.5 text-teal-primary shrink-0" />
            <span>Timeline</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs px-2 gap-1 shrink-0 text-text-secondary hover:text-text-primary"
            onClick={() => navigate(`/cases/${caseId}/notes?targetId=${entity.id}`)}
            title="Add note"
          >
            <Plus className="h-3.5 w-3.5 text-text-muted shrink-0" />
            <span>Note</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
