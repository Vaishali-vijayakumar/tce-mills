import React from 'react';

const BillTemplate = ({ contract, lot, paymentData }) => {
    // Helper to format currency
    const fmt = (val) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
    const dateFmt = (d) => {
        if (!d) return '';
        const date = new Date(d);
        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} `;
    };

    // Data Extraction
    const partyName = contract?.vendor_name || '';
    const partyAddress = contract?.address || '21, MITTAL CHAMBERS,\n228, NARIMAN POINT, \nMUMBAI - 400 021';

    // Dates
    const currentDate = dateFmt(new Date());
    const arrivalDate = dateFmt(lot?.arrival_date);
    const contractDate = dateFmt(contract?.entry_date);
    // Calculated Payment Date (Next Day)
    const paymentDateObj = new Date();
    paymentDateObj.setDate(paymentDateObj.getDate() + 1);
    const paymentDate = dateFmt(paymentDateObj);

    // Amounts
    const invoiceVal = parseFloat(paymentData?.invoice_value || 0);
    const tds = parseFloat(paymentData?.tds_amount || 0);
    const discount = parseFloat(paymentData?.cash_discount || 0);
    const netAmount = parseFloat(paymentData?.net_amount_paid || 0);

    return (
        <>
            <style>
                {`
                    @media print {
                        @page { 
                            size: A4; 
                            margin: 0 !important; 
                        }
                        body { 
                            margin: 0 !important;
                            padding: 0 !important; 
                        }
                        /* Ensure background colors print */
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                `}
            </style>
            {/* Main Sheet Container - Strict A4 Dimensions */}
            <div
                id="payment-bill-node"
                className="bg-white mx-auto text-black font-sans text-[14px] leading-tight shadow-lg select-none flex flex-col relative"
                style={{
                    width: '210mm',
                    height: '297mm', // Keep A4 height
                    padding: '10mm',
                    boxSizing: 'border-box'
                }}
            >

                {/* Header Section */}
                <div className="flex justify-center mb-2">
                    <div className="border border-black px-4 py-2 font-bold text-[15px] shadow-[2px_2px_0_rgba(0,0,0,0.1)]">
                        COTTON PAYMENT REQUISITION
                    </div>
                </div>

                <div className="text-right mb-2 font-bold text-base">
                    Date: {currentDate}
                </div>

                {/* Instruction Line */}
                <div className="mb-2 pl-1 text-[12px] italic">
                    Kindly instruct us to remit the payment to the following party on ...<span className="underline font-bold not-italic ml-2">{paymentDate}</span>
                </div>

                {/* Main Details Grid - Compact, No Flex Grow */}
                <div className="border-2 border-black">

                    {/* 1. PARTY */}
                    <div className="flex border-b border-black">
                        <div className="w-[180px] p-2 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30 text-[13px]">1. PARTY:</div>
                        <div className="p-1.5 pl-4 uppercase flex flex-col justify-center">
                            <div className="font-bold text-[15px]">M/s. {partyName}</div>
                            <div className="whitespace-pre-wrap text-gray-700 leading-normal">{partyAddress}</div>
                        </div>
                    </div>

                    {/* Agent Box */}
                    <div className="flex border-b border-black">
                        <div className="w-[250px] flex border-r border-black shrink-0">
                            <div className="w-[180px] p-1.5 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30">AGENT:</div>
                            <div className="p-2 pl-4 uppercase font-bold text-[13px] flex items-center">DIRECT</div>
                        </div>
                        <div className="grow bg-gray-100/20"></div>
                    </div>

                    {/* 2. Purchase Contract */}
                    <div className="flex border-b border-black items-center py-0.5">
                        <div className="w-[180px] p-2 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30 self-stretch flex items-center text-[13px]">2 PURCHASE CONTRACT NO :</div>
                        <div className="p-2 pl-4 uppercase font-bold text-[13px] grow flex gap-6">
                            <span>{contract?.contract_id}/2025-2026</span>
                            <span>Dt : {contractDate}</span>
                        </div>
                    </div>

                    {/* 3. Arrival Date */}
                    <div className="flex border-b border-black items-center py-0.5">
                        <div className="w-[180px] p-2 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30 self-stretch flex items-center text-[13px]">3. ARRIVAL DATE (at mills)</div>
                        <div className="p-2 pl-4 text-[13px]">{arrivalDate}</div>
                    </div>

                    {/* 4. Variety */}
                    <div className="flex border-b border-black items-center py-0.5">
                        <div className="w-[180px] p-2 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30 self-stretch flex items-center text-[13px]">4. VARIETY</div>
                        <div className="p-2 pl-4 uppercase text-[13px]">{contract?.cotton_type} {contract?.quality}</div>
                    </div>

                    {/* 5. Purchase Rate */}
                    <div className="flex border-b border-black items-center py-0.5">
                        <div className="w-[180px] p-2 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30 self-stretch flex items-center text-[13px]">5. PURCHASE RATE</div>
                        <div className="p-2 pl-4 font-medium text-[13px]">Rs.{contract?.price}/- Spot Per Candy</div>
                    </div>

                    {/* 6. Bales & 7. Nett Weight */}
                    <div className="flex border-b border-black items-center py-0.5">
                        <div className="w-[180px] p-2 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30 self-stretch flex items-center text-[13px]">6. BALES</div>
                        <div className="w-[150px] p-2 pl-4 border-r border-black shrink-0 text-[13px]">{contract?.quantity} BALES</div>
                        <div className="w-[120px] p-2 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30 self-stretch flex items-center text-[13px]">7. NET WEIGHT</div>
                        <div className="p-2 pl-4 text-[13px]">{paymentData?.invoice_weight} KGS</div>
                    </div>

                    {/* 8. Party Lot */}
                    <div className="flex border-b border-black py-1">
                        <div className="w-[180px] p-2 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30 self-stretch flex items-center text-[13px]">8 PARTY LOT</div>
                        <div className="p-2 pl-4 flex flex-col gap-1 text-[13px]">
                            <div className="font-bold text-[14px]">LOT - {lot?.lot_number}</div>
                            <div>Invoice No: <b className="text-[13px]">{paymentData?.invoice_number}</b> &nbsp;|&nbsp; DT: {arrivalDate}</div>
                        </div>
                    </div>

                    {/* 9. Payment Value */}
                    <div className="flex border-b border-black py-1">
                        <div className="w-[180px] p-2 pl-3 border-r border-black shrink-0 flex items-center font-bold bg-gray-50/30 self-stretch text-[13px]">9 PAYMENT VALUE</div>
                        <div className="grow p-2 text-[13px]">
                            <div className="flex justify-between w-[400px] ml-auto px-6 mb-1">
                                <span>Total Invoice Value</span>
                                <div className="flex gap-6">
                                    <span>Rs</span>
                                    <span className="font-mono text-right w-[100px] font-medium">{fmt(invoiceVal)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between w-[400px] ml-auto px-6 mb-1">
                                <span>Less: Tds @ 0.10%</span>
                                <div className="flex gap-6">
                                    <span>Rs.</span>
                                    <span className="font-mono text-right w-[100px] text-gray-600">{fmt(tds)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between w-[400px] ml-auto px-6 border-b border-gray-300 pb-1 mb-1">
                                <span>Less: Cash Discount (including Gst)</span>
                                <div className="flex gap-6">
                                    <span>Rs.</span>
                                    <span className="font-mono text-right w-[100px] text-gray-600">{fmt(discount)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between w-[400px] ml-auto px-6 pt-0 font-bold text-[14px]">
                                <span>Net Amount Paid</span>
                                <div className="flex gap-6">
                                    <span>Rs.</span>
                                    <span className="font-mono text-right w-[100px]">{fmt(netAmount)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 10. Remarks */}
                    <div className="flex border-b border-black min-h-[40px]">
                        <div className="w-[180px] p-1.5 pl-3 border-r border-black shrink-0 pt-2 font-bold bg-gray-50/30">10.REMARKS</div>
                        <div className="p-1.5 pl-4 pt-2 w-full break-all italic text-gray-600">
                            {paymentData?.special_remarks || lot?.stage5_remarks || 'No Remarks'}
                        </div>
                    </div>

                    {/* 11. Supplied To */}
                    <div className="flex border-b border-black items-center py-2">
                        <div className="w-[180px] p-1.5 pl-3 border-r border-black shrink-0 border-r-0 font-bold bg-gray-50/30 self-stretch flex items-center">11. SUPPLIED TO</div>
                        <div className="p-1.5 pl-0 uppercase font-medium">
                            ... TML, UNIT - I , KAPPALUR / TML, UNIT-III, NILAKOTTAI {contract?.quantity} BALES
                        </div>
                    </div>

                    {/* Bank Details Table */}
                    <div className="flex border-t border-black text-[13px]">
                        <div className="w-[60%] border-r border-black">
                            {/* Rows */}
                            <div className="flex border-b border-black py-0.5">
                                <div className="w-[120px] p-1.5 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30">BANK NAME</div>
                                <div className="p-1.5 pl-4 uppercase font-bold">{paymentData?.bank_name}</div>
                            </div>
                            <div className="flex border-b border-black py-0.5">
                                <div className="w-[120px] p-1.5 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30">BRANCH</div>
                                <div className="p-1.5 pl-4 uppercase">{paymentData?.branch}</div>
                            </div>
                            <div className="flex border-b border-black py-0.5">
                                <div className="w-[120px] p-1.5 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30">ACCOUNT No.</div>
                                <div className="p-1.5 pl-4 font-mono font-bold tracking-wider">{paymentData?.account_no}</div>
                            </div>
                            <div className="flex py-0.5">
                                <div className="w-[120px] p-1.5 pl-3 border-r border-black shrink-0 font-bold bg-gray-50/30">IFSC CODE</div>
                                <div className="p-1.5 pl-4 font-mono font-bold tracking-wider">{paymentData?.ifsc_code}</div>
                            </div>
                        </div>
                        {/* RTGS Box */}
                        <div className="w-[40%] flex items-center justify-center font-bold text-[18px] text-gray-400">
                            RTGS
                        </div>
                    </div>

                    {/* Bottom Footer - Compact */}
                    <div className="flex border-t border-black min-h-[60px]">
                        {/* Left: Code & Text */}
                        <div className="w-[60%] border-r border-black p-2 flex flex-col justify-between">
                            <div className="text-gray-500 font-mono">01-284 -0402</div>
                            <div className="font-bold border-t-2 border-gray-300 mt-auto pt-1 text-[11px]">
                                01-142 &nbsp;&nbsp;&nbsp; PAYMENT {contract?.quantity} B/S {contract?.cotton_type} KVS LOT - {lot?.lot_number}
                            </div>
                        </div>

                        {/* Right: Totals */}
                        <div className="w-[40%] flex flex-col">
                            {/* Rows for alignment */}
                            <div className="h-[30px] border-b border-black flex justify-between items-end px-3 pb-1 text-[16px]">
                                <span>Rs</span>
                                <span className="font-mono font-bold">{fmt(netAmount)}</span>
                            </div>
                            <div className="text-center mt-2 text-[15px] font-bold">CRF 07-284-0402</div>
                            <div className="flex justify-between items-center px-3 py-2 font-bold text-[17px] mt-auto">
                                <span>TOTAL &nbsp;&nbsp; Rs.</span>
                                <span className="font-mono">{fmt(netAmount)}</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* E-Signature & Timestamp Area - Immediately after content */}
                <div className="mt-4 flex justify-between items-end px-2">
                    {/* Timestamp Details */}
                    <div className="text-[12px] text-gray-500 text-left border-l-2 border-gray-300 pl-3">
                        <div className="font-bold uppercase tracking-wide mb-1 text-[13px]">Digitally Timestamped</div>
                        <div>Date: <span>{currentDate}</span></div>
                        <div>Time: <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>
                        <div className="text-[10px] mt-1 text-gray-400">ID: {lot?.lot_id} | {contract?.contract_id}</div>
                    </div>

                    {/* E-Sign Box */}
                    <div className="text-center">
                        <div className="w-[200px] h-[50px] border-b border-dashed border-gray-400 mb-1 flex flex-col items-center justify-end pb-1">
                            <span className="text-[20px] font-cursive text-indigo-900 opacity-80" style={{ fontFamily: 'cursive' }}>
                                Authorized Sign
                            </span>
                        </div>
                        <div className="text-center mt-1 text-[14px] font-bold">Authorized Signatory</div>
                        <div className="text-[12px] text-gray-500">For Thiagarajar Mills Pvt Ltd</div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default BillTemplate;
