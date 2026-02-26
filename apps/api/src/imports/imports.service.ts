import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppRole, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { ErrorCode } from '../common/error-codes';
import { getAverageAssignmentLoadPercent, startOfUtcDay } from '../common/load-profile.utils';
import { PrismaService } from '../common/prisma.service';
import { UsersService } from '../users/users.service';

type ImportIssue = {
  sheet: string;
  row: number;
  col: string;
  message: string;
};

type ParsedAssignment = {
  projectName: string;
  employeeName: string;
  monthValues: Array<{ monthStart: Date; value: number }>;
};

type ParsedImport = {
  monthRange: { from: string | null; to: string | null };
  assignments: ParsedAssignment[];
  projects: string[];
  employees: string[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

type PreviewResponse = {
  counts: {
    projects: number;
    employees: number;
    assignments: number;
  };
  monthRange: {
    from: string | null;
    to: string | null;
  };
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

type ApplyResponse = {
  company: {
    id: string;
    name: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  counts: {
    projects: number;
    employees: number;
    assignments: number;
  };
  monthRange: {
    from: string | null;
    to: string | null;
  };
  warnings: ImportIssue[];
};

type SheetsResponse = {
  sheets: string[];
};

type HeaderDetection = {
  row: number;
  monthColumns: Array<{ col: number; monthStart: Date }>;
};

const COMPANY_IMPORT_PREFIX = 'import company';
const WORKSPACE_IMPORT_PREFIX = 'import workspace';
const IMPORT_ROLE_NAME = 'IMPORTED_MEMBER';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private collapseWhitespace(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private normalizeName(value: string) {
    return this.collapseWhitespace(value).toLowerCase();
  }

  private toColumnLabel(col: number) {
    let n = col;
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out || 'A';
  }

  private excelSerialToDate(value: number): Date {
    const dayMs = 86_400_000;
    const excelEpochUtcMs = Date.UTC(1899, 11, 30);
    const millis = excelEpochUtcMs + Math.round(value * dayMs);
    return new Date(millis);
  }

  private parseMonthCell(value: ExcelJS.CellValue | undefined): Date | null {
    if (value === null || value === undefined) return null;

    if (value instanceof Date) {
      return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const parsed = this.excelSerialToDate(value);
      return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
    }

    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return null;

      const dotDate = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/u);
      if (dotDate) {
        const month = Number(dotDate[2]) - 1;
        const year = Number(dotDate[3]);
        if (month >= 0 && month <= 11) return new Date(Date.UTC(year, month, 1));
      }

      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
      }
      return null;
    }

    if (typeof value === 'object') {
      const richText = (value as { richText?: Array<{ text?: string }> }).richText;
      if (Array.isArray(richText)) {
        const asText = richText.map((entry) => entry?.text ?? '').join('').trim();
        if (asText) return this.parseMonthCell(asText);
      }

      const candidateText = (value as { text?: unknown }).text;
      if (typeof candidateText === 'string') {
        return this.parseMonthCell(candidateText);
      }

      const candidateResult = (value as { result?: unknown }).result;
      if (typeof candidateResult === 'string' || typeof candidateResult === 'number' || candidateResult instanceof Date) {
        return this.parseMonthCell(candidateResult as ExcelJS.CellValue);
      }
    }

    return null;
  }

  private cellToString(value: ExcelJS.CellValue | undefined): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return this.collapseWhitespace(value);
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof Date) return value.toISOString().slice(0, 10);

    if (typeof value === 'object') {
      const richText = (value as { richText?: Array<{ text?: string }> }).richText;
      if (Array.isArray(richText)) {
        return this.collapseWhitespace(richText.map((entry) => entry?.text ?? '').join(''));
      }

      const text = (value as { text?: unknown }).text;
      if (typeof text === 'string') return this.collapseWhitespace(text);

      const result = (value as { result?: unknown }).result;
      if (typeof result === 'string' || typeof result === 'number') return this.cellToString(result as ExcelJS.CellValue);
    }

    return '';
  }

  private parsePercentCell(value: ExcelJS.CellValue | undefined): number | null | 'INVALID' {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 'INVALID';
      return value;
    }

    const text = this.cellToString(value).replace(/%/g, '').replace(',', '.').trim();
    if (!text) return null;
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return 'INVALID';
    return parsed;
  }

  private detectHeaderRow(worksheet: ExcelJS.Worksheet): HeaderDetection | null {
    const limitRows = Math.min(worksheet.rowCount || 1, 60);
    let best: HeaderDetection | null = null;

    for (let rowNumber = 1; rowNumber <= limitRows; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const monthColumns: Array<{ col: number; monthStart: Date }> = [];

      for (let col = 1; col <= Math.max(row.cellCount, row.actualCellCount, 80); col += 1) {
        const monthStart = this.parseMonthCell(row.getCell(col).value);
        if (!monthStart) continue;
        monthColumns.push({ col, monthStart });
      }

      if (monthColumns.length < 2) continue;
      monthColumns.sort((left, right) => left.col - right.col);

      let contiguous: Array<{ col: number; monthStart: Date }> = [monthColumns[0]];
      let bestContiguous: Array<{ col: number; monthStart: Date }> = [...contiguous];
      for (let index = 1; index < monthColumns.length; index += 1) {
        const current = monthColumns[index];
        const previous = monthColumns[index - 1];
        if (current.col - previous.col <= 2) {
          contiguous.push(current);
          continue;
        }

        if (contiguous.length > bestContiguous.length) {
          bestContiguous = [...contiguous];
        }
        contiguous = [current];
      }

      if (contiguous.length > bestContiguous.length) {
        bestContiguous = [...contiguous];
      }

      if (bestContiguous.length < 6) continue;
      if (!best || bestContiguous.length > best.monthColumns.length) {
        best = {
          row: rowNumber,
          monthColumns: bestContiguous,
        };
      }
    }

    return best;
  }

  private detectProjectAndEmployeeColumns(row: ExcelJS.Row, monthStartCol: number): { projectCol: number; employeeCol: number } {
    const aliasesProject = ['project', 'проект'];
    const aliasesEmployee = ['employee', 'name', 'fullname', 'фио', 'сотрудник', 'работник'];

    let projectCol = 1;
    let employeeCol = 2;

    for (let col = 1; col < monthStartCol; col += 1) {
      const normalized = this.normalizeName(this.cellToString(row.getCell(col).value));
      if (!normalized) continue;
      if (aliasesProject.some((alias) => normalized.includes(alias))) {
        projectCol = col;
      }
      if (aliasesEmployee.some((alias) => normalized.includes(alias))) {
        employeeCol = col;
      }
    }

    if (projectCol === employeeCol) {
      employeeCol = Math.min(projectCol + 1, monthStartCol - 1);
    }

    return { projectCol, employeeCol };
  }

  private buildAssignmentCurve(monthValues: Array<{ monthStart: Date; value: number }>) {
    const firstMonth = monthValues[0]?.monthStart;
    const lastMonth = monthValues[monthValues.length - 1]?.monthStart;
    if (!firstMonth || !lastMonth) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_INVALID);
    }

    const assignmentStartDate = startOfUtcDay(new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth(), 1)));
    const assignmentEndDate = startOfUtcDay(new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 0)));

    const points: Array<{ date: string; value: number }> = [];
    for (const month of monthValues) {
      const monthStart = startOfUtcDay(new Date(Date.UTC(month.monthStart.getUTCFullYear(), month.monthStart.getUTCMonth(), 1)));
      const monthEnd = startOfUtcDay(new Date(Date.UTC(month.monthStart.getUTCFullYear(), month.monthStart.getUTCMonth() + 1, 0)));
      points.push({ date: monthStart.toISOString(), value: month.value });
      points.push({ date: monthEnd.toISOString(), value: month.value });
    }

    const normalizedPoints = points.filter((point, index) => {
      if (index === 0) return true;
      return point.date !== points[index - 1].date;
    });

    normalizedPoints[0] = {
      ...normalizedPoints[0],
      date: assignmentStartDate.toISOString(),
    };
    normalizedPoints[normalizedPoints.length - 1] = {
      ...normalizedPoints[normalizedPoints.length - 1],
      date: assignmentEndDate.toISOString(),
    };

    const loadProfile = {
      mode: 'curve' as const,
      points: normalizedPoints,
    };

    const allocationPercent = Number(
      getAverageAssignmentLoadPercent({
        assignmentStartDate,
        assignmentEndDate,
        allocationPercent: monthValues[0]?.value ?? 0,
        loadProfile,
      }).toFixed(2),
    );

    return {
      assignmentStartDate,
      assignmentEndDate,
      loadProfile,
      allocationPercent,
    };
  }

  private slugProjectCode(rawName: string): string {
    const normalized = rawName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase();
    return normalized.slice(0, 18) || 'PRJ';
  }

  private resolveWorksheet(workbook: ExcelJS.Workbook, requestedSheetName?: string) {
    const rawRequested = requestedSheetName?.trim() ?? '';
    if (!rawRequested) {
      return workbook.worksheets[0] ?? null;
    }

    const requestedNormalized = this.normalizeName(rawRequested);
    const found = workbook.worksheets.find((worksheet) => this.normalizeName(worksheet.name) === requestedNormalized);
    return found ?? null;
  }

  private async parseCompanyWorkbook(fileBuffer: Buffer, requestedSheetName?: string): Promise<ParsedImport> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = this.resolveWorksheet(workbook, requestedSheetName);
    if (!worksheet) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_INVALID);
    }

    const errors: ImportIssue[] = [];
    const warnings: ImportIssue[] = [];

    const header = this.detectHeaderRow(worksheet);
    if (!header) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_INVALID);
    }

    const monthColumns = header.monthColumns.sort((left, right) => left.col - right.col);
    const monthStartCol = monthColumns[0].col;
    const monthEndCol = monthColumns[monthColumns.length - 1].col;

    const headerRow = worksheet.getRow(header.row);
    const { projectCol, employeeCol } = this.detectProjectAndEmployeeColumns(headerRow, monthStartCol);

    const assignmentByPair = new Map<string, ParsedAssignment>();
    let activeProjectName = '';

    for (let rowNumber = header.row + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const projectCell = this.cellToString(row.getCell(projectCol).value);
      const employeeCell = this.cellToString(row.getCell(employeeCol).value);

      let rowHasMonthContent = false;
      for (let col = monthStartCol; col <= monthEndCol; col += 1) {
        const text = this.cellToString(row.getCell(col).value);
        if (text) {
          rowHasMonthContent = true;
          break;
        }
      }

      if (!projectCell && !employeeCell && !rowHasMonthContent) {
        continue;
      }

      if (projectCell) {
        activeProjectName = this.collapseWhitespace(projectCell);
      }

      if (!activeProjectName) {
        errors.push({
          sheet: worksheet.name,
          row: rowNumber,
          col: this.toColumnLabel(projectCol),
          message: 'Project name is required before employee rows.',
        });
        continue;
      }

      const employeeName = this.collapseWhitespace(employeeCell);
      if (!employeeName) {
        warnings.push({
          sheet: worksheet.name,
          row: rowNumber,
          col: this.toColumnLabel(employeeCol),
          message: 'Employee name is empty, row skipped.',
        });
        continue;
      }

      const parsedValues: Array<number | undefined> = [];
      let hasInvalidPercent = false;
      for (let index = 0; index < monthColumns.length; index += 1) {
        const monthCol = monthColumns[index];
        const parsed = this.parsePercentCell(row.getCell(monthCol.col).value);
        if (parsed === null) {
          parsedValues.push(undefined);
          continue;
        }
        if (parsed === 'INVALID' || parsed < 0 || parsed > 100) {
          hasInvalidPercent = true;
          errors.push({
            sheet: worksheet.name,
            row: rowNumber,
            col: this.toColumnLabel(monthCol.col),
            message: 'Percent value must be a number between 0 and 100.',
          });
          parsedValues.push(undefined);
          continue;
        }
        parsedValues.push(Number(parsed));
      }

      if (hasInvalidPercent) {
        continue;
      }

      const firstDefined = parsedValues.findIndex((value) => value !== undefined);
      const lastDefined = (() => {
        for (let index = parsedValues.length - 1; index >= 0; index -= 1) {
          if (parsedValues[index] !== undefined) return index;
        }
        return -1;
      })();

      if (firstDefined < 0 || lastDefined < 0 || firstDefined > lastDefined) {
        warnings.push({
          sheet: worksheet.name,
          row: rowNumber,
          col: this.toColumnLabel(employeeCol),
          message: 'No monthly values found for employee row, skipped.',
        });
        continue;
      }

      const monthValues: Array<{ monthStart: Date; value: number }> = [];
      for (let index = firstDefined; index <= lastDefined; index += 1) {
        const month = monthColumns[index];
        const value = parsedValues[index] ?? 0;
        monthValues.push({
          monthStart: month.monthStart,
          value,
        });
      }

      const pairKey = `${this.normalizeName(activeProjectName)}::${this.normalizeName(employeeName)}`;
      if (assignmentByPair.has(pairKey)) {
        warnings.push({
          sheet: worksheet.name,
          row: rowNumber,
          col: this.toColumnLabel(employeeCol),
          message: 'Duplicate project/employee pair found, latest row is used.',
        });
      }

      assignmentByPair.set(pairKey, {
        projectName: activeProjectName,
        employeeName,
        monthValues,
      });
    }

    const assignments = Array.from(assignmentByPair.values());
    const projects = Array.from(new Set(assignments.map((item) => item.projectName)));
    const employees = Array.from(new Set(assignments.map((item) => this.collapseWhitespace(item.employeeName))));

    const monthStarts = assignments.flatMap((item) => item.monthValues.map((entry) => entry.monthStart.getTime()));
    const from = monthStarts.length > 0 ? new Date(Math.min(...monthStarts)).toISOString().slice(0, 10) : null;
    const to = monthStarts.length > 0 ? new Date(Math.max(...monthStarts)).toISOString().slice(0, 10) : null;

    return {
      monthRange: { from, to },
      assignments,
      projects,
      employees,
      errors,
      warnings,
    };
  }

  private buildPreviewResponse(parsed: ParsedImport): PreviewResponse {
    return {
      counts: {
        projects: parsed.projects.length,
        employees: parsed.employees.length,
        assignments: parsed.assignments.length,
      },
      monthRange: parsed.monthRange,
      errors: parsed.errors,
      warnings: parsed.warnings,
    };
  }

  private buildTimestampedName(prefix: string) {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${prefix} ${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  }

  async listCompanyXlsxSheets(fileBuffer: Buffer): Promise<SheetsResponse> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const sheets = workbook.worksheets.map((worksheet) => worksheet.name).filter((name) => Boolean(name?.trim()));
    if (sheets.length === 0) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_INVALID);
    }
    return { sheets };
  }

  async previewCompanyXlsx(_userId: string, fileBuffer: Buffer, requestedSheetName?: string): Promise<PreviewResponse> {
    const parsed = await this.parseCompanyWorkbook(fileBuffer, requestedSheetName);
    return this.buildPreviewResponse(parsed);
  }

  async applyCompanyXlsx(userId: string, fileBuffer: Buffer, requestedSheetName?: string): Promise<ApplyResponse> {
    const parsed = await this.parseCompanyWorkbook(fileBuffer, requestedSheetName);
    if (parsed.errors.length > 0) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_INVALID);
    }

    const companyName = this.buildTimestampedName(COMPANY_IMPORT_PREFIX);
    const workspaceName = this.buildTimestampedName(WORKSPACE_IMPORT_PREFIX);

    const company = await this.usersService.createCompany(userId, companyName);
    if (!company) {
      throw new BadRequestException(ErrorCode.AUTH_COMPANY_ACCESS_DENIED);
    }

    await this.usersService.createProjectSpace(userId, workspaceName);

    const context = await this.usersService.resolveAuthContextByUserId(userId);
    if (!context) {
      throw new NotFoundException(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: context.workspaceId },
      select: {
        id: true,
        name: true,
        companyId: true,
      },
    });

    if (!workspace || !workspace.companyId) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_INVALID);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const companyId = workspace.companyId as string;

      const role =
        (await tx.role.findFirst({
          where: {
            companyId,
            name: IMPORT_ROLE_NAME,
          },
          select: { id: true },
        })) ??
        (await tx.role.create({
          data: {
            companyId,
            name: IMPORT_ROLE_NAME,
            shortName: 'IMP',
            description: 'Imported from XLSX',
          },
          select: { id: true },
        }));

      const employeeIdByName = new Map<string, string>();
      for (const employeeName of parsed.employees) {
        const createdEmployee = await tx.employee.create({
          data: {
            workspaceId: workspace.id,
            fullName: employeeName,
            roleId: role.id,
          },
          select: { id: true, fullName: true },
        });
        employeeIdByName.set(this.normalizeName(createdEmployee.fullName), createdEmployee.id);
      }

      const assignmentsByProject = new Map<string, ParsedAssignment[]>();
      for (const assignment of parsed.assignments) {
        const key = this.normalizeName(assignment.projectName);
        const list = assignmentsByProject.get(key) ?? [];
        list.push(assignment);
        assignmentsByProject.set(key, list);
      }

      const projectIdByName = new Map<string, string>();
      const usedCodes = new Set<string>();
      for (const [projectNameKey, projectAssignments] of assignmentsByProject.entries()) {
        const projectName = projectAssignments[0]?.projectName ?? 'Imported project';

        const starts = projectAssignments.map((item) => item.monthValues[0]?.monthStart.getTime()).filter((value): value is number => Number.isFinite(value));
        const ends = projectAssignments
          .map((item) => item.monthValues[item.monthValues.length - 1]?.monthStart)
          .filter((value): value is Date => Boolean(value))
          .map((monthStart) => Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));

        const projectStart = starts.length > 0 ? startOfUtcDay(new Date(Math.min(...starts))) : startOfUtcDay(new Date());
        const projectEnd = ends.length > 0 ? startOfUtcDay(new Date(Math.max(...ends))) : startOfUtcDay(new Date());

        const baseCode = this.slugProjectCode(projectName);
        let code = baseCode;
        let suffix = 1;
        while (usedCodes.has(code)) {
          suffix += 1;
          code = `${baseCode}-${suffix}`.slice(0, 24);
        }
        usedCodes.add(code);

        const createdProject = await tx.project.create({
          data: {
            workspaceId: workspace.id,
            code,
            name: projectName,
            startDate: projectStart,
            endDate: projectEnd,
            status: 'planned',
            priority: 3,
            links: Prisma.JsonNull,
          },
          select: { id: true },
        });
        projectIdByName.set(projectNameKey, createdProject.id);
      }

      let createdAssignments = 0;
      for (const assignment of parsed.assignments) {
        const projectId = projectIdByName.get(this.normalizeName(assignment.projectName));
        const employeeId = employeeIdByName.get(this.normalizeName(assignment.employeeName));
        if (!projectId || !employeeId) {
          continue;
        }

        const curve = this.buildAssignmentCurve(assignment.monthValues);

        await tx.projectMember.upsert({
          where: {
            projectId_employeeId: {
              projectId,
              employeeId,
            },
          },
          update: {},
          create: {
            projectId,
            employeeId,
          },
        });

        await tx.projectAssignment.create({
          data: {
            projectId,
            employeeId,
            assignmentStartDate: curve.assignmentStartDate,
            assignmentEndDate: curve.assignmentEndDate,
            allocationPercent: curve.allocationPercent,
            loadProfile: curve.loadProfile as unknown as Prisma.InputJsonValue,
          },
        });
        createdAssignments += 1;
      }

      return {
        projectsCount: projectIdByName.size,
        employeesCount: employeeIdByName.size,
        assignmentsCount: createdAssignments,
      };
    });

    return {
      company: {
        id: company.id,
        name: company.name,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      counts: {
        projects: created.projectsCount,
        employees: created.employeesCount,
        assignments: created.assignmentsCount,
      },
      monthRange: parsed.monthRange,
      warnings: parsed.warnings,
    };
  }
}
