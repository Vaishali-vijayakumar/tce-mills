import React, { useState } from 'react';
import api from '../api';

export default function AddVendorModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        vendor_name: '',
        gst_number: '',
        state: '',
        email: '',
        phone_number: '',
        address: '',
        is_privileged: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await api.post('/vendors', formData);
            onSuccess();
            onClose();
            setFormData({
                vendor_name: '',
                gst_number: '',
                state: '',
                email: '',
                phone_number: '',
                address: '',
                is_privileged: false
            });
        } catch (err) {
            console.error("Error adding vendor:", err);
            const errorMsg = err.response?.data?.error || err.message || "Failed to add vendor";
            alert(`Debug Error: ${errorMsg}`);
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Add New Vendor</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-xs">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="vendor_name" className="block text-xs font-medium text-slate-700 mb-1">Vendor Name *</label>
                        <input
                            id="vendor_name"
                            type="text"
                            name="vendor_name"
                            required
                            value={formData.vendor_name}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter vendor name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="gst_number" className="block text-xs font-medium text-slate-700 mb-1">GST Number *</label>
                            <input
                                id="gst_number"
                                type="text"
                                name="gst_number"
                                required
                                value={formData.gst_number}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="GST Number"
                            />
                        </div>
                        <div>
                            <label htmlFor="phone_number" className="block text-xs font-medium text-slate-700 mb-1">Phone Number *</label>
                            <input
                                id="phone_number"
                                type="tel"
                                name="phone_number"
                                required
                                value={formData.phone_number}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Phone"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="state" className="block text-xs font-medium text-slate-700 mb-1">State *</label>
                            <input
                                id="state"
                                type="text"
                                name="state"
                                required
                                value={formData.state}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="State"
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Email (Optional)"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="address" className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                        <textarea
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            rows="2"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Full address (Optional)"
                        />
                    </div>

                    <div className="flex items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                        <input
                            id="is_privileged"
                            name="is_privileged"
                            type="checkbox"
                            checked={formData.is_privileged}
                            onChange={handleChange}
                            className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="is_privileged" className="ml-3 block text-xs text-indigo-900 font-medium cursor-pointer">
                            Privileged Vendor
                        </label>
                    </div>

                    <div className="flex justify-end pt-4 gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? 'Adding...' : 'Add Vendor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
