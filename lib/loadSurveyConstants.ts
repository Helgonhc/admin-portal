import { ElectricalEquipment } from '../types/load-survey';

export const COMMON_EQUIPMENTS: ElectricalEquipment[] = [
    // Iluminação
    { id: 'led-bulb-9w', name: 'Lâmpada LED 9W', category: 'Iluminação', defaultPower: 9, unit: 'unid' },
    { id: 'led-bulb-12w', name: 'Lâmpada LED 12W', category: 'Iluminação', defaultPower: 12, unit: 'unid' },
    { id: 'fluorescent-tube-40w', name: 'Lâmpada Fluorescente 40W', category: 'Iluminação', defaultPower: 40, unit: 'unid' },

    // Climatização
    { id: 'ac-9000-btu', name: 'Ar Condicionado 9000 BTU', category: 'Climatização', defaultPower: 800, unit: 'unid' },
    { id: 'ac-12000-btu', name: 'Ar Condicionado 12000 BTU', category: 'Climatização', defaultPower: 1100, unit: 'unid' },
    { id: 'ac-18000-btu', name: 'Ar Condicionado 18000 BTU', category: 'Climatização', defaultPower: 1600, unit: 'unid' },
    { id: 'fan-ceiling', name: 'Ventilador de Teto', category: 'Climatização', defaultPower: 120, unit: 'unid' },

    // Cozinha
    { id: 'refrigerator', name: 'Geladeira / Refrigerador', category: 'Cozinha', defaultPower: 250, unit: 'unid' },
    { id: 'microwave', name: 'Micro-ondas', category: 'Cozinha', defaultPower: 1200, unit: 'unid' },
    { id: 'electric-oven', name: 'Forno Elétrico', category: 'Cozinha', defaultPower: 2000, unit: 'unid' },
    { id: 'dishwasher', name: 'Lava-louças', category: 'Cozinha', defaultPower: 1500, unit: 'unid' },
    { id: 'coffee-maker', name: 'Cafeteira', category: 'Cozinha', defaultPower: 800, unit: 'unid' },

    // Lavanderia
    { id: 'washing-machine', name: 'Máquina de Lavar Roupa', category: 'Lavanderia', defaultPower: 1000, unit: 'unid' },
    { id: 'clothes-dryer', name: 'Secadora de Roupa', category: 'Lavanderia', defaultPower: 3500, unit: 'unid' },
    { id: 'iron', name: 'Ferro de Passar', category: 'Lavanderia', defaultPower: 1200, unit: 'unid' },

    // Banheiro
    { id: 'electric-shower', name: 'Chuveiro Elétrico', category: 'Banheiro', defaultPower: 5500, unit: 'unid' },
    { id: 'hair-dryer', name: 'Secador de Cabelo', category: 'Banheiro', defaultPower: 1800, unit: 'unid' },

    // Computação / Oficina
    { id: 'pc-gamer', name: 'Computador Gamer / Workstation', category: 'Informática', defaultPower: 500, unit: 'unid' },
    { id: 'laptop', name: 'Notebook / Laptop', category: 'Informática', defaultPower: 90, unit: 'unid' },
    { id: 'monitor', name: 'Monitor LED', category: 'Informática', defaultPower: 40, unit: 'unid' },
    { id: 'tv-50', name: 'Televisor 50"', category: 'Sala', defaultPower: 150, unit: 'unid' },

    // Outros
    { id: 'custom', name: 'Equipamento Personalizado', category: 'Outros', defaultPower: 0, unit: 'unid' },
];
