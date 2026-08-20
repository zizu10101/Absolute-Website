import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { AlertCircle, Loader, CheckCircle2, Mail } from 'lucide-react';
import { motion } from 'motion/react';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword, isLoading, error, clearError } = useCustomerAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Invalid email format');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    clearError();
    if (emailError) setEmailError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateEmail()) return;

    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch (err) {
      // Error is handled by context
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center"
        >
          <div className="flex justify-center mb-4">
            <Mail className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
          <p className="text-gray-600 mb-6">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Click the link in the email to reset your password. The link will expire in 1 hour.
          </p>

          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 mb-4"
          >
            Back to Sign In
          </button>

          <button
            onClick={() => {
              setSubmitted(false);
              setEmail('');
            }}
            className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50"
          >
            Try Another Email
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-lg shadow-lg p-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
        <p className="text-gray-600 mb-8">Enter your email and we'll send you a reset link</p>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                emailError ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="your@email.com"
            />
            {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader className="w-4 h-4 animate-spin" />}
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Back to Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
