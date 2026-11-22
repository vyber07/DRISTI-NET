import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Contains a failure of the graph renderer to the graph area. Before this, an exception in Sigma (e.g. no WebGL)
 * replaced the whole application with React Router's raw error screen, including a JavaScript stack trace.
 */
export class GraphCanvasBoundary extends Component<{ children: ReactNode; onUseList: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error("Graph renderer failed", error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="m-4 rounded-lg border border-border-strong bg-surface-1 p-5 text-sm" data-testid="graph-render-failed">
        <p className="font-semibold text-text-primary">The graph could not be drawn in this browser.</p>
        <p className="mt-1 text-text-secondary">The same entities and relationships, with their sources, are available in the list view.</p>
        <Button variant="primary" size="sm" className="mt-3" onClick={this.props.onUseList}>Use the list view</Button>
      </div>
    );
  }
}
