import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultSkills() {
    const defaults = [
      { name: 'C#', description: 'Core language for Unity and backend tooling' },
      { name: 'Unity', description: 'Unity engine development' },
      { name: 'UI Design', description: 'Interface design systems and layouts' },
      { name: 'UX Research', description: 'User research and UX validation' },
      { name: 'Node.js', description: 'Backend API development' },
      { name: 'SQL', description: 'Data modeling and query optimization' },
      { name: 'QA Automation', description: 'Automated testing and test pipelines' },
      { name: 'Product Analytics', description: 'Funnel and product metrics analysis' },
      { name: '3D Modeling', description: '3D modeling and asset production' },
    ];

    await Promise.all(
      defaults.map((skill) =>
        this.prisma.skill.upsert({
          where: { name: skill.name },
          update: {},
          create: skill,
        }),
      ),
    );
  }

  create(dto: CreateSkillDto) {
    return this.prisma.skill.create({ data: dto });
  }

  findAll() {
    return this.prisma.skill.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      throw new NotFoundException(ErrorCode.SKILL_NOT_FOUND);
    }
    return skill;
  }

  async update(id: string, dto: UpdateSkillDto) {
    await this.findOne(id);
    return this.prisma.skill.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.skill.delete({ where: { id } });
  }

  async assignToEmployee(skillId: string, employeeId: string) {
    const [skill, employee] = await Promise.all([
      this.prisma.skill.findUnique({ where: { id: skillId }, select: { id: true } }),
      this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }),
    ]);

    if (!skill) {
      throw new NotFoundException(ErrorCode.SKILL_NOT_FOUND);
    }
    if (!employee) {
      throw new NotFoundException(ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    return this.prisma.employeeSkill.upsert({
      where: {
        employeeId_skillId: { employeeId, skillId },
      },
      update: {},
      create: { employeeId, skillId },
      include: {
        employee: {
          select: { id: true, fullName: true },
        },
        skill: true,
      },
    });
  }

  async unassignFromEmployee(skillId: string, employeeId: string) {
    const assignment = await this.prisma.employeeSkill.findUnique({
      where: {
        employeeId_skillId: { employeeId, skillId },
      },
    });

    if (!assignment) {
      throw new NotFoundException(ErrorCode.SKILL_NOT_FOUND);
    }

    return this.prisma.employeeSkill.delete({
      where: {
        employeeId_skillId: { employeeId, skillId },
      },
    });
  }
}
