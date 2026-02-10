export interface ElectricalEquipment {
  id: string;
  name: string;
  category: string;
  defaultPower: number; // in Watts
  unit: string;
}

export interface LoadSurveyItem {
  id: string;
  equipmentId: string;
  name: string;
  customName?: string; // Add this for custom equipment
  quantity: number;
  power: number; // Watts per unit
  totalPower: number; // quantity * power
  voltage: 127 | 220 | 380;
}

export interface LoadSurvey {
  id: string;
  client_id: string;
  title: string;
  items: LoadSurveyItem[];
  total_watts: number;
  created_at: string;
  updated_at: string;
}


export interface LoadSurveyState {
  items: LoadSurveyItem[];
  voltage: 127 | 220;
}
