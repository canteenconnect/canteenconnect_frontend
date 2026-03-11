import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type StudentErrorBoundaryProps = {
  children: ReactNode;
};

type StudentErrorBoundaryState = {
  hasError: boolean;
};

export class StudentErrorBoundary extends Component<
  StudentErrorBoundaryProps,
  StudentErrorBoundaryState
> {
  constructor(props: StudentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): StudentErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Student module render error", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 text-center">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-400" />
            <h2 className="text-xl font-semibold text-zinc-100">Something went wrong</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Student dashboard failed to render. Retry once and refresh if it persists.
            </p>
            <Button
              type="button"
              className="mt-5 bg-zinc-100 text-zinc-950 hover:bg-white"
              onClick={this.handleRetry}
            >
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
