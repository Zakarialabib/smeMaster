import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { BTN_BASE, BTN_PRIMARY } from "@shared/styles/ui-tokens";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}]`, error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 text-center">
          <p className="text-sm font-medium text-text-primary mb-1">Something went wrong</p>
          <p className="text-xs text-text-tertiary mb-4 max-w-sm">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className={`${BTN_BASE} ${BTN_PRIMARY} px-3 py-1.5 text-xs`}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC that wraps a component with an ErrorBoundary.
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(BrittleComponent, {
 *   name: "BrittleComponent",
 *   fallback: <div>Failed to load</div>,
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options?: { fallback?: ReactNode; name?: string },
): ComponentType<P> {
  const displayName = options?.name ?? WrappedComponent.displayName ?? WrappedComponent.name ?? "Component";

  function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={options?.fallback} name={displayName}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  }

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}
