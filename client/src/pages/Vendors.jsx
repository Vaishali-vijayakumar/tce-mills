import React, { useState, useEffect } from 'react';
import api from '../api';
import AddVendorModal from '../components/AddVendorModal';
import { Crown } from 'lucide-react';

export default function Vendors() {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchVendors();
    }, []);

    const [error, setError] = useState('');

    useEffect(() => {
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        try {
            console.log("DEBUG: Fetching vendors...");
            const res = await api.get('/vendors');
            console.log("DEBUG: Vendors response:", res.data);
            setVendors(res.data);
            setError('');
        } catch (e) {
            console.error("Error fetching vendors:", e);
            setError(e.response?.status === 403 ? "Access Denied (403) - Try Logging Out & In" : e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-slate-900">Vendor Directory</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Vendor
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-xs font-semibold tracking-wider">
                                <th className="p-4">ID</th>
                                <th className="p-4">Vendor Name</th>
                                <th className="p-4">GST Number</th>
                                <th className="p-4">State</th>
                                <th className="p-4">Email</th>
                                <th className="p-4">Phone</th>
                                <th className="p-4">Address</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                            {loading ? (
                                <tr><td colSpan="7" className="p-6 text-center text-slate-500">Loading vendors...</td></tr>
                            ) : error ? (
                                <tr><td colSpan="7" className="p-6 text-center text-red-500 font-bold">{error}</td></tr>
                            ) : vendors.length === 0 ? (
                                <tr><td colSpan="7" className="p-6 text-center text-slate-500">No vendors found.</td></tr>
                            ) : (
                                vendors.map((vendor) => (
                                    <tr key={vendor.vendor_id} className={`transition-colors ${Boolean(vendor.is_privileged) ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400' : 'hover:bg-indigo-50/50'}`}>
                                        <td className="p-4 font-mono text-indigo-600 font-semibold">#{vendor.vendor_id}</td>
                                        <td className="p-4 font-semibold text-slate-900 flex items-center gap-2">
                                            {vendor.vendor_name}
                                            {Boolean(vendor.is_privileged) && <Crown size={16} className="text-amber-500 fill-amber-500" title="Privileged Vendor" />}
                                        </td>
                                        <td className="p-4">{vendor.gst_number}</td>
                                        <td className="p-4">{vendor.state}</td>
                                        <td className="p-4 text-slate-500">{vendor.email || '-'}</td>
                                        <td className="p-4 text-slate-500">{vendor.phone_number || '-'}</td>
                                        <td className="p-4 max-w-xs truncate text-slate-500" title={vendor.address}>{vendor.address || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddVendorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchVendors}
            />
        </div>
    );
}
