import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

const Login = ({ onAccess, correctPassword, isDataLoading }) => {
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === correctPassword.toString()) {
      onAccess();
    } else {
      setError('Invalid code. Access denied.');
      setPassword('');
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 4) {
      setPassword(value);
      setError('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gray-100 rounded-full opacity-60" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gray-100 rounded-full opacity-60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-[400px] relative"
      >
        <div className="bg-white rounded-3xl p-8 sm:p-10"
          style={{ boxShadow: '0 8px 40px rgb(0 0 0 / 0.10), 0 2px 8px rgb(0 0 0 / 0.06)' }}>

          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-5 relative"
              style={{ boxShadow: '0 8px 24px rgb(0 0 0 / 0.25)' }}
            >
              {isDataLoading ? (
                <Loader2 size={28} className="text-white animate-spin" strokeWidth={2} />
              ) : (
                <Lock size={26} className="text-white" strokeWidth={2} />
              )}
            </motion.div>
            <h1 className="text-[22px] font-black text-gray-900 tracking-tight">ERP Admin Access</h1>
            <p className="text-gray-500 text-sm mt-1.5 font-medium text-center">
              {isDataLoading ? 'Connecting to your data…' : 'Enter your 4-digit security code'}
            </p>
          </div>

          {/* Pin dots */}
          <div className="flex justify-center gap-3 mb-6">
            {[1, 2, 3, 4].map((dot) => (
              <motion.div
                key={dot}
                animate={{ scale: password.length >= dot ? 1.2 : 1 }}
                transition={{ duration: 0.15 }}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  password.length >= dot ? 'bg-gray-900' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* PIN input */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                placeholder="• • • •"
                className="w-full text-center text-2xl tracking-[1em] font-black h-16 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-gray-900 focus:bg-white focus:ring-0 outline-none transition-all pr-12 font-mono"
                style={{ fontSize: '24px' }}
                disabled={isDataLoading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg"
              >
                {showPassword ? <EyeOff size={19} strokeWidth={2} /> : <Eye size={19} strokeWidth={2} />}
              </button>
            </div>

            {/* Error */}
            <div className="min-h-[22px]">
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-sm text-center font-semibold"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isDataLoading || password.length < 4}
              className="premium-button w-full py-4 text-base"
              style={{ minHeight: '56px', borderRadius: '16px' }}
            >
              {isDataLoading ? (
                <><Loader2 className="animate-spin" size={18} strokeWidth={2} /> Connecting…</>
              ) : (
                <><ShieldCheck size={18} strokeWidth={2} /> Access Dashboard</>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-gray-400 font-semibold uppercase tracking-widest">
            Secure Environment © 2025
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
