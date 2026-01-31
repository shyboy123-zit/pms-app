import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ArrowRight } from 'lucide-react';

const Login = () => {
    const [formData, setFormData] = useState({ id: '', password: '' });
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!formData.id || !formData.password) {
            setError('모든 필드를 입력해주세요.');
            return;
        }

        const result = login(formData.id, formData.password);
        if (result.success) {
            navigate('/');
        } else {
            setError(result.message || '로그인 실패');
        }
    };

    return (
        <div>
            <h2 className="text-center mb-4" style={{ fontSize: '1.25rem', marginBottom: '1.5rem', textAlign: 'center' }}>직원 로그인</h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                    <User size={20} className="input-icon" />
                    <input
                        type="text"
                        placeholder="사원번호 / ID"
                        value={formData.id}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        className="glass-input"
                    />
                </div>

                <div className="input-group">
                    <Lock size={20} className="input-icon" />
                    <input
                        type="password"
                        placeholder="비밀번호"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="glass-input"
                    />
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="btn-primary">
                    로그인 <ArrowRight size={18} />
                </button>
            </form>

            <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                <span className="text-muted">계정이 없으신가요? </span>
                <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: '600' }}>회원가입</Link>
            </div>

            <style>{`
                .input-group {
                    position: relative;
                }
                .input-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }
                .glass-input {
                    width: 100%;
                    padding: 0.875rem 1rem 0.875rem 3rem;
                    background: rgba(255, 255, 255, 0.5);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    font-size: 1rem;
                    transition: all 0.2s;
                }
                .glass-input:focus {
                    outline: none;
                    border-color: var(--primary);
                    background: #fff;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
                }
                .btn-primary {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.875rem;
                    background: var(--primary);
                    color: white;
                    border-radius: var(--radius-md);
                    font-weight: 600;
                    font-size: 1rem;
                    transition: all 0.2s;
                }
                .btn-primary:hover {
                    background: var(--primary-hover);
                    transform: translateY(-1px);
                }
                .error-message {
                    color: var(--danger);
                    font-size: 0.875rem;
                    text-align: center;
                    background: rgba(239, 68, 68, 0.1);
                    padding: 0.5rem;
                    border-radius: var(--radius-sm);
                }
            `}</style>
        </div>
    );
};

export default Login;
