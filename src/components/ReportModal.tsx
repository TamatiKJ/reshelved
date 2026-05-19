import React from 'react';

interface ReportModalProps {
  reason: string;
  details: string;
  loading: boolean;
  onReasonChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({
  reason,
  details,
  loading,
  onReasonChange,
  onDetailsChange,
  onClose,
  onSubmit
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl max-w-md w-full p-6">
      <h3 className="text-lg font-bold text-stone-800">Report Listing</h3>
      <p className="text-sm text-stone-500 mt-1">Help us understand what's wrong</p>
      <div className="mt-4 space-y-3">
        <select value={reason} onChange={(event) => onReasonChange(event.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm bg-white">
          <option value="">Select a reason...</option>
          <option value="spam">Spam or misleading</option>
          <option value="inappropriate">Inappropriate content</option>
          <option value="fraud">Suspected fraud</option>
          <option value="prohibited">Prohibited item</option>
          <option value="other">Other</option>
        </select>
        <textarea value={details} onChange={(event) => onDetailsChange(event.target.value)} placeholder="Additional details..." rows={3} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm resize-none" />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium">Cancel</button>
          <button type="button" onClick={onSubmit} disabled={!reason || loading} className="cursor-pointer flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Submit Report</button>
        </div>
      </div>
    </div>
  </div>
);

export default ReportModal;
