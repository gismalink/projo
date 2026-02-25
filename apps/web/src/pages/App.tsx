import { FormEvent, useEffect, useRef, useState } from 'react';
import { AdminOverviewResponse, api, GradeItem, ProjectMemberItem } from '../api/client';
import { DEFAULT_EMPLOYEE_STATUS, DEFAULT_VACATION_TYPE } from '../constants/app.constants';
import { DEFAULT_DATE_INPUTS } from '../constants/seed-defaults.constants';
import { ToastStack } from '../components/ToastStack';
import { TooltipPortal } from '../components/TooltipPortal';
import { AssignmentModal } from '../components/modals/AssignmentModal';
import { AccountModal } from '../components/modals/AccountModal';
import { AuthGate } from '../components/modals/AuthGate';
import { EmployeeCreateModal } from '../components/modals/EmployeeCreateModal';
import { EmployeeImportModal } from '../components/modals/EmployeeImportModal';
import { EmployeeModal } from '../components/modals/EmployeeModal';
import { ProjectDatesModal } from '../components/modals/ProjectDatesModal';
import { ProjectModal } from '../components/modals/ProjectModal';
import { ProjectSettingsModal } from '../components/modals/ProjectSettingsModal';
import { CompanyModal } from '../components/modals/CompanyModal';
import { Icon } from '../components/Icon';
import { InstructionTab } from '../components/InstructionTab';
import { PersonnelTab } from '../components/personnel/PersonnelTab';
import { RolesTab } from '../components/roles/RolesTab';
import { TimelineTab } from '../components/timeline/TimelineTab';
import { useAppData, isoToInputDate, roleColorOrDefault, timelineStyle, utilizationColor } from '../hooks/useAppData';
import { ERROR_TEXT, LANGUAGE_OPTIONS, LOCALE_BY_LANG, MONTHS_BY_LANG, TEXT } from './app-i18n';
import { Lang } from './app-types';

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
  const isCompanyAdminTabOpen = !isProjectHomeOpen && ['personnel', 'roles', 'instruction', 'admin'].includes(app.activeTab);
  const headerContext = isCompanyAdminTabOpen && companyTabReturnRef.current ? companyTabReturnRef.current : null;
  const headerIsProjectHomeOpen = headerContext ? headerContext.isProjectHomeOpen : isProjectHomeOpen;
  const headerActiveTab = headerContext ? headerContext.activeTab : app.activeTab;
  const isCompanyOwner = Boolean(currentCompany?.isOwner);
  const canRenameCompany = Boolean(currentCompany?.isOwner);
  const myCompanies = app.companies.filter((item) => item.isOwner);
  const otherCompanies = app.companies.filter((item) => !item.isOwner);
  const adminTopUsers = adminOverview?.topUsers ?? [];
  const adminCompanySummaries = adminOverview?.companies ?? [];

  const currentProjectName =
    app.myProjectSpaces.find((item) => item.id === app.activeProjectSpaceId)?.name ||
    app.sharedProjectSpaces.find((item) => item.id === app.activeProjectSpaceId)?.name ||
    '-';

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (!local || !domain) {
      return email;
    }

    const maskedLocal =
      local.length <= 2
        ? `${local[0] ?? ''}..${local.slice(-1)}`
        : local.length <= 4
          ? `${local.slice(0, 1)}..${local.slice(-1)}`
          : `${local.slice(0, 2)}..${local.slice(-2)}`;

    const domainParts = domain.split('.');
    const domainName = domainParts[0] ?? '';
    const domainTail = domainParts.slice(1).join('.');
    const maskedDomainName =
      domainName.length <= 2
        ? `${domainName.slice(0, 1)}...`
        : `${domainName.slice(0, 1)}...${domainName.slice(-1)}`;

    return `${maskedLocal}@${maskedDomainName}${domainTail ? `.${domainTail}` : ''}`;
  };
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

    const isCompanyTabOpen = !isProjectHomeOpen && ['personnel', 'roles', 'instruction', 'admin'].includes(app.activeTab);
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

  const buildUnnamedProjectName = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mi = pad(now.getMinutes());
    return `unnamed + ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  };

  const buildUnnamedCompanyName = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mi = pad(now.getMinutes());
    return `company + ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  };

  const closeProjectSettings = () => {
    setIsProjectSettingsOpen(false);
    setProjectSettingsProjectId('');
    setProjectSettingsNameDraft('');
    setProjectMemberSearch('');
    setDeleteProjectConfirmText('');
  };

  const handleCreateProjectSpaceCard = async () => {
    await app.handleCreateProjectSpace(buildUnnamedProjectName());
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
    setCompanyNameDraft(buildUnnamedCompanyName());
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

  const handleOpenProjectSettings = async () => {
    const projectId = app.activeProjectSpaceId;
    if (!projectId) return;

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

  const handleOpenProjectSettingsById = async (projectId: string) => {
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

  const renderPlanStats = (projectsCount: number, totalAllocationPercent: number) => (
    <div className="project-space-card-stats">
      <span className="project-space-card-stat" data-tooltip={t.planProjectsStat}>
        <Icon name="grid" size={12} />
        <span>{projectsCount}</span>
      </span>
      <span className="project-space-card-stat" data-tooltip={t.planLoadStat}>
        <Icon name="users" size={12} />
        <span>{`${totalAllocationPercent.toFixed(1)}%`}</span>
      </span>
    </div>
  );

  return (
    <main className="container">
      <div className="section-header">
        <div>
          {app.token && headerActiveTab === 'timeline' && !headerIsProjectHomeOpen ? (
            <div className="project-top-panel">
              <div className="project-top-main">
                <button
                  type="button"
                  className="icon-btn header-btn header-icon-btn"
                  onClick={() => openCompanyPlans()}
                  aria-label={t.projectList}
                  data-tooltip={t.projectList}
                >
                  <Icon name="grid" />
                </button>
                <button
                  type="button"
                  className={app.activeTab === 'timeline' ? 'tab active header-btn header-project-tab' : 'tab header-btn header-project-tab'}
                  onClick={() => app.setActiveTab('timeline')}
                >
                  {currentProjectName}
                </button>
              </div>
              <div className="project-top-actions">
                {canViewParticipants ? (
                  <button
                    type="button"
                    className="icon-btn header-btn header-icon-btn"
                    onClick={() => void handleOpenProjectSettings()}
                    aria-label={isOwner ? t.projectSettings : t.participants}
                    data-tooltip={isOwner ? t.projectSettings : t.participants}
                  >
                    <Icon name="settings" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : app.token ? (
            <div className="project-top-panel">
              <div className="project-top-main">
                <h1>{t.appTitle}</h1>
              </div>
              <div className="project-top-actions">
                <select
                  className="lang-select"
                  aria-label={t.workspace}
                  value={app.activeCompanyId}
                  onChange={(event) => void handleSwitchCompany(event.target.value)}
                >
                  {myCompanies.length > 0 ? (
                    <optgroup label={t.myCompanies}>
                      {myCompanies.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {otherCompanies.length > 0 ? (
                    <optgroup label={t.otherCompanies}>
                      {otherCompanies.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                {canRenameCompany ? (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void handleRenameCompany()}
                    aria-label={t.editCompany}
                    data-tooltip={t.editCompany}
                  >
                    <Icon name="edit" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => void handleCreateCompany()}
                  aria-label={t.createCompany}
                  data-tooltip={t.createCompany}
                >
                  <Icon name="plus" />
                </button>
              </div>
            </div>
          ) : (
            <h1>{t.appTitle}</h1>
          )}
        </div>
        <div className="header-controls">
          {app.token && canUseCompanyAdminTabs ? (
            <>
              <button
                type="button"
                className={
                  !isProjectHomeOpen && app.activeTab === 'personnel'
                    ? 'icon-btn active header-btn header-icon-btn'
                    : 'icon-btn header-btn header-icon-btn'
                }
                onClick={() => toggleCompanyTab('personnel')}
                aria-label={t.tabPersonnel}
                data-tooltip={t.tabPersonnel}
              >
                <Icon name="users" />
              </button>
              <button
                type="button"
                className={
                  !isProjectHomeOpen && app.activeTab === 'roles'
                    ? 'icon-btn active header-btn header-icon-btn'
                    : 'icon-btn header-btn header-icon-btn'
                }
                onClick={() => toggleCompanyTab('roles')}
                aria-label={t.tabRoles}
                data-tooltip={t.tabRoles}
              >
                <Icon name="settings" />
              </button>
              <button
                type="button"
                className={
                  !isProjectHomeOpen && app.activeTab === 'instruction'
                    ? 'icon-btn active header-btn header-icon-btn'
                    : 'icon-btn header-btn header-icon-btn'
                }
                onClick={() => toggleCompanyTab('instruction')}
                aria-label={t.tabInstruction}
                data-tooltip={t.tabInstruction}
              >
                <Icon name="copy" />
              </button>
            </>
          ) : null}
          {app.token && canUseAdminConsole ? (
            <button
              type="button"
              className={
                !isProjectHomeOpen && app.activeTab === 'admin'
                  ? 'icon-btn active header-btn header-icon-btn'
                  : 'icon-btn header-btn header-icon-btn'
              }
              onClick={() => toggleCompanyTab('admin')}
              aria-label={t.tabAdmin}
              data-tooltip={t.tabAdmin}
            >
              <Icon name="grid" />
            </button>
          ) : null}
          {app.token ? (
            <button
              type="button"
              className={isAccountModalOpen ? 'tab active header-btn' : 'tab header-btn'}
              onClick={() => setIsAccountModalOpen((prev) => !prev)}
            >
              {app.currentUserFullName || t.account}
            </button>
          ) : null}
          <div className="lang-select-wrap">
            <select
              aria-label="Language"
              className="lang-select"
              value={lang}
              onChange={(event) => setLang(event.target.value as Lang)}
            >
              {LANGUAGE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <TooltipPortal />
      </div>

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
                <article className="card" style={{ marginBottom: 12 }}>
                  <div className="timeline-form">
                    <h4>{t.myProjects}</h4>
                    <div className="project-space-grid">
                      {app.myProjectSpaces.map((item) => (
                        <div key={item.id} className="project-space-card" onClick={() => void handleOpenProject(item.id)}>
                          <div className="project-space-card-topline">
                            <strong>{item.name}</strong>
                            <div className="project-space-card-actions">
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleCopyProjectSpaceCard(item.id, item.name);
                                }}
                                aria-label={t.copyProjectSpace}
                                data-tooltip={t.copyProjectSpace}
                              >
                                <Icon name="copy" />
                              </button>
                              {item.isOwner || item.role === 'EDITOR' ? (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleOpenProjectSettingsById(item.id);
                                  }}
                                  aria-label={t.projectSettings}
                                  data-tooltip={t.projectSettings}
                                >
                                  <Icon name="edit" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {renderPlanStats(item.projectsCount, item.totalAllocationPercent)}
                          <span>{item.role}</span>
                        </div>
                      ))}
                      {canSeedDemoWorkspace ? (
                        <button
                          type="button"
                          className="project-space-card project-space-card-create"
                          onClick={() => void handleCreateDemoProjectSpaceCard()}
                          aria-label={t.createDemoProject}
                          data-tooltip={t.createDemoProject}
                        >
                          <span className="project-space-card-create-plus">
                            <Icon name="copy" />
                          </span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="project-space-card project-space-card-create"
                        onClick={() => void handleCreateProjectSpaceCard()}
                        aria-label={t.createProjectSpace}
                        data-tooltip={t.createProjectSpace}
                      >
                        <span className="project-space-card-create-plus">
                          <Icon name="plus" />
                        </span>
                      </button>
                    </div>

                    <h4>{t.sharedProjects}</h4>
                    {app.sharedProjectSpaces.length === 0 ? (
                      <p className="muted">{t.noSharedProjects}</p>
                    ) : (
                      <div className="project-space-grid">
                        {app.sharedProjectSpaces.map((item) => (
                          <div key={item.id} className="project-space-card" onClick={() => void handleOpenProject(item.id)}>
                            <div className="project-space-card-topline">
                              <strong>{item.name}</strong>
                              {item.isOwner || item.role === 'EDITOR' ? (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleOpenProjectSettingsById(item.id);
                                  }}
                                  aria-label={t.participants}
                                  data-tooltip={t.participants}
                                >
                                  <Icon name="edit" />
                                </button>
                              ) : null}
                            </div>
                            {renderPlanStats(item.projectsCount, item.totalAllocationPercent)}
                            <span>{item.role}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ) : (
                <></>
              )}

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
            <>
              {canUseCompanyAdminTabs && app.activeTab === 'personnel' ? (
            <PersonnelTab
              t={t}
              locale={locale}
              departments={app.departments}
              departmentGroups={app.departmentGroups}
              roleStats={app.roleStats}
              months={MONTHS_BY_LANG[lang]}
              selectedRoleFilters={app.selectedRoleFilters}
              vacationsByEmployee={app.vacationsByEmployee}
              roleByName={app.roleByName}
              utilizationByEmployee={app.utilizationByEmployee}
              monthlyUtilizationByEmployee={app.monthlyUtilizationByEmployee}
              employeeSalaryById={app.employeeSalaryById}
              toggleRoleFilter={app.toggleRoleFilter}
              clearRoleFilters={() => app.setSelectedRoleFilters([])}
              openEmployeeModal={(employee) => {
                const foundRole = app.roles.find((role) => role.name === employee.role?.name);
                app.setEditEmployeeId(employee.id);
                app.setEmployeeFullName(employee.fullName);
                  app.setEmployeeEmail(employee.email ?? '');
                app.setEmployeeRoleId(foundRole?.id ?? '');
                app.setEmployeeDepartmentId(employee.department?.id ?? '');
                app.setEmployeeGrade(employee.grade ?? '');
                app.setEmployeeStatus(employee.status ?? DEFAULT_EMPLOYEE_STATUS);
                app.setEmployeeSalary(
                  app.employeeSalaryById[employee.id] !== undefined ? String(app.employeeSalaryById[employee.id]) : '',
                );
                app.setVacationEmployeeId(employee.id);
                app.setVacationStartDate(DEFAULT_DATE_INPUTS.vacationStart);
                app.setVacationEndDate(DEFAULT_DATE_INPUTS.vacationEnd);
                app.setVacationType(DEFAULT_VACATION_TYPE);
                app.setIsEmployeeModalOpen(true);
              }}
              deleteEmployee={(employeeId) => app.handleDeleteEmployee(employeeId)}
              openEmployeeCreateModal={() => {
                app.setEditEmployeeId('');
                app.setEmployeeFullName('');
                app.setEmployeeEmail('');
                app.setEmployeeRoleId('');
                app.setEmployeeDepartmentId('');
                app.setEmployeeGrade('');
                app.setEmployeeStatus(DEFAULT_EMPLOYEE_STATUS);
                app.setEmployeeSalary('');
                app.setIsEmployeeCreateModalOpen(true);
              }}
              openEmployeeImportModal={() => app.setIsEmployeeImportModalOpen(true)}
              roleColorOrDefault={roleColorOrDefault}
              utilizationColor={utilizationColor}
              grades={grades}
            />
              ) : null}

              {canUseCompanyAdminTabs ? (
                <EmployeeCreateModal
            t={t}
            roles={app.roles}
            departments={app.departments}
            isOpen={app.isEmployeeCreateModalOpen}
            employeeFullName={app.employeeFullName}
            employeeEmail={app.employeeEmail}
            employeeRoleId={app.employeeRoleId}
            employeeDepartmentId={app.employeeDepartmentId}
            employeeGrade={app.employeeGrade}
            employeeStatus={app.employeeStatus}
            employeeSalary={app.employeeSalary}
            gradeOptions={gradeOptions}
            onClose={() => app.setIsEmployeeCreateModalOpen(false)}
            onSubmit={app.handleCreateEmployee}
            setEmployeeFullName={app.setEmployeeFullName}
            setEmployeeEmail={app.setEmployeeEmail}
            setEmployeeRoleId={app.setEmployeeRoleId}
            setEmployeeDepartmentId={app.setEmployeeDepartmentId}
            setEmployeeGrade={app.setEmployeeGrade}
            setEmployeeStatus={app.setEmployeeStatus}
            setEmployeeSalary={app.setEmployeeSalary}
                />
              ) : null}

              {canUseCompanyAdminTabs && app.activeTab === 'roles' ? (
            <RolesTab
              key={app.activeCompanyId}
              t={t}
              roles={app.roles}
              departments={app.departments}
              teamTemplates={app.teamTemplates}
              grades={grades}
              roleName={app.roleName}
              roleShortName={app.roleShortName}
              roleDescription={app.roleDescription}
              onCreateRole={app.handleCreateRole}
              onUpdateRole={app.handleUpdateRole}
              onDeleteRole={app.handleDeleteRole}
              onCreateDefaultRoles={app.handleCreateDefaultRoles}
              setRoleName={app.setRoleName}
              setRoleShortName={app.setRoleShortName}
              setRoleDescription={app.setRoleDescription}
              roleColorOrDefault={roleColorOrDefault}
              onCreateDefaultDepartments={app.handleCreateDefaultDepartments}
              onCreateDepartment={app.handleCreateDepartment}
              onUpdateDepartment={app.handleUpdateDepartment}
              onDeleteDepartment={app.handleDeleteDepartment}
              onCreateDefaultTeamTemplates={app.handleCreateDefaultTeamTemplates}
              onCreateTeamTemplate={app.handleCreateTeamTemplate}
              onUpdateTeamTemplate={app.handleUpdateTeamTemplate}
              onDeleteTeamTemplate={app.handleDeleteTeamTemplate}
              onCreateDefaultGrades={handleCreateDefaultGrades}
              onAddGrade={(name, colorHex) => {
                if (!app.token) return;
                const trimmed = name.trim();
                if (!trimmed) return;
                if (grades.some((item) => item.name === trimmed)) return;
                void api.createGrade({ name: trimmed, colorHex }, app.token).then((created) => {
                  setGrades((prev) => [...prev, created]);
                });
              }}
              onUpdateGrade={(gradeId, payload) => {
                if (!app.token) return;
                const currentGrade = grades.find((item) => item.id === gradeId);
                if (!currentGrade) return;

                const nextName = payload.name?.trim();
                if (nextName && grades.some((item) => item.id !== gradeId && item.name === nextName)) return;

                void api
                  .updateGrade(
                    gradeId,
                    {
                      ...(nextName ? { name: nextName } : {}),
                      ...(payload.colorHex ? { colorHex: payload.colorHex } : {}),
                    },
                    app.token,
                  )
                  .then((updated) => {
                  setGrades((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                  if (updated.name !== currentGrade.name) {
                    app.setEmployees((prev) =>
                      prev.map((employee) =>
                        employee.grade === currentGrade.name
                          ? {
                              ...employee,
                              grade: updated.name,
                            }
                          : employee,
                      ),
                    );
                  }
                });
              }}
              onDeleteGrade={(gradeId) => {
                if (!app.token) return;
                const currentGrade = grades.find((item) => item.id === gradeId);
                if (!currentGrade) return;
                void api.deleteGrade(currentGrade.id, app.token).then(() => {
                  setGrades((prev) => prev.filter((item) => item.id !== gradeId));
                  app.setEmployees((prev) =>
                    prev.map((employee) =>
                      employee.grade === currentGrade.name
                        ? {
                            ...employee,
                            grade: null,
                          }
                        : employee,
                    ),
                  );
                });
              }}
            />
              ) : null}

              {canUseCompanyAdminTabs && app.activeTab === 'instruction' ? <InstructionTab t={t} /> : null}

              {canUseAdminConsole && app.activeTab === 'admin' ? (
                <>
                <article className="card" style={{ marginBottom: 12 }}>
                  <div className="timeline-form">
                    <h4>{t.adminOverviewTitle}</h4>
                    <div className="project-space-grid" style={{ marginBottom: 12 }}>
                      <div className="project-space-card">
                        <strong>{t.adminOverviewUsers}</strong>
                        <span>{adminOverview?.totalUsers ?? 0}</span>
                      </div>
                      <div className="project-space-card">
                        <strong>{t.adminOverviewProjects}</strong>
                        <span>{adminOverview?.totalProjects ?? 0}</span>
                      </div>
                    </div>

                    {isAdminOverviewLoading && !adminOverview ? (
                      <p className="muted">Loading...</p>
                    ) : (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>{t.adminOverviewUserCol}</th>
                              <th>{t.adminOverviewEmailCol}</th>
                              <th>{t.adminOverviewProjectsCol}</th>
                              <th>{t.adminOverviewOwnedProjectsCol}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(adminOverview?.users ?? []).map((item) => (
                              <tr key={item.userId}>
                                <td>{item.fullName}</td>
                                <td title={item.email}>{maskEmail(item.email)}</td>
                                <td>{item.projectsCount}</td>
                                <td>{item.ownedProjectsCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </article>
                <article className="card" style={{ marginBottom: 12 }}>
                  <div className="timeline-form">
                    <h4>{t.adminTopUsersTitle}</h4>
                    {isAdminOverviewLoading && !adminOverview ? (
                      <p className="muted">Loading...</p>
                    ) : (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>{t.adminOverviewUserCol}</th>
                              <th>{t.adminOverviewEmailCol}</th>
                              <th>{t.adminOverviewProjectsCol}</th>
                              <th>{t.adminOverviewOwnedProjectsCol}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminTopUsers.map((item) => (
                              <tr key={`top-${item.userId}`}>
                                <td>{item.fullName}</td>
                                <td title={item.email}>{maskEmail(item.email)}</td>
                                <td>{item.projectsCount}</td>
                                <td>{item.ownedProjectsCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </article>
                <article className="card" style={{ marginBottom: 12 }}>
                  <div className="timeline-form">
                    <h4>{t.adminCompaniesTitle}</h4>
                    {isAdminOverviewLoading && !adminOverview ? (
                      <p className="muted">Loading...</p>
                    ) : (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>{t.adminCompanyCol}</th>
                              <th>{t.adminCompanyUsersCol}</th>
                              <th>{t.adminCompanyProjectsCol}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminCompanySummaries.map((item) => (
                              <tr key={item.companyId}>
                                <td>{item.companyName}</td>
                                <td>{item.totalUsers}</td>
                                <td>{item.totalProjects}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </article>
                </>
              ) : null}

              {app.activeTab === 'timeline' ? (
            <TimelineTab
              t={t}
              locale={locale}
              months={MONTHS_BY_LANG[lang]}
              canManageTimeline={canManageTimeline}
              canSeedDemoWorkspace={canSeedDemoWorkspace}
              onSeedDemoWorkspace={app.handleSeedDemoWorkspace}
              selectedYear={app.selectedYear}
              assignments={app.assignments}
              vacations={app.vacations}
              employees={app.employees}
              roles={app.roles}
              teamTemplates={app.teamTemplates}
              grades={grades}
              sortedTimeline={app.sortedTimeline}
              calendarDays={app.calendarDays}
              calendarHealth={app.calendarHealth}
              expandedProjectIds={app.expandedProjectIds}
              projectDetails={app.projectDetails}
              onOpenProjectModal={app.openProjectModal}
              onAutoSaveProjectMeta={app.handleAutoSaveProjectMeta}
              onOpenAssignmentModal={(projectId, employeeId) => {
                app.setAssignmentProjectId(projectId);
                if (employeeId) {
                  app.setAssignmentEmployeeId(employeeId);
                }
                app.setIsAssignmentModalOpen(true);
              }}
              onSelectProject={app.handleSelectProject}
              onYearChange={app.handleYearChange}
              onDeleteAssignment={app.handleDeleteAssignment}
              onAdjustAssignmentPlan={app.handleAdjustAssignmentPlan}
              onUpdateAssignmentCurve={async (projectId, assignmentId, loadProfile) => {
                return (await app.handleUpdateAssignmentCurve(projectId, assignmentId, loadProfile)) ?? false;
              }}
              onMoveProject={app.handleMoveProject}
              onAdjustProjectPlan={app.handleAdjustProjectPlan}
              timelineStyle={timelineStyle}
              isoToInputDate={isoToInputDate}
            />
              ) : null}

              {canManageTimeline ? (
                <ProjectModal
            t={t}
            isOpen={app.isProjectModalOpen}
            projectCode={app.projectCode}
            projectName={app.projectName}
            projectStartDate={app.projectStartDate}
            projectEndDate={app.projectEndDate}
            teamTemplates={app.teamTemplates}
            projectTeamTemplateId={app.projectTeamTemplateId}
            onClose={() => app.setIsProjectModalOpen(false)}
            onSubmit={app.handleCreateProject}
            setProjectCode={app.setProjectCode}
            setProjectName={app.setProjectName}
            setProjectStartDate={app.setProjectStartDate}
            setProjectEndDate={app.setProjectEndDate}
            setProjectTeamTemplateId={app.setProjectTeamTemplateId}
                />
              ) : null}

              {canManageTimeline ? (
                <ProjectDatesModal
            t={t}
            isOpen={app.isProjectDatesModalOpen}
            startDate={app.editProjectStartDate}
            endDate={app.editProjectEndDate}
            onClose={() => app.setIsProjectDatesModalOpen(false)}
            onSubmit={app.handleUpdateProjectDates}
            setStartDate={app.setEditProjectStartDate}
            setEndDate={app.setEditProjectEndDate}
                />
              ) : null}

              {canManageTimeline ? (
                <AssignmentModal
            t={t}
            isOpen={app.isAssignmentModalOpen}
            projects={app.projects}
            employees={app.employees}
            assignmentProjectId={app.assignmentProjectId}
            assignmentEmployeeId={app.assignmentEmployeeId}
            assignmentStartDate={app.assignmentStartDate}
            assignmentEndDate={app.assignmentEndDate}
            assignmentPercent={app.assignmentPercent}
            onClose={() => app.setIsAssignmentModalOpen(false)}
            onSubmit={app.handleCreateAssignment}
            setAssignmentProjectId={app.setAssignmentProjectId}
            setAssignmentEmployeeId={app.setAssignmentEmployeeId}
            setAssignmentStartDate={app.setAssignmentStartDate}
            setAssignmentEndDate={app.setAssignmentEndDate}
            setAssignmentPercent={app.setAssignmentPercent}
                />
              ) : null}

              {isOwner ? (
                <EmployeeModal
            t={t}
            locale={locale}
            roles={app.roles}
            departments={app.departments}
            isOpen={app.isEmployeeModalOpen}
            employeeFullName={app.employeeFullName}
            employeeEmail={app.employeeEmail}
            employeeRoleId={app.employeeRoleId}
            employeeDepartmentId={app.employeeDepartmentId}
            employeeGrade={app.employeeGrade}
            employeeStatus={app.employeeStatus}
            employeeSalary={app.employeeSalary}
            selectedYear={app.selectedYear}
            gradeOptions={gradeOptions}
            onClose={() => {
              app.setEditEmployeeId('');
              app.setIsEmployeeModalOpen(false);
            }}
            vacations={app.vacations.filter((vacation) => vacation.employeeId === app.editEmployeeId)}
            onProfileAutoSave={app.handleAutoSaveEmployeeProfile}
            onCreateVacation={app.handleCreateVacationFromEmployeeModal}
            onUpdateVacation={app.handleUpdateVacationFromEmployeeModal}
            onDeleteVacation={app.handleDeleteVacationFromEmployeeModal}
                />
              ) : null}

              {isOwner ? (
                <EmployeeImportModal
            t={t}
            isOpen={app.isEmployeeImportModalOpen}
            csv={app.employeeCsv}
            onClose={() => app.setIsEmployeeImportModalOpen(false)}
            onSubmit={app.handleImportEmployeesCsv}
            setCsv={app.setEmployeeCsv}
                />
              ) : null}
            </>
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
