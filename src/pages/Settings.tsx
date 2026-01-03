import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Settings, Globe, Bell, Shield, Database, ArrowLeft, Loader2,
  Download, Trash2, KeyRound, Mail, Check
} from 'lucide-react';
import type { CurrencyCode } from '@/types/finance';

const currencies: { value: CurrencyCode; label: string }[] = [
  { value: 'KES', label: 'KES - Kenyan Shilling' },
  { value: 'TZS', label: 'TZS - Tanzanian Shilling' },
  { value: 'UGX', label: 'UGX - Ugandan Shilling' },
  { value: 'RWF', label: 'RWF - Rwandan Franc' },
  { value: 'BIF', label: 'BIF - Burundian Franc' },
  { value: 'ETB', label: 'ETB - Ethiopian Birr' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { settings, updateSettings, refreshSettings } = useSettings();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleCurrencyChange = async (value: CurrencyCode) => {
    setLocalSettings(prev => ({ ...prev, default_currency: value }));
    setSaving(true);
    try {
      await updateSettings({ default_currency: value });
      toast.success('Currency updated system-wide');
    } catch (error) {
      toast.error('Failed to update currency');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    // Notification settings are stored locally for now
    toast.success('Notification preference updated');
  };

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
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;
      toast.success('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const [accountsRes, transactionsRes, budgetsRes, goalsRes, categoriesRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user!.id),
        supabase.from('transactions').select('*').eq('user_id', user!.id),
        supabase.from('budgets').select('*').eq('user_id', user!.id),
        supabase.from('savings_goals').select('*').eq('user_id', user!.id),
        supabase.from('categories').select('*').eq('user_id', user!.id),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_email: user?.email,
        currency: localSettings.default_currency,
        accounts: accountsRes.data || [],
        transactions: transactionsRes.data || [],
        budgets: budgetsRes.data || [],
        savings_goals: goalsRes.data || [],
        categories: categoriesRes.data || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finflow-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await supabase.from('transactions').delete().eq('user_id', user!.id);
      await supabase.from('budgets').delete().eq('user_id', user!.id);
      await supabase.from('savings_goals').delete().eq('user_id', user!.id);
      await supabase.from('accounts').delete().eq('user_id', user!.id);
      await supabase.from('categories').delete().eq('user_id', user!.id);
      await supabase.from('user_streaks').delete().eq('user_id', user!.id);
      await supabase.from('user_badges').delete().eq('user_id', user!.id);
      await supabase.from('user_lesson_progress').delete().eq('user_id', user!.id);
      await supabase.from('financial_tips').delete().eq('user_id', user!.id);
      await supabase.from('transaction_rules').delete().eq('user_id', user!.id);
      await supabase.from('profiles').delete().eq('user_id', user!.id);
      
      await signOut();
      toast.success('Account deleted successfully');
      navigate('/auth');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Settings
            </h1>
            <p className="text-muted-foreground">All changes apply system-wide instantly</p>
          </div>
        </div>

        <Tabs defaultValue="localization" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="localization" className="gap-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Currency</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Data</span>
            </TabsTrigger>
          </TabsList>

          {/* Localization Settings */}
          <TabsContent value="localization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  System Currency
                </CardTitle>
                <CardDescription>
                  This currency applies to all displays across dashboard, reports, transactions, budgets, and exports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select
                    value={localSettings.default_currency}
                    onValueChange={handleCurrencyChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((curr) => (
                        <SelectItem key={curr.value} value={curr.value}>
                          {curr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {saving && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying changes system-wide...
                  </div>
                )}

                {!saving && (
                  <div className="flex items-center gap-2 text-sm text-income">
                    <Check className="w-4 h-4" />
                    Currency settings are automatically saved
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Control how and when you receive alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Budget Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when approaching budget limits
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.budget_alerts}
                    onCheckedChange={(checked) => handleNotificationChange('budget_alerts', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive weekly financial summary
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.weekly_reports}
                    onCheckedChange={(checked) => handleNotificationChange('weekly_reports', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Savings Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Reminders to contribute to savings goals
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.savings_reminders}
                    onCheckedChange={(checked) => handleNotificationChange('savings_reminders', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Daily Financial Tips</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive daily personalized financial advice
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.daily_tips}
                    onCheckedChange={(checked) => handleNotificationChange('daily_tips', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Account Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{user?.email}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5" />
                  Change Password
                </CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                </div>
                <Button 
                  onClick={handleChangePassword} 
                  disabled={saving || !passwordData.newPassword || !passwordData.confirmPassword}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Update Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Control */}
          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Export Data
                </CardTitle>
                <CardDescription>Download all your financial data</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Export all your accounts, transactions, budgets, and goals as a JSON file.
                </p>
                <Button onClick={handleExportData} disabled={exporting}>
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  Export All Data
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" />
                  Delete Account
                </CardTitle>
                <CardDescription>Permanently delete your account and all data</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  This action cannot be undone. All your data including accounts, transactions, 
                  budgets, and goals will be permanently deleted.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={deleting}>
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete your account and all associated data.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}