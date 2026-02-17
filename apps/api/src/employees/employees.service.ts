import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { STANDARD_DAY_HOURS } from '../common/planning-config';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

type CsvEmployeeRow = {
  fullName: string;
  email: string;
  role: string;
  department?: string;
  grade?: string;
  status?: string;
  defaultCapacityHoursPerDay?: number;
};

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async ensureRoleExists(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundException(ErrorCode.ROLE_NOT_FOUND);
    }
  }

  private async ensureDepartmentExists(departmentId?: string) {
    if (!departmentId) return;

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!department) {
      throw new NotFoundException(ErrorCode.DEPARTMENT_NOT_FOUND);
    }
  }

  private async ensureEmployeeEmailAvailable(workspaceId: string, email: string, excludeEmployeeId?: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const existing = await this.prisma.employee.findUnique({
      where: {
        workspaceId_email: {
          workspaceId,
          email: normalizedEmail,
        },
      },
      select: { id: true },
    });

    if (existing && existing.id !== excludeEmployeeId) {
      throw new ConflictException(ErrorCode.EMPLOYEE_EMAIL_ALREADY_EXISTS);
    }
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        out.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    out.push(current.trim());
    return out;
  }

  private normalizeHeader(value: string): string {
    return value.toLowerCase().replace(/[\s_-]+/g, '');
  }

  private parseCsvRows(csv: string): CsvEmployeeRow[] {
    const lines = csv
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0]).map((header) => this.normalizeHeader(header));
    const headerIndex = (aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
    const idxFullName = headerIndex(['fullname', 'name']);
    const idxEmail = headerIndex(['email', 'mail']);
    const idxRole = headerIndex(['role', 'rolename']);
    const idxDepartment = headerIndex(['department', 'dept']);
    const idxGrade = headerIndex(['grade', 'level']);
    const idxStatus = headerIndex(['status']);
    const idxCapacity = headerIndex(['defaultcapacityhoursperday', 'capacity', 'hoursperday']);

    if (idxFullName < 0 || idxEmail < 0 || idxRole < 0) return [];

    const rows: CsvEmployeeRow[] = [];

    for (let lineNo = 1; lineNo < lines.length; lineNo += 1) {
      const cols = this.parseCsvLine(lines[lineNo]);
      const fullName = (cols[idxFullName] ?? '').trim();
      const email = (cols[idxEmail] ?? '').trim().toLowerCase();
      const role = (cols[idxRole] ?? '').trim();
      if (!fullName || !email || !role) continue;

      const capacityRaw = idxCapacity >= 0 ? (cols[idxCapacity] ?? '').trim() : '';
      const capacity = capacityRaw ? Number(capacityRaw) : undefined;

      rows.push({
        fullName,
        email,
        role,
        department: idxDepartment >= 0 ? (cols[idxDepartment] ?? '').trim() || undefined : undefined,
        grade: idxGrade >= 0 ? (cols[idxGrade] ?? '').trim() || undefined : undefined,
        status: idxStatus >= 0 ? (cols[idxStatus] ?? '').trim() || undefined : undefined,
        defaultCapacityHoursPerDay: Number.isFinite(capacity) ? capacity : undefined,
      });
    }

    return rows;
  }

  async create(workspaceId: string, dto: CreateEmployeeDto) {
    await this.ensureRoleExists(dto.roleId);
    await this.ensureDepartmentExists(dto.departmentId);
    await this.ensureEmployeeEmailAvailable(workspaceId, dto.email);

    return this.prisma.employee.create({
      data: {
        workspaceId,
        ...dto,
        email: this.normalizeEmail(dto.email),
        defaultCapacityHoursPerDay: dto.defaultCapacityHoursPerDay ?? STANDARD_DAY_HOURS,
      },
      include: { role: true, department: true },
    });
  }

  findAll(workspaceId: string) {
    return this.prisma.employee.findMany({
      where: { workspaceId },
      include: { role: true, department: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: { role: true, department: true },
    });

    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    return employee;
  }

  async update(workspaceId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(workspaceId, id);

    if (dto.roleId) {
      await this.ensureRoleExists(dto.roleId);
    }

    await this.ensureDepartmentExists(dto.departmentId);

    if (dto.email) {
      await this.ensureEmployeeEmailAvailable(workspaceId, dto.email, id);
    }

    const normalizedDto: UpdateEmployeeDto = {
      ...dto,
      email: dto.email ? this.normalizeEmail(dto.email) : undefined,
    };

    return this.prisma.employee.update({
      where: { id },
      data: normalizedDto,
      include: { role: true, department: true },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.employee.delete({ where: { id } });
  }

  async importCsv(workspaceId: string, csv: string) {
    const rows = this.parseCsvRows(csv);
    if (rows.length === 0) {
      return { total: 0, created: 0, updated: 0, errors: ['Invalid CSV or missing required columns'] };
    }

    const [roles, departments] = await Promise.all([
      this.prisma.role.findMany({ select: { id: true, name: true } }),
      this.prisma.department.findMany({ select: { id: true, name: true } }),
    ]);

    const roleByKey = new Map<string, string>();
    for (const role of roles) {
      roleByKey.set(role.id.toLowerCase(), role.id);
      roleByKey.set(role.name.toLowerCase(), role.id);
    }

    const departmentByKey = new Map<string, string>();
    for (const department of departments) {
      departmentByKey.set(department.id.toLowerCase(), department.id);
      departmentByKey.set(department.name.toLowerCase(), department.id);
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const [idx, row] of rows.entries()) {
      const roleId = roleByKey.get(row.role.toLowerCase());
      if (!roleId) {
        errors.push(`row ${idx + 2}: role "${row.role}" not found`);
        continue;
      }

      const departmentId = row.department ? departmentByKey.get(row.department.toLowerCase()) : undefined;
      if (row.department && !departmentId) {
        errors.push(`row ${idx + 2}: department "${row.department}" not found`);
        continue;
      }

      const existing = await this.prisma.employee.findUnique({
        where: {
          workspaceId_email: {
            workspaceId,
            email: row.email,
          },
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.employee.update({
          where: { id: existing.id },
          data: {
            fullName: row.fullName,
            roleId,
            departmentId: departmentId ?? null,
            grade: row.grade,
            status: row.status ?? 'active',
            defaultCapacityHoursPerDay: row.defaultCapacityHoursPerDay ?? STANDARD_DAY_HOURS,
          },
        });
        updated += 1;
        continue;
      }

      await this.prisma.employee.create({
        data: {
          workspaceId,
          fullName: row.fullName,
          email: row.email,
          roleId,
          departmentId,
          grade: row.grade,
          status: row.status ?? 'active',
          defaultCapacityHoursPerDay: row.defaultCapacityHoursPerDay ?? STANDARD_DAY_HOURS,
        },
      });
      created += 1;
    }

    return {
      total: rows.length,
      created,
      updated,
      errors,
    };
  }
}
