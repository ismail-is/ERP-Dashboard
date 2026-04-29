import React from 'react';
import { motion } from 'framer-motion';

export const StatsCard = ({ label, value, icon: Icon, trend }) => {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="premium-card"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-gray-50 rounded-xl">
          <Icon size={24} className="text-black" />
        </div>
        {trend && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
        <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
      </div>
    </motion.div>
  );
};
