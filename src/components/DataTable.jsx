import React from 'react';
import { cn } from '../utils/cn';

/**
 * DataTable — fully responsive:
 * - Mobile (<640px): renders each row as a stacked card
 * - Tablet+:         horizontal scroll table
 */
export const DataTable = ({ columns, data, title }) => {
  // Separate "Actions" column for card layout
  const actionCol = columns.find(c => c.header === 'Actions');
  const dataCols  = columns.filter(c => c.header !== 'Actions');

  return (
    <div className="premium-card overflow-hidden">
      {title && (
        <div className="mb-5">
          <h3 className="text-base sm:text-lg font-bold">{title}</h3>
        </div>
      )}

      {data.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-gray-400 text-sm font-medium">No records found.</p>
        </div>
      ) : (
        <>
          {/* ── Mobile Card List (< sm) ─────────────────── */}
          <div className="sm:hidden space-y-3">
            {data.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className="border border-gray-100 rounded-xl p-4 space-y-2.5 bg-gray-50/50 animate-fade-slide-up"
              >
                {dataCols.map((col, colIdx) => {
                  const value = col.render ? col.render(row) : row[col.accessor];
                  // Skip if null/empty
                  if (value === null || value === undefined || value === '') return null;
                  return (
                    <div key={colIdx} className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0 pt-0.5">
                        {col.header}
                      </span>
                      <span className="text-sm font-medium text-right text-gray-800">
                        {value}
                      </span>
                    </div>
                  );
                })}
                {/* Actions at bottom */}
                {actionCol && (
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                    {actionCol.render(row)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Desktop Scrollable Table (≥ sm) ──────────── */}
          <div className="hidden sm:block table-scroll-container">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="pb-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest px-3 whitespace-nowrap"
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((row, rowIdx) => (
                  <tr key={rowIdx} className="group hover:bg-gray-50/70 transition-colors">
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className="py-3.5 px-3 text-sm font-medium whitespace-nowrap">
                        {col.render ? col.render(row) : row[col.accessor]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
