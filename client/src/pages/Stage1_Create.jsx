import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, ChevronDown, ChevronUp, Check, RotateCcw, X as CloseIcon, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FileUpload from '../components/FileUpload';
import { getFullUrl } from '../utils/urls';
import BillTemplate from '../components/BillTemplate';
import { FileText, Download, Printer } from 'lucide-react';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
};

export default function Stage1_Create() {
    const urlParams = useParams();

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

    const id = safeDecode(urlParams.id);
    const navigate = useNavigate();
    const { user } = useAuth();
    const [vendors, setVendors] = useState([]);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [showParams, setShowParams] = useState(false);

    // Approval State
    const [contract, setContract] = useState(null);
    const [approvalData, setApprovalData] = useState({ decision: 'Approve', remarks: '' });
    const [docExists, setDocExists] = useState(true);

    // Contract Form State
    const [formData, setFormData] = useState({
        contract_prefix: '',
        vendor_id: '',
        cotton_type: '',
        quality: '',
        quantity: '',
        price: '', document_path: '', entry_date: new Date().toISOString().split('T')[0],
        manager_remarks: '',
        params: {}
    });

    const [isFileViewed, setIsFileViewed] = useState(false);
    const [activeView, setActiveView] = useState('contract'); // 'contract' | 'bill'
    const [selectedLot, setSelectedLot] = useState(null);

    // Optional Parameters State
    const [params, setParams] = useState({
        uhml: '', gpt: '', mic: '', sfi: '', elongation: '', rd: '', plus_b: '',
        mat: '', sci: '', trash: '', sfc_n: '', neps: '', moisture: '',
        ui: '', grade: '', strength: '', stability: ''
    });

    // Vendor Form State
    const [vendorData, setVendorData] = useState({
        vendor_name: '',
        gst_number: '',
        state: '',
        email: '',
        phone_number: '',
        address: '',
        is_privileged: false
    });

    const getFinancialYearSuffix = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const month = date.getMonth();
        const year = date.getFullYear();
        let startYear = year;
        if (month < 3) startYear = year - 1;
        return `/${startYear}-${startYear + 1}`;
    };

    const fetchLatestContractId = async () => {
        try {
            const res = await api.get('/latest-contract-id');
            const latestId = res.data?.latest_contract_id;

            if (latestId) {
                const parts = latestId.split('/');
                if (parts.length >= 3) {
                    const lastFy = parts[parts.length - 1];
                    const currentFySuffix = getFinancialYearSuffix(new Date());
                    const currentFy = currentFySuffix.replace('/', '');

                    const prefix = parts.slice(0, parts.length - 2).join('/');
                    const numberStr = parts[parts.length - 2];
                    const num = parseInt(numberStr);

                    if (!isNaN(num)) {
                        let nextNum = num + 1;
                        if (lastFy !== currentFy) {
                            nextNum = 1;
                        }
                        const padded = nextNum.toString().padStart(2, '0');
                        setFormData(prev => ({
                            ...prev,
                            contract_prefix: `${prefix}/${padded}`
                        }));
                    }
                }
            }
        } catch (e) {
            console.error("Auto-fetch ID failed", e);
        }
    };

    useEffect(() => {
        fetchVendors();
        if (id && id !== 'undefined') {
            fetchContract();
        } else {
            fetchLatestContractId();
        }
    }, [id]);

    useEffect(() => {
        const checkDoc = async () => {
            if (contract && contract.document_path) {
                try {
                    const url = getFullUrl(contract.document_path);
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

    const fetchContract = async () => {
        try {
            console.log('Fetching contract for ID:', id);
            const safeId = encodeURIComponent(id);
            const res = await api.get(`/contracts/${safeId}`);
            const data = res.data;
            if (!data) throw new Error("No data received");
            setContract(data);
            setFormData({
                contract_prefix: data.contract_id ? data.contract_id.split('/')[0] : '',
                vendor_id: data.vendor_id,
                cotton_type: data.cotton_type,
                quality: data.quality,
                quantity: data.quantity,
                price: data.price,
                document_path: data.document_path,
                entry_date: data.entry_date,
                manager_remarks: data.manager_remarks || ''
            });
            if (data.stage1_params) {
                setParams(data.stage1_params);
                setShowParams(true);
            }
        } catch (e) { console.error(e); }
    };

    const fetchVendors = async () => {
        try {
            const res = await api.get('/vendors');
            setVendors(res.data);
        } catch (e) { console.error(e); }
    };

    const handleContractChange = (e) => {
        const { name, value } = e.target;

        // Prevent negative values for numeric fields
        if (name === 'quantity' || name === 'price') {
            const numValue = parseFloat(value);
            if (value === '' || numValue < 0) {
                return; // Don't allow negative or empty values
            }
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleParamChange = (e) => {
        setParams({ ...params, [e.target.name]: e.target.value });
    };

    const handleDocumentUpload = (path) => {
        setFormData(prev => ({ ...prev, document_path: path }));
        setIsFileViewed(false);
    };


    const handleFileView = () => {
        setIsFileViewed(true);
    };

    const handleVendorChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setVendorData({ ...vendorData, [e.target.name]: value });
    };

    const [submitError, setSubmitError] = useState('');

    const submitContract = async (e) => {
        e.preventDefault();
        setSubmitError('');
        try {
            const contract_id = `${formData.contract_prefix}${getFinancialYearSuffix(formData.entry_date)}`;
            const payload = { ...formData, contract_id, params: showParams ? params : null, manager_remarks: formData.manager_remarks };

            const response = await api.post('/contracts', payload);
            navigate('/dashboard');
        } catch (e) {
            const errorMsg = e.response?.data?.error || e.response?.data?.message || e.message;
            setSubmitError(errorMsg);
        }
    };

    const submitVendor = async (e) => {
        e.preventDefault();
        try {
            await api.post('/vendors', vendorData);
            setShowVendorModal(false);
            fetchVendors();
            setVendorData({ vendor_name: '', gst_number: '', state: '', email: '', phone_number: '', address: '', is_privileged: false });
        } catch (e) {
            alert('Error adding vendor');
        }
    };

    const paramFields = [
        'uhml', 'gpt', 'mic', 'sfi', 'elongation', 'rd', 'plus_b', 'mat',
        'sci', 'trash', 'sfc_n', 'neps', 'moisture', 'ui', 'grade', 'strength', 'stability'
    ];

    const handleSubmitChairman = async (decision) => {
        try {
            await api.post(`/contracts/${encodeURIComponent(id)}/stage1/decision`, { decision, remarks: approvalData.remarks });
            navigate('/dashboard');
        } catch (e) { alert(e.response?.data?.error || e.message); }
    };

    const isChairman = user.role === 'Chairman';
    const isManager = user.role === 'Manager';
    const isViewMode = !!id;

    if (isViewMode) {
        if (!contract) return <div className="p-10 text-center">Loading Data...</div>; // Safety check

        const isPendingApproval = contract.stage1Decision?.decision !== 'Approve' && contract.stage1Decision?.decision !== 'Reject';
        const isApprove = contract.stage1Decision?.decision === 'Approve';
        const pdfUrl = contract.document_path ? getFullUrl(contract.document_path) : null;
        console.log("DEBUG: PDF URL:", pdfUrl);

        return (
            <div className="mx-auto pb-10 flex flex-col">
                {/* Header Strip */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Review Contract (Stage 1)</h2>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium px-3 py-1 bg-slate-100 text-slate-600 rounded-lg">Draft Contract</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${contract.status === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                            {contract.status || 'Pending Approval'}
                        </span>
                    </div>
                </div>

                {/* Info Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6 items-start">
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

                {/* Main Content Area - Vertical Stack */}
                <div className="grid grid-cols-1 gap-6 mb-8">

                    {/* TOP: Document Viewer - Large */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[800px] relative group">
                        {/* Header */}
                        <div className="h-12 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 z-10 shrink-0">
                            <span className="font-bold text-xs uppercase text-slate-500 tracking-wider">
                                Contract PDF
                            </span>
                        </div>

                        <div className="flex-grow relative bg-slate-50 overflow-hidden">
                            {(contract.document_path && docExists) ? (
                                <iframe src={getFullUrl(contract.document_path)} className="w-full h-full bg-white" title="Contract" />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <Eye size={42} className="mb-2 opacity-30" />
                                    <span className="font-medium">{docExists === false ? "Document not found on server" : "No PDF Available"}</span>
                                </div>
                            )}

                            {/* Overlay Link */}
                            {pdfUrl && (
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-white/90 hover:bg-white p-2 rounded-lg text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-slate-200 z-20">
                                    <Eye size={22} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* BOTTOM: Data Panel - Large Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col">
                        <div className="flex-shrink-0 border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Contract Information</h3>
                        </div>

                        <div className="space-y-6 flex-grow">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Vendor ID</label>
                                    <div className="text-slate-900 font-medium">{contract.vendor_id}</div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Vendor Name</label>
                                    <div className="text-slate-900 font-medium">{contract.vendor_name || 'Loading...'}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Cotton Type</label>
                                    <div className="text-slate-900 font-medium border-b border-slate-100 pb-1">{contract.cotton_type}</div>
                                </div>
                                <div>
                                    <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Quality</label>
                                    <div className="text-slate-900 font-medium border-b border-slate-100 pb-1">{contract.quality}</div>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Quantity</label>
                                    <div className="text-slate-900 font-medium border-b border-slate-100 pb-1">{contract.quantity}</div>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Price</label>
                                    <div className="text-slate-900 font-medium border-b border-slate-100 pb-1">{contract.price}</div>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Entry Date</label>
                                    <div className="text-slate-900 font-medium border-b border-slate-100 pb-1">{formatDate(contract.entry_date)}</div>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">GST Number</label>
                                    <div className="text-slate-900 font-medium border-b border-slate-100 pb-1">{contract.gst_number || '-'}</div>
                                </div>
                            </div>

                            {contract.manager_remarks && (
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    <label className="block text-xs uppercase font-bold text-slate-500 mb-2">Manager Remarks</label>
                                    <p className="text-sm text-slate-700">{contract.manager_remarks}</p>
                                </div>
                            )}

                            {contract.stage1_params && Object.values(
                                typeof contract.stage1_params === 'string'
                                    ? JSON.parse(contract.stage1_params)
                                    : contract.stage1_params
                            ).some(v => v !== '' && v !== null && v !== undefined) && (() => {
                                const paramLabels = {
                                    uhml: { label: 'UHML', unit: 'mm' },
                                    gpt: { label: 'GPT', unit: '%' },
                                    mic: { label: 'Micronaire', unit: '' },
                                    sfi: { label: 'SFI', unit: '%' },
                                    elongation: { label: 'Elongation', unit: '%' },
                                    rd: { label: 'Rd (Brightness)', unit: '' },
                                    plus_b: { label: '+b (Yellowness)', unit: '' },
                                    mat: { label: 'Maturity', unit: '' },
                                    sci: { label: 'SCI', unit: '' },
                                    trash: { label: 'Trash', unit: '%' },
                                    sfc_n: { label: 'SFC(n)', unit: '%' },
                                    neps: { label: 'Neps', unit: '/g' },
                                    moisture: { label: 'Moisture', unit: '%' },
                                    ui: { label: 'Uniformity Index', unit: '%' },
                                    grade: { label: 'Grade', unit: '' },
                                    strength: { label: 'Strength', unit: 'g/tex' },
                                    stability: { label: 'Stability', unit: '' },
                                };
                                const paramsObj = typeof contract.stage1_params === 'string'
                                    ? JSON.parse(contract.stage1_params)
                                    : contract.stage1_params;
                                const filledParams = Object.entries(paramsObj).filter(([, v]) => v !== '' && v !== null && v !== undefined);
                                return (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mt-2">
                                        <label className="block text-xs uppercase font-bold text-indigo-600 mb-3 tracking-widest">
                                            Internal Quality Parameters
                                        </label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {filledParams.map(([key, val]) => {
                                                const meta = paramLabels[key] || { label: key.replace(/_/g, ' '), unit: '' };
                                                return (
                                                    <div key={key} className="bg-white rounded-lg p-3 border border-indigo-100 shadow-sm">
                                                        <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                                                            {meta.label}
                                                        </span>
                                                        <span className="font-semibold text-slate-800 text-sm">
                                                            {val}
                                                            {meta.unit && <span className="text-slate-400 text-xs ml-1">{meta.unit}</span>}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}


                        </div>
                    </div>
                </div>

                {/* Status Strip - Full Width */}
                {
                    (() => {
                        const decision = contract.stage1Decision?.decision;
                        if (decision === 'Approve') return (
                            <div className="rounded-xl border p-4 shadow-sm mt-6 bg-emerald-50 border-emerald-100">
                                <div className="flex items-center space-x-3">
                                    <div className="bg-emerald-100 text-emerald-700 rounded-full p-2"><Check size={24} /></div>
                                    <div>
                                        <p className="font-bold text-base text-emerald-800">Contract Approved</p>
                                        <p className="text-sm text-emerald-600 opacity-75">Decision recorded by Chairman</p>
                                        {contract.stage1Decision?.remarks && (
                                            <div className="mt-2 pt-2 border-t border-emerald-100">
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">Chairman Remark</span>
                                                <p className="text-sm text-emerald-700 italic">"{contract.stage1Decision.remarks}"</p>
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
                                        {contract.stage1Decision?.remarks && (
                                            <div className="mt-2 pt-2 border-t border-rose-100">
                                                <span className="text-[10px] font-bold text-rose-600 uppercase block mb-1">Chairman Remark</span>
                                                <p className="text-sm text-rose-700 italic">"{contract.stage1Decision.remarks}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                        if (isManager) return (
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
                    })()
                }

                {/* Chairman Decision - Full Width Panel */}
                {
                    isChairman && !contract.stage1Decision?.decision && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mt-6">
                            <label className="block text-base font-semibold text-slate-700 mb-3 uppercase tracking-tight">Chairman Decision & Remarks</label>
                            <div className="space-y-4">
                                <textarea
                                    rows="2"
                                    className="w-full border border-slate-300 rounded-lg p-4 text-base focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                    placeholder="Enter optional remarks..."
                                    value={approvalData.remarks}
                                    onChange={(e) => setApprovalData({ ...approvalData, remarks: e.target.value })}
                                />
                                <div className="flex gap-4">
                                    <button onClick={() => handleSubmitChairman('Reject')} className="flex-1 bg-white border-2 border-rose-200 text-rose-700 hover:bg-rose-50 px-4 py-4 rounded-xl font-semibold transition-all shadow-sm flex items-center justify-center gap-2">
                                        <X size={20} /> <span className="text-lg">Reject Contract</span>
                                    </button>
                                    <button onClick={() => handleSubmitChairman('Approve')} className="flex-[2] bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                                        <Check size={24} /> <span className="text-lg">Approve Contract</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        );
    }

    return (
        <div className="mx-auto pb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">Create New Contract</h2>

            <div className="pb-10">
                <form onSubmit={submitContract}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Left Card: Contract Details */}
                        <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-sm h-full flex flex-col">
                            <div className="border-b border-slate-100 pb-4 mb-6">
                                <h3 className="text-xl font-bold text-slate-800">Contract Basics</h3>
                            </div>

                            <div className="space-y-6 flex-grow">
                                <div>
                                    <label className="text-slate-600 block mb-2 font-bold text-xs uppercase tracking-wide">Contract ID</label>
                                    <div className="flex items-center">
                                        <input
                                            type="text"
                                            name="contract_prefix"
                                            placeholder="e.g. MUML/02"
                                            value={formData.contract_prefix}
                                            onChange={handleContractChange}
                                            className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 rounded-l-lg p-3 focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-lg outline-none"
                                            required
                                        />
                                        <div className="bg-slate-100 border border-l-0 border-slate-200 px-4 py-3 rounded-r-lg text-slate-500 font-bold text-lg">
                                            {getFinancialYearSuffix(formData.entry_date)}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Enter prefix, suffix is auto-appended based on entry date</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-slate-600 block mb-2 font-bold text-xs uppercase tracking-wide">Cotton Type</label>
                                        <select name="cotton_type" value={formData.cotton_type} onChange={handleContractChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer font-medium text-lg">
                                            <option value="">Select Cotton Type</option>
                                            <option value="Domestic">Domestic</option>
                                            <option value="Import">Import</option>
                                            <option value="Waste">Waste</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-slate-600 block mb-2 font-bold text-xs uppercase tracking-wide">Quality</label>
                                        <input type="text" name="quality" placeholder="e.g. Grade A" value={formData.quality} onChange={handleContractChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-lg" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-slate-600 block mb-2 font-bold text-xs uppercase tracking-wide">Quantity (Bales)</label>
                                        <input type="number" name="quantity" placeholder="e.g. 100" value={formData.quantity} onChange={handleContractChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-lg" />
                                    </div>
                                    <div>
                                        <label className="text-slate-600 block mb-2 font-bold text-xs uppercase tracking-wide">Price</label>
                                        <input type="number" name="price" placeholder="e.g. 55000" value={formData.price} onChange={handleContractChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-lg" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-slate-600 block mb-2 font-bold text-xs uppercase tracking-wide">Entry Date</label>
                                    <input type="date" name="entry_date" value={formData.entry_date} onChange={handleContractChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-lg" required />
                                </div>

                            </div>
                        </div>

                        {/* Right Card: Vendor & Docs */}
                        <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-sm h-full flex flex-col">
                            <div className="border-b border-slate-100 pb-4 mb-6">
                                <h3 className="text-xl font-bold text-slate-800">Vendor & Document</h3>
                            </div>

                            <div className="space-y-6 flex-grow">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-slate-600 font-bold text-sm uppercase tracking-wide">Select Vendor</label>
                                        <button type="button" onClick={() => setShowVendorModal(true)} className="text-indigo-600 text-sm flex items-center hover:text-indigo-500 font-bold uppercase tracking-wide bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                            <Plus size={18} className="mr-1" /> New Vendor
                                        </button>
                                    </div>
                                    <select name="vendor_id" value={formData.vendor_id} onChange={handleContractChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer font-medium text-lg">
                                        <option value="">Select Vendor</option>
                                        {vendors.map(v => <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name} - {v.gst_number}</option>)}
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <FileUpload
                                        className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl"
                                        label="Attachment: Contract Document"
                                        initialPath={formData.document_path}
                                        onUploadComplete={handleDocumentUpload}
                                        onVerified={handleFileView}
                                    />
                                </div>

                                {/* Manager Observations / Remarks - Relocated to Right Panel */}
                                <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm mt-4">
                                    <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 uppercase tracking-wide">Manager Remarks</h3>
                                    <textarea
                                        name="manager_remarks"
                                        value={formData.manager_remarks}
                                        onChange={handleContractChange}
                                        placeholder="Enter any additional observations..."
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-3 min-h-[100px] focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
                                    />
                                </div>

                                {/* Optional Params Button - Relocated to Right Panel */}
                                <div className="pt-4 border-t border-slate-100 mt-auto">
                                    <button
                                        type="button"
                                        onClick={() => setShowParams(true)}
                                        className="w-full bg-indigo-50 text-indigo-700 px-4 py-4 rounded-xl font-bold text-sm flex items-center justify-center hover:bg-indigo-100 transition-colors border border-indigo-100"
                                    >
                                        <Plus size={22} className="mr-2" /> Add Internal Quality Parameters
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Create Contract Button - Full Width Below Panels */}
                    <div className="mt-4">
                        {submitError && (
                            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-5 py-3.5 flex items-start gap-3 text-sm font-medium shadow-sm">
                                <span className="text-rose-500 text-lg leading-none shrink-0">⚠</span>
                                <span>{submitError}</span>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={formData.document_path && !isFileViewed}
                            className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all transform flex items-center justify-center gap-3 text-lg ${formData.document_path && !isFileViewed
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-500/30 active:scale-[0.98]'
                                }`}
                        >
                            <Plus size={24} /> {formData.document_path && !isFileViewed ? 'View Document to Create' : 'Create Contract'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Quality Parameters Modal */}
            {
                showParams && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setShowParams(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><X /></button>
                            <h3 className="text-lg font-bold text-slate-900 mb-6">Internal Quality Parameters</h3>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {paramFields.map(key => (
                                    <div key={key}>
                                        <label className="block text-slate-500 text-xs uppercase font-bold tracking-wide mb-1">{key.replace(/_/g, ' ')}</label>
                                        <input
                                            type={key === 'grade' || key === 'colour_grade' ? 'text' : 'number'}
                                            name={key}
                                            value={params[key]}
                                            onChange={handleParamChange}
                                            placeholder=""
                                            step="any"
                                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end mt-8 space-x-4">
                                <button
                                    type="button"
                                    onClick={() => setShowParams(false)}
                                    className="px-6 py-2.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }



            {/* Vendor Modal */}
            {
                showVendorModal && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 relative shadow-2xl">
                            <button onClick={() => setShowVendorModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><X /></button>
                            <h3 className="text-lg font-bold text-slate-900 mb-6">Add New Vendor</h3>
                            <form onSubmit={submitVendor} className="space-y-4">
                                <input type="text" name="vendor_name" placeholder="Vendor Name" value={vendorData.vendor_name} onChange={handleVendorChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500" />
                                <input type="text" name="gst_number" placeholder="GST Number" value={vendorData.gst_number} onChange={handleVendorChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500" />
                                <input type="text" name="state" placeholder="State" value={vendorData.state} onChange={handleVendorChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500" />
                                <input type="email" name="email" placeholder="Email" value={vendorData.email} onChange={handleVendorChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500" />
                                <input type="tel" name="phone_number" placeholder="Phone Number" value={vendorData.phone_number} onChange={handleVendorChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500" />
                                <textarea name="address" placeholder="Address" value={vendorData.address} onChange={handleVendorChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 h-24 focus:ring-2 focus:ring-indigo-500" />
                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" name="is_privileged" checked={vendorData.is_privileged} onChange={handleVendorChange} id="priv" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <label htmlFor="priv" className="text-slate-700 font-medium">Privileged Vendor</label>
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg mt-4 shadow-lg hover:shadow-indigo-500/30 transition-all">Save Vendor</button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
