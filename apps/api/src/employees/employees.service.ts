import { Injectable, NotFoundException } from '@nestjs/common';
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

  create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        ...dto,
        defaultCapacityHoursPerDay: dto.defaultCapacityHoursPerDay ?? STANDARD_DAY_HOURS,
      },
      include: { role: true, department: true },
    });
  }

  findAll() {
    return this.prisma.employee.findMany({
      include: { role: true, department: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { role: true, department: true },
    });

    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: dto,
      include: { role: true, department: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employee.delete({ where: { id } });
  }

  async importCsv(csv: string) {
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
        where: { email: row.email },
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
