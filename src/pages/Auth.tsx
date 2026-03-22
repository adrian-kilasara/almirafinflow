import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Wallet, ArrowRight, Loader2, Mail, Phone, Lock, User, Eye, EyeOff, ArrowLeft, ScanFace } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'signin' | 'signup' | 'forgot';
type AuthMethod = 'email' | 'phone';

const fadeSlide = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
};

const childFade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [method, setMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp } = useAuth();
  const { isSupported: biometricSupported, authenticateWithBiometric, loading: bioLoading } = useBiometricAuth();
  const [hasBiometricCredentials, setHasBiometricCredentials] = useState(false);
  const navigate = useNavigate();

  // Check if any biometric credentials exist (without auth)
  useEffect(() => {
    if (biometricSupported) {
      setHasBiometricCredentials(true); // Show button if device supports it
    }
  }, [biometricSupported]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast.success('Account created! Please check your email to verify.');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset link sent! Check your email.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setOtpSent(true);
      toast.success('OTP sent to your phone');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
      if (error) throw error;
      toast.success('Phone verified!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (error: any) {
      toast.error(error.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.07] rounded-full blur-[120px]"
          animate={{ scale: [1, 1.08, 1], opacity: [0.07, 0.1, 0.07] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/[0.05] rounded-full blur-[100px]"
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 right-0 w-[400px] h-[600px] bg-primary/[0.04] rounded-full blur-[100px]"
          animate={{ y: [0, -40, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="w-full max-w-[460px] mx-auto px-5 py-8 relative z-10">
        {/* Logo & Branding */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5 shadow-[0_0_40px_hsl(var(--primary)/0.15)]"
          >
            <Wallet className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            FinFlow <span className="text-primary">2026</span>
          </h1>
          <AnimatePresence mode="wait">
            <motion.p
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-muted-foreground text-sm mt-2"
            >
              {mode === 'signin' && 'Welcome back. Sign in to continue.'}
              {mode === 'signup' && 'Create your premium account.'}
              {mode === 'forgot' && 'Reset your password via email.'}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl shadow-[0_8px_60px_-12px_hsl(var(--primary)/0.12)] p-6 sm:p-8 space-y-6"
        >
          <AnimatePresence mode="wait">
            {mode === 'forgot' ? (
              <motion.div key="forgot" {...fadeSlide}>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to sign in
                  </button>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 h-12 bg-muted/30 border-border/40 focus:border-primary/50 focus:bg-muted/50 transition-all duration-300"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 text-sm font-semibold shadow-[0_4px_20px_hsl(var(--primary)/0.25)] hover:shadow-[0_4px_30px_hsl(var(--primary)/0.35)] transition-all duration-300"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Send Reset Link
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div key="main" {...fadeSlide} className="space-y-6">
                {/* Google Sign-in */}
                <motion.div variants={childFade}>
                  <Button
                    variant="outline"
                    className="w-full h-12 gap-3 text-sm font-medium border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </Button>
                </motion.div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 text-xs uppercase tracking-widest text-muted-foreground bg-card/60">or</span>
                  </div>
                </div>

                {/* Method toggle */}
                <motion.div variants={childFade} className="flex rounded-xl bg-muted/50 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setMethod('email')}
                    className={`flex-1 relative flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                      method === 'email'
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {method === 'email' && (
                      <motion.div
                        layoutId="methodBg"
                        className="absolute inset-0 bg-primary/15 border border-primary/20 rounded-lg shadow-sm"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('phone')}
                    className={`flex-1 relative flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                      method === 'phone'
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {method === 'phone' && (
                      <motion.div
                        layoutId="methodBg"
                        className="absolute inset-0 bg-primary/15 border border-primary/20 rounded-lg shadow-sm"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone
                    </span>
                  </button>
                </motion.div>

                {/* Email Form */}
                <AnimatePresence mode="wait">
                  {method === 'email' && (
                    <motion.form
                      key="email-form"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.25 }}
                      onSubmit={handleEmailSubmit}
                      className="space-y-4"
                    >
                      <AnimatePresence>
                        {mode === 'signup' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="relative overflow-hidden"
                          >
                            <div className="relative">
                              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                type="text"
                                placeholder="Full name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                className="pl-10 h-12 bg-muted/30 border-border/40 focus:border-primary/50 focus:bg-muted/50 transition-all duration-300"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="Email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="pl-10 h-12 bg-muted/30 border-border/40 focus:border-primary/50 focus:bg-muted/50 transition-all duration-300"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="pl-10 pr-11 h-12 bg-muted/30 border-border/40 focus:border-primary/50 focus:bg-muted/50 transition-all duration-300"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {mode === 'signin' && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setMode('forgot')}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}

                      <Button
                        type="submit"
                        className="w-full h-12 text-sm font-semibold shadow-[0_4px_20px_hsl(var(--primary)/0.25)] hover:shadow-[0_4px_30px_hsl(var(--primary)/0.35)] transition-all duration-300"
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            {mode === 'signin' ? 'Sign In' : 'Create Account'}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </motion.form>
                  )}

                  {/* Phone OTP */}
                  {method === 'phone' && (
                    <motion.div
                      key="phone-form"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.25 }}
                    >
                      {!otpSent ? (
                        <div className="space-y-4">
                          <div className="relative">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              type="tel"
                              placeholder="+254 7XXXXXXXX"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              required
                              className="pl-10 h-12 bg-muted/30 border-border/40 focus:border-primary/50 focus:bg-muted/50 transition-all duration-300"
                            />
                          </div>
                          <Button
                            type="button"
                            className="w-full h-12 text-sm font-semibold shadow-[0_4px_20px_hsl(var(--primary)/0.25)] hover:shadow-[0_4px_30px_hsl(var(--primary)/0.35)] transition-all duration-300"
                            disabled={loading}
                            onClick={handleSendOtp}
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4 ml-2" /></>}
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                          <p className="text-sm text-muted-foreground text-center">
                            Enter the code sent to <span className="text-foreground font-medium">{phone}</span>
                          </p>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="6-digit code"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value)}
                              maxLength={6}
                              required
                              className="pl-10 h-12 bg-muted/30 border-border/40 text-center text-lg tracking-[0.5em] font-mono focus:border-primary/50 focus:bg-muted/50 transition-all duration-300"
                            />
                          </div>
                          <Button
                            type="submit"
                            className="w-full h-12 text-sm font-semibold shadow-[0_4px_20px_hsl(var(--primary)/0.25)] hover:shadow-[0_4px_30px_hsl(var(--primary)/0.35)] transition-all duration-300"
                            disabled={loading}
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify OTP <Lock className="w-4 h-4 ml-2" /></>}
                          </Button>
                          <button
                            type="button"
                            onClick={() => setOtpSent(false)}
                            className="w-full text-sm text-muted-foreground hover:text-primary transition-colors py-2"
                          >
                            Change phone number
                          </button>
                        </form>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Toggle mode */}
        {mode !== 'forgot' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button type="button" className="text-primary font-medium hover:underline" onClick={() => setMode('signup')}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="text-primary font-medium hover:underline" onClick={() => setMode('signin')}>
                  Sign in
                </button>
              </>
            )}
          </motion.p>
        )}

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-muted-foreground/50 mt-8"
        >
          Secured with end-to-end encryption
        </motion.p>
      </div>
    </div>
  );
}
