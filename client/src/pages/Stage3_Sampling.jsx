import React, { useState, useEffect } from 'react';
import api from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Box, Calendar, Hash, Scale, AlertCircle, CheckCircle, FileText, ArrowRight, MessageSquare, Eye, X } from 'lucide-react';
import PDFModal from '../components/PDFModal';
import { getFullUrl } from '../utils/urls';

export default function Stage3_Sampling() {
    const params = useParams();

    // Robust decoding for IDs with slashes/special chars
    const safeDecode = (val) => {
        if (!val) return val;
        // Support both old double-encoded and new --- substituted IDs
        const unslug = val.split('---').join('/');
        try {
            return decodeURIComponent(decodeURIComponent(unslug));
        } catch (e) {
            try {
                return decodeURIComponent(unslug);
            } catch (e2) {
                return unslug;
            }
        }
    };

    const id = safeDecode(params.id);
    const navigate = useNavigate();
    const { user } = useAuth();
    const [contract, setContract] = useState(null);
    const [lots, setLots] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // New Lot Form State
    const [newLot, setNewLot] = useState({
        lot_number: '',
        arrival_date: new Date().toISOString().split('T')[0],
        sequence_start_num: '',
        no_of_samples: '',
        no_of_bales: '',
        stage3_remarks: ''
    });

    const resetForm = () => {
        setNewLot({ lot_number: '', arrival_date: new Date().toISOString().split('T')[0], sequence_start_num: '', no_of_samples: '', no_of_bales: '', stage3_remarks: '' });
    };

    const [sequenceConflict, setSequenceConflict] = useState(null);
    const [viewDocUrl, setViewDocUrl] = useState(null);
    const [isArrived, setIsArrived] = useState(false);

    useEffect(() => {
        fetchContractAndLots();
    }, [id]);

    // Check Sequence Conflict
    useEffect(() => {
        const checkConflict = async () => {
            if (newLot.sequence_start_num && newLot.no_of_samples && newLot.arrival_date) {
                try {
                    const res = await api.get('/check-sequence', {
                        params: {
                            start: newLot.sequence_start_num,
                            samples: newLot.no_of_samples,
                            arrival_date: newLot.arrival_date
                        }
                    });
                    if (res.data.exists) {
                        setSequenceConflict(res.data.conflicts);
                    } else {
                        setSequenceConflict(null);
                    }
                } catch (e) {
                    console.error("Sequence check error:", e);
                }
            } else {
                setSequenceConflict(null);
            }
        };

        const timer = setTimeout(checkConflict, 500); // Debounce
        return () => clearTimeout(timer);
    }, [newLot.sequence_start_num, newLot.no_of_samples, newLot.arrival_date]);

    const fetchContractAndLots = async () => {
        try {
            setLoading(true);
            const safeId = encodeURIComponent(id);
            const res = await api.get(`/ contracts / ${safeId} `);
            setContract(res.data);

            // NAVIGATION GUARD
            const workflow = Boolean(res.data.is_privileged) ? [1, 2, 5, 3, 4] : [1, 2, 3, 4, 5];
            const currentIdx = workflow.indexOf(res.data.stage === 6 ? 6 : res.data.stage);
            const targetIdx = workflow.indexOf(3);

            if (currentIdx === -1 || currentIdx < targetIdx) {
                const prevStage = res.data.is_privileged === 1 ? "Payment (Stage 5)" : "Quality (Stage 2)";
                alert(`This contract is not yet ready for Lot Entry. Please complete ${prevStage} approval first.`);
                navigate('/dashboard');
                return;
            }
            setLots(res.data.lots || []);
            if (res.data.lots && res.data.lots.length > 0) {
                setIsArrived(true);
            }

            // Auto-calculate next sequence start
            if (res.data.lots && res.data.lots.length > 0) {
                const maxEnd = res.data.lots.reduce((max, lot) => {
                    // Extract number from "150/25-26" -> 150
                    const numPart = lot.sequence_end ? parseInt(lot.sequence_end.split('/')[0]) : 0;
                    return numPart > max ? numPart : max;
                }, 0);

                setNewLot(prev => ({
                    ...prev,
                    sequence_start_num: maxEnd + 1
                }));
            } else {
                setNewLot(prev => ({ ...prev, sequence_start_num: '1' }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Financial Year Helper
    const getFinancialYearSuffix = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const month = date.getMonth();
        const year = date.getFullYear();
        let startYear = year;
        if (month < 3) startYear = year - 1;
        return `/ ${startYear} -${startYear + 1} `;
    };

    const calculateEnd = (start, count) => {
        if (!start || !count) return '';
        return parseInt(start) + parseInt(count) - 1;
    };

    const handleInputsChange = (e) => {
        setNewLot({ ...newLot, [e.target.name]: e.target.value });
    };

    const handleAddLot = async (e) => {
        e.preventDefault();
        try {
            const fySuffix = getFinancialYearSuffix(newLot.arrival_date);
            const startFormat = `${newLot.sequence_start_num}${fySuffix} `;
            const endNum = calculateEnd(newLot.sequence_start_num, newLot.no_of_samples);
            const endFormat = endNum ? `${endNum}${fySuffix} ` : '';

            const payload = [{
                lot_number: newLot.lot_number,
                arrival_date: newLot.arrival_date,
                sequence_start: startFormat,
                sequence_end: endFormat,
                no_of_samples: parseInt(newLot.no_of_samples),
                no_of_bales: parseInt(newLot.no_of_bales),
                stage3_remarks: newLot.stage3_remarks
            }];

            await api.post(`/ contracts / ${encodeURIComponent(id)}/stage3`, { lots: payload });
            setShowAddModal(false);
            fetchContractAndLots(); // Refresh list

            // Reset form but keep date
            setNewLot(prev => ({
                lot_number: '',
                arrival_date: prev.arrival_date,
                sequence_start_num: endNum + 1, // Suggest next
                no_of_samples: '',
                no_of_bales: '',
                stage3_remarks: ''
            }));

        } catch (e) {
            alert(e.response?.data?.error || "Error adding lot");
        }
    };

    // Navigation Enforcement
    useEffect(() => {
        if (!loading && contract) {
            // Chairman has no role in Stage 3 (Lot Entry) — redirect to dashboard
            if (user.role === 'Chairman') {
                console.log("Access Denied: Chairman cannot access Lot Entry (Stage 3)");
                navigate('/dashboard');
                return;
            }

            const isPrivileged = contract.is_privileged === 1;
            if (isPrivileged) {
                // Privileged: Must have Stage 5 Approved
                if (contract.stage5Decision?.decision !== 'Approve') {
                    console.log("Access Denied: Stage 5 not approved for privileged vendor");
                    navigate('/dashboard');
                }
            } else {
                // Normal: Must have Stage 2 Approved
                if (contract.stage2Decision?.decision !== 'Approve') {
                    console.log("Access Denied: Stage 2 not approved for normal vendor");
                    navigate('/dashboard');
                }
            }
        }
    }, [loading, contract, navigate, user.role]);

    if (loading) return <div className="p-10 text-center text-slate-500">Loading Contract Data...</div>;
    if (!contract) return <div className="p-10 text-center text-red-500">Contract not found</div>;

    const isManager = user.role === 'Manager';
    const totalBales = contract.quantity || 0;
    const currentBales = (lots || []).reduce((acc, lot) => acc + (Number(lot.no_of_bales) || 0), 0);
    const remainingBales = totalBales - currentBales;
    const progressPercent = totalBales > 0 ? Math.min(100, Math.round((currentBales / totalBales) * 100)) : 0;
    const isComplete = currentBales >= totalBales && totalBales > 0;

    // Show management view if user clicked "Lot Arrived" or if lots already exist (set in fetch)
    const showManagement = isArrived;

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-semibold text-slate-900">Lot Management</h2>
                    <p className="text-slate-500 mt-1">Manage arrival lots for Contract <span className="font-mono font-semibold text-indigo-600">{contract.contract_id}</span></p>
                </div>
                <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-slate-700 font-medium text-xs">
                    Back to Dashboard
                </button>
            </div>

            {/* Top Stats Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="md:col-span-2 grid grid-cols-2 gap-6">
                    <div>
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vendor</span>
                        <span className="font-semibold text-slate-900 block text-lg">{contract.vendor_name}</span>
                        <span className="text-xs text-slate-400 font-mono mt-1">{contract.gst_number}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Contract Quantity</span>
                        <span className="font-semibold text-slate-900 block text-3xl">{contract.quantity} <span className="text-xs text-slate-500 font-medium">Bales</span></span>
                    </div>
                </div>

                {/* Progress Circle/Bar */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
                    <div className="flex justify-between w-full mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <span>Progress</span>
                        <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 mb-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <div className="text-xs font-medium text-slate-700">
                        <span className={isComplete ? "text-emerald-600 font-semibold" : "text-indigo-600 font-semibold"}>{currentBales}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        {totalBales} Bales
                    </div>
                    {remainingBales > 0 && (
                        <div className="text-xs text-amber-600 font-medium mt-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            {remainingBales} more to go
                        </div>
                    )}
                    {isComplete && (
                        <div className="text-xs text-emerald-600 font-semibold mt-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                            <CheckCircle size={16} /> Complete
                        </div>
                    )}
                </div>
            </div>

            {!showManagement ? (
                /* STEP 1: Arrival Landing View */
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Quality Details Card (from Stage 2) */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="text-teal-600" size={20} /> Pre-Arrival Quality Review
                            </h3>
                            <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm uppercase tracking-tighter">Reference: Stage 2</span>
                        </div>
                        <div className="p-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                                {[
                                    { label: 'UHML', value: contract.stage2?.uhml, unit: 'mm' },
                                    { label: 'UI', value: contract.stage2?.ui, unit: '%' },
                                    { label: 'Strength', value: contract.stage2?.strength, unit: 'gpt' },
                                    { label: 'Mic', value: contract.stage2?.mic, unit: '' },
                                    { label: 'Rd', value: contract.stage2?.rd, unit: '' },
                                    { label: '+b', value: contract.stage2?.plus_b, unit: '' },
                                    { label: 'Trash', value: contract.stage2?.trash, unit: '%' },
                                ].map((item, idx) => (
                                    <div key={idx} className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 hover:border-teal-100 hover:bg-teal-50/30 transition-colors">
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</span>
                                        <span className="text-lg font-mono font-bold text-slate-900 leading-none">
                                            {item.value || '-'}<span className="text-[10px] ml-0.5 text-slate-400 normal-case">{item.unit}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="bg-white border-2 border-indigo-100 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>

                        {/* Left Side: Chairman Instructions */}
                        <div className="flex-grow">
                            {(() => {
                                const isPrivileged = contract.is_privileged === 1;
                                const prevDecision = isPrivileged ? contract.stage5Decision : contract.stage2Decision;
                                const stageLabel = isPrivileged ? "Payment Approval" : "Quality Review";

                                if (prevDecision?.remarks) {
                                    return (
                                        <div className="flex items-start gap-4">
                                            <div className="bg-teal-100 text-teal-700 rounded-full p-2.5 flex-shrink-0">
                                                <MessageSquare size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-1">Chairman Instructions: {stageLabel}</h4>
                                                <p className="text-slate-600 italic text-base leading-relaxed max-w-2xl">
                                                    "{prevDecision.remarks}"
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <AlertCircle size={20} />
                                        <span className="font-medium">No specific instructions from Chairman</span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Right Side: Actions */}
                        <div className="flex flex-wrap items-center gap-4 flex-shrink-0 border-l border-slate-100 pl-6 h-full">
                            <div className="flex flex-col gap-2">
                                {contract.document_path && (
                                    <button
                                        onClick={() => setViewDocUrl(getFullUrl(contract.document_path))}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all shadow-sm"
                                    >
                                        <Eye size={16} /> View Contract
                                    </button>
                                )}
                                {contract.stage2?.report_document_path && (
                                    <button
                                        onClick={() => setViewDocUrl(getFullUrl(contract.stage2.report_document_path))}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-all shadow-sm"
                                    >
                                        <Eye size={16} /> View QC Report
                                    </button>
                                )}
                            </div>

                            {isManager && remainingBales > 0 && (
                                <button
                                    onClick={() => setIsArrived(true)}
                                    className="bg-indigo-600 hover:bg-slate-900 text-white font-black py-5 px-10 rounded-2xl shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center gap-4 text-xl group"
                                >
                                    <span className="bg-white/20 p-2 rounded-xl group-hover:rotate-12 transition-transform">
                                        <CheckCircle size={28} strokeWidth={3} />
                                    </span>
                                    Lot Arrived
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* STEP 2: Lot Management View */
                <div className="animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsArrived(false)}
                                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                                title="Back to Arrival Details"
                            >
                                <ArrowRight className="rotate-180" size={20} />
                            </button>
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Box className="text-indigo-600" /> Lot Management
                                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-200">{lots.length}</span>
                            </h3>
                        </div>
                        {isManager && remainingBales > 0 && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                            >
                                <Plus size={20} /> Add New Lot
                            </button>
                        )}
                    </div>

                    {/* Lots Grid */}
                    {lots.length === 0 ? (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-20 text-center">
                            <div className="bg-white w-20 h-20 rounded-2xl rotate-3 flex items-center justify-center mx-auto mb-6 shadow-sm text-slate-300 border border-slate-100">
                                <Box size={32} />
                            </div>
                            <h3 className="text-slate-900 font-bold text-xl mb-2">No lots arrived yet</h3>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto mb-8">Click the button above to record the first lot arrival for this contract.</p>
                            {isManager && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="bg-white text-indigo-600 border border-indigo-200 font-bold py-3 px-8 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                                >
                                    Add First Lot Entry
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {lots.map((lot, idx) => (
                                <div key={lot.lot_id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col h-full">
                                    <div className="absolute top-0 right-0 bg-slate-50 border-bl border-slate-100 px-4 py-1.5 rounded-bl-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Lot #{idx + 1}
                                    </div>

                                    <div className="flex items-start gap-5 mb-6">
                                        <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 transition-transform group-hover:scale-110">
                                            <Box size={28} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-xl tracking-tight">{lot.lot_number}</h4>
                                            <div className="flex items-center text-xs font-medium text-slate-400 mt-1">
                                                <Calendar size={14} className="mr-1.5" /> {lot.arrival_date ? lot.arrival_date.split('T')[0] : '-'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-xl border border-slate-50">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bales</span>
                                            <span className="font-black text-slate-900 text-lg">{lot.no_of_bales}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-indigo-50/30 p-2.5 rounded-xl border border-indigo-50/50">
                                                <span className="block text-[8px] font-black text-indigo-400 uppercase mb-1">Samples</span>
                                                <span className="font-bold text-indigo-600 text-sm">{lot.no_of_samples}</span>
                                            </div>
                                            <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                                <span className="block text-[8px] font-black text-slate-400 uppercase mb-1">Sequence</span>
                                                <span className="font-mono font-bold text-slate-700 text-[10px] tracking-tighter truncate block">{lot.sequence_start} - {lot.sequence_end}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-5 border-t border-slate-50 flex justify-between items-center gap-4">
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${(lot.status || '').includes('Approved') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            (lot.status || '').includes('Rejected') ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                'bg-amber-50 text-amber-600 border-amber-100'
                                            }`}>
                                            {lot.status || 'Pending'}
                                        </div>

                                        <button
                                            onClick={() => {
                                                const safeId = encodeURIComponent(id.replaceAll('/', '---'));
                                                if (lot.stage === 5 || (lot.s4Decision && lot.s4Decision.decision === 'Approve')) {
                                                    navigate(`/contracts/${safeId}/lots/${lot.lot_id}/stage5`);
                                                } else {
                                                    navigate(`/contracts/${safeId}/lots/${lot.lot_id}/stage4`);
                                                }
                                            }}
                                            className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
                                        >
                                            {lot.stage >= 5 ? 'Payment' : 'CTL Entry'}
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Lot Modal Integration */}
                    {showAddModal && (
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-xl text-slate-900">New Lot Arrival</h3>
                                        <p className="text-xs text-slate-400 font-medium">Capture incoming material details</p>
                                    </div>
                                    <button onClick={() => setShowAddModal(false)} className="bg-white p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 transition-all shadow-sm">
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleAddLot} className="p-8">
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Lot Identifer</label>
                                                <input
                                                    type="text"
                                                    name="lot_number"
                                                    value={newLot.lot_number}
                                                    onChange={handleInputsChange}
                                                    required
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold tracking-tight"
                                                    placeholder="e.g. BAL-001"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Arrival Date</label>
                                                <input
                                                    type="date"
                                                    name="arrival_date"
                                                    value={newLot.arrival_date}
                                                    onChange={handleInputsChange}
                                                    required
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Quantity (Bales)</label>
                                                <div className="relative group">
                                                    <input
                                                        type="number"
                                                        name="no_of_bales"
                                                        value={newLot.no_of_bales}
                                                        onChange={handleInputsChange}
                                                        required
                                                        min="1"
                                                        max={remainingBales}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 pl-11 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-slate-900"
                                                        placeholder={`Max ${remainingBales}`}
                                                    />
                                                    <Box size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Lab Samples</label>
                                                <div className="relative group">
                                                    <input
                                                        type="number"
                                                        name="no_of_samples"
                                                        value={newLot.no_of_samples}
                                                        onChange={handleInputsChange}
                                                        required
                                                        min="1"
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 pl-11 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-indigo-600"
                                                        placeholder="e.g. 5"
                                                    />
                                                    <Scale size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Sequence Range (Start)</label>
                                            <div className="relative group">
                                                <input
                                                    type="number"
                                                    name="sequence_start_num"
                                                    value={newLot.sequence_start_num}
                                                    onChange={handleInputsChange}
                                                    required
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 pl-11 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-mono font-bold text-slate-700"
                                                    placeholder="e.g. 1001"
                                                />
                                                <Hash size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                                {newLot.arrival_date && (
                                                    <div className="absolute right-3 top-3.5 bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-lg border border-slate-300">
                                                        {getFinancialYearSuffix(newLot.arrival_date)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {newLot.sequence_start_num && newLot.no_of_samples && (
                                            <div className="bg-indigo-600 rounded-2xl p-4 shadow-lg shadow-indigo-500/20 animate-in slide-in-from-top-2">
                                                <div className="flex justify-between items-center text-white/70 text-[10px] uppercase font-black tracking-widest mb-1">
                                                    <span>Computed Range End</span>
                                                    <CheckCircle size={12} className="text-white" />
                                                </div>
                                                <p className="text-xl font-mono font-black text-white">
                                                    {calculateEnd(newLot.sequence_start_num, newLot.no_of_samples)}{getFinancialYearSuffix(newLot.arrival_date)}
                                                </p>
                                            </div>
                                        )}

                                        {sequenceConflict && sequenceConflict.length > 0 && (
                                            <div className="bg-rose-50 border-2 border-rose-100 rounded-2xl p-5 flex items-start gap-4">
                                                <AlertCircle size={24} className="text-rose-600 flex-shrink-0" />
                                                <div>
                                                    <p className="text-rose-900 font-black text-xs uppercase tracking-tight mb-2">Sequence Overlap Detected</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {sequenceConflict.slice(0, 3).map((c, i) => (
                                                            <span key={i} className="bg-rose-500 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                                                                {c.sequence}
                                                            </span>
                                                        ))}
                                                        {sequenceConflict.length > 3 && <span className="text-[10px] text-rose-400 pt-1 font-bold">+ {sequenceConflict.length - 3} more</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-10 flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddModal(false)}
                                            className="flex-1 px-6 py-4 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 transition-colors border border-transparent"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-indigo-500/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 active:translate-y-0"
                                        >
                                            <Plus size={24} strokeWidth={3} /> Record Lot Arrival
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
            <PDFModal isOpen={!!viewDocUrl} onClose={() => setViewDocUrl(null)} fileUrl={viewDocUrl} />
        </div >
    );
}
