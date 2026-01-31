import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session on mount
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    // Fetch employee profile
                    const { data: employee } = await supabase
                        .from('employees')
                        .select('*')
                        .eq('auth_user_id', session.user.id)
                        .single();

                    if (employee) {
                        setUser({ ...employee, email: session.user.email });
                    } else {
                        setUser({ email: session.user.email, role: 'unknown' });
                    }
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error('Session check error:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                const { data: employee } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('auth_user_id', session.user.id)
                    .single();

                if (employee) {
                    setUser({ ...employee, email: session.user.email });
                } else {
                    setUser({ email: session.user.email, role: 'unknown' });
                }
            } else {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) return { success: false, message: error.message };
        return { success: true };
    };

    // Updated Register: Sign up Auth + Create Employee Record
    const register = async (userData) => {
        // 1. SignUp with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
        });

        if (authError) return { success: false, message: authError.message };
        if (!authData.user) return { success: false, message: '회원가입에 실패했습니다.' };

        // 2. Create Record in 'employees' table
        const newEmployee = {
            auth_user_id: authData.user.id,
            emp_id: userData.id, // Custom Employee ID (e.g. EMP-001)
            name: userData.name,
            email: userData.email,
            department: '생산팀', // Default
            position: '사원',     // Default
            join_date: new Date().toISOString().split('T')[0],
            status: '재직',
            permissions: { dashboard: true, molds: true, materials: true, delivery: true, quality: true, sales: true, employees: false, equipments: true } // Default permissions
        };

        const { error: dbError } = await supabase
            .from('employees')
            .insert([newEmployee]);

        if (dbError) {
            // If DB insert fails, we might want to clean up the auth user, but for MVP just return error
            console.error('DB Insert Error:', dbError);
            return { success: false, message: '계정은 생성되었으나 직원 정보 등록에 실패했습니다. 관리자에게 문의하세요.' };
        }

        return { success: true };
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
