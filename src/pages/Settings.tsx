import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Settings, User, Shield, Globe, Calculator, Bell, Sparkles,
  Database, Monitor, Wrench, ArrowLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import ProfileSettings from '@/components/settings/ProfileSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';
import LocalizationSettings from '@/components/settings/LocalizationSettings';
import FinancialRulesSettings from '@/components/settings/FinancialRulesSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import AIInsightsSettings from '@/components/settings/AIInsightsSettings';
import DataManagementSettings from '@/components/settings/DataManagementSettings';
import DisplaySettings from '@/components/settings/DisplaySettings';
import AdvancedSettings from '@/components/settings/AdvancedSettings';

const tabs = [
  { value: 'profile', icon: User, label: 'Profile', desc: 'Personal info & avatar' },
  { value: 'security', icon: Shield, label: 'Security', desc: 'Password & sessions' },
  { value: 'localization', icon: Globe, label: 'Currency & Region', desc: 'Currency, timezone, dates' },
  { value: 'financial-rules', icon: Calculator, label: 'Financial Rules', desc: 'Budget & savings behavior' },
  { value: 'notifications', icon: Bell, label: 'Notifications', desc: 'Alerts & reminders' },
  { value: 'ai-insights', icon: Sparkles, label: 'AI & Insights', desc: 'AI engine configuration' },
  { value: 'data', icon: Database, label: 'Data', desc: 'Export & manage data' },
  { value: 'display', icon: Monitor, label: 'Display', desc: 'Theme & UI preferences' },
  { value: 'advanced', icon: Wrench, label: 'Advanced', desc: 'Performance & cache' },
];

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

const CONTENT: Record<string, React.FC> = {
  profile: ProfileSettings,
  security: SecuritySettings,
  localization: LocalizationSettings,
  'financial-rules': FinancialRulesSettings,
  notifications: NotificationSettings,
  'ai-insights': AIInsightsSettings,
  data: DataManagementSettings,
  display: DisplaySettings,
  advanced: AdvancedSettings,
};

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState('profile');

  useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);

  if (!user) return null;

  const ActivePanel = CONTENT[active];
  const activeTab = tabs.find(t => t.value === active)!;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/50"
      >
        <div className="container max-w-6xl mx-auto flex items-center gap-4 py-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0 rounded-xl hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
              whileHover={{ rotate: 90, scale: 1.1 }}
              transition={spring}
            >
              <Settings className="w-5 h-5 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">Control Center</h1>
              <p className="text-[10px] text-muted-foreground font-medium">Every change propagates system-wide instantly</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <LayoutGroup>
            <motion.nav
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="lg:w-72 shrink-0"
            >
              {/* Mobile: Horizontal scroll pills */}
              <div className="lg:hidden flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = active === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setActive(tab.value)}
                      className={`relative shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                        isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="settings-mobile-pill"
                          className="absolute inset-0 bg-primary rounded-xl shadow-lg"
                          transition={spring}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Desktop: Vertical sidebar */}
              <div className="hidden lg:block space-y-1 p-2 rounded-2xl bg-card/50 border border-border/30 backdrop-blur-sm">
                {tabs.map((tab, i) => {
                  const Icon = tab.icon;
                  const isActive = active === tab.value;
                  return (
                    <motion.button
                      key={tab.value}
                      onClick={() => setActive(tab.value)}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="settings-sidebar-pill"
                          className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl"
                          transition={spring}
                        />
                      )}
                      <div className={`relative z-10 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? 'bg-primary/20' : 'bg-muted/50'
                      }`}>
                        <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                      </div>
                      <div className="relative z-10 flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${isActive ? 'text-foreground' : ''}`}>{tab.label}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{tab.desc}</p>
                      </div>
                      {isActive && (
                        <ChevronRight className="relative z-10 w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.nav>
          </LayoutGroup>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Section Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <activeTab.icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold">{activeTab.label}</h2>
                    <p className="text-[10px] text-muted-foreground">{activeTab.desc}</p>
                  </div>
                </div>

                <ActivePanel />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
