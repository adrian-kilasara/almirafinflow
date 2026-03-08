import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Settings, User, Shield, Globe, Calculator, Bell, Sparkles,
  Database, Monitor, Wrench, ArrowLeft,
} from 'lucide-react';

import ProfileSettings from '@/components/settings/ProfileSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';
import LocalizationSettings from '@/components/settings/LocalizationSettings';
import FinancialRulesSettings from '@/components/settings/FinancialRulesSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import AIInsightsSettings from '@/components/settings/AIInsightsSettings';
import DataManagementSettings from '@/components/settings/DataManagementSettings';
import DisplaySettings from '@/components/settings/DisplaySettings';
import AdvancedSettings from '@/components/settings/AdvancedSettings';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);

  if (!user) return null;

  const tabs = [
    { value: 'profile', icon: User, label: 'Profile' },
    { value: 'security', icon: Shield, label: 'Security' },
    { value: 'localization', icon: Globe, label: 'Currency' },
    { value: 'financial-rules', icon: Calculator, label: 'Rules' },
    { value: 'notifications', icon: Bell, label: 'Alerts' },
    { value: 'ai-insights', icon: Sparkles, label: 'AI' },
    { value: 'data', icon: Database, label: 'Data' },
    { value: 'display', icon: Monitor, label: 'Display' },
    { value: 'advanced', icon: Wrench, label: 'Advanced' },
  ];

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
              Settings — Control Center
            </h1>
            <p className="text-muted-foreground">Every change propagates system-wide instantly</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {tabs.map(({ value, icon: Icon, label }) => (
              <TabsTrigger key={value} value={value} className="gap-1.5 text-xs sm:text-sm">
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile"><ProfileSettings /></TabsContent>
          <TabsContent value="security"><SecuritySettings /></TabsContent>
          <TabsContent value="localization"><LocalizationSettings /></TabsContent>
          <TabsContent value="financial-rules"><FinancialRulesSettings /></TabsContent>
          <TabsContent value="notifications"><NotificationSettings /></TabsContent>
          <TabsContent value="ai-insights"><AIInsightsSettings /></TabsContent>
          <TabsContent value="data"><DataManagementSettings /></TabsContent>
          <TabsContent value="display"><DisplaySettings /></TabsContent>
          <TabsContent value="advanced"><AdvancedSettings /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
