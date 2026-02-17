import { resolveErrorMessage } from '../app-helpers';

type RunWithErrorToastParams<T> = {
  operation: () => Promise<T>;
  fallbackMessage: string;
  errorText: Record<string, string>;
  pushToast: (message: string) => void;
};

export async function runWithErrorToast<T>({
  operation,
  fallbackMessage,
  errorText,
  pushToast,
}: RunWithErrorToastParams<T>): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    pushToast(resolveErrorMessage(error, fallbackMessage, errorText));
    return undefined;
  }
}

type RunWithErrorToastVoidParams = {
  operation: () => Promise<void>;
  fallbackMessage: string;
  errorText: Record<string, string>;
  pushToast: (message: string) => void;
};

export async function runWithErrorToastVoid({
  operation,
  fallbackMessage,
  errorText,
  pushToast,
}: RunWithErrorToastVoidParams): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch (error) {
    pushToast(resolveErrorMessage(error, fallbackMessage, errorText));
    return false;
  }
}
