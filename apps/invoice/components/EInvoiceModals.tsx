import React from 'react';
import { InvoiceData } from '@/types';
import { getEInvoiceDownloadUrl } from '../services/sePayService';

interface EInvoiceModalsProps {
  theme: string;
  invoice: InvoiceData;
  // Save confirm modal
  showSaveConfirm: boolean;
  pendingInvoiceToSave: InvoiceData | null;
  onConfirmSave: () => void;
  onDismissSave: () => void;
  // eInvoice prompt modal
  showEInvoicePrompt: boolean;
  eInvoiceTargetInvoice: InvoiceData | null;
  onCreateEInvoice: (inv: InvoiceData) => void;
  onDismissEInvoicePrompt: () => void;
  // eInvoice progress/result modal
  showEInvoiceModal: boolean;
  eInvoiceProgress: string | null;
  eInvoiceResult: { pdf_url: string; reference_code: string; tracking_code: string } | null;
  eInvoiceError: string | null;
  pdfDownloading: boolean;
  onCloseEInvoiceModal: () => void;
}

export const EInvoiceModals: React.FC<EInvoiceModalsProps> = ({
  theme, invoice,
  showSaveConfirm, pendingInvoiceToSave, onConfirmSave, onDismissSave,
  showEInvoicePrompt, eInvoiceTargetInvoice, onCreateEInvoice, onDismissEInvoicePrompt,
  showEInvoiceModal, eInvoiceProgress, eInvoiceResult, eInvoiceError, pdfDownloading, onCloseEInvoiceModal,
}) => (
  <>
    {/* Save Invoice Confirmation Modal */}
    {showSaveConfirm && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
        <div className={`w-full max-w-md p-8 rounded-[28px] border shadow-2xl animate-fadeInUp ${theme === 'dark' ? 'bg-[#1A1A1A] border-primary/20' : 'bg-white border-gray-200'}`}>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </div>
          <h3 className={`text-xl font-black uppercase tracking-tighter text-center mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Save Invoice?</h3>
          <p className={`text-sm text-center mb-8 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>
            Do you want to save invoice <span className="font-black text-primary">{pendingInvoiceToSave?.invoiceNumber}</span> to database?
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={onDismissSave}
              className={`py-4 rounded-2xl text-sm font-black uppercase tracking-widest border transition-all hover:scale-[1.02] ${theme === 'dark' ? 'border-white/10 text-white/60 hover:text-white hover:border-white/30' : 'border-gray-200 text-gray-500 hover:text-black hover:border-gray-400'}`}>
              No
            </button>
            <button onClick={onConfirmSave}
              className="py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-primary text-black transition-all hover:scale-[1.02] hover:bg-primary/90 shadow-btn-glow">
              Yes, Save Now!
            </button>
          </div>
        </div>
      </div>
    )}

    {/* eInvoice Prompt — shown after saving an invoice */}
    {showEInvoicePrompt && eInvoiceTargetInvoice && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
        <div className={`w-full max-w-md p-8 rounded-[28px] border shadow-2xl animate-fadeInUp ${theme === 'dark' ? 'bg-[#1A1A1A] border-primary/20' : 'bg-white border-gray-200'}`}>
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">📄</span>
          </div>
          <h3 className={`text-xl font-black uppercase tracking-tighter text-center mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Create eInvoice?</h3>
          <p className={`text-sm text-center mb-8 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>
            Invoice <span className="font-black text-primary">{eInvoiceTargetInvoice.invoiceNumber}</span> has been saved. Would you like to create an eInvoice now?
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={onDismissEInvoicePrompt}
              className={`py-4 rounded-2xl text-sm font-black uppercase tracking-widest border transition-all hover:scale-[1.02] ${theme === 'dark' ? 'border-white/10 text-white/60 hover:text-white hover:border-white/30' : 'border-gray-200 text-gray-500 hover:text-black hover:border-gray-400'}`}>
              Later
            </button>
            <button onClick={() => onCreateEInvoice(eInvoiceTargetInvoice)}
              className="py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-emerald-500 text-white transition-all hover:scale-[1.02] hover:bg-emerald-600 shadow-lg">
              Create Now!
            </button>
          </div>
        </div>
      </div>
    )}

    {/* eInvoice Progress/Result Modal */}
    {showEInvoiceModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
        <div className={`w-full max-w-md p-8 rounded-[28px] border shadow-2xl animate-fadeInUp ${theme === 'dark' ? 'bg-[#1A1A1A] border-primary/20' : 'bg-white border-gray-200'}`}>
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">📄</span>
          </div>
          <h3 className={`text-xl font-black uppercase tracking-tighter text-center mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            {eInvoiceResult ? 'Success!' : eInvoiceError ? 'Error Occurred' : 'Creating eInvoice...'}
          </h3>

          {eInvoiceProgress && (
            <div className="text-center mb-6">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <p className={`text-sm ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>{eInvoiceProgress}</p>
            </div>
          )}

          {eInvoiceResult && (
            <div className="text-center mb-6 space-y-3">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl">✓</div>
              <p className={`text-sm ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>
                Reference: <span className="font-black text-primary">{eInvoiceResult.reference_code}</span>
              </p>
              {eInvoiceResult.pdf_url ? (
                pdfDownloading ? (
                  <div className="flex items-center gap-2 justify-center py-3">
                    <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                    <span className="text-sm text-emerald-400 font-bold">Downloading PDF...</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const url = getEInvoiceDownloadUrl({
                        referenceCode: eInvoiceResult.reference_code || '',
                        trackingCode: eInvoiceResult.tracking_code || '',
                        pdfUrl: eInvoiceResult.pdf_url || '',
                        filename: `eInvoice_${eInvoiceResult.reference_code}`,
                      });
                      window.open(url, '_blank');
                    }}
                    className="inline-block px-6 py-3 rounded-2xl bg-emerald-500 text-white font-black text-sm uppercase tracking-widest hover:bg-emerald-600 transition-all cursor-pointer"
                  >
                    📥 Download Draft PDF
                  </button>
                )
              ) : (
                <p className={`text-sm font-bold ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
                  ⏳ PDF is being generated. Check SePay Portal for the draft.
                </p>
              )}
              <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-neutral-medium/60' : 'text-gray-400'}`}>
                Go to <strong>SePay Portal</strong> to sign and publish officially
              </p>
            </div>
          )}

          {eInvoiceError && (
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto text-2xl mb-3">✗</div>
              <p className="text-sm text-red-400 font-bold">{eInvoiceError}</p>
            </div>
          )}

          {(eInvoiceResult || eInvoiceError) && (
            <button onClick={onCloseEInvoiceModal}
              className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest border transition-all hover:scale-[1.02] mt-2 ${theme === 'dark' ? 'border-white/10 text-white/60 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-black'}`}>
              Close
            </button>
          )}
        </div>
      </div>
    )}
  </>
);
