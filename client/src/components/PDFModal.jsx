import React, { useState } from 'react';
import { X, Check, Upload, ExternalLink, Download } from 'lucide-react';

export default function PDFModal({ isOpen, onClose, fileUrl, onReupload, onVerified }) {
    const [iframeError, setIframeError] = useState(false);

    if (!isOpen || !fileUrl) return null;

    // Use Google Docs Viewer to reliably render any PDF (including Supabase URLs that block iframe embedding)
    const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="w-full flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        📄 Document Viewer
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Open in new tab */}
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100"
                        >
                            <ExternalLink size={14} /> Open in Tab
                        </a>
                        <a
                            href={fileUrl}
                            download
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                        >
                            <Download size={14} /> Download
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* PDF Content */}
                <div className="flex-1 bg-slate-100 overflow-hidden relative">
                    {!iframeError ? (
                        <iframe
                            key={googleDocsUrl}
                            src={googleDocsUrl}
                            className="w-full h-full border-none"
                            title="PDF Viewer"
                            onError={() => setIframeError(true)}
                        />
                    ) : (
                        // Fallback: direct link if Google Docs viewer also fails
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
                            <p className="text-sm font-medium">Unable to preview inline.</p>
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700"
                            >
                                <ExternalLink size={16} /> Open PDF in New Tab
                            </a>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="w-full p-4 border-t border-slate-100 bg-white flex justify-between items-center rounded-b-xl shrink-0">
                    <div className="flex items-center gap-2">
                        {onReupload && (
                            <button
                                type="button"
                                onClick={onReupload}
                                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200 transition-all border border-slate-200"
                            >
                                <Upload size={18} /> Reupload
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onVerified || onClose}
                        className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md hover:shadow-indigo-500/20 transition-all"
                    >
                        <Check size={18} /> Verified
                    </button>
                </div>
            </div>
        </div>
    );
}
