-- DropIndex
DROP INDEX "Employee_departmentId_idx";

-- RenameIndex
ALTER INDEX "ProjectAssignment_employeeId_assignmentStartDate_assignmentEndD" RENAME TO "ProjectAssignment_employeeId_assignmentStartDate_assignment_idx";

-- RenameIndex
ALTER INDEX "ProjectAssignment_projectId_assignmentStartDate_assignmentEndDa" RENAME TO "ProjectAssignment_projectId_assignmentStartDate_assignmentE_idx";
