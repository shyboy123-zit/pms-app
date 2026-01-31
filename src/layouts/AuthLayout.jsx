import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthLayout = () => {
    const { user } = useAuth();

    if (user) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="circle circle-1"></div>
                <div className="circle circle-2"></div>
            </div>

            <div className="auth-card glass-panel">
                <div className="auth-header">
                    <h1 className="auth-title">PMS Solution</h1>
                    <p className="auth-subtitle">Production Management System</p>
                </div>
                <Outlet />
            </div>

            <style>{`
        .auth-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        }

        .auth-background {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: 0;
        }

        .circle {
          position: absolute;
          border-radius: 50%;
          opacity: 0.6;
          filter: blur(60px);
        }

        .circle-1 {
          width: 400px;
          height: 400px;
          background: #a5b4fc;
          top: -100px;
          left: -100px;
          animation: float 6s ease-in-out infinite;
        }

        .circle-2 {
          width: 300px;
          height: 300px;
          background: #67e8f9;
          bottom: -50px;
          right: -50px;
          animation: float 8s ease-in-out infinite reverse;
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, 30px); }
        }

        .auth-card {
          width: 100%;
          max-width: 420px;
          padding: 2.5rem;
          z-index: 1;
          margin: 1rem;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .auth-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--primary);
          margin-bottom: 0.5rem;
        }
        
        .auth-subtitle {
          color: var(--text-muted);
          font-size: 0.95rem;
        }
      `}</style>
        </div>
    );
};

export default AuthLayout;
