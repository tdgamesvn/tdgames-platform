import React, { useState } from 'react';
import { AccountUser } from '../types';

interface LoginScreenProps {
    onLogin: (user: AccountUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            setError('Vui lòng nhập đầy đủ tên đăng nhập/email và mật khẩu.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const { loginWithCredentials } = await import('@/services/authService');
            const user = await loginWithCredentials(username, password);
            onLogin(user);
        } catch (e: any) {
            setError(e.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: '#0F0F0F' }}
        >
            {/* Background glow blobs – matching app's orange primary */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div
                    className="absolute rounded-full blur-[120px] opacity-20"
                    style={{
                        width: '700px', height: '700px',
                        background: 'radial-gradient(circle, #FF9500 0%, transparent 70%)',
                        top: '-250px', left: '-200px',
                    }}
                />
                <div
                    className="absolute rounded-full blur-[100px] opacity-10"
                    style={{
                        width: '500px', height: '500px',
                        background: 'radial-gradient(circle, #FF6B00 0%, transparent 70%)',
                        bottom: '-150px', right: '-150px',
                    }}
                />
                {/* Subtle grid */}
                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: 'linear-gradient(#FF9500 1px, transparent 1px), linear-gradient(90deg, #FF9500 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                    }}
                />
            </div>

            {/* Card */}
            <div className="relative z-10 w-full max-w-md mx-4" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
                <div
                    className="rounded-[28px] border p-10"
                    style={{
                        background: 'rgba(26,26,26,0.85)',
                        backdropFilter: 'blur(32px)',
                        borderColor: 'rgba(255,149,0,0.18)',
                        boxShadow: '0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                >
                    {/* Branding */}
                    <div className="flex flex-col items-center mb-10">
                        <div
                            className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center mb-4"
                            style={{
                                background: 'rgba(255,149,0,0.1)',
                                border: '1.5px solid rgba(255,149,0,0.35)',
                                boxShadow: '0 0 40px rgba(255,149,0,0.2)',
                            }}
                        >
                            <img
                                src="https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/logo_td.png"
                                alt="TD Games"
                                className="w-11 h-11 object-contain"
                            />
                        </div>
                        <h1
                            className="text-2xl font-black uppercase tracking-[0.12em] font-montserrat"
                            style={{ color: '#FF9500' }}
                        >
                            TD Games Platform
                        </h1>
                        <p
                            className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1"
                            style={{ color: 'rgba(157,156,157,0.7)' }}
                        >
                            Internal Dashboard
                        </p>
                    </div>

                    {/* Divider */}
                    <div
                        className="w-full h-px mb-8"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,149,0,0.25), transparent)' }}
                    />

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username */}
                        <div>
                            <label
                                className="block text-[10px] font-black uppercase tracking-[0.15em] mb-2 font-montserrat"
                                style={{ color: '#9D9C9D' }}
                            >
                                Tên đăng nhập
                            </label>
                            <div className="relative">
                                <div
                                    className="absolute left-4 top-1/2 -translate-y-1/2"
                                    style={{ color: 'rgba(255,149,0,0.5)' }}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => { setUsername(e.target.value); setError(''); }}
                                    placeholder="username"
                                    autoComplete="username"
                                    className="w-full rounded-xl pl-11 pr-4 py-3.5 text-sm font-medium font-montserrat outline-none transition-all"
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1.5px solid rgba(255,149,0,0.15)',
                                        color: '#F2F2F2',
                                        caretColor: '#FF9500',
                                    }}
                                    onFocus={e => {
                                        e.target.style.borderColor = 'rgba(255,149,0,0.55)';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(255,149,0,0.07)';
                                    }}
                                    onBlur={e => {
                                        e.target.style.borderColor = 'rgba(255,149,0,0.15)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                className="block text-[10px] font-black uppercase tracking-[0.15em] mb-2 font-montserrat"
                                style={{ color: '#9D9C9D' }}
                            >
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <div
                                    className="absolute left-4 top-1/2 -translate-y-1/2"
                                    style={{ color: 'rgba(255,149,0,0.5)' }}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError(''); }}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="w-full rounded-xl pl-11 pr-12 py-3.5 text-sm font-medium font-montserrat outline-none transition-all"
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1.5px solid rgba(255,149,0,0.15)',
                                        color: '#F2F2F2',
                                        caretColor: '#FF9500',
                                    }}
                                    onFocus={e => {
                                        e.target.style.borderColor = 'rgba(255,149,0,0.55)';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(255,149,0,0.07)';
                                    }}
                                    onBlur={e => {
                                        e.target.style.borderColor = 'rgba(255,149,0,0.15)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100"
                                    style={{ color: '#9D9C9D' }}
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div
                                className="rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2 font-montserrat"
                                style={{
                                    background: 'rgba(244,67,54,0.1)',
                                    border: '1px solid rgba(244,67,54,0.3)',
                                    color: '#F44336',
                                    animation: 'fadeInUp 0.2s ease-out',
                                }}
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-xl py-4 text-sm font-black uppercase tracking-[0.12em] font-montserrat transition-all"
                            style={{
                                background: isLoading
                                    ? 'rgba(255,149,0,0.5)'
                                    : 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)',
                                color: '#0F0F0F',
                                boxShadow: isLoading ? 'none' : '0 8px 24px rgba(255,149,0,0.4)',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transform: isLoading ? 'none' : undefined,
                            }}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Đang xác thực...
                                </span>
                            ) : (
                                'Đăng nhập'
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <p
                        className="text-center text-[9px] font-bold uppercase tracking-[0.2em] mt-8 font-montserrat"
                        style={{ color: 'rgba(157,156,157,0.35)' }}
                    >
                        Internal use only · TD Games © 2026
                    </p>
                </div>
            </div>
        </div>
    );
};
