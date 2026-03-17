import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RotateCcw, Check, X, FileText, ZoomIn, ZoomOut, Maximize, Minimize, Download, MessageSquare, AlertCircle } from 'lucide-react';
import { getFullUrl } from '../utils/urls';
import BillTemplate from '../components/BillTemplate';
import html2pdf from 'html2pdf.js';

export default function Stage5_Payment() {
    console.log("Stage5_Payment rendering...");
    const params = useParams();

    const safeDecode = (val) => {
        if (!val) return '';
        return val.split('---').join('/');
    };

    const id = safeDecode(params.id);
    const lotId = safeDecode(params.lotId);

    const navigate = useNavigate();
    const { user } = useAuth();
    const [contract, setContract] = useState(null);
    const [activeLot, setActiveLot] = useState(null);

    const [formData, setFormData] = useState({
        invoice_number: '', invoice_weight: '',
        invoice_value: '', tds_amount: '0', cash_discount: '0', net_amount_paid: '',
        bank_name: '', branch: '', account_no: '', ifsc_code: '',
        payment_mode: 'RTGS', rtgs_reference_no: '', supplied_to: 'TML, UNIT - I, KAPPALUR', remarks: ''
    });

    const [approvalData, setApprovalData] = useState({ decision: 'Approve', remarks: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Auto-Fit Logic
    const containerRef = useRef(null);
    const [scale, setScale] = useState(0.85); // Default to 85% as requested
    const [fitMode, setFitMode] = useState('manual');

    // Zoom Handlers
    const handleZoomIn = () => {
        setFitMode('manual');
        setScale(prev => Math.min(prev + 0.1, 2.5));
    };

    const handleZoomOut = () => {
        setFitMode('manual');
        setScale(prev => Math.max(prev - 0.1, 0.4));
    };

    const toggleFitMode = () => {
        setFitMode(prev => prev === 'page' ? 'width' : 'page');
    };

    const handleDownload = () => {
        const element = document.getElementById('payment-bill-node');
        if (!element) return;

        // Clone to force specific styles if needed, but 'payment-bill-node' already has A4 dimensions
        const opt = {
            margin: 0,
            filename: `Payment_Req_L${activeLot?.lot_number || 'Draft'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    };

    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current && fitMode !== 'manual') {
                const { clientWidth, clientHeight } = containerRef.current;
                const docWidth = 794; // A4 px
                const docHeight = 1123;
                const padding = 64; // Corrected: p-8 is 32px on each side
                const availableWidth = clientWidth - padding;
                const availableHeight = clientHeight - padding;

                if (fitMode === 'width') {
                    setScale(availableWidth / docWidth);
                } else {
                    const scaleX = availableWidth / docWidth;
                    const scaleY = availableHeight / docHeight;
                    setScale(Math.min(scaleX, scaleY));
                }
            }
        };
        updateScale();
        const observer = new ResizeObserver(updateScale);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [fitMode]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchContract();
    }, [id, lotId]);

    // Calculations
    useEffect(() => {
        const invoice = parseFloat(formData.invoice_value) || 0;
        const discount = parseFloat(formData.cash_discount) || 0;
        const tds = (invoice * 0.001).toFixed(2);
        const net = (invoice - parseFloat(tds) - discount).toFixed(2);
        setFormData(prev => {
            if (prev.tds_amount === tds && prev.net_amount_paid === net) return prev;
            return { ...prev, tds_amount: tds, net_amount_paid: net };
        });
    }, [formData.invoice_value, formData.cash_discount]);

    const fetchContract = async () => {
        try {
            const safeId = encodeURIComponent(id);
            const res = await api.get(`/contracts/${safeId}`);
            setContract(res.data);

            // NAVIGATION GUARD
            const workflow = Boolean(res.data.is_privileged) ? [1, 2, 5, 3, 4] : [1, 2, 3, 4, 5];
            const currentIdx = workflow.indexOf(res.data.stage === 6 ? 6 : res.data.stage);
            const targetIdx = workflow.indexOf(5);

            if (currentIdx === -1 || currentIdx < targetIdx) {
                const prevStage = Boolean(res.data.is_privileged) ? "Quality (Stage 2)" : "Lot Entry (Stage 3)";
                alert(`This contract/lot is not yet ready for Payment Entry. Please complete ${prevStage} first.`);
                navigate('/dashboard');
                return;
            }

            if (lotId) {
                // Lot-specific payment
                if (res.data.lots) {
                    const foundLot = res.data.lots.find(l => l.lot_id.toString() === lotId.toString());
                    if (foundLot) {
                        setActiveLot(foundLot);
                        setFormData({
                            invoice_number: foundLot.invoice_number || '',
                            invoice_weight: foundLot.invoice_weight || '',
                            invoice_value: foundLot.invoice_value || '',
                            tds_amount: foundLot.tds_amount || '0',
                            cash_discount: foundLot.cash_discount || '0',
                            net_amount_paid: foundLot.net_amount_paid || '',
                            bank_name: foundLot.bank_name || '',
                            branch: foundLot.branch || '',
                            account_no: foundLot.account_no || '',
                            ifsc_code: foundLot.ifsc_code || '',
                            payment_mode: foundLot.payment_mode || 'RTGS',
                            rtgs_reference_no: foundLot.rtgs_reference_no || '',
                            supplied_to: foundLot.supplied_to || 'TML, UNIT - I, KAPPALUR',
                            remarks: foundLot.stage5_remarks || ''
                        });
                    }
                }
            } else {
                // Contract-level payment (Privileged Vendors)
                // Create a virtual "activeLot" for UI compatibility
                setActiveLot({
                    ...res.data,
                    lot_number: 'Full Contract',
                    s5Decision: res.data.stage5Decision // Map decision
                });
                setFormData({
                    invoice_number: res.data.invoice_number || '',
                    invoice_weight: res.data.invoice_weight || '',
                    invoice_value: res.data.invoice_value || '',
                    tds_amount: res.data.tds_amount || '0',
                    cash_discount: res.data.cash_discount || '0',
                    net_amount_paid: res.data.net_amount_paid || '',
                    bank_name: res.data.bank_name || '',
                    branch: res.data.branch || '',
                    account_no: res.data.account_no || '',
                    ifsc_code: res.data.ifsc_code || '',
                    payment_mode: res.data.payment_mode || 'RTGS',
                    rtgs_reference_no: res.data.rtgs_reference_no || '',
                    supplied_to: res.data.supplied_to || 'TML, UNIT - I, KAPPALUR',
                    remarks: res.data.stage5_remarks || ''
                });
            }
        } catch (e) {
            console.error(e);
            setError("Failed to fetch payment data. " + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Prevent negative values for numeric fields
        if (['invoice_weight', 'cash_discount', 'invoice_value'].includes(name)) {
            const numValue = parseFloat(value);
            if (value === '' || numValue < 0) {
                return; // Don't allow negative values
            }
        }

        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmitManager = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const endpoint = lotId
                ? `/contracts/${encodeURIComponent(id)}/lots/${lotId}/stage5`
                : `/contracts/${encodeURIComponent(id)}/payment`;
            await api.post(endpoint, formData);
            navigate('/dashboard');
        } catch (e) {
            alert(e.response?.data?.error || 'Error saving payment');
            setIsSubmitting(false);
        }
    };

    const handleSubmitChairman = async (decision) => {
        try {
            setIsSubmitting(true);
            const endpoint = lotId
                ? `/contracts/${encodeURIComponent(id)}/lots/${lotId}/stage5/decision`
                : `/contracts/${encodeURIComponent(id)}/payment/decision`;
            await api.post(endpoint, { decision, remarks: approvalData.remarks });
            navigate('/dashboard');
        } catch (e) {
            alert(e.response?.data?.error || 'Error saving decision');
            setIsSubmitting(false);
        }
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

    console.log("Stage5 state:", { loading, error, hasContract: !!contract });

    // Navigation Enforcement
    useEffect(() => {
        if (!loading && contract) {
            const isPrivileged = Boolean(contract.is_privileged);
            if (isPrivileged) {
                // Privileged: Must have Stage 2 Approved
                if (contract.stage2Decision?.decision !== 'Approve') {
                    console.log("Access Denied: Stage 2 not approved for privileged vendor");
                    navigate('/dashboard');
                }
            } else {
                // Normal: Must have Stage 4 Approved
                if (activeLot?.s4Decision?.decision !== 'Approve') {
                    console.log("Access Denied: Stage 4 not approved for normal vendor");
                    navigate('/dashboard');
                }
            }
        }
    }, [loading, contract, activeLot, navigate]);

    if (loading) return <div className="p-10 text-center flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-500 font-medium">Loading Payment Data...</p>
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
            <p className="text-amber-700 mb-6">We couldn't find the specific lot or contract details for this payment stage.</p>
            <button onClick={() => navigate('/dashboard')} className="bg-amber-600 text-white px-6 py-2 rounded-xl font-bold">Back to Dashboard</button>
        </div>
    </div>;


    const isManager = user.role === 'Manager';
    const isChairman = user.role === 'Chairman';
    const isApproved = activeLot.s5Decision?.decision === 'Approve';
    const isRollbackRequest = activeLot.s5Decision?.decision === 'Modify';
    const canEdit = isManager && (!activeLot.invoice_value || isRollbackRequest);

    return (
        <div className={`mx-auto pb-10 flex flex-col ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}>

            {/* 1. Header & Title */}
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-3xl font-semibold text-slate-900 mb-2">
                        {isChairman ? 'Payment Review' : 'Payment Requisition'}
                        <span className="text-slate-400 font-light mx-2">|</span>
                        <span className="text-lg font-mono text-slate-600">Lot {activeLot.lot_number}</span>
                    </h2>
                </div>
                <div>
                    <div className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${isApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : (activeLot.s5Decision?.decision === 'Reject' ? 'bg-rose-50 border-rose-200 text-rose-700' : (isRollbackRequest ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-50 border-amber-200 text-amber-700'))}`}>
                        {isApproved ? 'Approved' : (activeLot.s5Decision?.decision === 'Reject' ? 'Rejected' : (isRollbackRequest ? 'Revision Required' : (activeLot.s5Decision?.decision || 'Pending Approval')))}
                    </div>
                </div>
            </div>

            {/* 2. Standard Info Grid (Same as Stage 4) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6 items-start flex-shrink-0">
                <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vendor</span>
                    <span className="font-semibold text-slate-900 block">{contract.vendor_name}</span>
                </div>
                <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Contract ID</span>
                    <span className="font-mono font-semibold text-indigo-600 block">{contract.contract_id}</span>
                </div>
                <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">GST Number</span>
                    <span className="font-mono text-slate-700 block text-xs">{contract.gst_number || '-'}</span>
                </div>
                <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sequence</span>
                    <span className="font-mono text-slate-700 block text-xs">{activeLot.sequence_start ? `${activeLot.sequence_start} (${activeLot.no_of_samples})` : '-'}</span>
                </div>
            </div>

            {/* Revision / Rejection Alert Banner - Visible to Manager */}
            {isManager && isRollbackRequest && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 mb-6 flex items-start gap-4 shadow-sm">
                    <div className="bg-amber-200 text-amber-800 rounded-full p-2.5 flex-shrink-0">
                        <RotateCcw size={24} />
                    </div>
                    <div className="flex-grow">
                        <h3 className="font-bold text-amber-900 text-lg">Revision Requested by Chairman</h3>
                        {activeLot.s5Decision?.remarks ? (
                            <p className="text-amber-800 mt-1">
                                <span className="font-semibold">Chairman's Remarks:</span>{' '}
                                <span className="italic">"{activeLot.s5Decision.remarks}"</span>
                            </p>
                        ) : (
                            <p className="text-amber-700 mt-1">No specific remarks provided.</p>
                        )}
                        <p className="text-amber-700 mt-2 text-sm font-medium">Please review and update the payment details below, then click <strong>"Update Bill & Re-submit"</strong> to send back to the Chairman.</p>
                    </div>
                </div>
            )}

            {isManager && activeLot.s5Decision?.decision === 'Reject' && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-5 mb-6 flex items-start gap-4 shadow-sm">
                    <div className="bg-rose-200 text-rose-800 rounded-full p-2.5 flex-shrink-0">
                        <X size={24} />
                    </div>
                    <div className="flex-grow">
                        <h3 className="font-bold text-rose-900 text-lg">Payment Denied by Chairman</h3>
                        {activeLot.s5Decision?.remarks ? (
                            <p className="text-rose-800 mt-1">
                                <span className="font-semibold">Chairman's Remarks:</span>{' '}
                                <span className="italic">"{activeLot.s5Decision.remarks}"</span>
                            </p>
                        ) : (
                            <p className="text-rose-700 mt-1">No specific remarks provided.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Main Content Area - Vertical Stack Layout */}
            <div className="grid grid-cols-1 gap-6 mb-8">

                {/* TOP: Bill Preview - Large */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[900px] relative group">
                    {/* Viewer Toolbar */}
                    <div className="h-14 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-6 z-10">
                        <div className="flex items-center gap-3 text-sm font-semibold text-slate-700 uppercase tracking-tight">
                            <FileText className="text-indigo-600" size={20} />
                            Payment Bill Preview
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg">
                                <button onClick={handleZoomOut} className="p-1 px-2 hover:bg-slate-50 text-slate-400 rounded transition-colors" title="Zoom Out"><ZoomOut size={16} /></button>
                                <span className="text-[10px] font-mono font-bold text-slate-500 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                                <button onClick={handleZoomIn} className="p-1 px-2 hover:bg-slate-50 text-slate-400 rounded transition-colors" title="Zoom In"><ZoomIn size={16} /></button>
                            </div>

                            <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>

                            <button onClick={toggleFitMode} className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium ${fitMode === 'page' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                {fitMode === 'page' ? <Maximize size={16} /> : <Minimize size={16} />}
                                {fitMode === 'page' ? 'Fit Width' : 'Fit Page'}
                            </button>

                            <button onClick={handleDownload} className="p-2 ml-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition-colors" title="Download PDF">
                                <Download size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Viewport - items-start ensures document starts at the top */}
                    <div ref={containerRef} className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50 flex items-start justify-center p-8 scroll-smooth">
                        <div
                            style={{
                                width: `${scale * 794}px`,
                                height: `${scale * 1123}px`,
                                transition: fitMode !== 'manual' ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                                flexShrink: 0,
                                boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.1)'
                            }}
                            className="bg-white overflow-hidden rounded-sm ring-1 ring-slate-200"
                        >
                            <div className="origin-top-left" style={{ width: '794px', height: '1123px', transform: `scale(${scale})` }}>
                                <BillTemplate contract={contract} lot={activeLot} paymentData={isManager && canEdit ? formData : activeLot} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM: Input / Action Panel - Large Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col">
                    <div className="flex-shrink-0 border-b border-slate-100 pb-4 mb-6">
                        <h3 className="text-xl font-bold text-slate-800">
                            {isManager ? 'Payment Entry Details' : 'Payment Details & Approval'}
                        </h3>
                    </div>

                    {/* Content Area */}
                    <div className="flex-grow">
                        {/* Preceding Remarks Section */}
                        {(() => {
                            const isPrivileged = Boolean(contract.is_privileged);
                            const prevDecision = isPrivileged ? contract.stage2Decision : activeLot.s4Decision;
                            const stageLabel = isPrivileged ? "Quality Review" : `CTL Approval (Lot ${activeLot.lot_number})`;

                            if (prevDecision?.remarks) {
                                return (
                                    <div className="mb-8 bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-start gap-3 shadow-sm">
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

                        {isManager ? (
                            <>
                                {/* Display Chairman Remarks if they exist */}
                                {activeLot.s5Decision?.remarks && (
                                    <div className={`p-4 rounded-lg border mb-6 flex items-start gap-4 ${activeLot.s5Decision.decision === 'Modify' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                        activeLot.s5Decision.decision === 'Reject' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                                            'bg-indigo-50 border-indigo-200 text-indigo-800'
                                        }`}>
                                        <AlertCircle size={24} className="flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-bold text-sm uppercase tracking-wider mb-1">
                                                Chairman Remarks ({activeLot.s5Decision.decision})
                                            </h4>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                                {activeLot.s5Decision.remarks}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <form id="manager-form" onSubmit={handleSubmitManager} className={`space-y-8 ${!canEdit ? 'opacity-70 pointer-events-none' : ''}`}>
                                    {/* Section 1 */}
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Invoice Information</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Invoice Number</label>
                                                <input type="text" name="invoice_number" value={formData.invoice_number} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium focus:ring-2 focus:ring-indigo-500" placeholder="e.g. INV-2023-001" required />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Invoice Weight (Kg)</label>
                                                <input type="number" name="invoice_weight" value={formData.invoice_weight} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium focus:ring-2 focus:ring-indigo-500" placeholder="0.00" required />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Cash Discount</label>
                                                <input type="number" name="cash_discount" value={formData.cash_discount} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                                            </div>
                                        </div>
                                        <div className="mt-6 max-w-md">
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Total Invoice Value (₹)</label>
                                            <input type="number" name="invoice_value" value={formData.invoice_value} onChange={handleChange} className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-4 text-2xl font-bold focus:ring-2 focus:ring-indigo-500 shadow-sm" placeholder="0.00" required />
                                        </div>
                                    </div>

                                    {/* Section 2 */}
                                    <div className="pt-6 border-t border-slate-100">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Bank & Remarks</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Bank Name</label>
                                                <input type="text" name="bank_name" value={formData.bank_name} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium" required />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Branch</label>
                                                <input type="text" name="branch" value={formData.branch} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium" required />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Account No</label>
                                                    <input type="text" name="account_no" value={formData.account_no} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-mono font-medium" required />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">IFSC Code</label>
                                                    <input type="text" name="ifsc_code" value={formData.ifsc_code} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-mono font-medium" required />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Payment Mode</label>
                                                    <select name="payment_mode" value={formData.payment_mode} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium focus:ring-2 focus:ring-indigo-500 outline-none">
                                                        <option value="RTGS">RTGS</option>
                                                        <option value="Net Banking">Net Banking</option>
                                                        <option value="NEFT">NEFT</option>
                                                        <option value="IMPS">IMPS</option>
                                                        <option value="Cheque">Cheque</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Ref No / UTR</label>
                                                    <input type="text" name="rtgs_reference_no" value={formData.rtgs_reference_no} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium" placeholder="Reference #" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-6">
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Supplied To (Unit)</label>
                                            <select name="supplied_to" value={formData.supplied_to} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 font-medium focus:ring-2 focus:ring-indigo-500 outline-none">
                                                <option value="TML, UNIT - I, KAPPALUR">TML, UNIT - I, KAPPALUR</option>
                                                <option value="TML, UNIT - III, NILAKOTTAI">TML, UNIT - III, NILAKOTTAI</option>
                                            </select>
                                        </div>
                                        <div className="mt-6">
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Manager Remarks</label>
                                            <textarea
                                                name="remarks"
                                                value={formData.remarks}
                                                onChange={handleChange}
                                                placeholder="Optional remarks for payment approval..."
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-4 h-32 font-medium focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </form>
                            </>
                        ) : (
                            /* Chairman Read-Only View */
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Invoice Summary</label>
                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                                                <span className="text-slate-600 font-bold">{activeLot.invoice_number}</span>
                                                <span className="text-2xl font-bold text-slate-900">₹ {activeLot.invoice_value}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm">
                                                <label className="block text-[10px] uppercase font-bold text-indigo-500 mb-1 tracking-wider">Net Payable</label>
                                                <div className="text-2xl font-bold text-indigo-700 font-mono">₹ {activeLot.net_amount_paid}</div>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">TDS Deduction</label>
                                                <div className="text-xl font-bold text-slate-600 font-mono">₹ {activeLot.tds_amount}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Remittance Details</label>
                                            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 text-sm space-y-3 shadow-sm font-medium">
                                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                                    <span className="text-slate-400">Bank</span>
                                                    <span className="text-slate-800">{activeLot.bank_name}</span>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                                    <span className="text-slate-400">Branch</span>
                                                    <span className="text-slate-800">{activeLot.branch}</span>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                                    <span className="text-slate-400">Account</span>
                                                    <span className="text-slate-800 font-mono">{activeLot.account_no}</span>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                                    <span className="text-slate-400">IFSC / Mode</span>
                                                    <span className="text-slate-800">{activeLot.ifsc_code} | <span className="font-bold text-indigo-600">{activeLot.payment_mode}</span></span>
                                                </div>
                                                <div className="flex justify-between items-center pt-1 font-medium italic text-slate-500">
                                                    <span>Ref: {activeLot.rtgs_reference_no || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pt-6">
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Supply Destination</label>
                                            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-3 shadow-sm">
                                                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                                                    <RotateCcw size={20} className="rotate-90" />
                                                </div>
                                                <span className="font-bold text-indigo-900 text-sm">{activeLot.supplied_to || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100">
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Manager Observations</label>
                                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 italic whitespace-pre-wrap leading-relaxed">
                                        {activeLot.stage5_remarks || 'No remarks provided by the manager.'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chairman Audit Panel - Full Width */}
            {isChairman && !isApproved && !activeLot.s5Decision?.decision && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <label className="block text-base font-semibold text-slate-700 mb-3 uppercase tracking-tight">Chairman Payment Audit</label>
                    <div className="space-y-4">
                        <textarea
                            rows="2"
                            className="w-full border border-slate-300 rounded-lg p-4 text-base focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                            placeholder="Enter audit observations..."
                            value={approvalData.remarks}
                            onChange={(e) => setApprovalData({ ...approvalData, remarks: e.target.value })}
                        />
                        <div className="flex gap-4">
                            <button onClick={() => handleSubmitChairman('Reject')} className="flex-1 bg-white border-2 border-rose-200 text-rose-700 hover:bg-rose-50 px-4 py-4 rounded-xl font-semibold transition-all shadow-sm flex items-center justify-center gap-2">
                                <X size={20} /> <span className="text-lg">Deny</span>
                            </button>
                            <button onClick={() => handleSubmitChairman('Modify')} className="flex-1 bg-amber-100 border-2 border-amber-200 text-amber-800 hover:bg-amber-200 px-4 py-4 rounded-xl font-semibold transition-all shadow-sm flex items-center justify-center gap-2">
                                <RotateCcw size={20} /> <span className="text-lg">Revision</span>
                            </button>
                            <button onClick={() => handleSubmitChairman('Approve')} className="flex-[2] bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                                <Check size={24} /> <span className="text-lg">Approve for Payment</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Strip - Full Width */}
            {(() => {
                const decision = activeLot.s5Decision?.decision;
                const remarks = activeLot.s5Decision?.remarks;
                if (decision === 'Approve') return (
                    <div className="rounded-xl border p-4 shadow-sm bg-emerald-50 border-emerald-100">
                        <div className="flex items-center space-x-3">
                            <div className="bg-emerald-100 text-emerald-700 rounded-full p-2"><Check size={24} /></div>
                            <div>
                                <p className="font-bold text-base text-emerald-800">Payment Authorized</p>
                                <p className="text-sm text-emerald-600 opacity-75">Lot has been cleared for final settlement.</p>
                                {remarks && (
                                    <div className="mt-2 pt-2 border-t border-emerald-200">
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">Chairman Remark</span>
                                        <p className="text-sm text-emerald-700 italic">"{remarks}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
                if (decision === 'Reject') return (
                    <div className="rounded-xl border p-4 shadow-sm bg-rose-50 border-rose-100">
                        <div className="flex items-center space-x-3">
                            <div className="bg-rose-100 text-rose-700 rounded-full p-2"><X size={24} /></div>
                            <div>
                                <p className="font-bold text-base text-rose-800">Payment Denied by Chairman</p>
                                {remarks && (
                                    <div className="mt-2 pt-2 border-t border-rose-200">
                                        <span className="text-[10px] font-bold text-rose-600 uppercase block mb-1">Chairman Remark</span>
                                        <p className="text-sm text-rose-700 italic">"{remarks}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
                if (decision === 'Modify') return (
                    <div className="rounded-xl border-2 p-5 shadow-sm bg-amber-50 border-amber-300">
                        <div className="flex items-center space-x-3">
                            <div className="bg-amber-200 text-amber-800 rounded-full p-2"><RotateCcw size={24} /></div>
                            <div>
                                <p className="font-bold text-base text-amber-900">Revision Requested by Chairman</p>
                                {remarks && (
                                    <div className="mt-2 pt-2 border-t border-amber-200">
                                        <span className="text-[10px] font-bold text-amber-600 uppercase block mb-1">Chairman Remark</span>
                                        <p className="text-sm text-amber-800 italic">"{remarks}"</p>
                                    </div>
                                )}
                                {isManager && <p className="text-sm text-amber-700 mt-2 font-semibold">Please update the payment details above and click "Update Bill & Re-submit".</p>}
                            </div>
                        </div>
                    </div>
                );
                return null;
            })()}

            {isManager && canEdit && (
                <div className="mt-8 pt-8 border-t border-slate-200 flex flex-col items-center">
                    <div className="mb-6 flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 shadow-inner">
                        <span className="text-slate-500 font-semibold uppercase tracking-wider text-sm">Net Payable Amount</span>
                        <span className="font-mono font-semibold text-slate-900 text-3xl">₹ {formData.net_amount_paid || '0.00'}</span>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            document.getElementById('manager-form').requestSubmit();
                        }}
                        className={`w-full max-w-2xl px-6 py-5 rounded-2xl font-semibold shadow-xl transition-all flex items-center justify-center gap-3 text-xl ${isRollbackRequest ? 'bg-amber-600 hover:bg-slate-900 text-white hover:shadow-amber-500/30' : 'bg-indigo-600 hover:bg-slate-900 text-white hover:shadow-indigo-500/30'} active:scale-[0.98]`}
                    >
                        {isRollbackRequest ? <RotateCcw size={28} /> : <Check size={28} />}
                        {isRollbackRequest ? "Update Bill & Re-submit" : "Generate Final Bill"}
                    </button>
                    <p className="mt-4 text-slate-400 text-xs font-medium">Please review the bill preview on the left before generating.</p>
                </div>
            )}
        </div>
    );
}
