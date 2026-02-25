import { Dispatch, SetStateAction } from 'react';
import { AdminOverviewResponse, api, GradeItem } from '../../api/client';
import { DEFAULT_EMPLOYEE_STATUS, DEFAULT_VACATION_TYPE } from '../../constants/app.constants';
import { DEFAULT_DATE_INPUTS } from '../../constants/seed-defaults.constants';
import { isoToInputDate, roleColorOrDefault, timelineStyle, useAppData, utilizationColor } from '../../hooks/useAppData';
import { AdminUsersTable } from '../admin/AdminUsersTable';
import { AssignmentModal } from '../modals/AssignmentModal';
import { EmployeeCreateModal } from '../modals/EmployeeCreateModal';
import { EmployeeImportModal } from '../modals/EmployeeImportModal';
import { EmployeeModal } from '../modals/EmployeeModal';
import { ProjectDatesModal } from '../modals/ProjectDatesModal';
import { ProjectModal } from '../modals/ProjectModal';
import { InstructionTab } from '../InstructionTab';
import { PersonnelTab } from '../personnel/PersonnelTab';
import { RolesTab } from '../roles/RolesTab';
import { TimelineTab } from '../timeline/TimelineTab';

type CompanyTabsContentProps = {
  app: ReturnType<typeof useAppData>;
  t: Record<string, string>;
  locale: string;
  months: string[];
  canUseCompanyAdminTabs: boolean;
  canUseAdminConsole: boolean;
  canManageTimeline: boolean;
  canSeedDemoWorkspace: boolean;
  isOwner: boolean;
  grades: GradeItem[];
  setGrades: Dispatch<SetStateAction<GradeItem[]>>;
  gradeOptions: string[];
  adminOverview: AdminOverviewResponse | null;
  isAdminOverviewLoading: boolean;
  handleCreateDefaultGrades: () => Promise<void>;
};

export function CompanyTabsContent({
  app,
  t,
  locale,
  months,
  canUseCompanyAdminTabs,
  canUseAdminConsole,
  canManageTimeline,
  canSeedDemoWorkspace,
  isOwner,
  grades,
  setGrades,
  gradeOptions,
  adminOverview,
  isAdminOverviewLoading,
  handleCreateDefaultGrades,
}: CompanyTabsContentProps) {
  return (
    <>
      {canUseCompanyAdminTabs && app.activeTab === 'personnel' ? (
        <PersonnelTab
          t={t}
          locale={locale}
          departments={app.departments}
          departmentGroups={app.departmentGroups}
          roleStats={app.roleStats}
          months={months}
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
        <AdminUsersTable t={t} adminOverview={adminOverview} isLoading={isAdminOverviewLoading} />
      ) : null}

      {app.activeTab === 'timeline' ? (
        <TimelineTab
          t={t}
          locale={locale}
          months={months}
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
  );
}
