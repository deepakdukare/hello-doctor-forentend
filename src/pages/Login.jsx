import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, Loader2, Stethoscope, Pill, Activity, Plus } from 'lucide-react';
import api from '../api';

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
        <div className="glass-login-wrapper">
            {/* Animated Medical Icons in Background */}
            <div className="glass-bg-icons">
                <Stethoscope className="medical-icon" size={48} style={{ top: '15%', left: '10%', animationDelay: '0s' }} />
                <Pill className="medical-icon" size={32} style={{ top: '65%', left: '15%', animationDelay: '2s' }} />
                <Activity className="medical-icon" size={40} style={{ top: '25%', right: '15%', animationDelay: '4s' }} />
                <Plus className="medical-icon" size={36} style={{ bottom: '20%', right: '10%', animationDelay: '1s' }} />
                <Stethoscope className="medical-icon" size={32} style={{ bottom: '40%', left: '40%', animationDelay: '3s' }} />
            </div>

            <div className="glass-login-card">
                <div className="glass-logo-container">
                    <div className="glass-logo-box">
                        <Stethoscope size={32} strokeWidth={2.5} />
                    </div>
                    <span className="glass-logo-text">PediPulse</span>
                </div>

                <h2>Welcome back</h2>

                <form onSubmit={handleSubmit}>
                    {error && <div className="glass-error">{error}</div>}

                    <div className="glass-form-group">
                        <div className="glass-input-wrapper">
                            <Mail className="input-icon" size={20} />
                            <input
                                type="email"
                                className="glass-input"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="glass-form-group">
                        <div className="glass-input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="glass-input"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="eye-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="glass-actions">
                        <label className="glass-checkbox">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <span>Remember Me</span>
                        </label>
                        <a href="#" className="glass-link">Forgot password?</a>
                    </div>

                    <button
                        type="submit"
                        className="glass-submit-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Signing in...</span>
                            </div>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
