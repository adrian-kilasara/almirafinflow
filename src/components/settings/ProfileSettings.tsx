import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Loader2, Check, Camera, Calendar,
  UserCircle, AtSign, Sparkles, Shield, Eye, EyeOff,
  MessageSquare, Clock, Fingerprint, Landmark, Wallet,
  CreditCard, Smartphone, Activity, Lock, Globe,
  ArrowRight, Banknote, PiggyBank,
} from 'lucide-react';

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };
const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

interface AccountSummary {
  type: string;
  count: number;
  icon: React.ReactNode;
}

export default function ProfileSettings() {
  const { user } = useAuth();
  const { settings, updateSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);

  const [fullName, setFullName] = useState(settings.full_name || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [username, setUsername] = useState(settings.username || '');
  const [dob, setDob] = useState(settings.dob || '');
  const [gender, setGender] = useState(settings.gender || '');
  const [tagline, setTagline] = useState('');

  // Privacy controls (local state — extendable to DB later)
  const [showAvatarInReports, setShowAvatarInReports] = useState(true);
  const [showNameInNotifications, setShowNameInNotifications] = useState(true);
  const [showProfileInShared, setShowProfileInShared] = useState(true);

  // Connected accounts summary
  const [accountSummary, setAccountSummary] = useState<AccountSummary[]>([]);
  const [totalAccounts, setTotalAccounts] = useState(0);

  // Sync state from settings when they load
  useEffect(() => {
    setFullName(settings.full_name || '');
    setPhone(settings.phone || '');
    setUsername(settings.username || '');
    setDob(settings.dob || '');
    setGender(settings.gender || '');
  }, [settings]);

  // Load connected accounts overview
  useEffect(() => {
    if (!user) return;
    const loadAccounts = async () => {
      const { data } = await supabase
        .from('accounts')
        .select('type, is_active')
        .eq('user_id', user.id)
        .eq('is_archived', false);

      if (data) {
        const grouped: Record<string, number> = {};
        data.forEach((a) => {
          grouped[a.type] = (grouped[a.type] || 0) + 1;
        });

        const iconMap: Record<string, React.ReactNode> = {
          bank: <Landmark className="w-3.5 h-3.5" />,
          mobile_money: <Smartphone className="w-3.5 h-3.5" />,
          cash: <Banknote className="w-3.5 h-3.5" />,
          investment: <PiggyBank className="w-3.5 h-3.5" />,
          crypto: <Wallet className="w-3.5 h-3.5" />,
          other: <CreditCard className="w-3.5 h-3.5" />,
        };

        const summary = Object.entries(grouped).map(([type, count]) => ({
          type,
          count,
          icon: iconMap[type] || <CreditCard className="w-3.5 h-3.5" />,
        }));

        setAccountSummary(summary);
        setTotalAccounts(data.length);
      }
    };
    loadAccounts();
  }, [user]);

  const initials = (settings.full_name || user?.email || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload JPEG, PNG, or WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await updateSettings({ avatar_url: avatarUrl });
      toast.success('Profile picture updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  }, [user, updateSettings]);

  const handleSave = async () => {
    if (username && (username.length > 30 || !/^[a-zA-Z0-9._-]+$/.test(username))) {
      toast.error('Username: max 30 chars, alphanumeric, dots, dashes, underscores only');
      return;
    }

    setSaving(true);
    try {
      await updateSettings({
        full_name: fullName || null,
        phone: phone || null,
        username: username || null,
        dob: dob || null,
        gender: gender || null,
      });
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const lastLogin = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString()
    : 'Unknown';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  const typeLabels: Record<string, string> = {
    bank: 'Bank',
    mobile_money: 'Mobile Money',
    cash: 'Cash',
    investment: 'Investment',
    crypto: 'Crypto',
    other: 'Other',
  };

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* ── 1. Avatar & Identity ── */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <motion.div
                  className="w-28 h-28 rounded-3xl overflow-hidden border-2 border-border/50 relative cursor-pointer"
                  whileHover={{ scale: 1.04 }}
                  transition={spring}
                  onMouseEnter={() => setAvatarHover(true)}
                  onMouseLeave={() => setAvatarHover(false)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {settings.avatar_url ? (
                    <img src={settings.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <span className="text-3xl font-black text-primary">{initials}</span>
                    </div>
                  )}
                  <AnimatePresence>
                    {(avatarHover || uploading) && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-1"
                      >
                        {uploading ? (
                          <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-5 h-5 text-primary" />
                            <span className="text-[9px] font-bold text-foreground">Change Photo</span>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-income/20 border-2 border-card flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-income" />
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left space-y-1.5">
                <h3 className="text-lg font-extrabold">{settings.full_name || 'Your Name'}</h3>
                {settings.username && <p className="text-xs text-primary font-semibold">@{settings.username}</p>}
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {tagline && <p className="text-[10px] text-muted-foreground/80 italic">"{tagline}"</p>}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-2">
                  <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <Shield className="w-3 h-3 inline mr-1" />Verified
                  </span>
                  <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground">
                    Member since {memberSince}
                  </span>
                  {totalAccounts > 0 && (
                    <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground">
                      <Wallet className="w-3 h-3 inline mr-1" />{totalAccounts} account{totalAccounts !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 2. Profile Status / Tagline ── */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Status / Tagline</p>
                <p className="text-[9px] text-muted-foreground">Short personal goal or status visible in shared features & AI coaching</p>
              </div>
            </div>
            <Textarea
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 120))}
              placeholder='e.g. "Saving for my first house 🏠"'
              maxLength={120}
              rows={2}
              className="text-sm resize-none"
            />
            <p className="text-[9px] text-muted-foreground text-right">{tagline.length}/120</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 3. Username ── */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <AtSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Username</p>
                <p className="text-[9px] text-muted-foreground">Unique identifier displayed system-wide</p>
              </div>
            </div>
            <div className="space-y-2">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                placeholder="e.g. john.doe"
                maxLength={30}
                className="font-mono text-sm"
              />
              <p className="text-[9px] text-muted-foreground">Max 30 characters. Letters, numbers, dots, dashes, underscores.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 4. Personal Information ── */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserCircle className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Personal Information</p>
                <p className="text-[9px] text-muted-foreground">Used across dashboard, reports & notifications</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Full Name
                </Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" maxLength={100} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email
                </Label>
                <Input value={user?.email || ''} disabled className="opacity-50" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> Phone Number
                </Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255 xxx xxx xxx" maxLength={20} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Date of Birth
                </Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="text-sm" />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 5. Privacy Controls ── */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Eye className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Privacy Controls</p>
                <p className="text-[9px] text-muted-foreground">Control what's visible across shared features and exports</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  label: 'Show avatar in reports',
                  desc: 'Include your profile picture in exported/downloaded reports',
                  value: showAvatarInReports,
                  onChange: setShowAvatarInReports,
                  icon: <EyeOff className="w-3.5 h-3.5" />,
                },
                {
                  label: 'Show name in notifications',
                  desc: 'Display your full name in system notifications',
                  value: showNameInNotifications,
                  onChange: setShowNameInNotifications,
                  icon: <MessageSquare className="w-3.5 h-3.5" />,
                },
                {
                  label: 'Visible in shared budgets',
                  desc: 'Show your profile info to collaborators on shared budgets/savings',
                  value: showProfileInShared,
                  onChange: setShowProfileInShared,
                  icon: <Globe className="w-3.5 h-3.5" />,
                },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border/20 hover:bg-muted/30 transition-colors"
                  whileHover={{ x: 2 }}
                  transition={spring}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 text-muted-foreground">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold">{item.label}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{item.desc}</p>
                    </div>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.onChange} />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 6. Activity & Audit ── */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Activity & Audit</p>
                <p className="text-[9px] text-muted-foreground">Account activity and session information</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Last Login', value: lastLogin, icon: <Clock className="w-3.5 h-3.5" /> },
                { label: 'Member Since', value: memberSince, icon: <Calendar className="w-3.5 h-3.5" /> },
                { label: 'Email', value: user?.email || '—', icon: <Mail className="w-3.5 h-3.5" /> },
                { label: 'Auth Provider', value: user?.app_metadata?.provider || 'email', icon: <Lock className="w-3.5 h-3.5" /> },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  className="p-3 rounded-xl bg-muted/20 border border-border/20"
                  whileHover={{ scale: 1.01 }}
                  transition={spring}
                >
                  <div className="flex items-center gap-2 mb-1.5 text-muted-foreground">
                    {item.icon}
                    <span className="text-[9px] uppercase tracking-wider font-semibold">{item.label}</span>
                  </div>
                  <p className="text-[11px] font-bold truncate">{item.value}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 7. Biometric & Security Hints ── */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card border-border/30">
          <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Fingerprint className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Biometric & Quick Access</p>
                <p className="text-[9px] text-muted-foreground">Enable device-level authentication for faster, safer access</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/[0.04] to-transparent border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold">Fingerprint / Face ID</p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    Enable biometric login on supported mobile devices for instant, secure access to your financial data.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full w-0 rounded-full bg-primary/40" />
                </div>
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Coming Soon</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 8. Connected Accounts Overview ── */}
      <motion.div variants={stagger.item}>
        <Card className="overflow-hidden relative group/card">
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-primary/5 blur-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold">Connected Accounts</p>
                  <p className="text-[9px] text-muted-foreground">Overview of financial accounts linked to this profile</p>
                </div>
              </div>
              <span className="text-lg font-black text-primary">{totalAccounts}</span>
            </div>

            {accountSummary.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {accountSummary.map((item, i) => (
                  <motion.div
                    key={item.type}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    className="p-3 rounded-xl bg-muted/20 border border-border/20 flex items-center gap-2.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-black">{item.count}</p>
                      <p className="text-[9px] text-muted-foreground capitalize">{typeLabels[item.type] || item.type}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/10 border border-dashed border-border/30 text-center">
                <Wallet className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1.5" />
                <p className="text-[10px] text-muted-foreground">No accounts linked yet</p>
              </div>
            )}

            <p className="text-[8px] text-muted-foreground italic">
              Read-only snapshot — manage accounts from the Accounts tab
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 9. System Integration ── */}
      <motion.div variants={stagger.item}>
        <Card className="border-primary/10 bg-gradient-to-br from-primary/[0.03] via-card to-card overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">System Integration</p>
                <p className="text-[9px] text-muted-foreground">Your profile propagates to all modules</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Dashboard', desc: 'Greeting & avatar' },
                { label: 'Reports', desc: 'Header info' },
                { label: 'Notifications', desc: 'Username display' },
                { label: 'AI Coach', desc: 'Personalized advice' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="p-2.5 rounded-xl bg-muted/30 border border-border/30 text-center"
                >
                  <p className="text-[10px] font-bold">{item.label}</p>
                  <p className="text-[8px] text-muted-foreground">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Save Button ── */}
      <motion.div variants={stagger.item}>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-2xl text-sm font-bold gap-2 shadow-lg shadow-primary/10"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
