import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    padding: '2rem',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                    <div style={{
                        maxWidth: '500px',
                        width: '100%',
                        background: '#fff',
                        padding: '3rem',
                        borderRadius: '32px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
                        textAlign: 'center',
                        border: '1px solid #f1f5f9'
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: '#fee2e2',
                            color: '#ef4444',
                            borderRadius: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 2rem'
                        }}>
                            <AlertTriangle size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1rem' }}>Something went wrong</h2>
                        <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 2.5rem' }}>
                            We encountered an unexpected error. Don't worry, your data is safe. Try refreshing the page or returning home.
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button 
                                onClick={() => window.location.reload()}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    background: '#0f172a',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '16px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <RefreshCw size={18} />
                                Refresh Page
                            </button>
                            <button 
                                onClick={() => window.location.href = '/'}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: 'none',
                                    borderRadius: '16px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Home size={18} />
                                Go Home
                            </button>
                        </div>
                        
                        {process.env.NODE_ENV === 'development' && (
                            <div style={{ marginTop: '2rem', textAlign: 'left', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                <p style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Debug Info</p>
                                <code style={{ fontSize: '0.7rem', color: '#475569', wordBreak: 'break-all' }}>
                                    {this.state.error && this.state.error.toString()}
                                </code>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
