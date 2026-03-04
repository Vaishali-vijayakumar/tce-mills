import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Box, Search, ArrowRight, Layers, LayoutGrid, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Lots() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchContracts();
    }, []);

    const fetchContracts = async () => {
        try {
            const res = await api.get('/contracts');

            // De-duplicate contracts (GET /contracts returns one row per lot)
            const uniqueMap = new Map();
            res.data.forEach(item => {
                if (!uniqueMap.has(item.contract_id)) {
                    // Start with this item
                    uniqueMap.set(item.contract_id, {
                        ...item,
                        lotCount: item.lot_id ? 1 : 0, // Initial count
                        totalBalesReceived: item.no_of_bales || 0 // Track total bales
                    });
                } else {
                    // Update existing entry (e.g. increment lot count)
                    const existing = uniqueMap.get(item.contract_id);
                    if (item.lot_id) {
                        existing.lotCount += 1;
                        existing.totalBalesReceived += (item.no_of_bales || 0);
                    }
                }
            });

            const uniqueContracts = Array.from(uniqueMap.values());

            // Filter out contracts that are rejected at Stage 1
            const valid = uniqueContracts.filter(c => c.stage >= 3);
            setContracts(valid);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredContracts = contracts.filter(c =>
        c.contract_id.toString().includes(searchTerm) ||
        c.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Lot Management</h2>
                    <p className="text-slate-500 mt-1">Manage arrival lots, CTL testing, and payments per contract.</p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search Contract or Vendor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-400 font-medium">Loading contracts...</p>
                </div>
            ) : filteredContracts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                        <Layers size={34} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No Contracts Found</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">Active contracts will appear here. Create a new contract to start managing lots.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredContracts.map(contract => {
                        const completionPercent = contract.quantity > 0
                            ? Math.round((contract.totalBalesReceived / contract.quantity) * 100)
                            : 0;
                        const isComplete = contract.totalBalesReceived >= contract.quantity;

                        return (
                            <div key={contract.contract_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col group">
                                <div className="p-6 flex-grow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-mono font-bold text-xs">
                                            {contract.contract_id}
                                        </div>
                                        <div className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                                            <Box size={16} />
                                            {contract.lotCount} Lot{contract.lotCount !== 1 ? 's' : ''}
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-slate-900 text-lg mb-1 truncate" title={contract.vendor_name}>
                                        {contract.vendor_name}
                                    </h3>
                                    <p className="text-slate-500 text-xs font-mono mb-6">{contract.gst_number || 'No GST'}</p>

                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs py-2 border-t border-slate-50">
                                            <span className="text-slate-500">Contract Qty</span>
                                            <span className="font-bold text-slate-900">{contract.quantity || '-'} Bales</span>
                                        </div>
                                        <div className="flex justify-between text-xs py-2 border-t border-slate-50">
                                            <span className="text-slate-500">Bales Arrived</span>
                                            <span className="font-bold text-slate-900">{contract.totalBalesReceived || 0} Bales</span>
                                        </div>
                                        {contract.quantity && (
                                            <div className="pt-2">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="text-xs font-bold text-slate-500 uppercase">Completion</span>
                                                    <span className={`text-xs font-bold ${isComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {completionPercent}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                        style={{ width: `${Math.min(completionPercent, 100)}%` }}
                                                    />
                                                </div>
                                                {isComplete && (
                                                    <div className="flex items-center gap-1 mt-2 text-emerald-600">
                                                        <CheckCircle size={16} />
                                                        <span className="text-xs font-bold">All Bales Received</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center group-hover:bg-indigo-50/50 transition-colors">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-400">Action</span>
                                    <button
                                        onClick={() => navigate(`/contracts/${encodeURIComponent(contract.contract_id.split('/').join('---'))}/stage3`)}
                                        className="flex items-center gap-2 text-indigo-600 font-bold text-xs bg-white border border-indigo-100 px-4 py-2 rounded-lg hover:bg-indigo-600 hover:text-white hover:border-transparent transition-all shadow-sm"
                                    >
                                        <LayoutGrid size={16} /> Manage Lots
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
