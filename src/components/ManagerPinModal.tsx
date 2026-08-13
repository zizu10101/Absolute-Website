import React, { useState, useEffect, useRef } from 'react';
import { Lock, Delete } from 'lucide-react';

interface ManagerPinModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  attemptsRemaining: number;
  lockedUntil: number | null;
  onWrongPin: () => void;
}

const MANAGER_PIN = import.meta.env.VITE_MANAGER_PIN || '0852';
const PIN_LENGTH = 4;

export const ManagerPinModal: React.FC<ManagerPinModalProps> = ({
  onSuccess,
  onCancel,
  attemptsRemaining,
  lockedUntil,
  onWrongPin,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLocked = !!lockedUntil && lockedUntil > Date.now();

  useEffect(() => {
    if (!isLocked) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((lockedUntil! - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLocked, lockedUntil]);

  useEffect(() => {
    if (!isLocked) inputRef.current?.focus();
  }, [isLocked]);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleSubmit = (candidate: string) => {
    if (isLocked) return;
    if (candidate === MANAGER_PIN) {
      onSuccess();
      return;
    }
    setError('Incorrect PIN');
    setPin('');
    triggerShake();
    onWrongPin();
  };

  const handleDigitClick = (digit: string) => {
    if (isLocked || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === PIN_LENGTH) handleSubmit(next);
  };

  const handleBackspace = () => {
    if (isLocked) return;
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLocked) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (/^\d$/.test(e.key)) {
      handleDigitClick(e.key);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className={`bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-zinc-200 ${shaking ? 'animate-shake' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center space-y-5">
          <div className="p-4 rounded-full bg-red-50">
            <Lock size={32} className="text-[var(--primary-color)]" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-lg font-black uppercase tracking-widest text-zinc-900">Manager Access</h2>
            <p className="text-xs text-zinc-500">Enter Manager PIN</p>
          </div>

          {/* Hidden keyboard input - inputMode="none" + readOnly suppress mobile keyboard, same as POSPinEntry */}
          <input
            ref={inputRef}
            type="text"
            inputMode="none"
            readOnly
            value={pin}
            onKeyDown={handleKeyDown}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
            aria-label="Manager PIN entry"
            aria-hidden="true"
          />

          {isLocked ? (
            <div className="text-center py-2">
              <p className="text-sm font-bold text-red-700">Too many incorrect attempts</p>
              <p className="text-xs text-zinc-500 mt-1">Try again in {secondsLeft}s</p>
            </div>
          ) : (
            <>
              {/* PIN dots */}
              <div className="w-full flex justify-center gap-3 py-4">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      i < pin.length
                        ? 'bg-[var(--primary-color)] border-[var(--primary-color)]'
                        : 'bg-white border-zinc-300'
                    }`}
                  />
                ))}
              </div>

              {error && (
                <p className="text-xs font-bold text-red-600 text-center -mt-2">
                  {error} - {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
                </p>
              )}

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-3 w-full">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
                  <button
                    key={digit}
                    onClick={() => handleDigitClick(String(digit))}
                    className="p-3 rounded-lg font-black text-lg transition-all active:scale-95 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200"
                  >
                    {digit}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 w-full">
                <button
                  onClick={() => handleDigitClick('0')}
                  className="p-3 rounded-lg font-black text-lg transition-all active:scale-95 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="p-3 rounded-lg font-black transition-all active:scale-95 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200"
                >
                  <Delete size={18} />
                </button>
                <button
                  onClick={onCancel}
                  className="p-3 rounded-lg font-black uppercase text-xs tracking-widest transition-all active:scale-95 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 border border-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {isLocked && (
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 bg-zinc-200 text-zinc-900 rounded-lg font-bold hover:bg-zinc-300 transition-colors"
            >
              Cancel
            </button>
          )}
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
