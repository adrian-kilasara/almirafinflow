import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shield, KeyRound, Loader2, Clock, Eye, EyeOff, Fingerprint } from 'lucide-react';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function SecuritySettings() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Unknown';

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5">
      {/* Password */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Change Password</p>
                <p className="text-[9px] text-muted-foreground">Update your account password securely</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">New Password</Label>
                <div className="relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Confirm Password</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {passwordData.newPassword && (
              <div className="flex gap-1">
                {[6, 8, 12].map((len) => (
                  <div key={len} className={`h-1.5 flex-1 rounded-full transition-colors ${passwordData.newPassword.length >= len ? 'bg-income' : 'bg-muted'}`} />
                ))}
              </div>
            )}

            <Button onClick={handleChangePassword} disabled={saving || !passwordData.newPassword || !passwordData.confirmPassword} className="rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Session */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Session Info</p>
                <p className="text-[9px] text-muted-foreground">Current authentication details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Fingerprint, label: 'Email', value: user?.email || '—' },
                { icon: Clock, label: 'Last Sign In', value: lastSignIn },
                { icon: Shield, label: 'Created', value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-1"
                >
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                    <item.icon className="w-3 h-3" /> {item.label}
                  </p>
                  <p className="text-xs font-semibold truncate">{item.value}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
