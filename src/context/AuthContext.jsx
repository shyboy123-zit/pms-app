import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check local storage for existing session
        const storedUser = localStorage.getItem('pms_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = (id, password) => {
        // Mock login logic
        // In a real app, this would be an API call
        const users = JSON.parse(localStorage.getItem('pms_users') || '[]');
        const foundUser = users.find(u => u.id === id && u.password === password);

        if (foundUser) {
            const userData = { ...foundUser };
            delete userData.password; // Don't store password in session
            setUser(userData);
            localStorage.setItem('pms_user', JSON.stringify(userData));
            return { success: true };
        }
        return { success: false, message: 'Invalid ID or Password' };
    };

    const register = (userData) => {
        const users = JSON.parse(localStorage.getItem('pms_users') || '[]');
        if (users.find(u => u.id === userData.id)) {
            return { success: false, message: 'User ID already exists' };
        }

        // Add new user
        const newUser = { ...userData, role: 'employee' }; // Default role
        users.push(newUser);
        localStorage.setItem('pms_users', JSON.stringify(users));

        // Auto login after register
        const sessionUser = { ...newUser };
        delete sessionUser.password;
        setUser(sessionUser);
        localStorage.setItem('pms_user', JSON.stringify(sessionUser));

        return { success: true };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('pms_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
