import React from 'react';
import { cn } from '../utils/cn';

/**
 * DataTable — fully responsive
 * • Mobile (<640 px): each row = stacked label-value card
 * • Tablet / Desktop: horizontal-scroll table
 */
export const DataTable = ({ columns, data, title }) => {
  const actionCol = columns.find(c => c.header === 'Actions');
  const dataCols  = columns.filter(c => c.header !== 'Actions');

  if (data.length === 0) {
    return (
      <div className="premium-card py-14 text-center">
        <p className="text-gray-400 text-sm font-medium">No records found.</p>
      </div>
    );
  }

  return (
    <div className="premium-card overflow-hidden p-0">
      {title && (
        <div className="px-4 sm:px-5 py-4 border-b border-gray-50">
          <h3 className="section-title">{title}</h3>
        </div>
      )}

      {/* ── Mobile Card List (<sm) ──────────────────────── */}
      <div className="sm:hidden divide-y divide-gray-50">
        {data.map((row, rowIdx) => (
          <div key={rowIdx} className="p-4 space-y-2.5 animate-fade-slide-up hover:bg-gray-50/50 transition-colors">
            {dataCols.map((col, colIdx) => {
              const value = col.render ? col.render(row) : row[col.accessor];
              if (value === null || value === undefined || value === '') return null;
              return (
                <div key={colIdx} className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0 pt-0.5 mt-0.5">
                    {col.header}
                  </span>
                  <span className="text-[13px] font-semibold text-right text-gray-800 min-w-0">
                    {value}
                  </span>
                </div>
              );
            })}
            {actionCol && (
              <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                {actionCol.render(row)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Desktop Scrollable Table (≥sm) ──────────────── */}
      <div className="hidden sm:block table-scroll-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={cn(
                    'text-[13px] font-medium',
                    col.header === 'Actions' && 'text-right'
                  )}>
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
