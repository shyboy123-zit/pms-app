import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const DebugOverlay = () => {
    const { user, loading: authLoading } = useAuth();
    const { loading: dataLoading, molds, employees } = useData();
    const [visible, setVisible] = useState(true);

    if (!visible) return <button onClick={() => setVisible(true)} style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 9999 }}>Debug</button>;

    return (
        <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            background: 'rgba(0,0,0,0.85)',
            color: '#0f0',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '10px',
            fontFamily: 'monospace',
            zIndex: 9999,
            maxWidth: '300px',
            pointerEvents: 'none' // Allow clicking through
        }}>
            <h4 style={{ margin: 0, borderBottom: '1px solid #333' }}>DEBUG INFO</h4>
            <div>Auth Loading: {authLoading ? 'YES' : 'NO'}</div>
            <div>User: {user ? (user.name || user.email) : 'NULL'}</div>
            <div>Data Loading: {dataLoading ? 'YES' : 'NO'}</div>
            <div>Molds: {molds?.length || 0}</div>
            <div>Employees: {employees?.length || 0}</div>
            <div>ENV: {import.meta.env.VITE_SUPABASE_URL ? 'OK' : 'MISSING'}</div>
            <div style={{ color: 'red' }}>
                {!import.meta.env.VITE_SUPABASE_URL && 'VITE_SUPABASE_URL is missing! Check Vercel Settings.'}
            </div>
        </div>
    );
};

export default DebugOverlay;
