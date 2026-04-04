import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Wallet, ArrowRight, Loader2, Mail, Lock, User, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'verify';

const fadeSlide = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(120);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Countdown timer for verification
  useEffect(() => {
    if (mode === 'verify' && countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // Delete unverified account
            handleExpiredVerification();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [mode]);

  const handleExpiredVerification = async () => {
    if (pendingUserId) {
      try {
        await supabase.functions.invoke('cleanup-unverified', {
          body: { userId: pendingUserId },
        });
      } catch (e) {
        // silent
      }
    }
    toast.error('Verification timed out. Please sign up again.');
    setPendingUserId(null);
    setMode('signup');
    setCountdown(120);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast.success('Verification email sent! Check your inbox.');
        setMode('verify');
        setCountdown(120);
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

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      toast.success('Verification email resent!');
      setCountdown(120);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const modeLabel = {
    signin: 'Welcome back. Sign in to continue.',
    signup: 'Create your premium account.',
    forgot: 'Reset your password via email.',
    verify: 'Verify your email to activate your account.',
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
              {modeLabel[mode]}
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
            {/* Forgot Password */}
            {mode === 'forgot' && (
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
            )}

            {/* Verification Screen */}
            {mode === 'verify' && (
              <motion.div key="verify" {...fadeSlide} className="space-y-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mx-auto"
                >
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </motion.div>

                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Check Your Email</h2>
                  <p className="text-sm text-muted-foreground">
                    We sent a verification link to{' '}
                    <span className="text-foreground font-medium">{email}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click the link in your email to activate your account.
                  </p>
                </div>

                {/* Countdown */}
                <div className="space-y-2">
                  <div className={`text-3xl font-mono font-bold tracking-wider ${
                    countdown <= 30 ? 'text-destructive' : 'text-primary'
                  }`}>
                    {formatTime(countdown)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {countdown > 0
                      ? 'Time remaining to verify your email'
                      : 'Verification expired. Please sign up again.'}
                  </p>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${countdown <= 30 ? 'bg-destructive' : 'bg-primary'}`}
                      initial={{ width: '100%' }}
                      animate={{ width: `${(countdown / 120) * 100}%` }}
                      transition={{ duration: 1, ease: 'linear' }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-11 text-sm"
                    onClick={handleResendVerification}
                    disabled={loading || countdown <= 0}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resend Verification Email'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      if (timerRef.current) clearInterval(timerRef.current);
                      setMode('signup');
                      setCountdown(120);
                    }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Back to sign up
                  </button>
                </div>
              </motion.div>
            )}

            {/* Sign In / Sign Up */}
            {(mode === 'signin' || mode === 'signup') && (
              <motion.div key="main" {...fadeSlide} className="space-y-6">
                <motion.form
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
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
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Toggle mode */}
        {(mode === 'signin' || mode === 'signup') && (
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
