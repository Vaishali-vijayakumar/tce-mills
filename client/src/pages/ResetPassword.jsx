import React, { useState } from 'react';
import api from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic Validation
        if (formData.newPassword !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (formData.newPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);

        try {
            await api.post('/auth/reset-password', {
                username: formData.username,
                email: formData.email,
                newPassword: formData.newPassword
            });

            setSuccess("Password reset successfully! Redirecting to login...");
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to reset password. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
            {/* Background elements (same as login) */}
            <div className="absolute top-0 left-0 w-full h-full bg-white opacity-40 z-0"></div>
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>

            <div className="relative z-10 bg-white/80 backdrop-blur-xl border border-white/50 p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md">

                <Link to="/login" className="flex items-center text-slate-500 hover:text-indigo-600 mb-6 transition-colors text-xs font-medium">
                    <ArrowLeft size={16} className="mr-1" /> Back to Login
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reset Password</h1>
                    <p className="text-slate-500 mt-2 text-xs">Enter your credentials to set a new password.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg mb-6 text-xs text-center font-medium">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-3 rounded-lg mb-6 text-xs text-center font-medium flex items-center justify-center animate-in fade-in">
                        <CheckCircle size={16} className="mr-2" /> {success}
                    </div>
                )}

                {!success && (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-700 text-xs font-semibold mb-1">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400 text-xs"
                                    placeholder="e.g. manager"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-700 text-xs font-semibold mb-1">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400 text-xs"
                                    placeholder="e.g. manager@cotton.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="pt-2 border-t border-slate-100 mt-2"></div>
                            <div>
                                <label className="block text-slate-700 text-xs font-semibold mb-1">New Password</label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400 text-xs"
                                    placeholder="Minimum 6 characters"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-700 text-xs font-semibold mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400 text-xs"
                                    placeholder="Re-enter password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-lg shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Reset Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
