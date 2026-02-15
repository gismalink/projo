import { useEffect, useState } from 'react';
import { api, GradeItem } from '../api/client';
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
  const t = TEXT[lang];

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

  return (
    <main className="container">
      <div className="section-header">
        <div>
          <h1>{t.appTitle}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="lang-toggle">
          <button type="button" className={lang === 'ru' ? 'tab active' : 'tab'} onClick={() => setLang('ru')}>
            RU
          </button>
          <button type="button" className={lang === 'en' ? 'tab active' : 'tab'} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
      </div>

      {!app.token ? (
        <form onSubmit={app.handleLogin} className="card">
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
              departments={app.departments}
              departmentGroups={app.departmentGroups}
              roleStats={app.roleStats}
              months={MONTHS_BY_LANG[lang]}
              selectedRoleFilters={app.selectedRoleFilters}
              vacationsByEmployee={app.vacationsByEmployee}
              roleByName={app.roleByName}
              utilizationByEmployee={app.utilizationByEmployee}
              monthlyUtilizationByEmployee={app.monthlyUtilizationByEmployee}
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
                app.setEmployeeStatus(employee.status ?? 'active');
                app.setVacationEmployeeId(employee.id);
                app.setVacationStartDate(`${new Date().getFullYear()}-07-01`);
                app.setVacationEndDate(`${new Date().getFullYear()}-07-14`);
                app.setVacationType('vacation');
                app.setIsEmployeeModalOpen(true);
              }}
              openEmployeeCreateModal={() => {
                app.setEditEmployeeId('');
                app.setEmployeeFullName('');
                app.setEmployeeEmail('');
                app.setEmployeeRoleId('');
                app.setEmployeeDepartmentId('');
                app.setEmployeeGrade('');
                app.setEmployeeStatus('active');
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
            gradeOptions={gradeOptions}
            onClose={() => app.setIsEmployeeCreateModalOpen(false)}
            onSubmit={app.handleCreateEmployee}
            setEmployeeFullName={app.setEmployeeFullName}
            setEmployeeEmail={app.setEmployeeEmail}
            setEmployeeRoleId={app.setEmployeeRoleId}
            setEmployeeDepartmentId={app.setEmployeeDepartmentId}
            setEmployeeGrade={app.setEmployeeGrade}
            setEmployeeStatus={app.setEmployeeStatus}
          />

          {app.activeTab === 'roles' ? (
            <RolesTab
              t={t}
              roles={app.roles}
              departments={app.departments}
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
              months={MONTHS_BY_LANG[lang]}
              canManageTimeline={app.currentUserRole === 'ADMIN' || app.currentUserRole === 'PM'}
              selectedYear={app.selectedYear}
              assignments={app.assignments}
              vacations={app.vacations}
              employees={app.employees}
              roles={app.roles}
              grades={grades}
              sortedTimeline={app.sortedTimeline}
              calendarDays={app.calendarDays}
              calendarHealth={app.calendarHealth}
              expandedProjectIds={app.expandedProjectIds}
              projectDetails={app.projectDetails}
              onOpenProjectModal={app.openProjectModal}
              onOpenProjectDatesModal={app.openProjectDatesModal}
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
            onClose={() => app.setIsProjectModalOpen(false)}
            onSubmit={app.handleCreateProject}
            setProjectCode={app.setProjectCode}
            setProjectName={app.setProjectName}
            setProjectStartDate={app.setProjectStartDate}
            setProjectEndDate={app.setProjectEndDate}
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
            roles={app.roles}
            departments={app.departments}
            isOpen={app.isEmployeeModalOpen}
            employeeFullName={app.employeeFullName}
            employeeEmail={app.employeeEmail}
            employeeRoleId={app.employeeRoleId}
            employeeDepartmentId={app.employeeDepartmentId}
            employeeGrade={app.employeeGrade}
            employeeStatus={app.employeeStatus}
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

          <ToastStack toasts={app.toasts} />
        </>
      )}
    </main>
  );
}
