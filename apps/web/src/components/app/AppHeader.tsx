import { CompanyItem } from '../../api/client';
import { ChangeEvent } from 'react';
import { LANGUAGE_OPTIONS } from '../../pages/app-i18n';
import { Lang } from '../../pages/app-types';
import { Icon } from '../Icon';
import { TooltipPortal } from '../TooltipPortal';

type CompanyTab = 'personnel' | 'roles' | 'instruction' | 'admin';

type AppHeaderProps = {
  t: Record<string, string>;
  token: string | null;
  headerActiveTab: string;
  headerIsProjectHomeOpen: boolean;
  activeTab: string;
  isProjectHomeOpen: boolean;
  currentProjectName: string;
  canViewParticipants: boolean;
  isOwner: boolean;
  activeCompanyId: string;
  myCompanies: CompanyItem[];
  otherCompanies: CompanyItem[];
  canRenameCompany: boolean;
  canDeleteCompany: boolean;
  canUseCompanyAdminTabs: boolean;
  canUseAdminConsole: boolean;
  isAccountModalOpen: boolean;
  currentUserFullName: string;
  lang: Lang;
  onOpenCompanyPlans: () => void;
  onSetTimelineTab: () => void;
  onOpenProjectSettings: () => Promise<void>;
  onSwitchCompany: (companyId: string) => Promise<void>;
  onRenameCompany: () => Promise<void>;
  onDeleteCompany: () => Promise<void>;
  onCreateCompany: () => Promise<void>;
  onImportCompanyXlsx: (file: File) => Promise<void>;
  onToggleCompanyTab: (tab: CompanyTab) => void;
  onToggleAccountModal: () => void;
  onChangeLang: (lang: Lang) => void;
};

export function AppHeader({
  t,
  token,
  headerActiveTab,
  headerIsProjectHomeOpen,
  activeTab,
  isProjectHomeOpen,
  currentProjectName,
  canViewParticipants,
  isOwner,
  activeCompanyId,
  myCompanies,
  otherCompanies,
  canRenameCompany,
  canDeleteCompany,
  canUseCompanyAdminTabs,
  canUseAdminConsole,
  isAccountModalOpen,
  currentUserFullName,
  lang,
  onOpenCompanyPlans,
  onSetTimelineTab,
  onOpenProjectSettings,
  onSwitchCompany,
  onRenameCompany,
  onDeleteCompany,
  onCreateCompany,
  onImportCompanyXlsx,
  onToggleCompanyTab,
  onToggleAccountModal,
  onChangeLang,
}: AppHeaderProps) {
  return (
    <div className="section-header">
      <div>
        {token && headerActiveTab === 'timeline' && !headerIsProjectHomeOpen ? (
          <div className="project-top-panel">
            <div className="project-top-main">
              <button
                type="button"
                className="icon-btn header-btn header-icon-btn"
                onClick={() => onOpenCompanyPlans()}
                aria-label={t.projectList}
                data-tooltip={t.projectList}
              >
                <Icon name="grid" />
              </button>
              <button
                type="button"
                className={activeTab === 'timeline' ? 'tab active header-btn header-project-tab' : 'tab header-btn header-project-tab'}
                onClick={() => onSetTimelineTab()}
              >
                {currentProjectName}
              </button>
            </div>
            <div className="project-top-actions">
              {canViewParticipants ? (
                <button
                  type="button"
                  className="icon-btn header-btn header-icon-btn"
                  onClick={() => void onOpenProjectSettings()}
                  aria-label={isOwner ? t.projectSettings : t.participants}
                  data-tooltip={isOwner ? t.projectSettings : t.participants}
                >
                  <Icon name="settings" />
                </button>
              ) : null}
            </div>
          </div>
        ) : token ? (
          <div className="project-top-panel">
            <div className="project-top-main">
              <h1>{t.appTitle}</h1>
            </div>
            <div className="project-top-actions">
              <select
                className="lang-select"
                aria-label={t.workspace}
                value={activeCompanyId}
                onChange={(event) => void onSwitchCompany(event.target.value)}
              >
                {myCompanies.length > 0 ? (
                  <optgroup label={t.myCompanies}>
                    {myCompanies.map((item) => (
                      <option key={item.id} value={item.id}>
                        {`${item.name} (${item.projectsCount})`}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {otherCompanies.length > 0 ? (
                  <optgroup label={t.otherCompanies}>
                    {otherCompanies.map((item) => (
                      <option key={item.id} value={item.id}>
                        {`${item.name} (${item.projectsCount})`}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              {canRenameCompany ? (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => void onRenameCompany()}
                  aria-label={t.editCompany}
                  data-tooltip={t.editCompany}
                >
                  <Icon name="edit" />
                </button>
              ) : null}
              {canDeleteCompany ? (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => void onDeleteCompany()}
                  aria-label={t.deleteCompany}
                  data-tooltip={t.deleteCompany}
                >
                  <Icon name="trash" />
                </button>
              ) : null}
              <button
                type="button"
                className="icon-btn"
                onClick={() => void onCreateCompany()}
                aria-label={t.createCompany}
                data-tooltip={t.createCompany}
              >
                <Icon name="plus" />
              </button>
              <label className="icon-btn" aria-label={t.importCompanyXlsx} data-tooltip={t.importCompanyXlsx}>
                <Icon name="upload" />
                <input
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void onImportCompanyXlsx(file);
                    }
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        ) : (
          <h1>{t.appTitle}</h1>
        )}
      </div>
      <div className="header-controls">
        {token && canUseCompanyAdminTabs ? (
          <>
            <button
              type="button"
              className={
                !isProjectHomeOpen && activeTab === 'personnel'
                  ? 'icon-btn active header-btn header-icon-btn'
                  : 'icon-btn header-btn header-icon-btn'
              }
              onClick={() => onToggleCompanyTab('personnel')}
              aria-label={t.tabPersonnel}
              data-tooltip={t.tabPersonnel}
            >
              <Icon name="users" />
            </button>
            <button
              type="button"
              className={
                !isProjectHomeOpen && activeTab === 'roles'
                  ? 'icon-btn active header-btn header-icon-btn'
                  : 'icon-btn header-btn header-icon-btn'
              }
              onClick={() => onToggleCompanyTab('roles')}
              aria-label={t.tabRoles}
              data-tooltip={t.tabRoles}
            >
              <Icon name="settings" />
            </button>
            <button
              type="button"
              className={
                !isProjectHomeOpen && activeTab === 'instruction'
                  ? 'icon-btn active header-btn header-icon-btn'
                  : 'icon-btn header-btn header-icon-btn'
              }
              onClick={() => onToggleCompanyTab('instruction')}
              aria-label={t.tabInstruction}
              data-tooltip={t.tabInstruction}
            >
              <Icon name="copy" />
            </button>
          </>
        ) : null}
        {token && canUseAdminConsole ? (
          <button
            type="button"
            className={
              !isProjectHomeOpen && activeTab === 'admin'
                ? 'icon-btn active header-btn header-icon-btn'
                : 'icon-btn header-btn header-icon-btn'
            }
            onClick={() => onToggleCompanyTab('admin')}
            aria-label={t.tabAdmin}
            data-tooltip={t.tabAdmin}
          >
            <Icon name="grid" />
          </button>
        ) : null}
        {token ? (
          <button type="button" className={isAccountModalOpen ? 'tab active header-btn' : 'tab header-btn'} onClick={onToggleAccountModal}>
            {currentUserFullName || t.account}
          </button>
        ) : null}
        <div className="lang-select-wrap">
          <select aria-label="Language" className="lang-select" value={lang} onChange={(event) => onChangeLang(event.target.value as Lang)}>
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
  );
}
