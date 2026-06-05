import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Lock, Mail, ArrowRight, User, BadgeCheck, KeyRound } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    // 아이디 찾기 모달
    const [findOpen, setFindOpen] = useState(false);
    const [findName, setFindName] = useState('');
    const [findEmpId, setFindEmpId] = useState('');
    const [finding, setFinding] = useState(false);
    const [findResult, setFindResult] = useState(null); // {found, email} | {error}
    // 비밀번호 안내 모달
    const [pwOpen, setPwOpen] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const result = await login(email, password);
        if (result.success) {
            navigate('/');
        } else {
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        }
    };

    const handleFind = async (e) => {
        e.preventDefault();
        if (!findName.trim() || !findEmpId.trim()) {
            setFindResult({ error: '이름과 사원번호를 모두 입력하세요.' });
            return;
        }
        setFinding(true);
        setFindResult(null);
        try {
            const res = await fetch('/api/find-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: findName.trim(), emp_id: findEmpId.trim() }),
            });
            const data = await res.json();
            if (!res.ok) setFindResult({ error: data.error || '조회에 실패했습니다.' });
            else if (data.found) setFindResult({ found: true, email: data.email });
            else setFindResult({ found: false });
        } catch (err) {
            setFindResult({ error: '연결 오류: ' + err.message });
        } finally {
            setFinding(false);
        }
    };

    const openFind = () => {
        setFindName(''); setFindEmpId(''); setFindResult(null); setFindOpen(true);
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

            {/* 아이디 / 비밀번호 찾기 */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                <button type="button" onClick={openFind}
                    style={{ color: 'var(--text-muted)', background: 'none', fontWeight: 500 }}>
                    아이디 찾기
                </button>
                <span style={{ color: 'var(--border)' }}>|</span>
                <button type="button" onClick={() => setPwOpen(true)}
                    style={{ color: 'var(--text-muted)', background: 'none', fontWeight: 500 }}>
                    비밀번호 찾기
                </button>
            </div>

            <div className="auth-footer" style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.9rem' }}>
                <span className="text-muted">계정이 없으신가요? </span>
                <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: '600' }}>직원 가입하기</Link>
            </div>

            {/* === 아이디 찾기 모달 === */}
            <Modal title="🔎 아이디(이메일) 찾기" isOpen={findOpen} onClose={() => setFindOpen(false)}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    가입 시 등록한 <b>이름</b>과 <b>사원번호</b>를 입력하면 가입 이메일을 알려드립니다.
                </p>
                <form onSubmit={handleFind} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="input-group">
                        <BadgeCheck size={20} className="input-icon" />
                        <input type="text" placeholder="이름" value={findName}
                            onChange={(e) => setFindName(e.target.value)} className="glass-input" />
                    </div>
                    <div className="input-group">
                        <User size={20} className="input-icon" />
                        <input type="text" placeholder="사원번호" value={findEmpId}
                            onChange={(e) => setFindEmpId(e.target.value)} className="glass-input" />
                    </div>

                    {findResult?.error && <div className="error-message">{findResult.error}</div>}
                    {findResult?.found && (
                        <div style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary)', borderRadius: 10, padding: '0.85rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>가입 이메일</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)' }}>{findResult.email}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                보안을 위해 일부만 표시됩니다. 기억나지 않으시면 관리자에게 문의하세요.
                            </div>
                        </div>
                    )}
                    {findResult && findResult.found === false && (
                        <div className="error-message">일치하는 직원 정보가 없습니다. 이름·사원번호를 확인하세요.</div>
                    )}

                    <button type="submit" className="btn-primary" disabled={finding} style={{ marginTop: '0.25rem' }}>
                        {finding ? '조회 중...' : '이메일 찾기'}
                    </button>
                </form>
            </Modal>

            {/* === 비밀번호 찾기 안내 모달 === */}
            <Modal title="🔑 비밀번호 찾기" isOpen={pwOpen} onClose={() => setPwOpen(false)}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <KeyRound size={28} />
                    </div>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', textAlign: 'center', lineHeight: 1.6 }}>
                        비밀번호는 보안상 <b>관리자가 초기화</b>해 드립니다.
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                        관리자에게 <b>이름</b>과 <b>사원번호</b>를 알려주고 비밀번호 초기화를 요청하세요.
                        초기화된 임시 비밀번호로 로그인한 뒤 변경하시면 됩니다.
                    </p>
                    <button className="btn-primary" onClick={() => setPwOpen(false)} style={{ marginTop: '0.5rem' }}>확인</button>
                </div>
            </Modal>
        </div>
    );
};

export default Login;
