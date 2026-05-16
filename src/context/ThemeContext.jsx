import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * 테마 컨텍스트
 * - 'light' | 'dark' 두 가지 모드 지원
 * - localStorage('pms-theme')에 저장되어 새로고침 후에도 유지
 * - 첫 방문 시 시스템 prefers-color-scheme 추종
 * - document.documentElement에 data-theme 속성 자동 설정
 */
const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });

const getInitialTheme = () => {
    try {
        const stored = localStorage.getItem('pms-theme');
        if (stored === 'light' || stored === 'dark') return stored;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
    } catch {}
    return 'light';
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem('pms-theme', theme); } catch {}
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
