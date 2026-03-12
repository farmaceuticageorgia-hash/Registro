export interface Intervention {
  type: string;
  specialty: string;
  classifications: string[];
  acceptance: string;
  is_economic: string;
  cost_classification: string;
}

export interface PatientRecord {
  date: string;
  pharmacist_name: string;
  sector: string;
  bed_number: string;
  interventions: Intervention[];
}

export interface Stats {
  totalRecords: number;
  totalInterventions: number;
  byType: { type: string; count: number }[];
  byAcceptance: { acceptance: string; count: number }[];
  bySector: { sector: string; count: number }[];
}
