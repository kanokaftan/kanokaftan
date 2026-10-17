import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/errorReporter";

interface Props {
  /** What this part of the page shows, for the fallback message. */
  name: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Keeps one broken card from blanking a whole admin page: it shows a small note and reports the error. */
export class SectionBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SectionBoundary] ${this.props.name} crashed`, error, info.componentStack);
    reportError(error, { componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        {this.props.name} couldn't load.{" "}
        <button type="button" className="font-medium text-primary underline" onClick={() => this.setState({ failed: false })}>
          Try again
        </button>
      </div>
    );
  }
}
