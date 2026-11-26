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
  created_at: string;
};
export type Profile = { id: string; display_name: string; animal: AnimalId; household_id: string };
export type Household = { id: string; name: string; code: string };
