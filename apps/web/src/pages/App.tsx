import { useState } from 'react';
import { ToastStack } from '../components/ToastStack';
import { AssignmentModal } from '../components/modals/AssignmentModal';
import { EmployeeImportModal } from '../components/modals/EmployeeImportModal';
import { EmployeeModal } from '../components/modals/EmployeeModal';
import { ProjectDatesModal } from '../components/modals/ProjectDatesModal';
import { ProjectModal } from '../components/modals/ProjectModal';
import { VacationModal } from '../components/modals/VacationModal';
import { PersonnelTab } from '../components/personnel/PersonnelTab';
import { RolesTab } from '../components/roles/RolesTab';
import { TimelineTab } from '../components/timeline/TimelineTab';
import { useAppData, isoToInputDate, roleColorOrDefault, timelineStyle, utilizationColor } from '../hooks/useAppData';
import { ERROR_TEXT, GRADE_OPTIONS, MONTHS_BY_LANG, TEXT } from './app-i18n';
import { Lang } from './app-types';

export function App() {
  const [lang, setLang] = useState<Lang>('ru');
  const t = TEXT[lang];

  const app = useAppData({
    t,
    errorText: ERROR_TEXT[lang],
  });

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
          </div>

          {app.activeTab === 'personnel' ? (
            <PersonnelTab
              t={t}
              departmentGroups={app.departmentGroups}
              roleStats={app.roleStats}
              selectedRoleFilters={app.selectedRoleFilters}
              vacationsByEmployee={app.vacationsByEmployee}
              roleByName={app.roleByName}
              utilizationByEmployee={app.utilizationByEmployee}
              toggleRoleFilter={app.toggleRoleFilter}
              clearRoleFilters={() => app.setSelectedRoleFilters([])}
              openVacationModal={app.openVacationModal}
              openEmployeeModal={() => app.setIsEmployeeModalOpen(true)}
              openEmployeeImportModal={() => app.setIsEmployeeImportModalOpen(true)}
              roleColorOrDefault={roleColorOrDefault}
              utilizationColor={utilizationColor}
              isoToInputDate={isoToInputDate}
            />
          ) : null}

          {app.activeTab === 'roles' ? (
            <RolesTab
              t={t}
              roles={app.roles}
              skills={app.skills}
              roleName={app.roleName}
              roleDescription={app.roleDescription}
              roleLevel={app.roleLevel}
              skillName={app.skillName}
              skillDescription={app.skillDescription}
              roleColorDrafts={app.roleColorDrafts}
              onCreateRole={app.handleCreateRole}
              onCreateSkill={app.handleCreateSkill}
              onUpdateRoleColor={app.handleUpdateRoleColor}
              setRoleName={app.setRoleName}
              setRoleDescription={app.setRoleDescription}
              setRoleLevel={app.setRoleLevel}
              setSkillName={app.setSkillName}
              setSkillDescription={app.setSkillDescription}
              setRoleColorDraft={(roleId, color) =>
                app.setRoleColorDrafts((prev) => ({
                  ...prev,
                  [roleId]: color,
                }))
              }
              roleColorOrDefault={roleColorOrDefault}
            />
          ) : null}

          {app.activeTab === 'timeline' ? (
            <TimelineTab
              t={t}
              months={MONTHS_BY_LANG[lang]}
              selectedYear={app.selectedYear}
              assignments={app.assignments}
              employees={app.employees}
              roles={app.roles}
              sortedTimeline={app.sortedTimeline}
              expandedProjectIds={app.expandedProjectIds}
              projectDetails={app.projectDetails}
              selectedProjectId={app.selectedProjectId}
              selectedAssignmentId={app.editAssignmentId}
              editAssignmentStartDate={app.editAssignmentStartDate}
              editAssignmentEndDate={app.editAssignmentEndDate}
              editAssignmentPercent={app.editAssignmentPercent}
              onOpenProjectModal={app.openProjectModal}
              onOpenProjectDatesModal={app.openProjectDatesModal}
              onOpenAssignmentModal={(projectId) => {
                app.setAssignmentProjectId(projectId);
                app.setIsAssignmentModalOpen(true);
              }}
              onSelectProject={app.handleSelectProject}
              onUpdateAssignment={app.handleUpdateAssignment}
              onYearChange={app.handleYearChange}
              onEditorAssignmentChange={app.handleEditorAssignmentChange}
              setEditAssignmentStartDate={app.setEditAssignmentStartDate}
              setEditAssignmentEndDate={app.setEditAssignmentEndDate}
              setEditAssignmentPercent={app.setEditAssignmentPercent}
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
            gradeOptions={GRADE_OPTIONS}
            onClose={() => app.setIsEmployeeModalOpen(false)}
            onSubmit={app.handleCreateEmployee}
            setEmployeeFullName={app.setEmployeeFullName}
            setEmployeeEmail={app.setEmployeeEmail}
            setEmployeeRoleId={app.setEmployeeRoleId}
            setEmployeeDepartmentId={app.setEmployeeDepartmentId}
            setEmployeeGrade={app.setEmployeeGrade}
            setEmployeeStatus={app.setEmployeeStatus}
          />

          <EmployeeImportModal
            t={t}
            isOpen={app.isEmployeeImportModalOpen}
            csv={app.employeeCsv}
            onClose={() => app.setIsEmployeeImportModalOpen(false)}
            onSubmit={app.handleImportEmployeesCsv}
            setCsv={app.setEmployeeCsv}
          />

          <VacationModal
            t={t}
            isOpen={app.isVacationModalOpen}
            vacationEmployeeName={app.vacationEmployeeName}
            vacationStartDate={app.vacationStartDate}
            vacationEndDate={app.vacationEndDate}
            vacationType={app.vacationType}
            onClose={() => app.setIsVacationModalOpen(false)}
            onSubmit={app.handleCreateVacation}
            setVacationStartDate={app.setVacationStartDate}
            setVacationEndDate={app.setVacationEndDate}
            setVacationType={app.setVacationType}
          />

          <ToastStack toasts={app.toasts} />
        </>
      )}
    </main>
  );
}
