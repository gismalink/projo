import { FormEvent, useEffect, useRef, useState } from 'react';
import { AdminOverviewResponse, api, GradeItem, ProjectMemberItem } from '../api/client';
import { ToastStack } from '../components/ToastStack';
import { AccountModal } from '../components/modals/AccountModal';
import { AuthGate } from '../components/modals/AuthGate';
import { ProjectSettingsModal } from '../components/modals/ProjectSettingsModal';
import { CompanyModal } from '../components/modals/CompanyModal';
import { AppHeader } from '../components/app/AppHeader';
import { CompanyTabsContent } from '../components/app/CompanyTabsContent';
import { ProjectHomeSection } from '../components/app/ProjectHomeSection';
import { Icon } from '../components/Icon';
import { useAppData } from '../hooks/useAppData';
import { ERROR_TEXT, LOCALE_BY_LANG, MONTHS_BY_LANG, TEXT } from './app-i18n';
import { Lang } from './app-types';

const COMPANY_TABS: Array<'personnel' | 'roles' | 'instruction' | 'admin'> = ['personnel', 'roles', 'instruction', 'admin'];

function buildTimestampedName(prefix: string) {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  return `${prefix} + ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function App() {
  const SUPER_ADMIN_EMAIL = 'gismalink@gmail.com';

  const [lang, setLang] = useState<Lang>('ru');
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isProjectHomeOpen, setIsProjectHomeOpen] = useState(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [projectSettingsProjectId, setProjectSettingsProjectId] = useState('');
  const [projectSettingsNameDraft, setProjectSettingsNameDraft] = useState('');
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [companyModalMode, setCompanyModalMode] = useState<'create' | 'rename'>('create');
  const [companyNameDraft, setCompanyNameDraft] = useState('');
  const [deleteProjectConfirmText, setDeleteProjectConfirmText] = useState('');
  const [projectMembers, setProjectMembers] = useState<ProjectMemberItem[]>([]);
  const [projectMemberSearch, setProjectMemberSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'viewer' | 'editor'>('viewer');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [accountFullNameDraft, setAccountFullNameDraft] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [adminOverview, setAdminOverview] = useState<AdminOverviewResponse | null>(null);
  const [isAdminOverviewLoading, setIsAdminOverviewLoading] = useState(false);
  const t = TEXT[lang];
  const locale = LOCALE_BY_LANG[lang];

  const gradeOptions = grades.map((grade) => grade.name);

  const app = useAppData({
    t,
    errorText: ERROR_TEXT[lang],
  });

  const previousTokenRef = useRef<string | null>(null);
  const companyTabReturnRef = useRef<{ isProjectHomeOpen: boolean; activeTab: string } | null>(null);

  useEffect(() => {
    if (app.token) return;
    void app.bootstrapSsoSession();
  }, [app.token]);

  useEffect(() => {
    if (!app.token) {
      setGrades([]);
      return;
    }

    let cancelled = false;
    void api
      .getGrades(app.token)
      .then((items) => {
        if (!cancelled) setGrades(items);
      })
      .catch(() => {
        if (!cancelled) setGrades([]);
      });

    return () => {
      cancelled = true;
    };
  }, [app.token]);

  useEffect(() => {
    if (!app.token) return;
    setAccountFullNameDraft(app.currentUserFullName || '');
  }, [app.currentUserFullName, app.token]);

  useEffect(() => {
    if (!app.token) {
      setIsAccountModalOpen(false);
      setIsProjectHomeOpen(false);
      setIsProjectSettingsOpen(false);
      setIsCompanyModalOpen(false);
      setProjectSettingsProjectId('');
      setProjectSettingsNameDraft('');
      previousTokenRef.current = null;
      return;
    }

    // `token` changes not only on login/logout but also on company/project switching
    // (because the API returns a new access token with updated workspace context).
    // We only want to auto-open the project list on the first login (null -> token).
    // Otherwise company tabs would unexpectedly jump back to the project list.
    if (!previousTokenRef.current) {
      setIsProjectHomeOpen(true);
    }
    void app.loadMyCompanies();
    void app.loadMyProjects();

    previousTokenRef.current = app.token;
  }, [app.token]);

  const currentCompany = app.companies.find((item) => item.id === app.activeCompanyId) || null;
  const currentCompanyName = currentCompany?.name || '-';

  const canUseAdminConsole = app.currentUserEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
  const isCompanyAdminTabOpen = !isProjectHomeOpen && COMPANY_TABS.includes(app.activeTab as (typeof COMPANY_TABS)[number]);
  const headerContext = isCompanyAdminTabOpen && companyTabReturnRef.current ? companyTabReturnRef.current : null;
  const headerIsProjectHomeOpen = headerContext ? headerContext.isProjectHomeOpen : isProjectHomeOpen;
  const headerActiveTab = headerContext ? headerContext.activeTab : app.activeTab;
  const isCompanyOwner = Boolean(currentCompany?.isOwner);
  const canRenameCompany = Boolean(currentCompany?.isOwner);
  const myCompanies = app.companies.filter((item) => item.isOwner);
  const otherCompanies = app.companies.filter((item) => !item.isOwner);

  const currentProjectName =
    app.myProjectSpaces.find((item) => item.id === app.activeProjectSpaceId)?.name ||
    app.sharedProjectSpaces.find((item) => item.id === app.activeProjectSpaceId)?.name ||
    '-';

  const currentProjectAccess =
    app.myProjectSpaces.find((item) => item.id === app.activeProjectSpaceId) ||
    app.sharedProjectSpaces.find((item) => item.id === app.activeProjectSpaceId) ||
    null;
  const settingsProjectAccess =
    (projectSettingsProjectId
      ? app.myProjectSpaces.find((item) => item.id === projectSettingsProjectId) ||
        app.sharedProjectSpaces.find((item) => item.id === projectSettingsProjectId)
      : null) || currentProjectAccess;
  const editingProjectId = projectSettingsProjectId || app.activeProjectSpaceId;
  const isOwner = Boolean(currentProjectAccess?.isOwner);
  const isEditor = app.currentUserRole === 'EDITOR';
  const canUseCompanyAdminTabs = isCompanyOwner;
  const canManageTimeline = app.currentUserRole === 'ADMIN' || app.currentUserRole === 'EDITOR';
  const canSeedDemoWorkspace = app.currentUserRole === 'ADMIN' || app.currentUserRole === 'EDITOR';
  const canViewParticipants = isOwner || isEditor;
  const canInviteParticipants = Boolean(settingsProjectAccess?.isOwner);
  const projectMemberSearchValue = projectMemberSearch.trim().toLowerCase();
  const filteredProjectMembers = projectMembers.filter((member) => {
    if (!projectMemberSearchValue) return true;
    return (
      member.fullName.toLowerCase().includes(projectMemberSearchValue) ||
      member.email.toLowerCase().includes(projectMemberSearchValue)
    );
  });

  useEffect(() => {
    const canStayOnCurrentTab =
      app.activeTab === 'timeline' ||
      (app.activeTab === 'admin' ? canUseAdminConsole : canUseCompanyAdminTabs);
    if (!canStayOnCurrentTab) {
      app.setActiveTab('timeline');
    }
  }, [app.activeTab, app.setActiveTab, canUseCompanyAdminTabs, canUseAdminConsole]);

  useEffect(() => {
    if (!app.token || app.activeTab !== 'admin' || !canUseAdminConsole) {
      if (app.activeTab !== 'admin') {
        setAdminOverview(null);
      }
      return;
    }

    let cancelled = false;
    setIsAdminOverviewLoading(true);
    void api
      .getAdminOverview(app.token)
      .then((result) => {
        if (!cancelled) {
          setAdminOverview(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdminOverview(null);
          app.setActiveTab('timeline');
          app.pushToast(t.uiLoadProjectsFailed);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAdminOverviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [app.activeTab, app.token, canUseAdminConsole, t.uiLoadProjectsFailed]);

  const handleRegisterSubmit = async (event: FormEvent) => {
    if (registerPassword !== registerPasswordConfirm) {
      event.preventDefault();
      app.pushToast(t.uiPasswordsDoNotMatch);
      return;
    }

    await app.handleRegister(event, {
      email: registerEmail,
      fullName: registerFullName,
      password: registerPassword,
    });
  };

  const handleUpdateMemberPermission = async (targetUserId: string, permission: 'viewer' | 'editor') => {
    if (!editingProjectId) return;
    const members = await app.handleUpdateProjectMemberPermission(editingProjectId, targetUserId, permission);
    if (members) {
      setProjectMembers(members);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!editingProjectId) return;
    if (!window.confirm(t.confirmRemoveProjectMember)) return;

    const members = await app.handleRemoveProjectMember(editingProjectId, targetUserId);
    if (members) {
      setProjectMembers(members);
    }
  };

  const handleUpdateProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await app.handleUpdateMyProfile(accountFullNameDraft);
  };

  const handleChangePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      app.pushToast(t.uiPasswordsDoNotMatch);
      return;
    }

    await app.handleChangeMyPassword(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
  };

  const handleLogoutClick = async () => {
    await app.handleLogout();
    setIsAccountModalOpen(false);
    setIsProjectHomeOpen(false);
  };

  const openCompanyPlans = () => {
    companyTabReturnRef.current = null;
    setIsProjectHomeOpen(true);
    app.setActiveTab('timeline');
  };

  const toggleCompanyTab = (tab: 'personnel' | 'roles' | 'instruction' | 'admin') => {
    const isAlreadyOpen = !isProjectHomeOpen && app.activeTab === tab;
    if (isAlreadyOpen) {
      const back = companyTabReturnRef.current;
      companyTabReturnRef.current = null;
      if (back) {
        setIsProjectHomeOpen(back.isProjectHomeOpen);
        app.setActiveTab(back.activeTab as never);
        return;
      }

      openCompanyPlans();
      return;
    }

    const isCompanyTabOpen = !isProjectHomeOpen && COMPANY_TABS.includes(app.activeTab as (typeof COMPANY_TABS)[number]);
    if (!isCompanyTabOpen && !companyTabReturnRef.current) {
      companyTabReturnRef.current = {
        isProjectHomeOpen,
        activeTab: app.activeTab,
      };
    }

    if (isProjectHomeOpen) {
      setIsProjectHomeOpen(false);
    }
    app.setActiveTab(tab);
  };

  const closeProjectSettings = () => {
    setIsProjectSettingsOpen(false);
    setProjectSettingsProjectId('');
    setProjectSettingsNameDraft('');
    setProjectMemberSearch('');
    setDeleteProjectConfirmText('');
  };

  const handleCreateProjectSpaceCard = async () => {
    await app.handleCreateProjectSpace(buildTimestampedName('unnamed'));
    setIsProjectHomeOpen(false);
  };

  const handleCreateDemoProjectSpaceCard = async () => {
    await app.handleCreateProjectSpace('Demo plan');
    await app.handleSeedDemoWorkspace();
    setIsProjectHomeOpen(false);
  };

  const buildCopiedPlanName = (sourceName: string) => {
    const trimmed = sourceName.trim();
    const baseName = trimmed.replace(/_v\(\d+\)$/u, '');
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const versionPattern = new RegExp(`^${escapeRegExp(baseName)}_v\\((\\d+)\\)$`, 'u');
    const allNames = [...app.myProjectSpaces, ...app.sharedProjectSpaces].map((item) => item.name.trim());
    const maxVersion = allNames.reduce((max, name) => {
      const match = name.match(versionPattern);
      if (!match) return max;
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    return `${baseName}_v(${maxVersion + 1})`;
  };

  const handleCopyProjectSpaceCard = async (projectId: string, sourceName: string) => {
    const copiedName = buildCopiedPlanName(sourceName);
    await app.handleCopyProjectSpace(projectId, copiedName);
  };

  const handleOpenProject = async (projectId: string) => {
    await app.handleSwitchProjectSpace(projectId);
    setIsProjectHomeOpen(false);
    setIsProjectSettingsOpen(false);
  };

  const handleSwitchCompany = async (companyId: string) => {
    if (!companyId || companyId === app.activeCompanyId) return;
    await app.handleSwitchCompany(companyId);
  };

  const handleCreateDefaultGrades = async () => {
    if (!app.token) return;
    try {
      await api.createDefaultGrades(app.token);
      const items = await api.getGrades(app.token);
      setGrades(items);
    } catch {
      app.pushToast(t.uiCreateDefaultGradesFailed);
    }
  };

  const handleCreateCompany = async () => {
    setCompanyModalMode('create');
    setCompanyNameDraft(buildTimestampedName('company'));
    setIsCompanyModalOpen(true);
  };

  const handleRenameCompany = async () => {
    if (!app.activeCompanyId) return;
    setCompanyModalMode('rename');
    setCompanyNameDraft(currentCompanyName);
    setIsCompanyModalOpen(true);
  };

  const handleSubmitCompanyModal = async (event: FormEvent) => {
    event.preventDefault();

    if (companyModalMode === 'create') {
      const created = await app.handleCreateCompany(companyNameDraft);
      if (created) {
        setIsCompanyModalOpen(false);
      }
      return;
    }

    if (!app.activeCompanyId) return;
    const updated = await app.handleUpdateCompanyName(app.activeCompanyId, companyNameDraft);
    if (updated) {
      setIsCompanyModalOpen(false);
    }
  };

  const openProjectSettingsById = async (projectId: string) => {
    const projectAccess =
      app.myProjectSpaces.find((item) => item.id === projectId) ||
      app.sharedProjectSpaces.find((item) => item.id === projectId);
    if (!projectAccess) return;

    const members = await app.loadProjectMembers(projectId);
    if (members) {
      setProjectSettingsProjectId(projectId);
      setProjectSettingsNameDraft(projectAccess.name);
      setProjectMembers(members);
      setProjectMemberSearch('');
      setDeleteProjectConfirmText('');
      setIsProjectSettingsOpen(true);
    }
  };

  const handleOpenProjectSettings = async () => {
    const projectId = app.activeProjectSpaceId;
    if (!projectId) return;
    await openProjectSettingsById(projectId);
  };

  const handleOpenProjectSettingsById = async (projectId: string) => {
    await openProjectSettingsById(projectId);
  };

  const handleUpdateProjectNameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingProjectId) return;

    const success = await app.handleUpdateProjectSpaceName(editingProjectId, projectSettingsNameDraft);
    if (success) {
      const updatedAccess =
        app.myProjectSpaces.find((item) => item.id === editingProjectId) ||
        app.sharedProjectSpaces.find((item) => item.id === editingProjectId);
      if (updatedAccess) {
        setProjectSettingsNameDraft(updatedAccess.name);
      }
    }
  };

  const handleInviteSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingProjectId) return;

    const members = await app.handleInviteProjectMember(editingProjectId, inviteEmail, invitePermission);
    if (members) {
      setProjectMembers(members);
      setInviteEmail('');
    }
  };

  const handleDeleteProjectSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingProjectId) return;

    if (deleteProjectConfirmText.trim().toLowerCase() !== 'delete') {
      app.pushToast(t.uiDeleteProjectConfirmWordRequired);
      return;
    }

    const deleted = await app.handleDeleteProjectSpace(editingProjectId);
    if (!deleted) return;

    closeProjectSettings();
    setIsProjectHomeOpen(true);
  };

  return (
    <main className="container">
      <AppHeader
        t={t}
        token={app.token}
        headerActiveTab={headerActiveTab}
        headerIsProjectHomeOpen={headerIsProjectHomeOpen}
        activeTab={app.activeTab}
        isProjectHomeOpen={isProjectHomeOpen}
        currentProjectName={currentProjectName}
        canViewParticipants={canViewParticipants}
        isOwner={isOwner}
        activeCompanyId={app.activeCompanyId}
        myCompanies={myCompanies}
        otherCompanies={otherCompanies}
        canRenameCompany={canRenameCompany}
        canUseCompanyAdminTabs={canUseCompanyAdminTabs}
        canUseAdminConsole={canUseAdminConsole}
        isAccountModalOpen={isAccountModalOpen}
        currentUserFullName={app.currentUserFullName}
        lang={lang}
        onOpenCompanyPlans={openCompanyPlans}
        onSetTimelineTab={() => app.setActiveTab('timeline')}
        onOpenProjectSettings={handleOpenProjectSettings}
        onSwitchCompany={handleSwitchCompany}
        onRenameCompany={handleRenameCompany}
        onCreateCompany={handleCreateCompany}
        onToggleCompanyTab={toggleCompanyTab}
        onToggleAccountModal={() => setIsAccountModalOpen((prev) => !prev)}
        onChangeLang={setLang}
      />

      {!app.token ? (
        <AuthGate
          isOpen={!app.token}
          t={t}
          authMode={authMode}
          setAuthMode={setAuthMode}
          lang={lang}
          setLang={setLang}
          email={app.email}
          setEmail={app.setEmail}
          password={app.password}
          setPassword={app.setPassword}
          registerEmail={registerEmail}
          setRegisterEmail={setRegisterEmail}
          registerFullName={registerFullName}
          setRegisterFullName={setRegisterFullName}
          registerPassword={registerPassword}
          setRegisterPassword={setRegisterPassword}
          registerPasswordConfirm={registerPasswordConfirm}
          setRegisterPasswordConfirm={setRegisterPasswordConfirm}
          onLoginSubmit={app.handleLogin}
          onRegisterSubmit={handleRegisterSubmit}
          onOauthGoogle={app.handleOauthLoginGoogle}
          onOauthYandex={app.handleOauthLoginYandex}
        />
      ) : (
        <>

              {isProjectHomeOpen ? (
                <ProjectHomeSection
                  t={t}
                  myProjectSpaces={app.myProjectSpaces}
                  sharedProjectSpaces={app.sharedProjectSpaces}
                  canSeedDemoWorkspace={canSeedDemoWorkspace}
                  onOpenProject={handleOpenProject}
                  onCopyProjectSpaceCard={handleCopyProjectSpaceCard}
                  onOpenProjectSettingsById={handleOpenProjectSettingsById}
                  onCreateDemoProjectSpaceCard={handleCreateDemoProjectSpaceCard}
                  onCreateProjectSpaceCard={handleCreateProjectSpaceCard}
                  renderPlanStats={(projectsCount, totalAllocationPercent, peakAllocationPercent, monthlyLoadStats) => {
                    const monthlyAverageValues = monthlyLoadStats.map((entry) => entry.avgAllocationPercent);
                    const loadAvg = Number.isFinite(totalAllocationPercent)
                      ? totalAllocationPercent
                      : monthlyAverageValues.length > 0
                        ? monthlyAverageValues.reduce((sum, value) => sum + value, 0) / monthlyAverageValues.length
                        : 0;
                    const loadMax = Number.isFinite(peakAllocationPercent)
                      ? peakAllocationPercent
                      : monthlyAverageValues.length > 0
                        ? Math.max(...monthlyAverageValues)
                        : loadAvg;
                    const miniChartScaleMax = Math.max(100, loadMax, ...monthlyAverageValues, 1);

                    return (
                      <>
                        <div className="project-space-card-stats">
                          <span className="project-space-card-stat" data-tooltip={t.planProjectsStat}>
                            <Icon name="grid" size={12} />
                            <span>{projectsCount}</span>
                          </span>
                          <span className="project-space-card-stat" data-tooltip={t.planLoadStat}>
                            <Icon name="users" size={12} />
                            <span>{`avg ${loadAvg.toFixed(1)}% · max ${loadMax.toFixed(1)}%`}</span>
                          </span>
                        </div>
                        <div className="project-space-mini-load" aria-label={t.planLoadStat}>
                          {monthlyLoadStats.map((entry) => {
                            const barHeight = Math.max(8, Math.min(100, (entry.avgAllocationPercent / miniChartScaleMax) * 100));
                            return (
                              <span
                                key={`plan-month-load-${entry.month}`}
                                className={`project-space-mini-load-bar${entry.avgAllocationPercent > 100 ? ' overloaded' : ''}`}
                                style={{ height: `${barHeight}%` }}
                                title={`${MONTHS_BY_LANG[lang][entry.month - 1]}: ${entry.avgAllocationPercent.toFixed(1)}%`}
                              />
                            );
                          })}
                        </div>
                      </>
                    );
                  }}
                />
              ) : null}

          <ProjectSettingsModal
            isOpen={isProjectSettingsOpen}
            t={t}
            isOwner={isOwner}
            canInviteParticipants={canInviteParticipants}
            projectSettingsNameDraft={projectSettingsNameDraft}
            setProjectSettingsNameDraft={setProjectSettingsNameDraft}
            projectMemberSearch={projectMemberSearch}
            setProjectMemberSearch={setProjectMemberSearch}
            filteredProjectMembers={filteredProjectMembers}
            inviteEmail={inviteEmail}
            setInviteEmail={setInviteEmail}
            invitePermission={invitePermission}
            setInvitePermission={setInvitePermission}
            deleteProjectConfirmText={deleteProjectConfirmText}
            setDeleteProjectConfirmText={setDeleteProjectConfirmText}
            onClose={closeProjectSettings}
            onUpdateProjectNameSubmit={handleUpdateProjectNameSubmit}
            onUpdateMemberPermission={handleUpdateMemberPermission}
            onRemoveMember={handleRemoveMember}
            onInviteSubmit={handleInviteSubmit}
            onDeleteProjectSubmit={handleDeleteProjectSubmit}
          />

          <CompanyModal
            isOpen={isCompanyModalOpen}
            t={t}
            mode={companyModalMode}
            companyNameDraft={companyNameDraft}
            setCompanyNameDraft={setCompanyNameDraft}
            onClose={() => setIsCompanyModalOpen(false)}
            onSubmit={handleSubmitCompanyModal}
          />

          {!isProjectHomeOpen ? (
            <CompanyTabsContent
              app={app}
              t={t}
              locale={locale}
              months={MONTHS_BY_LANG[lang]}
              canUseCompanyAdminTabs={canUseCompanyAdminTabs}
              canUseAdminConsole={canUseAdminConsole}
              canManageTimeline={canManageTimeline}
              canSeedDemoWorkspace={canSeedDemoWorkspace}
              isOwner={isOwner}
              grades={grades}
              setGrades={setGrades}
              gradeOptions={gradeOptions}
              adminOverview={adminOverview}
              isAdminOverviewLoading={isAdminOverviewLoading}
              handleCreateDefaultGrades={handleCreateDefaultGrades}
            />
          ) : null}

          <AccountModal
            isOpen={isAccountModalOpen}
            t={t}
            currentUserEmail={app.currentUserEmail}
            currentCompanyName={currentCompanyName}
            accountFullNameDraft={accountFullNameDraft}
            setAccountFullNameDraft={setAccountFullNameDraft}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            newPasswordConfirm={newPasswordConfirm}
            setNewPasswordConfirm={setNewPasswordConfirm}
            onClose={() => setIsAccountModalOpen(false)}
            onLogout={handleLogoutClick}
            onUpdateProfileSubmit={handleUpdateProfileSubmit}
            onChangePasswordSubmit={handleChangePasswordSubmit}
          />

        </>
      )}

      <ToastStack toasts={app.toasts} />
    </main>
  );
}
