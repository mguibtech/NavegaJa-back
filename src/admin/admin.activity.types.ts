export interface AdminActivity {
  type: string;
  category: string;
  description: string;
  user: string;
  details: Record<string, unknown>;
  icon: string;
  color: string;
  link: string;
  timestamp: Date | string;
}
