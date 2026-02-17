import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DepartmentItem, VacationItem } from '../../api/client';
import { DEFAULT_VACATION_TYPE, PROFILE_AUTOSAVE_DEBOUNCE_MS } from '../../constants/app.constants';
import { Role } from '../../pages/app-types';
import { Icon } from '../Icon';
import { EmployeeProfileFields } from './EmployeeProfileFields';
import { VacationTypeSelect } from './VacationTypeSelect';

type EmployeeModalProps = {
  t: Record<string, string>;
  locale: 'ru-RU' | 'en-US';
  roles: Role[];
  departments: DepartmentItem[];
  isOpen: boolean;
  employeeFullName: string;
  employeeEmail: string;
  employeeRoleId: string;
  employeeDepartmentId: string;
  employeeGrade: string;
  employeeStatus: string;
  employeeSalary: string;
  selectedYear: number;
  gradeOptions: string[];
  onClose: () => void;
  vacations: VacationItem[];
  onProfileAutoSave: (payload: {
    fullName: string;
    email: string;
    roleId: string;
    departmentId?: string;
    grade?: string;
    status?: string;
    salaryMonthly?: number;
  }) => Promise<void>;
  onCreateVacation: (payload: { startDate: string; endDate: string; type: string }) => Promise<void>;
  onUpdateVacation: (vacationId: string, payload: { startDate: string; endDate: string; type: string }) => Promise<void>;
  onDeleteVacation: (vacationId: string) => Promise<void>;
};

export function EmployeeModal(props: EmployeeModalProps) {
  const {
    t,
    locale,
    roles,
    departments,
    isOpen,
    employeeFullName,
    employeeEmail,
    employeeRoleId,
    employeeDepartmentId,
    employeeGrade,
    employeeStatus,
    employeeSalary,
    selectedYear,
    gradeOptions,
    onClose,
    vacations,
    onProfileAutoSave,
    onCreateVacation,
    onUpdateVacation,
    onDeleteVacation,
  } = props;

  const [fullName, setFullName] = useState(employeeFullName);
  const [email, setEmail] = useState(employeeEmail);
  const [roleId, setRoleId] = useState(employeeRoleId);
  const [departmentId, setDepartmentId] = useState(employeeDepartmentId);
  const [grade, setGrade] = useState(employeeGrade);
  const [status, setStatus] = useState(employeeStatus);
  const [salary, setSalary] = useState(employeeSalary);
  const [newVacationStart, setNewVacationStart] = useState(`${new Date().getFullYear()}-07-01`);
  const [newVacationEnd, setNewVacationEnd] = useState(`${new Date().getFullYear()}-07-14`);
  const [newVacationType, setNewVacationType] = useState(DEFAULT_VACATION_TYPE);
  const initialProfileKeyRef = useRef('');
  const lastAutosavedProfileKeyRef = useRef('');

  const toProfileKey = (payload: {
    fullName: string;
    email: string;
    roleId: string;
    departmentId?: string;
    grade?: string;
    status: string;
    salaryMonthly?: number;
  }) =>
    [
      payload.fullName.trim(),
      payload.email.trim().toLowerCase(),
      payload.roleId,
      payload.departmentId ?? '',
      payload.grade ?? '',
      payload.status,
      payload.salaryMonthly !== undefined ? String(Math.round(payload.salaryMonthly)) : '',
    ].join('|');

  const shiftDate = (dateValue: string, days: number) => {
    const date = new Date(dateValue);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const [vacationDragState, setVacationDragState] = useState<{
    vacationId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    trackWidth: number;
    initialStartDate: string;
    initialEndDate: string;
  } | null>(null);
  const [vacationDragPreview, setVacationDragPreview] = useState<{
    vacationId: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  const yearStart = useMemo(() => new Date(Date.UTC(selectedYear, 0, 1)), [selectedYear]);
  const yearEnd = useMemo(() => new Date(Date.UTC(selectedYear + 1, 0, 1)), [selectedYear]);
  const totalDays = useMemo(() => Math.max(1, Math.floor((yearEnd.getTime() - yearStart.getTime()) / 86400000)), [yearEnd, yearStart]);

  const toUtcDay = (value: string) => {
    const date = new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  };

  const clampUtcDay = (value: Date) => {
    if (value < yearStart) return new Date(yearStart);
    const max = new Date(yearEnd);
    max.setUTCDate(max.getUTCDate() - 1);
    if (value > max) return max;
    return value;
  };

  const toInputDate = (value: Date) => value.toISOString().slice(0, 10);

  const vacationStyle = (startDate: string, endDate: string) => {
    const start = toUtcDay(startDate);
    const end = toUtcDay(endDate);
    const startOffset = Math.max(0, Math.floor((start.getTime() - yearStart.getTime()) / 86400000));
    const endOffset = Math.min(totalDays, Math.floor((end.getTime() - yearStart.getTime()) / 86400000) + 1);
    const safeEnd = Math.max(startOffset + 1, endOffset);
    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${((safeEnd - startOffset) / totalDays) * 100}%`,
    };
  };

  const beginVacationDrag = (
    event: MouseEvent<HTMLSpanElement>,
    vacation: VacationItem,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const track = (event.currentTarget.closest('.vacation-year-track') as HTMLElement | null);
    if (!track) return;
    const startDate = vacation.startDate.slice(0, 10);
    const endDate = vacation.endDate.slice(0, 10);
    setVacationDragState({
      vacationId: vacation.id,
      mode,
      startX: event.clientX,
      trackWidth: track.clientWidth,
      initialStartDate: startDate,
      initialEndDate: endDate,
    });
    setVacationDragPreview({ vacationId: vacation.id, startDate, endDate });
  };

  useEffect(() => {
    if (!vacationDragState) return;

    const onMouseMove = (event: globalThis.MouseEvent) => {
      const dayWidth = Math.max(1, vacationDragState.trackWidth / totalDays);
      const deltaDays = Math.round((event.clientX - vacationDragState.startX) / dayWidth);

      const initialStart = toUtcDay(vacationDragState.initialStartDate);
      const initialEnd = toUtcDay(vacationDragState.initialEndDate);
      let nextStart = new Date(initialStart);
      let nextEnd = new Date(initialEnd);

      if (vacationDragState.mode === 'move') {
        nextStart = toUtcDay(shiftDate(vacationDragState.initialStartDate, deltaDays));
        nextEnd = toUtcDay(shiftDate(vacationDragState.initialEndDate, deltaDays));
        const rangeDays = Math.floor((nextEnd.getTime() - nextStart.getTime()) / 86400000);
        if (nextStart < yearStart) {
          nextStart = new Date(yearStart);
          nextEnd = new Date(nextStart);
          nextEnd.setUTCDate(nextEnd.getUTCDate() + rangeDays);
        }
        const yearEndInclusive = new Date(yearEnd);
        yearEndInclusive.setUTCDate(yearEndInclusive.getUTCDate() - 1);
        if (nextEnd > yearEndInclusive) {
          nextEnd = yearEndInclusive;
          nextStart = new Date(nextEnd);
          nextStart.setUTCDate(nextStart.getUTCDate() - rangeDays);
        }
      } else if (vacationDragState.mode === 'resize-start') {
        nextStart = clampUtcDay(toUtcDay(shiftDate(vacationDragState.initialStartDate, deltaDays)));
        if (nextStart > nextEnd) nextStart = nextEnd;
      } else {
        nextEnd = clampUtcDay(toUtcDay(shiftDate(vacationDragState.initialEndDate, deltaDays)));
        if (nextEnd < nextStart) nextEnd = nextStart;
      }

      setVacationDragPreview({
        vacationId: vacationDragState.vacationId,
        startDate: toInputDate(nextStart),
        endDate: toInputDate(nextEnd),
      });
    };

    const onMouseUp = () => {
      if (vacationDragPreview && vacationDragPreview.vacationId === vacationDragState.vacationId) {
        const vacation = vacations.find((item) => item.id === vacationDragState.vacationId);
        if (vacation) {
          void onUpdateVacation(vacation.id, {
            startDate: vacationDragPreview.startDate,
            endDate: vacationDragPreview.endDate,
            type: vacation.type,
          });
        }
      }
      setVacationDragState(null);
      setVacationDragPreview(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onUpdateVacation, totalDays, vacationDragPreview, vacationDragState, vacations, yearEnd, yearStart]);

  const monthMarkers = useMemo(() => {
    const items: Array<{ key: string; left: string; label: string }> = [];
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const monthDate = new Date(Date.UTC(selectedYear, monthIndex, 1));
      const offsetDays = Math.floor((monthDate.getTime() - yearStart.getTime()) / 86400000);
      const left = `${(offsetDays / totalDays) * 100}%`;
      const label = monthDate.toLocaleString(locale, { month: 'short' });
      items.push({ key: `${selectedYear}-${monthIndex}`, left, label });
    }
    return items;
  }, [locale, selectedYear, totalDays, yearStart]);

  useEffect(() => {
    if (!isOpen) return;
    setFullName(employeeFullName);
    setEmail(employeeEmail);
    setRoleId(employeeRoleId);
    setDepartmentId(employeeDepartmentId);
    setGrade(employeeGrade);
    setStatus(employeeStatus);
    setSalary(employeeSalary);
    const initialSalary = employeeSalary.trim() ? Number(employeeSalary) : undefined;
    const initialPayloadKey = toProfileKey({
      fullName: employeeFullName,
      email: employeeEmail,
      roleId: employeeRoleId,
      departmentId: employeeDepartmentId || undefined,
      grade: employeeGrade || undefined,
      status: employeeStatus,
      salaryMonthly: Number.isFinite(initialSalary) ? initialSalary : undefined,
    });
    initialProfileKeyRef.current = initialPayloadKey;
    lastAutosavedProfileKeyRef.current = initialPayloadKey;
  }, [isOpen, employeeFullName, employeeEmail, employeeRoleId, employeeDepartmentId, employeeGrade, employeeStatus, employeeSalary]);

  useEffect(() => {
    if (!isOpen) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();
    const normalizedStatus = status.trim();
    const normalizedSalary = salary.trim();
    const salaryMonthly = normalizedSalary ? Number(normalizedSalary) : undefined;

    const hasRequiredFields = Boolean(normalizedFullName) && Boolean(normalizedEmail) && Boolean(roleId) && Boolean(normalizedStatus);
    if (!hasRequiredFields) return;

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isValidEmail) return;

    if (normalizedSalary && (!Number.isFinite(salaryMonthly) || (salaryMonthly as number) < 0)) {
      return;
    }

    const payload = {
      fullName: normalizedFullName,
      email: normalizedEmail,
      roleId,
      departmentId: departmentId || undefined,
      grade: grade || undefined,
      status,
      salaryMonthly: salaryMonthly !== undefined && Number.isFinite(salaryMonthly) ? salaryMonthly : undefined,
    };
    const payloadKey = toProfileKey(payload);
    if (payloadKey === initialProfileKeyRef.current || payloadKey === lastAutosavedProfileKeyRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastAutosavedProfileKeyRef.current = payloadKey;
      void onProfileAutoSave(payload);
    }, PROFILE_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, fullName, email, roleId, departmentId, grade, status, salary, onProfileAutoSave]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="section-header">
          <h3>{t.editProfile}</h3>
          <button
            type="button"
            className="create-role-icon-btn team-icon-btn modal-icon-btn"
            onClick={onClose}
            title={t.close}
            aria-label={t.close}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="timeline-form">
          <EmployeeProfileFields
            t={t}
            roles={roles}
            departments={departments}
            gradeOptions={gradeOptions}
            fullName={fullName}
            email={email}
            roleId={roleId}
            departmentId={departmentId}
            grade={grade}
            status={status}
            salary={salary}
            compactMeta
            setFullName={setFullName}
            setEmail={setEmail}
            setRoleId={setRoleId}
            setDepartmentId={setDepartmentId}
            setGrade={setGrade}
            setStatus={setStatus}
            setSalary={setSalary}
          />

          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <strong>{t.vacations || 'Отпуска'}</strong>
            {vacations.map((vacation) => (
              <div key={vacation.id} className="vacation-editor-row">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={vacation.startDate.slice(0, 10)}
                    onChange={(e) => void onUpdateVacation(vacation.id, { startDate: e.target.value, endDate: vacation.endDate.slice(0, 10), type: vacation.type })}
                  />
                  <span>—</span>
                  <input
                    type="date"
                    value={vacation.endDate.slice(0, 10)}
                    onChange={(e) => void onUpdateVacation(vacation.id, { startDate: vacation.startDate.slice(0, 10), endDate: e.target.value, type: vacation.type })}
                  />
                  <VacationTypeSelect
                    t={t}
                    value={vacation.type}
                    onChange={(value) => void onUpdateVacation(vacation.id, { startDate: vacation.startDate.slice(0, 10), endDate: vacation.endDate.slice(0, 10), type: value })}
                  />
                  <button
                    type="button"
                    className="create-role-icon-btn team-icon-btn modal-icon-btn"
                    title={t.deleteVacation}
                    aria-label={t.deleteVacation}
                    onClick={() => void onDeleteVacation(vacation.id)}
                  >
                    <Icon name="x" />
                  </button>
                </div>

                <div className="vacation-year-track" aria-label={`${selectedYear} vacation timeline`}>
                  <span className="track-day-grid" style={{ ['--day-step' as string]: `${(1 / totalDays) * 100}%` }} />
                  {monthMarkers.map((marker) => (
                    <span key={marker.key} className="vacation-month-marker" style={{ left: marker.left }} title={marker.label} />
                  ))}
                  {(() => {
                    const preview = vacationDragPreview && vacationDragPreview.vacationId === vacation.id ? vacationDragPreview : null;
                    const startDate = preview?.startDate ?? vacation.startDate;
                    const endDate = preview?.endDate ?? vacation.endDate;
                    return (
                      <span
                        className="assignment-bar vacation-range-bar"
                        style={vacationStyle(startDate, endDate)}
                        title={`${startDate.slice(0, 10)} — ${endDate.slice(0, 10)}`}
                      >
                        <span
                          className="assignment-plan-handle left"
                          title={t.vacationResizeStart}
                          onMouseDown={(event) => beginVacationDrag(event, vacation, 'resize-start')}
                        />
                        <span
                          className="assignment-plan-handle center"
                          title={t.vacationMoveRange}
                          onMouseDown={(event) => beginVacationDrag(event, vacation, 'move')}
                        />
                        <span
                          className="assignment-plan-handle right"
                          title={t.vacationResizeEnd}
                          onMouseDown={(event) => beginVacationDrag(event, vacation, 'resize-end')}
                        />
                      </span>
                    );
                  })()}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={newVacationStart} onChange={(e) => setNewVacationStart(e.target.value)} />
              <span>—</span>
              <input type="date" value={newVacationEnd} onChange={(e) => setNewVacationEnd(e.target.value)} />
              <VacationTypeSelect t={t} value={newVacationType} onChange={setNewVacationType} />
              <button
                type="button"
                className="create-role-icon-btn team-icon-btn modal-icon-btn"
                title={t.addVacation || 'Добавить отпуск'}
                aria-label={t.addVacation || 'Добавить отпуск'}
                onClick={() => void onCreateVacation({ startDate: newVacationStart, endDate: newVacationEnd, type: newVacationType })}
              >
                <Icon name="plus" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
