import { useAppDerivedData } from './useAppDerivedData';
import { useAppHandlers } from './useAppHandlers';
import { useAppState } from './useAppState';
export { isoToInputDate, roleColorOrDefault, timelineStyle, utilizationColor } from './app-helpers';

type UseAppDataParams = {
  t: Record<string, string>;
  errorText: Record<string, string>;
};

export function useAppData({ t, errorText }: UseAppDataParams) {
  const state = useAppState();
  const derived = useAppDerivedData(state, t);
  const handlers = useAppHandlers({ state, t, errorText });

  return {
    ...state,
    ...derived,
    ...handlers,
  };
}
