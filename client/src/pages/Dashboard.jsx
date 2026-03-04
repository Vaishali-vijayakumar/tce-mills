import React, { useState, useEffect } from 'react';
import api from '../api';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import {
    FileText,
    Search,
    Clock,
    CheckCircle,
    ChevronRight,
    ArrowRight,
    Filter,
    MoreHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
    const { user } = useAuth();
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('pending'); // Default to Pending
    const [sortBy, setSortBy] = useState('all'); // Default: Show All Stages
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchContracts();

        // REAL-TIME SUBSCRIPTION
        const channel = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'contracts' },
                () => fetchContracts()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'contract_lots' },
                () => fetchContracts()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'lot_decisions' },
                () => fetchContracts()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchContracts = async () => {
        try {
            const res = await api.get('/contracts');
            setContracts(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        if (!status) return 'text-slate-400 bg-slate-50 border-slate-100';
        if (status.includes('Pending')) return 'text-amber-700 bg-amber-50 border-amber-200';
        if (status === 'Closed' || status.includes('Approved')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
        if (status.includes('Rollback') || status.includes('Rejected') || status.includes('Revision') || status.includes('Modify')) return 'text-rose-700 bg-rose-50 border-rose-200';
        return 'text-slate-600 bg-slate-100 border-slate-200';
    };

    const handleAction = (c) => {
        // If Lot ID is present, use Lot-Specific Routes for Stage 4/5
        const lotPath = c.lot_id ? `/lots/${c.lot_id}` : ''; // Part of URL

        // Replace slashes with --- for robust URL segments on hosted environments
        const safeContractId = encodeURIComponent(c.contract_id.split('/').join('---'));

        // For Stage 3 and above, the "Master Row" (no lot_id) always goes to the Manage Lots (Stage 3) page,
        // UNLESS it's a privileged vendor in Stage 5 (Contract-Level Payment — happens before lots).
        if (c.stage === 5 && !c.lot_id) {
            navigate(`/contracts/${safeContractId}/stage5`);
            return;
        }

        if (c.stage >= 3 && !c.lot_id) {
            navigate(`/contracts/${safeContractId}/stage3`);
            return;
        }

        switch (c.stage) {
            case 2: navigate(`/contracts/${safeContractId}/stage2`); break;
            case 3: navigate(`/contracts/${safeContractId}/stage3`); break;
            case 4: navigate(`/contracts/${safeContractId}${lotPath}/stage4`); break;
            case 5:
            case 6: navigate(`/contracts/${safeContractId}${lotPath}/stage5`); break;
            default: navigate(`/contracts/${safeContractId}/view`); break;
        }
    };

    const handleStageClick = (e, c, stepId) => {
        e.stopPropagation();
        const safeContractId = encodeURIComponent(c.contract_id.split('/').join('---'));
        const lotPath = c.lot_id ? `/lots/${c.lot_id}` : '';

        // ENFORCEMENT: Block future stages
        const steps = c.is_privileged === 1
            ? [1, 2, 5, 3, 4]
            : [1, 2, 3, 4, 5];

        const currentStageIdx = steps.indexOf(c.stage === 6 ? 6 : c.stage);
        const targetStageIdx = steps.indexOf(stepId);

        if (targetStageIdx > currentStageIdx && c.stage !== 6) {
            // Future stage - do nothing or show toast (optional)
            return;
        }

        switch (stepId) {
            case 1: navigate(`/contracts/${safeContractId}/view`); break;
            case 2: navigate(`/contracts/${safeContractId}/stage2`); break;
            case 3: navigate(`/contracts/${safeContractId}/stage3`); break;
            case 4: navigate(`/contracts/${safeContractId}${lotPath}/stage4`); break;
            case 5: navigate(`/contracts/${safeContractId}${lotPath}/stage5`); break;
            default: break;
        }
    };

    // Derived State
    const filteredContracts = contracts.filter(c => {
        // Search Filter
        const matchesSearch = c.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.contract_id.toString().includes(searchTerm);

        // Status Filter
        let matchesStatus = true;

        if (filterStatus === 'action_required') {
            if (user?.role === 'Chairman') {
                // Chairman sees ONLY approval tasks (after manager submission)
                matchesStatus = c.status.includes('Pending Chairman Approval');
            } else {
                // Manager sees everything NOT waiting for Chairman and NOT Closed/Approved
                // Includes: Pending Entry, Lot Management, Rollback, Rejected, and Revision
                matchesStatus = !c.status.includes('Pending Chairman Approval') &&
                    !c.status.includes('Closed') &&
                    !c.status.includes('Approved');
            }
        }
        else if (filterStatus === 'pending') {
            if (user?.role === 'Chairman') {
                // For Chairman, show ONLY items awaiting their approval
                matchesStatus = c.status.includes('Pending Chairman Approval');
            } else {
                // Manager sees 'Pending', 'Rollback', and 'Revision' as pending actions
                matchesStatus = c.status.includes('Pending') || c.status.includes('Rollback') || c.status.includes('Revision');
            }
        }
        else if (filterStatus === 'approved') matchesStatus = c.status.includes('Approved') || c.status === 'Closed';
        else if (filterStatus === 'rejected') matchesStatus = c.status.includes('Rejected'); // Rollback/Revision moved to Pending for clarity

        return matchesSearch && matchesStatus;
    }).filter(c => {
        // Stage Filter
        if (sortBy === 'all') return true;
        if (sortBy.startsWith('stage_')) {
            const targetStage = parseInt(sortBy.split('_')[1]);
            if (targetStage === 5 && c.stage === 6) return true;
            return c.stage === targetStage;
        }
        return true;
    });

    // Group: master row first, then lots sorted by arrival_date, grouped by contract_id
    // Contracts sorted newest entry_date first
    const grouped = [];
    const seen = new Set();
    // Get unique contract IDs sorted by entry_date descending (use master row entry_date)
    const contractOrder = [...filteredContracts]
        .filter(c => !c.lot_id)
        .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))
        .map(c => c.contract_id);

    // Also handle contracts that only have lot rows (no master row in current filter)
    filteredContracts.forEach(c => {
        if (!contractOrder.includes(c.contract_id)) contractOrder.push(c.contract_id);
    });

    contractOrder.forEach(cid => {
        if (seen.has(cid)) return;
        seen.add(cid);
        // Master row first
        const master = filteredContracts.find(c => c.contract_id === cid && !c.lot_id);
        if (master) grouped.push(master);
        // Lot rows sorted by arrival_date ascending
        const lots = filteredContracts
            .filter(c => c.contract_id === cid && c.lot_id)
            .sort((a, b) => new Date(a.arrival_date || a.entry_date) - new Date(b.arrival_date || b.entry_date));
        lots.forEach(l => grouped.push(l));
    });

    const sortedContracts = grouped;

    // Stats Logic
    const stats = {
        total: contracts.length,
        // Manager Pending includes Rollbacks/Revisions, Chairman sees only approval tasks
        pending: contracts.filter(c => {
            if (user?.role === 'Chairman') {
                return c.status.includes('Pending Chairman Approval');
            }
            return c.status.includes('Pending') || c.status.includes('Rollback') || c.status.includes('Revision');
        }).length,
        completed: contracts.filter(c => c.status === 'Closed' || c.status.includes('Approved')).length,
        attention: contracts.filter(c => c.status.includes('Rollback') || c.status.includes('Revision')).length
    };

    const handleResume = async (c) => {
        if (!window.confirm(`Are you sure you want to resume contract ${c.contract_id}? This will restart it from Stage 2 (Quality Entry) and clear all data from Stage 2 onwards.`)) return;

        try {
            await api.post(`/contracts/${encodeURIComponent(c.contract_id)}/resume`);
            fetchContracts();
        } catch (e) {
            console.error(e);
            alert('Error resuming contract: ' + (e.response?.data?.error || e.message));
        }
    };

    return (
        <div className="space-y-8">
            {/* Header & Stats */}
            <div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-5">Dashboard Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={20} /></div>
                        <div>
                            <p className="text-slate-400 text-[9px] font-semibold uppercase tracking-wider">Total</p>
                            <p className="text-xl font-semibold text-slate-900">{stats.total}</p>
                        </div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock size={20} /></div>
                        <div>
                            <p className="text-slate-400 text-[9px] font-semibold uppercase tracking-wider">Pending</p>
                            <p className="text-xl font-semibold text-slate-900">{stats.pending}</p>
                        </div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle size={20} /></div>
                        <div>
                            <p className="text-slate-400 text-[9px] font-semibold uppercase tracking-wider">Completed</p>
                            <p className="text-xl font-semibold text-slate-900">{stats.completed}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search contracts or vendors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                </div>

                <div className="flex items-center space-x-3">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">Sort By:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-900 text-[11px] rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none font-semibold cursor-pointer hover:bg-slate-100 transition-colors mr-2"
                    >
                        <option value="all">All Stages</option>
                        <option value="stage_1">Stage 1: Contract</option>
                        <option value="stage_2">Stage 2: Quality</option>
                        <option value="stage_3">Stage 3: Lot Management</option>
                        <option value="stage_4">Stage 4: CTL</option>
                        <option value="stage_5">Stage 5: Payment</option>
                    </select>

                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">Filter By:</span>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-900 text-[11px] rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none font-semibold cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Denied</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                            <th className="px-6 py-4">Contract ID</th>
                            <th className="px-6 py-4">Lot No</th>
                            <th className="px-6 py-4">Vendor</th>
                            <th className="px-6 py-4">GST No</th>
                            <th className="px-6 py-4">Progress</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedContracts.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center">
                                        <div className="p-4 bg-slate-50 text-slate-300 rounded-full mb-4">
                                            <Search size={40} />
                                        </div>
                                        <h3 className="text-slate-900 font-bold text-lg mb-1">No contracts found</h3>
                                        <p className="text-slate-500 text-xs">Try adjusting your filters or search term to find what you're looking for.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            sortedContracts.map((c, idx) => (
                                <tr key={`${c.contract_id}-${c.lot_id || 'main'}-${idx}`}
                                    className={`transition-colors group cursor-default ${c.lot_id
                                        ? 'bg-slate-50/60 hover:bg-indigo-50/30 border-l-2 border-l-indigo-100'
                                        : 'hover:bg-indigo-50/20'
                                        }`}>
                                    <td className="px-6 py-3.5 font-mono font-semibold tracking-tight"><span className="text-indigo-600 text-base font-bold">{c.contract_id}</span></td>
                                    <td className="px-6 py-3.5 font-mono text-slate-600 font-semibold text-xs text-center">
                                        {c.lot_id ? (
                                            <span className="bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md text-indigo-700 font-bold uppercase shadow-sm">
                                                {c.lot_number}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 font-bold">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3.5 font-semibold text-slate-800 text-sm tracking-tight capitalize">
                                        <div className="flex flex-col">
                                            <span>{c.vendor_name}</span>
                                            {c.is_privileged === 1 && (
                                                <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700 mt-1 uppercase tracking-tighter">
                                                    Privileged Vendor
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5 text-slate-400 font-mono text-xs">{c.gst_number || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-1">
                                            {(() => {
                                                const steps = c.is_privileged === 1
                                                    ? [
                                                        { id: 1, label: 'Contract' },
                                                        { id: 2, label: 'Quality' },
                                                        { id: 5, label: 'Payment' },
                                                        { id: 3, label: 'Lot' },
                                                        { id: 4, label: 'CTL' }
                                                    ]
                                                    : [
                                                        { id: 1, label: 'Contract' },
                                                        { id: 2, label: 'Quality' },
                                                        { id: 3, label: 'Lot' },
                                                        { id: 4, label: 'CTL' },
                                                        { id: 5, label: 'Payment' }
                                                    ];

                                                return steps.map((step, idx, arr) => {
                                                    let isPast = false;
                                                    const currentStage = c.stage;

                                                    if (currentStage === 6) {
                                                        isPast = true;
                                                    } else {
                                                        // Get the index of the current stage in the active steps array
                                                        const currentOrderIdx = steps.findIndex(s => s.id === currentStage);
                                                        const stepOrderIdx = idx;

                                                        // If we didn't find the current stage (shouldn't happen), assume it's past if stage number is greater?
                                                        // No, better to be explicit.
                                                        if (currentOrderIdx === -1) {
                                                            isPast = currentStage > step.id;
                                                        } else {
                                                            isPast = currentOrderIdx > stepOrderIdx;
                                                        }
                                                    }

                                                    const isCurrent = step.id === currentStage;
                                                    const isFuture = !isPast && !isCurrent;

                                                    let boxClass = 'border border-slate-200 bg-white text-slate-400';
                                                    if (isPast) boxClass = 'border border-emerald-200 bg-emerald-50 text-emerald-600';
                                                    if (isCurrent) boxClass = 'border border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold';
                                                    if (isFuture) boxClass = 'border border-slate-100 bg-slate-50/50 text-slate-300 opacity-60 cursor-not-allowed';

                                                    return (
                                                        <React.Fragment key={step.id}>
                                                            <button
                                                                onClick={(e) => !isFuture && handleStageClick(e, c, step.id)}
                                                                disabled={isFuture}
                                                                className={`px-1.5 py-0.5 rounded-md text-[10px] tracking-wide ${boxClass} transition-all whitespace-nowrap ${!isFuture ? 'hover:opacity-80 hover:scale-105 active:scale-95 cursor-pointer' : ''}`}
                                                                title={isFuture ? 'Complete previous stages first' : `Go to ${step.label}`}
                                                            >
                                                                {step.label.toLowerCase()}
                                                            </button>
                                                            {idx < arr.length - 1 && (
                                                                <ChevronRight
                                                                    size={9}
                                                                    className={`mx-0.5 shrink-0 ${isPast ? 'text-emerald-300' : 'text-slate-200'}`}
                                                                />
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                });
                                            })()}
                                        </div>
                                        <div className="mt-1 flex items-center gap-2">
                                            {(c.status.includes('Rollback') || c.status.includes('Rejected') || c.status.includes('Revision') || c.status.includes('Modify')) && (
                                                <span className="text-[10px] font-semibold text-rose-600 flex items-center gap-1">
                                                    <AlertTriangle size={10} /> {c.status}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        {c.status.includes('Rejected') && user?.role === 'Manager' && (
                                            <button
                                                onClick={() => handleResume(c)}
                                                className="inline-flex items-center px-3 py-1.5 border border-emerald-100 text-xs font-semibold rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all shadow-sm group"
                                            >
                                                <RotateCcw size={14} className="mr-1.5 group-hover:-rotate-90 transition-transform" />
                                                Resume
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleAction(c)}
                                            className="inline-flex items-center px-3 py-1.5 border border-indigo-100 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white transition-all shadow-sm group"
                                        >
                                            View
                                            <ArrowRight size={14} className="ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
