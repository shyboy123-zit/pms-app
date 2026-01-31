import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Login button clicked!', { email, password: '***' });
        setError('');

        console.log('Calling login function...');
        const result = await login(email, password);
        console.log('Login result:', result);

        if (result.success) {
            console.log('Login successful, navigating to /');
            navigate('/');
        } else {
            console.log('Login failed:', result.message);
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        }
    };

    return (
        <div style={{ width: '100%' }}>
            <h2 className="text-center mb-4" style={{ fontSize: '1.25rem', marginBottom: '1.5rem', textAlign: 'center' }}>로그인</h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                    <Mail size={20} className="input-icon" />
                    <input
                        type="email"
                        placeholder="이메일"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="glass-input"
                    />
                </div>

                <div className="input-group">
                    <Lock size={20} className="input-icon" />
                    <input
                        type="password"
                        placeholder="비밀번호"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="glass-input"
                    />
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
                    로그인 <ArrowRight size={18} />
                </button>
            </form>

            <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                <span className="text-muted">계정이 없으신가요? </span>
                <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: '600' }}>직원 가입하기</Link>
            </div>
        </div>
    );
};

export default Login;
