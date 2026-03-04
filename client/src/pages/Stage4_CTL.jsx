import React, { useState, useEffect } from 'react';
import api from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Check, X, Eye, RotateCcw, MessageSquare, AlertCircle } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import PDFModal from '../components/PDFModal';
import { getFullUrl } from '../utils/urls';


const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
};

export default function Stage4_CTL() {
    console.log("Stage4_CTL rendering...");
    const params = useParams();

    // Robust decoding for IDs with slashes/special chars
    const safeDecode = (val) => {
        if (!val) return val;
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
    const lotId = safeDecode(params.lotId);

    const navigate = useNavigate();
    const { user } = useAuth();
    const [contract, setContract] = useState(null);
    const [activeLot, setActiveLot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [docExists, setDocExists] = useState(true);

    // CTL Fields
    const [formData, setFormData] = useState({
        mic_value: '', strength: '', uhml: '', ui_percent: '', sfi: '',
        elongation: '', rd: '', plus_b: '', colour_grade: '', mat: '',
        sci: '', trash_percent: '', moisture_percent: '',
        test_date: '', confirmation_date: '', remarks: '', report_document_path: ''
    });

    const [isFileViewed, setIsFileViewed] = useState(false);

    const [trashSamples, setTrashSamples] = useState({});
    const [sequences, setSequences] = useState([]);

    // Valid fields for iteration
    const fieldOrder = [
        'test_date', 'confirmation_date',
        'mic_value', 'strength', 'uhml', 'ui_percent', 'sfi',
        'elongation', 'rd', 'plus_b', 'mat',
        'moisture_percent', 'remarks'
    ];

    const [approvalData, setApprovalData] = useState({ decision: 'Approve', remarks: '' });
    const [viewDocUrl, setViewDocUrl] = useState(null);
    const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchContract();
    }, [id, lotId]);


    const fetchContract = async () => {
        try {
            const safeId = encodeURIComponent(id);
            const res = await api.get(`/contracts/${safeId}`);
            setContract(res.data);

            // NAVIGATION GUARD — skip for Chairman (they review all submissions)
            if (user.role !== 'Chairman') {
                const workflow = Boolean(res.data.is_privileged) ? [1, 2, 5, 3, 4] : [1, 2, 3, 4, 5];
                const currentIdx = workflow.indexOf(res.data.stage === 6 ? 6 : res.data.stage);

                if (currentIdx === -1 || currentIdx < workflow.indexOf(3)) {
                    const prevStage = Boolean(res.data.is_privileged) ? "Quality (Stage 2)" : "Lot Entry (Stage 3)";
                    alert(`This contract/lot is not yet ready for CTL Entry. Please complete ${prevStage} first.`);
                    navigate('/dashboard');
                    return;
                }
            }

            // Find Active Lot
            if (res.data.lots && lotId) {
                const foundLot = res.data.lots.find(l => l.lot_id.toString() === lotId.toString());
                if (foundLot) {
                    setActiveLot(foundLot);

                    // Populate Form
                    setFormData({
                        mic_value: foundLot.mic_value || '',
                        strength: foundLot.strength || '',
                        uhml: foundLot.uhml || '',
                        ui_percent: foundLot.ui_percent || '',
                        sfi: foundLot.sfi || '',
                        elongation: foundLot.elongation || '',
                        rd: foundLot.rd || '',
                        plus_b: foundLot.plus_b || '',
                        colour_grade: foundLot.colour_grade || '',
                        mat: foundLot.mat || '',
                        sci: foundLot.sci || '',
                        trash_percent: foundLot.trash_percent || '',
                        moisture_percent: foundLot.moisture_percent || '',
                        test_date: foundLot.test_date ? foundLot.test_date.split('T')[0] : '',
                        confirmation_date: foundLot.confirmation_date ? foundLot.confirmation_date.split('T')[0] : '',
                        remarks: foundLot.stage4_remarks || '',
                        report_document_path: foundLot.report_document_path || ''
                    });

                    // Trash Samples
                    if (foundLot.trash_percent_samples) {
                        try {
                            setTrashSamples(JSON.parse(foundLot.trash_percent_samples));
                        } catch (e) { setTrashSamples({}); }
                    }

                    // Generate Sequences
                    generateSequences(foundLot);
                }
            }
        } catch (e) {
            console.error(e);
            setError("Failed to fetch contract data. " + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    const generateSequences = (lot) => {
        if (lot.sequence_start && lot.no_of_samples) {
            // Parse start number from formatted string (e.g. "101/25-26" -> 101)
            const parts = lot.sequence_start.split('/');
            let start = parseInt(parts[0]);
            const count = parseInt(lot.no_of_samples);

            // Fallback if start is missing (e.g. "/25-26")
            if (isNaN(start)) start = 1;

            if (!isNaN(start) && count > 0) {
                const seqs = [];
                for (let i = 0; i < count; i++) {
                    const num = start + i;
                    seqs.push({ num: num, label: `Seq ${num}` });
                }
                setSequences(seqs);
            }
        } else if (lot.no_of_samples) {
            // Fallback if sequence_start is completely missing but we have count
            const count = parseInt(lot.no_of_samples);
            if (count > 0) {
                const seqs = [];
                for (let i = 0; i < count; i++) {
                    const num = i + 1;
                    seqs.push({ num: num, label: `Seq ${num}` });
                }
                setSequences(seqs);
            }
        }
    };

    // REMOVED SCI AUTO-CALC EFFECT

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Prevent negative values for numeric fields
        const numericFields = ['mic_value', 'strength', 'uhml', 'ui_percent', 'sfi', 'elongation', 'rd', 'plus_b', 'mat', 'sci', 'trash_percent', 'moisture_percent'];
        if (numericFields.includes(name)) {
            const numValue = parseFloat(value);
            if (value === '' || numValue < 0) {
                return; // Don't allow negative values
            }
        }

        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleTrashChange = (seq, val) => {
        setTrashSamples(prev => ({ ...prev, [seq]: val }));
    };

    const handleDocumentUpload = (path) => {
        setFormData(prev => ({ ...prev, report_document_path: path }));
        setIsFileViewed(false); // Reset
    };

    const calculateAvgTrash = () => {
        const values = Object.values(trashSamples).filter(v => v !== '' && !isNaN(parseFloat(v)));
        if (values.length === 0) return 0;
        const sum = values.reduce((acc, curr) => acc + parseFloat(curr), 0);
        return (sum / values.length).toFixed(2);
    };

    const handleFileView = () => {
        setIsFileViewed(true);
    };

    const handleSubmitManager = async (e) => {
        e.preventDefault();
        try {
            const calculatedAvg = calculateAvgTrash();
            await api.post(`/contracts/${encodeURIComponent(id)}/lots/${lotId}/stage4`, {
                ...formData,
                trash_percent: calculatedAvg,
                trash_percent_samples: JSON.stringify(trashSamples)
            });
            fetchContract();
            navigate('/dashboard');
        } catch (e) { alert(e.response?.data?.error); }
    };

    const handleSubmitChairman = async (decision) => {
        try {
            await api.post(`/contracts/${encodeURIComponent(id)}/lots/${lotId}/stage4/decision`, { decision, remarks: approvalData.remarks });
            navigate('/dashboard');
        } catch (e) { alert(e.response?.data?.error); }
    };


    useEffect(() => {
        const checkDoc = async () => {
            const path = activeLot?.report_document_path;
            if (path) {
                try {
                    const url = getFullUrl(path);
                    const res = await fetch(url, { method: 'HEAD' });
                    setDocExists(res.ok);
                } catch (e) {
                    setDocExists(false);
                }
            } else {
                setDocExists(false);
            }
        };
        checkDoc();
    }, [activeLot]);

    console.log("Stage4 state:", { loading, error, hasContract: !!contract, hasLot: !!activeLot });

    // Navigation Enforcement
    useEffect(() => {
        if (!loading && contract) {
            // Chairman can always view CTL pages — no redirect
            if (user.role === 'Chairman') return;

            const isPrivileged = Boolean(contract.is_privileged);
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
    }, [loading, contract, navigate]);

    if (loading) return <div className="p-10 text-center flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-500 font-medium">Loading Lot Data...</p>
    </div>;

    if (error) return <div className="p-10 text-center">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 max-w-md mx-auto">
            <X size={48} className="text-rose-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-rose-900 mb-2">Error Loading Page</h3>
            <p className="text-rose-700 mb-6">{error}</p>
            <button onClick={() => navigate('/dashboard')} className="bg-rose-600 text-white px-6 py-2 rounded-xl font-bold">Back to Dashboard</button>
        </div>
    </div>;

    if (!contract || !activeLot) return <div className="p-10 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-md mx-auto">
            <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-amber-900 mb-2">Lot Not Found</h3>
            <p className="text-amber-700 mb-6">We couldn't find the specific lot details for this contract.</p>
            <button onClick={() => navigate('/dashboard')} className="bg-amber-600 text-white px-6 py-2 rounded-xl font-bold">Back to Dashboard</button>
        </div>
    </div>;

    const isManager = user.role === 'Manager';
    const isChairman = user.role === 'Chairman';

    // Decisions are now at Lot Level (s4Decision)
    const isApproved = activeLot.s4Decision?.decision === 'Approve';
    const isPendingApproval = activeLot.mic_value && !isApproved; // If mic_value exists, Manager submitted.

    if (isChairman) {
        const docUrl = getFullUrl(activeLot.report_document_path);

        return (
            <div className="mx-auto pb-10 flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">
                            CTL Approval - Lot {activeLot.lot_number}
                        </h2>
                    </div>
                    <div>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${isApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : (activeLot.s4Decision?.decision === 'Reject' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700')}`}>
                            {activeLot.s4Decision?.decision || 'Pending Approval'}
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6 items-start flex-shrink-0">
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vendor</span>
                        <span className="font-semibold text-slate-900 block">{contract.vendor_name}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contract ID</span>
                        <span className="font-mono font-semibold text-indigo-600 block">{contract.contract_id}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GST Number</span>
                        <span className="font-mono text-slate-700 block text-xs">{contract.gst_number || '-'}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact</span>
                        <span className="font-mono text-slate-700 block text-xs">{contract.phone_number || '-'}</span>
                    </div>
                </div>

                {/* Main Content Area - Vertical Stack Layout */}
                <div className="grid grid-cols-1 gap-6 mb-8">

                    {/* TOP Panel: PDF Viewer - Large */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[800px] relative group">
                        <div className="flex-grow relative bg-slate-50">
                            {(docUrl && docExists) ? (
                                <iframe src={docUrl} className="w-full h-full bg-white" title="CTL Report" />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <Eye size={42} className="mb-2 opacity-30" />
                                    <span className="font-medium text-base">{docExists === false ? "Document not found on server" : "No Document Available"}</span>
                                </div>
                            )}
                            {/* Eye Link */}
                            {docUrl && (
                                <a href={docUrl} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-white/90 hover:bg-white p-2 rounded-lg text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-slate-200">
                                    <Eye size={22} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* BOTTOM Panel: Data & Actions - Large Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col">
                        <div className="flex-shrink-0 border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-xl font-bold text-slate-800">CTL Parameters</h3>
                        </div>

                        {/* Data Display */}
                        <div className="space-y-6 flex-grow">
                            {/* Previous Remarks Section for Chairman */}
                            {(() => {
                                const isPrivileged = Boolean(contract.is_privileged);
                                const prevDecision = isPrivileged ? contract.stage5Decision : contract.stage2Decision;
                                const stageLabel = isPrivileged ? "Payment Audit" : "Quality Review";

                                if (prevDecision?.remarks) {
                                    return (
                                        <div className="mb-6 bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                                            <MessageSquare size={20} className="text-teal-600 mt-1 flex-shrink-0" />
                                            <div>
                                                <h4 className="font-bold text-teal-900 text-[10px] uppercase tracking-wider mb-1">Preceding Remarks: {stageLabel}</h4>
                                                <p className="text-teal-800 text-sm italic leading-relaxed">"{prevDecision.remarks}"</p>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {fieldOrder.map(key => (
                                    <div key={key} className={key === 'remarks' ? 'col-span-1 md:col-span-2' : ''}>
                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                                            {key === 'remarks' ? 'Manager Remark' : key.replace(/_/g, ' ')}
                                        </label>
                                        <div className="text-slate-900 font-medium border-b border-slate-100 pb-1">
                                            {key.includes('date') ? formatDate(formData[key]) : (formData[key] || '-')}
                                        </div>
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">SCI</label>
                                    <div className="text-slate-900 font-medium border-b border-slate-100 pb-1">
                                        {formData.sci || '-'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Colour Grade</label>
                                    <div className="text-slate-900 font-medium border-b border-slate-100 pb-1">
                                        {formData.colour_grade || '-'}
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Avg Trash %</label>
                                    <div className="text-slate-900 font-bold border-b border-slate-100 pb-1 flex items-center gap-2">
                                        {calculateAvgTrash()}%
                                        <span className="text-[10px] text-slate-400 font-normal">(Auto-calculated)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Individual Trash Percentages */}
                            {Object.keys(trashSamples).length > 0 && (
                                <div className="mt-8 pt-6 border-t border-slate-100">
                                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        Individual Trash % Analysis
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                        {sequences.map(seq => (
                                            <div
                                                key={seq.num}
                                                className="bg-slate-50 border border-slate-100 rounded-xl p-3 hover:bg-white hover:border-indigo-200 transition-all hover:shadow-md cursor-default group/seq"
                                            >
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 group-hover/seq:text-indigo-400">{seq.label}</div>
                                                <div className={`text-xl font-mono font-bold ${trashSamples[seq.num] != null
                                                    ? 'text-slate-900'
                                                    : 'text-slate-200'
                                                    }`}>
                                                    {trashSamples[seq.num] != null ? `${trashSamples[seq.num]}%` : '-'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Chairman Decision - Full Width Panel */}
                {!isApproved && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mt-6">
                        <label className="block text-base font-semibold text-slate-700 mb-3 uppercase tracking-tight">Chairman Decision & Observations</label>
                        <div className="space-y-4">
                            <textarea
                                rows="2"
                                className="w-full border border-slate-300 rounded-lg p-4 text-base focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                placeholder="Enter optional observations..."
                                value={approvalData.remarks}
                                onChange={(e) => setApprovalData({ ...approvalData, remarks: e.target.value })}
                            />
                            <div className="flex gap-4">
                                <button onClick={() => handleSubmitChairman('Reject')} className="flex-1 bg-white border-2 border-rose-200 text-rose-700 hover:bg-rose-50 px-4 py-4 rounded-xl font-semibold transition-all shadow-sm flex items-center justify-center gap-2">
                                    <X size={20} /> <span className="text-lg">Reject Lot</span>
                                </button>
                                <button onClick={() => handleSubmitChairman('Approve')} className="flex-[2] bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                                    <Check size={24} /> <span className="text-lg">Approve Lot</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Strip - Full Width */}
                {(() => {
                    const decision = activeLot.s4Decision?.decision;
                    const remarks = activeLot.s4Decision?.remarks;
                    if (decision === 'Approve') return (
                        <div className="rounded-xl border p-4 shadow-sm mt-6 bg-emerald-50 border-emerald-100">
                            <div className="flex items-center space-x-3">
                                <div className="bg-emerald-100 text-emerald-700 rounded-full p-2"><Check size={24} /></div>
                                <div>
                                    <p className="font-bold text-base text-emerald-800">CTL Results Approved</p>
                                    <p className="text-sm text-emerald-600 opacity-75">Decision recorded by Chairman</p>
                                    {remarks && (
                                        <div className="mt-2 pt-2 border-t border-emerald-100">
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">Chairman Remark</span>
                                            <p className="text-sm text-emerald-700 italic">"{remarks}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                    if (decision === 'Reject') return (
                        <div className="rounded-xl border p-4 shadow-sm mt-6 bg-rose-50 border-rose-100">
                            <div className="flex items-center space-x-3">
                                <div className="bg-rose-100 text-rose-700 rounded-full p-2"><X size={24} /></div>
                                <div>
                                    <p className="font-bold text-base text-rose-800">Rejected by Chairman</p>
                                    {remarks && (
                                        <div className="mt-2 pt-2 border-t border-rose-100">
                                            <span className="text-[10px] font-bold text-rose-600 uppercase block mb-1">Chairman Remark</span>
                                            <p className="text-sm text-rose-700 italic">"{remarks}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                    if (!decision) return (
                        <div className="rounded-xl border p-4 shadow-sm mt-6 bg-amber-50 border-amber-100">
                            <div className="flex items-center space-x-3">
                                <div className="bg-amber-100 text-amber-700 rounded-full p-2"><RotateCcw size={24} /></div>
                                <div>
                                    <p className="font-bold text-base text-amber-800">Pending Review</p>
                                    <p className="text-sm text-amber-600 opacity-75">Waiting for Chairman approval</p>
                                </div>
                            </div>
                        </div>
                    );
                    return null;
                })()}
            </div>
        );
    }

    // MANAGER VIEW
    return (
        <div className="mx-auto pb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">CTL Entry - Lot {activeLot.lot_number}</h2>
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6 items-start">
                <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vendor</span>
                    <span className="font-semibold text-slate-900 block">{contract.vendor_name}</span>
                </div>
                <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contract ID</span>
                    <span className="font-mono font-semibold text-indigo-600 block">{contract.contract_id}</span>
                </div>
                <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">GST Number</span>
                    <span className="font-mono text-slate-700 block text-xs">{contract.gst_number || '-'}</span>
                </div>
                <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contact</span>
                    <span className="font-mono text-slate-700 block text-xs">{contract.phone_number || '-'}</span>
                </div>
            </div>

            {/* Document Links */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4 items-center">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Documents:</span>
                {contract.document_path && (
                    <button
                        onClick={() => setViewDocUrl(getFullUrl(contract.document_path))}
                        className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors"
                    >
                        <Eye size={16} className="mr-2" /> View Contract Document
                    </button>
                )}
                {activeLot.report_document_path && (
                    <button
                        onClick={() => setViewDocUrl(getFullUrl(activeLot.report_document_path))}
                        className="flex items-center text-teal-600 hover:text-teal-800 font-medium text-xs bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100 hover:bg-teal-100 transition-colors"
                    >
                        <Eye size={16} className="mr-2" /> View CTL Report
                    </button>
                )}
            </div>

            <PDFModal isOpen={!!viewDocUrl} onClose={() => setViewDocUrl(null)} fileUrl={viewDocUrl} />

            {/* Previous Chairman Remarks */}
            {(() => {
                const isPrivileged = Boolean(contract.is_privileged);
                const prevDecision = isPrivileged ? contract.stage5Decision : contract.stage2Decision;
                const stageLabel = isPrivileged ? "Payment Audit" : "Quality Review";

                if (prevDecision?.remarks) {
                    return (
                        <div className="grid grid-cols-1 gap-6 mb-8">
                            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                                <MessageSquare size={20} className="text-teal-600 mt-1 flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold text-teal-900 text-sm uppercase tracking-wider mb-1">Preceding Remarks: {stageLabel}</h4>
                                    <p className="text-teal-800 text-sm italic leading-relaxed">"{prevDecision.remarks}"</p>
                                </div>
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            <form onSubmit={handleSubmitManager}>
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 ${isPendingApproval || isApproved ? 'opacity-75 pointer-events-none' : ''}`}>
                    {/* Left Card: CTL Parameters */}
                    <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-sm h-full flex flex-col">
                        <div className="border-b border-slate-100 pb-4 mb-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-800">CTL Parameters</h3>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-grow content-start">
                            {/* Basic Inputs */}
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">Mic</label>
                                <input type="number" step="0.01" name="mic_value" value={formData.mic_value} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">Strength</label>
                                <input type="number" step="0.1" name="strength" value={formData.strength} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">UHML</label>
                                <input type="number" step="0.1" name="uhml" value={formData.uhml} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">UI %</label>
                                <input type="number" step="0.1" name="ui_percent" value={formData.ui_percent} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">SFI</label>
                                <input type="number" step="0.1" name="sfi" value={formData.sfi} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">Elongation</label>
                                <input type="number" step="0.1" name="elongation" value={formData.elongation} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">Rd</label>
                                <input type="number" step="0.1" name="rd" value={formData.rd} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">+b</label>
                                <input type="number" step="0.1" name="plus_b" value={formData.plus_b} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">MAT</label>
                                <input type="number" step="0.1" name="mat" value={formData.mat} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">Grade</label>
                                <input type="text" name="colour_grade" value={formData.colour_grade} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">Moisture %</label>
                                <input type="number" step="0.1" name="moisture_percent" value={formData.moisture_percent} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                            {/* SCI Input Manually */}
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wide mb-1">SCI</label>
                                <input type="number" step="1" name="sci" value={formData.sci} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium" />
                            </div>
                        </div>
                    </div>

                    {/* Right Card: Test & Docs */}
                    <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-sm h-full flex flex-col">
                        <div className="border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Test Details & Upload</h3>
                        </div>
                        <div className="space-y-6 flex-grow">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-500 text-xs uppercase font-bold tracking-wide mb-1.5">Test Date</label>
                                    <input type="date" name="test_date" value={formData.test_date} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium" required />
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-xs uppercase font-bold tracking-wide mb-1.5">Conf. Date</label>
                                    <input type="date" name="confirmation_date" value={formData.confirmation_date} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium" required />
                                </div>
                            </div>

                            <div>
                                <FileUpload label="CTL Report Document" initialPath={formData.report_document_path} onUploadComplete={handleDocumentUpload} onVerified={handleFileView} />
                            </div>

                            <div>
                                <label className="block text-slate-500 text-xs uppercase font-bold tracking-wide mb-1.5">Manager Remarks</label>
                                <textarea name="remarks" value={formData.remarks} onChange={handleChange} placeholder="Optional remarks..." className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 h-24 font-medium"></textarea>
                            </div>

                            {activeLot.s4Decision?.remarks && (
                                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                                    <div className="flex items-center gap-2 mb-1">
                                        <RotateCcw size={14} className="text-amber-600" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Chairman Remark (Previous Decision)</span>
                                    </div>
                                    <p className="text-xs italic">"{activeLot.s4Decision.remarks}"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Trash Samples Modal Trigger & Content */}
                {sequences.length > 0 ? (
                    <>
                        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm mb-8 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Trash Percentage Details</h3>
                                <p className="text-xs text-slate-500">Enter separate trash % for all {sequences.length} sequences.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsTrashModalOpen(true)}
                                className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2"
                            >
                                <Check size={18} /> Enter Trash Details
                            </button>
                        </div>

                        {/* Modal */}
                        {isTrashModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                        <h3 className="text-lg font-bold text-slate-900">Trash % per Sequence ({sequences.length} Samples)</h3>
                                        <button
                                            type="button"
                                            onClick={() => setIsTrashModalOpen(false)}
                                            className="text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <X size={26} />
                                        </button>
                                    </div>
                                    <div className="p-8 overflow-y-auto custom-scrollbar">
                                        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                            {sequences.map(item => (
                                                <div key={item.num}>
                                                    <label className="block text-slate-500 text-[10px] font-bold mb-1">{item.label}</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={trashSamples[item.num] || ''}
                                                        onChange={(e) => handleTrashChange(item.num, e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 font-medium text-center focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setIsTrashModalOpen(false)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* Fallback for missing sequence data */
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl mb-8 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-amber-800">Trash Details Configuration</h3>
                            <p className="text-xs text-amber-600">Sequence data missing. Enter number of samples to enable Trash entry.</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Qty"
                                className="w-24 p-2 rounded-lg border border-amber-300"
                                onBlur={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (val > 0) generateSequences({ no_of_samples: val, sequence_start: '1' });
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-center pt-8 border-t border-slate-200 mt-10">
                    <button
                        type="submit"
                        disabled={formData.report_document_path && !isFileViewed}
                        className={`w-full max-w-2xl px-6 py-5 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3 text-xl ${formData.report_document_path && !isFileViewed
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-indigo-600 hover:bg-slate-900 text-white hover:shadow-indigo-500/30 active:scale-[0.98]'
                            }`}
                    >
                        <Check size={28} /> {formData.report_document_path && !isFileViewed ? 'View Document to Submit' : 'Submit CTL Results'}
                    </button>
                </div>
            </form>
        </div >
    );
}
