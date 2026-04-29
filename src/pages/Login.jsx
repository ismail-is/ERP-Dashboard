import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

const Login = ({ onAccess, correctPassword, isDataLoading }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Check against the password fetched from Google Sheets
    if (password === correctPassword.toString()) {
      onAccess();
    } else {
      setError('Invalid 4-digit code. Access denied.');
      setPassword('');
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    // Only allow numbers and max 4 digits
    if (/^\d*$/.test(value) && value.length <= 4) {
      setPassword(value);
      setError('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-xl relative overflow-hidden">
            <motion.div
              animate={{ rotate: isDataLoading ? 360 : 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute inset-0 opacity-10 bg-gradient-to-tr from-white to-transparent"
            />
            <Lock className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-black">ERP Admin Access</h1>
          <p className="text-gray-500 mt-2">Enter your 4-digit security code</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={handlePasswordChange}
              placeholder="0 0 0 0"
              className="premium-input text-center text-2xl tracking-[1em] font-bold h-16 pr-12"
              disabled={isDataLoading}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-black transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          
          <div className="h-6">
            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-500 text-sm text-center font-medium"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <button
            type="submit"
            disabled={isDataLoading || password.length < 4}
            className="premium-button w-full py-4 text-lg flex items-center justify-center gap-2"
          >
            {isDataLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Connecting to Sheets...
              </>
            ) : (
              'Access Dashboard'
            )}
          </button>
        </form>

        <div className="mt-12 flex justify-center gap-4">
          {[1, 2, 3, 4].map((dot) => (
            <div 
              key={dot}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                password.length >= dot ? 'bg-black scale-125' : 'bg-gray-100'
              }`}
            />
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-gray-400 uppercase tracking-widest">
          Secure Environment &copy; 2024
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
