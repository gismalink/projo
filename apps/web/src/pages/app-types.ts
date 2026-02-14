export type Role = {
  id: string;
  name: string;
  description?: string;
  level?: number;
  colorHex?: string | null;
  _count?: { employees: number };
};

export type Employee = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  grade?: string | null;
  role: { name: string };
  department?: { id: string; name: string } | null;
};

export type ActiveTab = 'timeline' | 'personnel' | 'roles';
export type Lang = 'ru' | 'en';

export type Toast = {
  id: number;
  message: string;
};
