# FRONTEND MERGE MANIFEST

## 1. Analysis of Old vs New Frontend

| Old File | New Equivalent | Functionality | Decision | Reason |
| --- | --- | --- | --- | --- |
| src/App.tsx | src/App.tsx | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/api/client.ts | src/None (needs mapping) | To be analyzed | MIGRATE | Preserve existing backend integration logic |
| src/components/AnalysisPanel.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/AuditPanel.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/CaseOverview.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/EvidenceDrawer.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/EvidencePanel.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/GraphView.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/MapView.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/ReportPanel.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/ReviewQueue.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/TimelinePanel.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/components/common.tsx | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/main.tsx | src/main.tsx | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |
| src/pages/CaseWorkspace.tsx | src/None (needs mapping) | To be analyzed | MERGE | Combine old functionality with new UI |
| src/pages/Cases.tsx | src/None (needs mapping) | To be analyzed | MERGE | Combine old functionality with new UI |
| src/pages/Login.tsx | src/None (needs mapping) | To be analyzed | MERGE | Combine old functionality with new UI |
| src/styles.css | src/None (needs mapping) | To be analyzed | UNKNOWN | Requires manual review for functionality preservation |

## 2. New Files Matrix

| New File | Backend Dependency | Old Equivalent | Decision | Reason |
| --- | --- | --- | --- | --- |
| src/app/providers/app-providers.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/app/router/router.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/auth/protected-route.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/evidence/PdfDocumentViewer.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/evidence/ProvenanceViewer.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/evidence/SvgBoundingBoxOverlay.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/GraphCanvas.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/GraphLegend.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/GraphToolbar.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/TemporalSlider.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/drawers/EdgeDrawer.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/drawers/EmptyDrawer.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/drawers/EntityDrawer.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/engine/GraphEngine.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/filters/ConfidenceRangeFilter.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/filters/DateRangeFilter.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/filters/EntityTypeFilter.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/filters/GraphFilterPanel.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/filters/RelationshipTypeFilter.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/graph/filters/TierFilter.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/intelligence/confidence-meter.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/intelligence/entity-badge.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/intelligence/evidence-tier-badge.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/intelligence/pii-field.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/intelligence/relationship-badge.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/intelligence/reveal-identity-modal.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/security/security-status-bar.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/ui/badge.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/ui/button.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/ui/checkbox.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/ui/dialog.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/ui/separator.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/ui/status-dot.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/ui/tabs.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/components/ui/tooltip.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/constants/evidenceTiers.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/constants/navigation.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/alerts/alerts-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/auth/login-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/audit/audit-detail-drawer.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/audit/audit-event-card.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/audit/audit-filter-bar.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/audit/audit-integrity-header.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/audit/case-audit-view.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/case-graph-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/case-workspace-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/cases-directory-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/components/case-detail-sidebar.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/components/case-entity-summary-card.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/components/case-evidence-summary-card.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/components/case-header.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/components/case-overview-view.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/components/case-placeholder-view.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/components/case-relationship-summary-card.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/components/case-stats-grid.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/evidence/case-evidence-view.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/evidence/evidence-card.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/evidence/evidence-filter-bar.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/evidence/evidence-row.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/notes/case-notes-view.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/notes/note-card.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/notes/note-composer-dialog.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/notes/note-filter-bar.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/timeline/case-timeline.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/timeline/timeline-event-icon.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/timeline/timeline-event-row.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/timeline/timeline-filter-bar.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/cases/workspace-skeleton-preview.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/command-center/command-center-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/command-center/components/HowItWorksModal.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/command-center/foundation-preview-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/hitl/hitl-decision-dialog.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/hitl/hitl-decision-pane.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/hitl/hitl-evidence-pane.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/hitl/hitl-queue-filters.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/hitl/hitl-task-card.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/hitl/hitl-workspace-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/reports/reports-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/features/settings/settings-page.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/index.css | TBD | None | KEEP_NEW | New architecture/feature |
| src/layouts/AppShell/app-shell.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/layouts/AppShell/sidebar.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/layouts/InvestigationShell/investigation-shell.tsx | TBD | None | KEEP_NEW | New architecture/feature |
| src/lib/formatters.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/lib/pii.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/lib/utils.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/mock/alerts.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/mock/audit.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/mock/caseGraphData.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/mock/cases.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/mock/hitl.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/mock/notes.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/mock/timeline.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/alertsApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/auditApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/casesApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/client.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/entityApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/evidenceApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/graphApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/hitlApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/notesApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/provenanceApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/relationshipApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/revealApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/services/api/timelineApi.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/auditStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/authStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/evidenceStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/graphStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/hitlStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/notesStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/provenanceStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/revealStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/timelineStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/stores/uiStore.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/styles/tokens.css | TBD | None | KEEP_NEW | New architecture/feature |
| src/styles/typography.css | TBD | None | KEEP_NEW | New architecture/feature |
| src/types/alert.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/types/audit.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/types/case.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/types/entity.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/types/evidence.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/types/hitl.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/types/note.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/types/reveal.ts | TBD | None | KEEP_NEW | New architecture/feature |
| src/types/timeline.ts | TBD | None | KEEP_NEW | New architecture/feature |
