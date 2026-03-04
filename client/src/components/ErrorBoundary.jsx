import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-20 text-center bg-gray-900 min-h-screen text-white">
                    <h2 className="text-3xl font-bold text-rose-500 mb-4">Something went wrong.</h2>
                    <div className="bg-gray-800 p-6 rounded-xl border border-rose-500/30 max-w-2xl mx-auto mb-8">
                        <p className="text-rose-400 font-mono text-sm overflow-auto text-left">
                            {this.state.error?.message || "Unknown rendering error"}
                        </p>
                        <p className="mt-4 text-xs text-slate-500">
                            Stack: {this.state.error?.stack?.split('\n').slice(0, 3).join('\n')}
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="bg-indigo-600 hover:bg-indigo-700 px-8 py-3 rounded-xl font-bold transition-all shadow-lg"
                    >
                        Go back to Dashboard
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
