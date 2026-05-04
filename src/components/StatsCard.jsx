import React from 'react';
import { motion } from 'framer-motion';

export const StatsCard = ({ label, value, icon: Icon, trend }) => {
  const isPositive = trend?.startsWith('+');
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="premium-card cursor-default select-none animate-fade-slide-up"
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="p-2 sm:p-2.5 bg-gray-50 rounded-xl">
          <Icon size={18} className="text-gray-700" strokeWidth={2} />
        </div>
        {trend && (
          <span
            className={`text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-full ${
              isPositive ? 'bg-gray-100 text-gray-900' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <p className="text-[10px] sm:text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider truncate">
        {label}
      </p>
      <h3 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-gray-900 truncate">
        {value}
      </h3>
    </motion.div>
  );
};
