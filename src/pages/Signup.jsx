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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic Validation
        if (!formData.id || !formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
            setError('모든 항목을 입력해주세요.');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        if (formData.password.length < 6) {
            setError('비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        // Call Register in AuthContext
        const result = await register({
            id: formData.id,
            name: formData.name,
            email: formData.email,
            password: formData.password
        });

        if (result.success) {
            alert('가입이 완료되었습니다! 자동 로그인됩니다.');
            navigate('/');
        } else {
            setError(result.message || '회원가입 실패');
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
                        placeholder="이메일 (필수)"
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
                        placeholder="비밀번호 (6자 이상)"
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
