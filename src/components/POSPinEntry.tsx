import React, { useState, useEffect, useRef } from 'react';
import { Lock, Delete } from 'lucide-react';

interface POSPinEntryProps {
  onPinSubmit: (pin: string) => void;
  isDarkMode: boolean;
}

export const POSPinEntry: React.FC<POSPinEntryProps> = ({ onPinSubmit, isDarkMode }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError(null);
  };

  const handleSubmit = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      triggerShake();
      return;
    }

    const correctPin = import.meta.env.VITE_POS_PIN || '2024';
    if (pin !== correctPin) {
      setError('Incorrect PIN');
      triggerShake();
      setPin('');
      return;
    }

    onPinSubmit(pin);
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (/^\d$/.test(e.key)) {
      handleDigitClick(e.key);
    }
  };

  useEffect(() => {
    if (pin.length === 6) {
      handleSubmit();
    }
  }, [pin]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const bgClass = isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white';
  const textClass = isDarkMode ? 'text-white' : 'text-zinc-900';
  const borderClass = isDarkMode ? 'border-zinc-700' : 'border-zinc-200';

  return (
    <div
      className={`fixed inset-0 ${isDarkMode ? 'bg-zinc-950' : 'bg-zinc-50'} flex items-center justify-center p-4 z-50`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className={`${bgClass} rounded-2xl shadow-2xl p-8 w-full max-w-sm border ${borderClass} ${shaking ? 'animate-shake' : ''}`}>
        <div className="flex flex-col items-center space-y-6">
          {/* Logo */}
          <div className={`p-4 rounded-full ${isDarkMode ? 'bg-zinc-800' : 'bg-red-50'}`}>
            <Lock size={40} className={isDarkMode ? 'text-[#b90014]' : 'text-[#b90014]'} />
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className={`text-2xl font-black uppercase tracking-wider ${textClass}`}>POS System</h1>
            <p className={isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}>Enter your PIN to access</p>
          </div>

          {/* Hidden keyboard input — inputMode="none" + readOnly suppress mobile keyboard */}
          <input
            ref={inputRef}
            type="text"
            inputMode="none"
            readOnly
            value={pin}
            onKeyDown={handleKeyDown}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
            aria-label="PIN entry"
            aria-hidden="true"
          />

          {/* PIN display */}
          <div className={`w-full flex justify-center gap-2 py-6 px-4 rounded-lg ${isDarkMode ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-lg font-bold text-lg flex items-center justify-center border-2 transition-all ${
                  i < pin.length
                    ? 'bg-[#b90014] border-red-600 text-white'
                    : isDarkMode
                    ? 'bg-zinc-700 border-zinc-600'
                    : 'bg-white border-zinc-300'
                }`}
              >
                {i < pin.length ? '●' : '○'}
              </div>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm font-bold text-red-600 text-center">{error}</p>
          )}

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
              <button
                key={digit}
                onClick={() => handleDigitClick(String(digit))}
                className={`p-4 rounded-lg font-black text-lg transition-all active:scale-95 ${
                  isDarkMode
                    ? 'bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200'
                }`}
              >
                {digit}
              </button>
            ))}
          </div>

          {/* Bottom row: 0, backspace, submit */}
          <div className="grid grid-cols-3 gap-3 w-full">
            <button
              onClick={() => handleDigitClick('0')}
              className={`p-4 rounded-lg font-black text-lg transition-all active:scale-95 col-span-1 ${
                isDarkMode
                  ? 'bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200'
              }`}
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className={`p-4 rounded-lg font-black transition-all active:scale-95 flex items-center justify-center ${
                isDarkMode
                  ? 'bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-600'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200'
              }`}
            >
              <Delete size={20} />
            </button>
            <button
              onClick={handleSubmit}
              disabled={pin.length < 4}
              className={`p-4 rounded-lg font-black uppercase tracking-widest transition-all active:scale-95 ${
                pin.length >= 4
                  ? 'bg-[#b90014] hover:bg-red-700 text-white border border-red-600'
                  : isDarkMode
                  ? 'bg-zinc-600 text-zinc-400 border border-zinc-700 cursor-not-allowed'
                  : 'bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed'
              }`}
            >
              OK
            </button>
          </div>

          {/* Instructions */}
          <p className={`text-xs text-center ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'} font-medium`}>
            Use the keypad or your keyboard to enter the PIN
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
};
