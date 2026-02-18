export type Role = {
  id: string;
  companyId?: string | null;
  name: string;
  shortName?: string | null;
  description?: string;
  level?: number;
  colorHex?: string | null;
  _count?: { employees: number };
};

export type Employee = {
  id: string;
  fullName: string;
  email?: string | null;
  status: string;
  grade?: string | null;
  role: { name: string; shortName?: string | null };
  department?: { id: string; name: string; colorHex?: string | null } | null;
};

export type ActiveTab = 'timeline' | 'personnel' | 'roles' | 'instruction';
export type Lang = 'ru' | 'en';

export type Toast = {
  id: number;
  message: string;
};
