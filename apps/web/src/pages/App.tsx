import { FormEvent, useEffect, useState } from 'react';
import { api, GradeItem } from '../api/client';
import { DEFAULT_EMPLOYEE_STATUS, DEFAULT_VACATION_TYPE } from '../constants/app.constants';
import { DEFAULT_DATE_INPUTS } from '../constants/seed-defaults.constants';
import { ToastStack } from '../components/ToastStack';
import { AssignmentModal } from '../components/modals/AssignmentModal';
import { EmployeeCreateModal } from '../components/modals/EmployeeCreateModal';
import { EmployeeImportModal } from '../components/modals/EmployeeImportModal';
import { EmployeeModal } from '../components/modals/EmployeeModal';
import { ProjectDatesModal } from '../components/modals/ProjectDatesModal';
import { ProjectModal } from '../components/modals/ProjectModal';
import { InstructionTab } from '../components/InstructionTab';
import { PersonnelTab } from '../components/personnel/PersonnelTab';
import { RolesTab } from '../components/roles/RolesTab';
import { TimelineTab } from '../components/timeline/TimelineTab';
import { useAppData, isoToInputDate, roleColorOrDefault, timelineStyle, utilizationColor } from '../hooks/useAppData';
import { ERROR_TEXT, MONTHS_BY_LANG, TEXT } from './app-i18n';
import { Lang } from './app-types';

export function App() {
  const [lang, setLang] = useState<Lang>('ru');
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [isAccountPageOpen, setIsAccountPageOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [accountFullNameDraft, setAccountFullNameDraft] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const t = TEXT[lang];
  const locale: 'ru-RU' | 'en-US' = lang === 'ru' ? 'ru-RU' : 'en-US';

  const gradeOptions = grades.map((grade) => grade.name);

  const app = useAppData({
    t,
    errorText: ERROR_TEXT[lang],
  });

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
      setIsAccountPageOpen(false);
    }
  }, [app.token]);

  const handleRegisterSubmit = async (event: FormEvent) => {
    if (registerPassword !== registerPasswordConfirm) {
      event.preventDefault();
      app.setToasts((prev) => [...prev, { id: Date.now(), message: t.uiPasswordsDoNotMatch }]);
      return;
    }

    await app.handleRegister(event, {
      email: registerEmail,
      fullName: registerFullName,
      password: registerPassword,
    });
  };

  const handleUpdateProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await app.handleUpdateMyProfile(accountFullNameDraft);
  };

  const handleChangePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      app.setToasts((prev) => [...prev, { id: Date.now(), message: t.uiPasswordsDoNotMatch }]);
      return;
    }

    await app.handleChangeMyPassword(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
  };

  const handleLogoutClick = async () => {
    await app.handleLogout();
    setIsAccountPageOpen(false);
  };

  return (
    <main className="container">
      <div className="section-header">
        <div>
          <h1>{t.appTitle}</h1>
        </div>
        <div className="lang-toggle">
          <button type="button" className={lang === 'ru' ? 'tab active' : 'tab'} onClick={() => setLang('ru')}>
            RU
          </button>
          <button type="button" className={lang === 'en' ? 'tab active' : 'tab'} onClick={() => setLang('en')}>
            EN
          </button>
          {app.token ? (
            <button
              type="button"
              className={isAccountPageOpen ? 'tab active' : 'tab'}
              onClick={() => setIsAccountPageOpen((prev) => !prev)}
            >
              {t.account}
            </button>
          ) : null}
        </div>
      </div>

      {!app.token ? (
        <div className="modal-backdrop">
          <article className="modal-card auth-modal">
            <div className="tabs auth-tabs" style={{ marginBottom: 12 }}>
            <button type="button" className={authMode === 'login' ? 'tab active' : 'tab'} onClick={() => setAuthMode('login')}>
              {t.login}
            </button>
            <button type="button" className={authMode === 'register' ? 'tab active' : 'tab'} onClick={() => setAuthMode('register')}>
              {t.register}
            </button>
            </div>

          {authMode === 'login' ? (
            <form onSubmit={app.handleLogin} className="timeline-form">
              <h2>{t.login}</h2>
              <label>
                {t.email}
                <input value={app.email} onChange={(e) => app.setEmail(e.target.value)} />
              </label>
              <label>
                {t.password}
                <input type="password" value={app.password} onChange={(e) => app.setPassword(e.target.value)} />
              </label>
              <button type="submit">{t.signIn}</button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="timeline-form">
              <h2>{t.register}</h2>
              <label>
                {t.fullName}
                <input value={registerFullName} onChange={(e) => setRegisterFullName(e.target.value)} />
              </label>
              <label>
                {t.email}
                <input value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
              </label>
              <label>
                {t.password}
                <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
              </label>
              <label>
                {t.confirmPassword}
                <input type="password" value={registerPasswordConfirm} onChange={(e) => setRegisterPasswordConfirm(e.target.value)} />
              </label>
              <button type="submit">{t.createAccount}</button>
            </form>
          )}
          </article>
        </div>
      ) : (
        <>
          {isAccountPageOpen ? (
            <article className="card" style={{ marginBottom: 12 }}>
              <div className="section-header">
                <h3>{t.account}</h3>
                <div className="lang-toggle">
                  <button type="button" className="ghost-btn" onClick={() => setIsAccountPageOpen(false)}>
                    {t.backToApp}
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => void handleLogoutClick()}>
                    {t.logout}
                  </button>
                </div>
              </div>
              <div className="timeline-form">
                <label>
                  {t.email}
                  <input value={app.currentUserEmail} readOnly />
                </label>
                <form onSubmit={handleUpdateProfileSubmit} className="timeline-form" style={{ padding: 0 }}>
                  <label>
                    {t.fullName}
                    <input value={accountFullNameDraft} onChange={(e) => setAccountFullNameDraft(e.target.value)} />
                  </label>
                  <button type="submit">{t.saveProfile}</button>
                </form>
                <form onSubmit={handleChangePasswordSubmit} className="timeline-form" style={{ padding: 0 }}>
                  <label>
                    {t.currentPassword}
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                  </label>
                  <label>
                    {t.newPassword}
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </label>
                  <label>
                    {t.confirmPassword}
                    <input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} />
                  </label>
                  <button type="submit">{t.changePassword}</button>
                </form>
              </div>
            </article>
          ) : (
            <>
              <div className="tabs">
                <button type="button" className={app.activeTab === 'timeline' ? 'tab active' : 'tab'} onClick={() => app.setActiveTab('timeline')}>
                  {t.tabTimeline}
                </button>
                <button type="button" className={app.activeTab === 'personnel' ? 'tab active' : 'tab'} onClick={() => app.setActiveTab('personnel')}>
                  {t.tabPersonnel}
                </button>
                <button type="button" className={app.activeTab === 'roles' ? 'tab active' : 'tab'} onClick={() => app.setActiveTab('roles')}>
                  {t.tabRoles}
                </button>
                <button type="button" className={app.activeTab === 'instruction' ? 'tab active' : 'tab'} onClick={() => app.setActiveTab('instruction')}>
                  {t.tabInstruction}
                </button>
              </div>

              {app.activeTab === 'personnel' ? (
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
                app.setEmployeeEmail(employee.email);
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

              {app.activeTab === 'roles' ? (
            <RolesTab
              t={t}
              roles={app.roles}
              departments={app.departments}
              teamTemplates={app.teamTemplates}
              grades={grades}
              roleName={app.roleName}
              roleShortName={app.roleShortName}
              roleDescription={app.roleDescription}
              roleLevel={app.roleLevel}
              onCreateRole={app.handleCreateRole}
              onUpdateRole={app.handleUpdateRole}
              setRoleName={app.setRoleName}
              setRoleShortName={app.setRoleShortName}
              setRoleDescription={app.setRoleDescription}
              setRoleLevel={app.setRoleLevel}
              roleColorOrDefault={roleColorOrDefault}
              onCreateDepartment={app.handleCreateDepartment}
              onUpdateDepartment={app.handleUpdateDepartment}
              onDeleteDepartment={app.handleDeleteDepartment}
              onCreateTeamTemplate={app.handleCreateTeamTemplate}
              onUpdateTeamTemplate={app.handleUpdateTeamTemplate}
              onDeleteTeamTemplate={app.handleDeleteTeamTemplate}
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

              {app.activeTab === 'instruction' ? <InstructionTab t={t} /> : null}

              {app.activeTab === 'timeline' ? (
            <TimelineTab
              t={t}
              locale={locale}
              months={MONTHS_BY_LANG[lang]}
              canManageTimeline={app.currentUserRole === 'ADMIN' || app.currentUserRole === 'PM'}
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
              onMoveProject={app.handleMoveProject}
              onAdjustProjectPlan={app.handleAdjustProjectPlan}
              timelineStyle={timelineStyle}
              isoToInputDate={isoToInputDate}
            />
              ) : null}

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

              <EmployeeImportModal
            t={t}
            isOpen={app.isEmployeeImportModalOpen}
            csv={app.employeeCsv}
            onClose={() => app.setIsEmployeeImportModalOpen(false)}
            onSubmit={app.handleImportEmployeesCsv}
            setCsv={app.setEmployeeCsv}
              />
            </>
          )}

          <ToastStack toasts={app.toasts} />
        </>
      )}
    </main>
  );
}
