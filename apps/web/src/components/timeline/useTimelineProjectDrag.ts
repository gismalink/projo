import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { ProjectTimelineRow } from '../../api/client';

type ProjectDragState = {
  projectId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  startDate: Date;
  endDate: Date;
  startX: number;
  trackWidth: number;
  shiftDays: number;
};

type PendingPlanPreview = {
  projectId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  nextStart: Date;
  nextEnd: Date;
  shiftDays: number;
};

type HoverProjectDragMode = {
  projectId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
};

type UseTimelineProjectDragParams = {
  totalDays: number;
  quantizationDays: 1 | 7 | 30;
  yearStartDay: Date;
  yearEndDay: Date;
  shiftDateByDays: (value: Date, days: number) => Date;
  diffDays: (from: Date, to: Date) => number;
  toApiDate: (value: Date) => string;
  onAdjustProjectPlan: (
    projectId: string,
    nextStartIso: string,
    nextEndIso: string,
    shiftDays: number,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => Promise<void>;
};

export function useTimelineProjectDrag(params: UseTimelineProjectDragParams) {
  const { totalDays, quantizationDays, yearStartDay, yearEndDay, shiftDateByDays, diffDays, toApiDate, onAdjustProjectPlan } = params;

  const [dragState, setDragState] = useState<ProjectDragState | null>(null);
  const [pendingPlanPreview, setPendingPlanPreview] = useState<PendingPlanPreview | null>(null);
  const [hoverDragMode, setHoverDragMode] = useState<HoverProjectDragMode | null>(null);
  const suppressToggleClickRef = useRef(false);
  const dragMovedRef = useRef(false);

  const beginPlanDrag = (
    event: ReactMouseEvent,
    row: ProjectTimelineRow,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const track = (event.currentTarget as HTMLElement).closest('.track') as HTMLElement | null;
    if (!track) return;
    dragMovedRef.current = false;

    setDragState({
      projectId: row.id,
      mode,
      startDate: new Date(row.startDate),
      endDate: new Date(row.endDate),
      startX: event.clientX,
      trackWidth: Math.max(1, track.getBoundingClientRect().width),
      shiftDays: 0,
    });
  };

  const resolveDragDates = (state: ProjectDragState) => {
    let nextStart = new Date(Date.UTC(state.startDate.getUTCFullYear(), state.startDate.getUTCMonth(), state.startDate.getUTCDate()));
    let nextEnd = new Date(Date.UTC(state.endDate.getUTCFullYear(), state.endDate.getUTCMonth(), state.endDate.getUTCDate()));
    if (state.mode === 'move') {
      const minShift = diffDays(state.startDate, yearStartDay);
      const maxShift = diffDays(state.endDate, yearEndDay);
      const boundedShift = Math.min(maxShift, Math.max(minShift, state.shiftDays));
      nextStart = shiftDateByDays(state.startDate, boundedShift);
      nextEnd = shiftDateByDays(state.endDate, boundedShift);
    } else if (state.mode === 'resize-start') {
      const candidateStart = shiftDateByDays(state.startDate, state.shiftDays);
      const clampedStart = candidateStart < yearStartDay ? yearStartDay : candidateStart;
      nextStart = clampedStart <= nextEnd ? clampedStart : nextEnd;
    } else {
      const candidateEnd = shiftDateByDays(state.endDate, state.shiftDays);
      const clampedEnd = candidateEnd > yearEndDay ? yearEndDay : candidateEnd;
      nextEnd = clampedEnd >= nextStart ? clampedEnd : nextStart;
    }
    return { nextStart, nextEnd };
  };

  const onPlanDragMove = (event: MouseEvent) => {
    if (!dragState) return;
    event.preventDefault();
    const deltaX = event.clientX - dragState.startX;
    const rawDays = (deltaX / dragState.trackWidth) * totalDays;
    const baseDate = dragState.mode === 'resize-end' ? dragState.endDate : dragState.startDate;
    const candidateDate = shiftDateByDays(baseDate, Math.round(rawDays));

    const toUtcDay = (value: Date) =>
      new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    const snapToBoundary = (value: Date) => {
      const next = toUtcDay(value);
      if (quantizationDays === 1) return next;
      if (quantizationDays === 7) {
        const weekDay = next.getUTCDay();
        const offsetToMonday = (weekDay + 6) % 7;
        next.setUTCDate(next.getUTCDate() - offsetToMonday);
        return next;
      }
      next.setUTCDate(1);
      return next;
    };

    const snappedDate = snapToBoundary(candidateDate);
    const shiftDays = diffDays(baseDate, snappedDate);
    if (Math.abs(deltaX) >= 2) {
      dragMovedRef.current = true;
    }
    if (shiftDays !== dragState.shiftDays) {
      setDragState({ ...dragState, shiftDays });
    }
  };

  const endPlanDrag = async (event?: MouseEvent) => {
    if (!dragState) return;
    event?.preventDefault();

    const current = dragState;
    setDragState(null);
    setHoverDragMode(null);
    suppressToggleClickRef.current = dragMovedRef.current;
    if (current.shiftDays === 0) return;

    const { nextStart, nextEnd } = resolveDragDates(current);
    const effectiveShiftDays = diffDays(current.startDate, nextStart);
    setPendingPlanPreview({
      projectId: current.projectId,
      mode: current.mode,
      nextStart,
      nextEnd,
      shiftDays: current.mode === 'resize-end' ? 0 : effectiveShiftDays,
    });

    try {
      await onAdjustProjectPlan(
        current.projectId,
        toApiDate(nextStart),
        toApiDate(nextEnd),
        current.mode === 'resize-end' ? 0 : effectiveShiftDays,
        current.mode,
      );
    } finally {
      setPendingPlanPreview((prev) => (prev && prev.projectId === current.projectId ? null : prev));
    }
  };

  const handlePlanBarHover = (event: ReactMouseEvent<HTMLElement>, row: ProjectTimelineRow) => {
    if (dragState) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const edgeWidth = 10;
    let mode: 'move' | 'resize-start' | 'resize-end' = 'move';
    if (x <= edgeWidth) {
      mode = 'resize-start';
    } else if (x >= rect.width - edgeWidth) {
      mode = 'resize-end';
    }
    if (!hoverDragMode || hoverDragMode.projectId !== row.id || hoverDragMode.mode !== mode) {
      setHoverDragMode({ projectId: row.id, mode });
    }
  };

  const clearPlanBarHover = (row: ProjectTimelineRow) => {
    if (dragState) return;
    setHoverDragMode((prev) => (prev && prev.projectId === row.id ? null : prev));
  };

  const consumeSuppressedToggleClick = (event: ReactMouseEvent) => {
    if (suppressToggleClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressToggleClickRef.current = false;
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (!dragState) return;

    const handleWindowMouseMove = (event: MouseEvent) => {
      onPlanDragMove(event);
    };

    const handleWindowMouseUp = (event: MouseEvent) => {
      void endPlanDrag(event);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragState, quantizationDays]);

  return {
    dragState,
    pendingPlanPreview,
    hoverDragMode,
    beginPlanDrag,
    resolveDragDates,
    handlePlanBarHover,
    clearPlanBarHover,
    consumeSuppressedToggleClick,
  };
}