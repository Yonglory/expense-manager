export type AnimalId = 'bunny' | 'bear' | 'cat' | 'lamb';
export type Kind = 'in' | 'out';
export type Item = {
  id: string;
  household_id: string;
  month: string; // "YYYY-MM"
  kind: Kind;
  name: string;
  amount: number;
  paid: boolean;
  actual: number | null; // what was really spent, when different from the plan
  due_day: number | null; // day of month, for bills
  bill_id: string | null;
  created_at: string;
};
export type Profile = { id: string; display_name: string; animal: AnimalId; household_id: string };
export type Household = { id: string; name: string; code: string };
export type Bill = {
  id: string;
  household_id: string;
  name: string;
  amount: number;
  due_day: number;
  remind_days_before: number;
  active: boolean;
  start_month: string;
};
// Built-in categories use the keys Groceries, Household and Others. Custom ones use their own name.
export type ShopCategory = string;
export type ShopCat = { name: string; color: string; builtin: boolean; id?: string };
export type ShopItem = {
  id: string;
  household_id: string;
  name: string;
  category: ShopCategory;
  est_price: number;
  done: boolean;
  archived: boolean;
  created_at: string;
};
