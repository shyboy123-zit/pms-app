import React from 'react';
import { Activity } from 'lucide-react';

const LoadingScreen = () => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            zIndex: 9999
        }}>
            <Activity className="spin" size={48} color="#2563eb" />
            <h3 style={{ marginTop: '1rem', color: '#475569' }}>앱 로딩 중...</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>잠시만 기다려주세요</p>
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default LoadingScreen;
