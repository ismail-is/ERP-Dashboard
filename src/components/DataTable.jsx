import React from 'react';
import { cn } from '../utils/cn';

export const DataTable = ({ columns, data, title }) => {
  return (
    <div className="premium-card overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-50">
              {columns.map((col, idx) => (
                <th key={idx} className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-widest px-4">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((row, rowIdx) => (
              <tr key={rowIdx} className="group hover:bg-gray-50 transition-colors">
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="py-4 px-4 text-sm font-medium">
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            No records found.
          </div>
        )}
      </div>
    </div>
  );
};
