import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, Loader2, CheckCircle2, Zap, ShieldCheck, Activity } from 'lucide-react';
import api from '../api';
import { Stethoscope } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/admin/login', { username: email, password });

            if (response.data.success) {
                const { access_token, user } = response.data;
                const storage = rememberMe ? localStorage : sessionStorage;

                storage.setItem('token', access_token);
                storage.setItem('user', JSON.stringify(user || {}));

                onLogin(access_token);
                navigate('/');
            } else {
                setError('Invalid login credentials. Please try again.');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(
                err.response?.data?.message ||
                'Unable to connect to the server. Please check your internet connection.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-split">
                {/* Left Section: Branding & Visuals */}
                <div className="login-branding">
                    <div className="branding-content">
                        <div className="clinic-portal-label">Clinic Portal</div>
                        <div className="login-logo">
                            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="highlight-icon" style={{ marginBottom: '1rem', filter: 'drop-shadow(0px 8px 20px rgba(99, 102, 241, 0.4))' }}>
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="url(#heartGrad)" />
                                <path d="M4 11h2.5l1.5-4 2 9 1.5-7 1.5 5 1-3h3.5" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0px 2px 4px rgba(16, 185, 129, 0.5))' }} />
                                <defs>
                                    <linearGradient id="heartGrad" x1="2" y1="3" x2="22" y2="21.35" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#4F46E5" />
                                        <stop offset="100%" stopColor="#7C3AED" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <h1>PediPulse</h1>
                        </div>
                        <div className="branding-highlights">
                            <div className="highlight-item">
                                <Activity className="highlight-icon" size={20} />
                                <p>Specialized Patient Management</p>
                            </div>
                            <div className="highlight-item">
                                <Zap className="highlight-icon" size={20} />
                                <p>Real-time Appointment Tracking</p>
                            </div>
                            <div className="highlight-item">
                                <ShieldCheck className="highlight-icon" size={20} />
                                <p>Digital Clinical Records</p>
                            </div>
                        </div>
                    </div>
                    <div className="dev-credit">
                        <p>Designed and developed by <a href="https://deepakdukare.vercel.app/" target="_blank" rel="noopener noreferrer"><span>YashoDeep Technology</span></a></p>
                    </div>
                </div>

                {/* Right Section: Login Form */}
                <div className="login-form-container">
                    <div className="login-card">
                        <div className="login-header">
                            <h1>Welcome Back</h1>
                            <p>Please enter your details to sign in</p>
                        </div>

                        <form className="login-form" onSubmit={handleSubmit}>
                            {error && <div className="login-error">{error}</div>}

                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <div className="input-wrapper">
                                    <Mail className="input-icon" size={24} />
                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="username"
                                        placeholder=""
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <div className="input-wrapper">
                                    <Lock className="input-icon" size={24} />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        placeholder=""
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={24} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="login-actions">
                                <label className="remember-me" htmlFor="remember">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    <span>Remember me</span>
                                </label>
                                <a href="#" className="forgot-password">Forgot password?</a>
                            </div>

                            <button
                                type="submit"
                                className="login-submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
