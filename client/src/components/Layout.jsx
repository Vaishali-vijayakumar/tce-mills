import React from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import { Home, PlusCircle, Users, LogOut, Layers } from 'lucide-react';

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const [hasLots, setHasLots] = React.useState(false);

    React.useEffect(() => {
        if (user?.role === 'Manager') {
            checkLots();
        }
    }, [user, location.pathname]); // Re-check on nav or user change

    const checkLots = async () => {
        try {
            const res = await api.get('/contracts');
            const lotsExist = res.data.some(c => c.stage >= 3);
            setHasLots(lotsExist);
        } catch (e) {
            console.error('Error checking lots:', e);
        }
    };

    const NavItem = ({ to, icon: Icon, label }) => {
        const active = location.pathname === to;
        return (
            <Link to={to} className={`flex items-center space-x-3 px-6 py-3 transition-all duration-200 group relative ${active ? 'text-indigo-600 bg-indigo-50 font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full"></div>}
                <Icon size={20} className={active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-3">
                    <img src="/temple.webp" alt="Thiagarajar Mills" className="h-12 w-12 object-contain shrink-0" />
                    <div className="leading-tight">
                        <p className="text-[13px] font-semibold text-blue-600 leading-snug">Thiagarajar mills</p>
                        <p className="text-[11px] text-slate-400">(P) limited</p>
                    </div>
                </div>

                <nav className="flex-1 mt-6 space-y-1">
                    <NavItem to="/dashboard" icon={Home} label="Dashboard" />
                    {user?.role === 'Manager' && (
                        <>
                            <NavItem to="/create-contract" icon={PlusCircle} label="New Contract" />
                            <NavItem to="/lots" icon={Layers} label="Manage Lots" />
                            <NavItem to="/vendors" icon={Users} label="Vendors" />
                        </>
                    )}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                                {user?.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-800">{user?.full_name}</p>
                                <p className="text-xs text-slate-500 uppercase tracking-wider">{user?.role}</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 text-slate-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-100">
                        <LogOut size={16} />
                        <span className="text-xs font-medium">Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
