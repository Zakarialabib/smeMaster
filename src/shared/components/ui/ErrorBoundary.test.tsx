import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// A component that throws on render
function ThrowingComponent({ message }: { message: string }) {
  throw new Error(message);
}

// A component that renders normally
function GoodComponent() {
  return <div>All good</div>;
}

describe("ErrorBoundary", () => {
  // Suppress console.error for expected errors in tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders default fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test error" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent message="Test error" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("logs the error with the boundary name", () => {
    render(
      <ErrorBoundary name="TestBoundary">
        <ThrowingComponent message="Named error" />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalledWith(
      "[ErrorBoundary: TestBoundary]",
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it("logs the error without a name when name is not provided", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Unnamed error" />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalledWith(
      "[ErrorBoundary]",
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it("recovers when 'Try again' is clicked and child no longer throws", () => {
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error("Conditional error");
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the error condition
    shouldThrow = false;

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Recovered")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("shows fallback again if child still throws after retry", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Persistent error" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    // Still broken, so fallback should reappear
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Persistent error")).toBeInTheDocument();
  });
});
