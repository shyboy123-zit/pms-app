import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Mail, ArrowRight, BadgeCheck } from 'lucide-react';

const Signup = () => {
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        // Basic Validation
        if (!formData.id || !formData.name || !formData.password || !formData.confirmPassword) {
            setError('필수 정보를 모두 입력해주세요.');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        if (formData.password.length < 4) {
            setError('비밀번호는 4자 이상이어야 합니다.');
            return;
        }

        const result = register({
            id: formData.id,
            name: formData.name,
            email: formData.email
            // password is not stored in plaintext in real apps, but here we just pass it
        });

        // In the context we handled the "mock" password logic implicitly or need to pass it? 
        // Ah, in AuthContext `register` takes `userData`. I should double check logic.
        // Wait, I need to pass password to register function too so it can simulate "check".
        // Actually AuthContext logic was: `const newUser = { ...userData, role: 'employee' };` 
        // It didn't mention password. I need to make sure I pass password in userData.

        // Let's modify the call:
        const regResult = register({
            id: formData.id,
            name: formData.name,
            email: formData.email,
            password: formData.password
        });

        if (regResult.success) {
            navigate('/');
        } else {
            setError(regResult.message || '회원가입 실패');
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div>
            <h2 className="text-center mb-4" style={{ fontSize: '1.25rem', marginBottom: '1.5rem', textAlign: 'center' }}>직원 회원가입</h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className="input-group">
                    <User size={20} className="input-icon" />
                    <input
                        type="text"
                        name="id"
                        placeholder="사원번호 (ID)"
                        value={formData.id}
                        onChange={handleChange}
                        className="glass-input"
                    />
                </div>

                <div className="input-group">
                    <BadgeCheck size={20} className="input-icon" />
                    <input
                        type="text"
                        name="name"
                        placeholder="이름"
                        value={formData.name}
                        onChange={handleChange}
                        className="glass-input"
                    />
                </div>

                <div className="input-group">
                    <Mail size={20} className="input-icon" />
                    <input
                        type="email"
                        name="email"
                        placeholder="이메일 (선택)"
                        value={formData.email}
                        onChange={handleChange}
                        className="glass-input"
                    />
                </div>

                <div className="input-group">
                    <Lock size={20} className="input-icon" />
                    <input
                        type="password"
                        name="password"
                        placeholder="비밀번호"
                        value={formData.password}
                        onChange={handleChange}
                        className="glass-input"
                    />
                </div>

                <div className="input-group">
                    <Lock size={20} className="input-icon" />
                    <input
                        type="password"
                        name="confirmPassword"
                        placeholder="비밀번호 확인"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="glass-input"
                    />
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
                    가입하기 <ArrowRight size={18} />
                </button>
            </form>

            <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                <span className="text-muted">이미 계정이 있으신가요? </span>
                <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600' }}>로그인</Link>
            </div>
        </div>
    );
};

export default Signup;
