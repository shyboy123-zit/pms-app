import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', marginTop: '10%' }}>
                    <h2>앱에 오류가 발생했습니다.</h2>
                    <p>아래 내용을 개발자에게 캡쳐해서 보내주세요.</p>
                    <div style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        padding: '1rem',
                        borderRadius: '8px',
                        textAlign: 'left',
                        margin: '1rem auto',
                        maxWidth: '600px',
                        overflow: 'auto'
                    }}>
                        <p><strong>Error:</strong> {this.state.error?.toString()}</p>
                        <pre style={{ fontSize: '0.8rem' }}>{this.state.errorInfo?.componentStack}</pre>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '0.8rem 1.5rem',
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        새로고침
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
