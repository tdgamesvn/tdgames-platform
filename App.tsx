import React, { useState, useEffect, useCallback } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { SetPasswordScreen } from './components/SetPasswordScreen';
import { ProfileCompletionScreen } from './components/ProfileCompletionScreen';
import { AccountUser } from './types';
import HomeScreen from './components/HomeScreen';
import { fetchMyProfile } from './apps/portal/services/portalService';
import InvoiceApp from './apps/invoice/components/InvoiceApp';
import ExpenseApp from './apps/expense/components/ExpenseApp';
import WorkforceApp from './apps/workforce/components/WorkforceApp';
import CrmApp from './apps/crm/components/CrmApp';
import HrApp from './apps/hr/components/HrApp';
import AttendanceApp from './apps/attendance/components/AttendanceApp';
import PayrollApp from './apps/payroll/components/PayrollApp';
import DashboardApp from './apps/dashboard/components/DashboardApp';
import PortalApp from './apps/portal/components/PortalApp';
import FreelancerPortalApp from './apps/freelancer-portal/components/FreelancerPortalApp';
import AccountingApp from './apps/accounting/components/AccountingApp';
import CompanyApp from './apps/company/components/CompanyApp';
import AiAgentApp from './apps/ai-agent/components/AiAgentApp';
import SystemMonitorApp from './apps/system-monitor/components/SystemMonitorApp';
import { supabase } from './services/supabaseClient';
import { ExchangeRateProvider } from './services/ExchangeRateContext';

const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer'] as const;
const parseRole = (r: string) => (VALID_ROLES.includes(r as any) ? r : 'member') as AccountUser['role'];
const VALID_APPS = ['dashboard', 'invoice', 'expense', 'workforce', 'crm', 'hr', 'attendance', 'payroll', 'portal', 'freelancer-portal', 'accounting', 'company', 'ai-agent', 'system-monitor'];

/** Parse hash like #workforce/tasks or #hr/requests/uuid → { app, tab, param } */
const parseHash = (): { app: string | null; tab: string | null; param: string | null } => {
  const hash = window.location.hash.replace('#', '');
  const parts = hash.split('/');
  return {
    app: VALID_APPS.includes(parts[0]) ? parts[0] : null,
    tab: parts[1] || null,
    param: parts[2] || null,
  };
};

/** Helper for child apps to update just the tab portion of the hash */
export const setHashTab = (tab: string) => {
  const { app } = parseHash();
  if (app) {
    window.location.hash = `${app}/${tab}`;
  }
};

const App: React.FC = () => {
  // ── Auth State (Supabase Auth managed) ──
  const [currentUser, setCurrentUser] = useState<AccountUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsPasswordSet, setNeedsPasswordSet] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  // Required profile fields — must match ProfileCompletionScreen
  const EMPLOYEE_REQUIRED_KEYS = [
    'full_name', 'email', 'phone', 'date_of_birth', 'gender',
    'address', 'temp_address', 'id_number', 'id_issue_date', 'id_issue_place',
    'bank_name', 'bank_account', 'bank_branch', 'avatar_url',
  ];
  const FREELANCER_REQUIRED_KEYS = [
    'full_name', 'phone', 'date_of_birth', 'gender',
    'address', 'id_number', 'id_issue_date', 'id_issue_place',
    'bank_name', 'bank_account', 'bank_branch', 'tax_code',
  ];

  /** Check employee profile completeness from DB */
  const checkProfileCompletion = async (employeeId: string, role?: string) => {
    try {
      const profile = await fetchMyProfile(employeeId);
      const keys = role === 'freelancer' ? FREELANCER_REQUIRED_KEYS : EMPLOYEE_REQUIRED_KEYS;
      const missing = keys.filter(key => {
        const v = profile?.[key];
        return !v || (typeof v === 'string' && v.trim().length === 0);
      });
      if (missing.length > 0) {
        setNeedsProfileCompletion(true);
      }
    } catch {
      // If profile fetch fails, don't block
    }
  };

  /** Check if this user was invited and still needs to set a password.
   *  Uses metadata-driven detection (reliable, no URL dependency):
   *  - user.invited_at exists → user was invited
   *  - user_metadata.password_set !== true → hasn't set password yet
   */
  const checkNeedsOnboarding = async (session: any, event?: string) => {
    if (!session) return;
    const user = session.user;
    const meta = user.user_metadata || {};

    // Clean URL params
    if (window.location.search) {
      const cleanUrl = window.location.pathname + window.location.hash;
      history.replaceState(null, '', cleanUrl);
    }

    // Case 1: PASSWORD_RECOVERY event (password reset link)
    if (event === 'PASSWORD_RECOVERY') {
      setNeedsPasswordSet(true);
      return;
    }

    // Case 2: Invited user who hasn't set password yet
    if (user.invited_at && meta.password_set !== true) {
      setNeedsPasswordSet(true);
      return;
    }

    // Case 3: Password is set — check profile completion from DB
    const role = parseRole(meta.role || 'member');
    const employeeId = meta.employee_id;
    if ((role === 'member' || role === 'freelancer') && employeeId) {
      await checkProfileCompletion(employeeId, role);
    }
  };

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const meta = session.user.user_metadata;
        setCurrentUser({
          id: session.user.id,
          username: meta.username || session.user.email?.split('@')[0] || 'unknown',
          role: parseRole(meta.role || 'member'),
          employee_id: meta.employee_id || undefined,
          worker_id: meta.worker_id || undefined,
        });
        // Check onboarding state on initial load (including profile completion from DB)
        await checkNeedsOnboarding(session);
      }
      setAuthLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh, invite)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const meta = session.user.user_metadata;
        setCurrentUser({
          id: session.user.id,
          username: meta.username || session.user.email?.split('@')[0] || 'unknown',
          role: parseRole(meta.role || 'member'),
          employee_id: meta.employee_id || undefined,
          worker_id: meta.worker_id || undefined,
        });

        // Detect invite or password recovery flow
        checkNeedsOnboarding(session, event);
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── App Router State (synced with URL hash) ──
  const [activeApp, _setActiveApp] = useState<string | null>(() => parseHash().app);
  const [initialTab, setInitialTab] = useState<string | null>(() => parseHash().tab);
  const [initialParam, setInitialParam] = useState<string | null>(() => parseHash().param);

  const setActiveApp = useCallback((app: string | null) => {
    _setActiveApp(app);
    setInitialTab(null);
    setInitialParam(null);
    if (app) {
      window.location.hash = app;
    } else {
      history.pushState(null, '', window.location.pathname);
    }
  }, []);

  // Listen for browser back/forward
  useEffect(() => {
    const onHashChange = () => {
      const { app, tab, param } = parseHash();
      _setActiveApp(app);
      setInitialTab(tab);
      setInitialParam(param);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveApp(null);
  };

  const handleBack = () => {
    setActiveApp(null);
  };

  // ── Loading state ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0F0F' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4" style={{ borderColor: '#FF9500', borderTopColor: 'transparent' }} />
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#9D9C9D' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // ── Invite flow: Step 1 — Set password ──
  if (needsPasswordSet && currentUser) {
    return (
      <SetPasswordScreen
        onComplete={() => {
          setNeedsPasswordSet(false);
          // After setting password, check if profile needs completion
          if (currentUser.employee_id && (currentUser.role === 'member' || currentUser.role === 'freelancer')) {
            setNeedsProfileCompletion(true);
          } else if (currentUser.role === 'member') {
            setActiveApp('portal');
          } else if (currentUser.role === 'freelancer') {
            setActiveApp('freelancer-portal');
          }
        }}
      />
    );
  }

  // ── Invite flow: Step 2 — Profile completion ──
  if (needsProfileCompletion && currentUser && currentUser.employee_id) {
    return (
      <ProfileCompletionScreen
        currentUser={currentUser}
        onComplete={() => {
          setNeedsProfileCompletion(false);
          setActiveApp(currentUser.role === 'freelancer' ? 'freelancer-portal' : 'portal');
        }}
      />
    );
  }

  // ── Not logged in ──
  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;

  // ── App Router ──
  if (activeApp === 'dashboard') {
    return <DashboardApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} />;
  }

  if (activeApp === 'invoice') {
    return <InvoiceApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} />;
  }

  if (activeApp === 'expense') {
    return <ExpenseApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} />;
  }

  if (activeApp === 'workforce') {
    return <WorkforceApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} />;
  }

  if (activeApp === 'crm') {
    return <CrmApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} />;
  }

  if (activeApp === 'hr') {
    return <HrApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} initialParam={initialParam} />;
  }

  if (activeApp === 'attendance') {
    return <AttendanceApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} />;
  }

  if (activeApp === 'payroll') {
    return <PayrollApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} />;
  }

  if (activeApp === 'portal') {
    return <PortalApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} initialParam={initialParam} />;
  }

  if (activeApp === 'freelancer-portal') {
    return <FreelancerPortalApp currentUser={currentUser} onBack={handleBack} />;
  }

  if (activeApp === 'accounting') {
    return <AccountingApp currentUser={currentUser} onBack={handleBack} initialTab={parseHash().tab} />;
  }

  if (activeApp === 'company') {
    return <CompanyApp currentUser={currentUser} onBack={handleBack} />;
  }

  if (activeApp === 'system-monitor') {
    return <SystemMonitorApp currentUser={currentUser} onBack={handleBack} />;
  }
  if (activeApp === 'ai-agent') {
    return <AiAgentApp currentUser={currentUser} onBack={handleBack} initialTab={initialTab} />;
  }

  // ── Home Screen ──
  return (
    <HomeScreen
      currentUser={currentUser}
      onSelectApp={setActiveApp}
      onLogout={handleLogout}
    />
  );
};

const AppWithProviders: React.FC = () => (
  <ExchangeRateProvider>
    <App />
  </ExchangeRateProvider>
);

export default AppWithProviders;
