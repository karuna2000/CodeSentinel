"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { ErrorState } from "./error-state";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  compact?: boolean;
  className?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title={this.props.fallbackTitle || "Component Error"}
          message={
            this.props.fallbackMessage || 
            (process.env.NODE_ENV === "development" ? this.state.error?.message : null) || 
            "Failed to render this section."
          }
          onRetry={this.handleRetry}
          compact={this.props.compact}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}
