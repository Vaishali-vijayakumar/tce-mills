import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Check, X, Eye, RotateCcw, MessageSquare, AlertCircle } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { getFullUrl } from '../utils/urls';


const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
};

export default function Stage2_Quality() {
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [docExists, setDocExists] = useState(true);

    const [formData, setFormData] = useState({
        report_date: '', report_document_path: '',
        uhml: '', ui: '', strength: '', elongation: '',
        mic: '', rd: '', plus_b: '',
        remarks: ''
    });

    const [isFileViewed, setIsFileViewed] = useState(false);

    const [approvalData, setApprovalData] = useState({ decision: 'Approve', remarks: '' });

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchContract();
    }, [id]);

    const fetchContract = async () => {
        try {
            const safeId = encodeURIComponent(id);
            const res = await api.get(`/contracts/${safeId}`);
            setContract(res.data);

            // NAVIGATION GUARD
            if (res.data.stage < 2) {
                alert("This contract is not yet ready for Quality Entry. Please complete Stage 1 Chairman approval first.");
                navigate('/dashboard');
                return;
            }

            if (res.data.stage2) {
                setFormData(res.data.stage2); // Pre-fill if exists
            }
        } catch (e) {
            console.error(e);
            setError("Failed to fetch contract details. " + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleDocumentUpload = (path) => {
        setFormData(prev => ({ ...prev, report_document_path: path }));
        setIsFileViewed(false); // Reset on new upload
    };

    const handleFileView = () => {
        setIsFileViewed(true);
    };

    const handleSubmitManager = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/contracts/${encodeURIComponent(id)}/stage2`, formData);
            fetchContract(); // Refresh
        } catch (e) { alert(e.response?.data?.error || e.message); }
    };

    const handleSubmitChairman = async (decision) => {
        try {
            await api.post(`/contracts/${encodeURIComponent(id)}/stage2/decision`, {
                decision,
                remarks: approvalData.remarks
            });
            navigate('/dashboard');
        } catch (e) { alert(e.response?.data?.error || e.message); }
    };

    useEffect(() => {
        const checkDoc = async () => {
            const path = contract?.document_path;
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
    }, [contract]);

    // Navigation Enforcement
    useEffect(() => {
        if (!loading && contract) {
            // Must have Stage 1 Approved
            if (contract.stage1Decision?.decision !== 'Approve') {
                console.log("Access Denied: Stage 1 not approved");
                navigate('/dashboard');
            }
        }
    }, [loading, contract, navigate]);

    if (loading) return <div className="p-10 text-center flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-500 font-medium">Loading Quality Data...</p>
    </div>;

    if (error) return <div className="p-10 text-center">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 max-w-md mx-auto">
            <X size={48} className="text-rose-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-rose-900 mb-2">Error Loading Page</h3>
            <p className="text-rose-700 mb-6">{error}</p>
            <button onClick={() => navigate('/dashboard')} className="bg-rose-600 text-white px-6 py-2 rounded-xl font-bold">Back to Dashboard</button>
        </div>
    </div>;

    if (!contract) return <div className="p-10 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-md mx-auto">
            <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-amber-900 mb-2">Contract Not Found</h3>
            <p className="text-amber-700 mb-6">We couldn't find the specific contract details for this quality stage.</p>
            <button onClick={() => navigate('/dashboard')} className="bg-amber-600 text-white px-6 py-2 rounded-xl font-bold">Back to Dashboard</button>
        </div>
    </div>;

    const isManager = user.role === 'Manager';
    const isChairman = user.role === 'Chairman';
    const isApproved = contract.stage2Decision?.decision === 'Approve';
    const isPendingApproval = contract.stage2 && !isApproved;

    const isViewMode = isChairman || (isManager && (isPendingApproval || isApproved));

    if (isViewMode) {
        const pdfUrl = getFullUrl(contract.stage2?.report_document_path);

        return (
            <div className="mx-auto pb-10 flex flex-col">
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">
                            {isChairman ? "Review Quality (Stage 2)" : "Quality Details (Stage 2)"}
                        </h2>
                    </div>
                    <div>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${isApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                            {contract.stage2Decision?.decision || (contract.stage2 ? 'Pending Approval' : 'Pending Entry')}
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

                    {/* TOP: PDF Viewer - Large */}
                    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col ${(pdfUrl && docExists) ? 'h-[800px]' : 'h-[160px]'} relative group`}>
                        <div className="flex-grow relative bg-slate-50">
                            {(pdfUrl && docExists) ? (
                                <iframe src={pdfUrl} className="w-full h-full bg-white" title="Quality Report" />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <Eye size={42} className="mb-2 opacity-30" />
                                    <span className="font-medium text-base">{docExists === false ? "Document not found on server" : "Report not uploaded"}</span>
                                </div>
                            )}
                            {/* Eye Link */}
                            {pdfUrl && (
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-white/90 hover:bg-white p-2 rounded-lg text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-slate-200">
                                    <Eye size={22} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* BOTTOM: Manager Data - Large Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col">
                        <div className="flex-shrink-0 border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Manager Input Details</h3>
                        </div>

                        <div className="space-y-6 flex-grow">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Report Date</label>
                                    <div className="text-slate-900 font-medium">{formatDate(formData.report_date) || '-'}</div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs uppercase font-bold text-slate-500 mb-4 border-b border-slate-100 pb-2">Average Parameters</label>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4">
                                    {['uhml', 'ui', 'strength', 'elongation', 'mic', 'rd', 'plus_b'].map(field => (
                                        <div key={field} className="border-l-2 border-slate-200 pl-4">
                                            <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1 tracking-wide">{field.replace(/_/g, ' ')}</span>
                                            <span className="text-slate-900 font-mono font-bold text-xl">{formData[field] || '-'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 mt-4 border-t border-slate-50">
                                <label className="block text-xs uppercase font-bold text-slate-500 mb-2">Manager's Remarks</label>
                                <div className="bg-slate-50 p-5 rounded-xl text-slate-700 text-sm italic border border-slate-100">
                                    {formData.remarks || 'No remarks provided.'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chairman Decision - Full Width Panel */}
                {isChairman && isPendingApproval && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mt-6">
                        <label className="block text-base font-semibold text-slate-700 mb-3 uppercase tracking-tight">Chairman's Review & Observations</label>
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
                                    <X size={20} /> <span className="text-lg">Reject Report</span>
                                </button>
                                <button onClick={() => handleSubmitChairman('Approve')} className="flex-[2] bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                                    <Check size={24} /> <span className="text-lg">Approve Quality</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Strip - Full Width */}
                {(() => {
                    const decision = contract.stage2Decision?.decision;
                    const remarks = contract.stage2Decision?.remarks;
                    if (decision === 'Approve') return (
                        <div className="rounded-xl border p-4 shadow-sm mt-6 bg-emerald-50 border-emerald-100">
                            <div className="flex items-center space-x-3">
                                <div className="bg-emerald-100 text-emerald-700 rounded-full p-2"><Check size={24} /></div>
                                <div>
                                    <p className="font-bold text-base text-emerald-800">Quality Approved</p>
                                    <p className="text-sm text-emerald-600 opacity-75">Verified by Chairman</p>
                                    {remarks && <p className="text-sm text-emerald-700 mt-1 italic">"{remarks}"</p>}
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
                    if (isManager && isPendingApproval) return (
                        <div className="rounded-xl border p-4 shadow-sm mt-6 bg-amber-50 border-amber-100">
                            <div className="flex items-center space-x-3">
                                <div className="bg-amber-100 text-amber-700 rounded-full p-2"><RotateCcw size={24} /></div>
                                <div>
                                    <p className="font-bold text-base text-amber-800">Under Review</p>
                                    <p className="text-sm text-amber-600 opacity-75">Waiting for Chairman to clear quality</p>
                                </div>
                            </div>
                        </div>
                    );
                    return null;
                })()}
            </div>
        );
    }

    // Default: Manager Entry Form
    return (
        <div className="mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Quality Entry (Stage 2)</h2>
                    <p className="text-slate-500 font-medium">Contract {contract.contract_id} - {contract.vendor_name}</p>
                </div>
            </div>

            {/* Show Stage 1 Chairman Remarks to Manager */}
            {contract.stage1Decision?.remarks && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-5 mb-8 flex items-start gap-4 shadow-sm">
                    <div className="bg-indigo-200 text-indigo-800 rounded-full p-2.5 flex-shrink-0">
                        <MessageSquare size={24} />
                    </div>
                    <div className="flex-grow">
                        <h3 className="font-bold text-indigo-900 text-lg">Chairman Instructions (Stage 1)</h3>
                        <p className="text-indigo-800 mt-1 italic whitespace-pre-wrap">
                            "{contract.stage1Decision.remarks}"
                        </p>
                    </div>
                </div>
            )}

            {/* Manager Form */}
            <form onSubmit={handleSubmitManager}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Left Card: Average Quality Parameters */}
                    <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-sm h-full flex flex-col">
                        <div className="border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                Parameter Inputs
                                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Averages</span>
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-6 flex-grow content-start">
                            {['mic', 'rd', 'plus_b', 'uhml', 'ui', 'strength', 'elongation'].map(field => (
                                <div key={field} className={['mic', 'rd', 'plus_b'].includes(field) ? 'col-span-2 sm:col-span-1' : 'col-span-2 sm:col-span-1'}>
                                    <label className="block text-slate-500 text-[10px] uppercase mb-1.5 font-bold tracking-wide">
                                        <span className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded mr-1">AVG</span>
                                        {field.replace(/_/g, ' ')}
                                    </label>
                                    <input
                                        type="number"
                                        name={field}
                                        value={formData[field] || ''}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 text-lg font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                                        step="any"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Card: Report Details & Upload */}
                    <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-sm h-full flex flex-col">
                        <div className="border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Report Details</h3>
                        </div>

                        <div className="space-y-6 flex-grow">
                            <div>
                                <label className="block text-slate-500 text-xs uppercase mb-1 font-bold tracking-wide">Report Date</label>
                                <input type="date" name="report_date" value={formData.report_date} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3" required />
                            </div>

                            <div className="pt-2">
                                <FileUpload
                                    label="Upload Quality Report"
                                    initialPath={formData.report_document_path}
                                    onUploadComplete={handleDocumentUpload}
                                    onVerified={handleFileView}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-500 text-xs uppercase mb-1 font-bold tracking-wide">Manager Remarks</label>
                                <textarea
                                    name="remarks"
                                    value={formData.remarks || ''}
                                    onChange={handleChange}
                                    placeholder="Enter any specific observations..."
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 min-h-[120px] focus:ring-2 focus:ring-indigo-500 transition-all text-base"
                                ></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-8 border-t border-slate-200 mt-10">
                    <button
                        type="submit"
                        disabled={formData.report_document_path && !isFileViewed}
                        className={`w-full max-w-2xl px-6 py-5 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3 text-xl ${formData.report_document_path && !isFileViewed
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-indigo-600 hover:bg-slate-900 text-white hover:shadow-indigo-500/30 active:scale-[0.98]'
                            }`}
                    >
                        <Check size={28} /> {formData.report_document_path && !isFileViewed ? 'View Document to Submit' : 'Submit Quality Report'}
                    </button>
                </div>
            </form>
        </div>
    );
}
