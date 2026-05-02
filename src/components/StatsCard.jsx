import React from 'react';
import { motion } from 'framer-motion';

export const StatsCard = ({ label, value, icon: Icon, trend }) => {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="premium-card cursor-default select-none"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="p-2.5 bg-gray-50 rounded-xl">
          <Icon size={20} className="text-black" />
        </div>
        {trend && (
          <span
            className={`text-[11px] font-bold px-2 py-1 rounded-full ${
              trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 mb-1 truncate">{label}</p>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{value}</h3>
      </div>
    </motion.div>
  );
};
