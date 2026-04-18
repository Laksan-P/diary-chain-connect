import React from 'react';

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const classMap: Record<string, string> = {
    Pass: 'status-pass',
    Fail: 'status-fail',
    Approved: 'status-approved',
    Rejected: 'status-rejected',
    Pending: 'status-pending',
    Dispatched: 'status-dispatched',
    Verified: 'status-pending',
    'Rejected (Mixed)': 'status-pending',
    Paid: 'status-paid',
  };

  return <span className={classMap[status] || 'status-pending'}>{status}</span>;
};
