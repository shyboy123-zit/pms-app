import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Check active session
        const checkSession = async () => {
            try {
                // Timeout promise to prevent hanging
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                );

                const sessionPromise = supabase.auth.getSession();

                const { data: { session } } = await Promise.race([sessionPromise, timeout]);

                if (session?.user) {
                    await fetchProfile(session.user);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.warn('Auth Check Timeout or Error:', error);
                setLoading(false); // Force loading end
            }
        }
    };
    // checkSession();
    setLoading(false); // Force manual login on refresh

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
            await fetchProfile(session.user);
        } else {
            setUser(null);
            setLoading(false);
        }
    });

    return () => subscription.unsubscribe();
}, []);

const fetchProfile = async (authUser) => {
    try {
        // Fetch employee data linked to this auth user
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('auth_user_id', authUser.id)
            .single();

        if (data) {
            setUser({ ...data, email: authUser.email }); // Combine auth email with employee data
        } else if (authUser) {
            // Fallback if employee record missing (shouldn't happen with correct flow)
            setUser({ email: authUser.email, role: 'unknown' });
        }
    } catch (err) {
        console.error('Error fetching profile:', err);
    } finally {
        setLoading(false);
    }
};

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
