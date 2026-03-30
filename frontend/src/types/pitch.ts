/**
 * Pitch constants — pure frontend data, never sent to the backend.
 *
 * POSITION_MAP maps every semantic position key to a CSS Grid cell (row, col).
 * Row 0 = attack line (top), Row 5 = goalkeeper (bottom).
 *
 * FORMATIONS are simply lists of active position keys drawn from POSITION_MAP.
 * To move a position visually, change one entry in POSITION_MAP — zero changes
 * required in formation definitions or components.
 */

export const PITCH_GRID = { rows: 6, cols: 5 } as const;

export const POSITION_MAP: Record<string, { row: number; col: number }> = {
  // Row 0 — Attack
  LW:  { row: 0, col: 0 },
  LST: { row: 0, col: 1 },
  ST:  { row: 0, col: 2 },
  RST: { row: 0, col: 3 },
  RW:  { row: 0, col: 4 },

  // Row 1 — Attacking Mid
  LAM:  { row: 1, col: 0 },
  CLAM: { row: 1, col: 1 },
  CAM:  { row: 1, col: 2 },
  CRAM: { row: 1, col: 3 },
  RAM:  { row: 1, col: 4 },

  // Row 2 — Midfield
  LM:  { row: 2, col: 0 },
  CLM: { row: 2, col: 1 },
  CM:  { row: 2, col: 2 },
  CRM: { row: 2, col: 3 },
  RM:  { row: 2, col: 4 },

  // Row 3 — Defensive Mid
  LDM:  { row: 3, col: 0 },
  CDLM: { row: 3, col: 1 },
  CDM:  { row: 3, col: 2 },
  CDRM: { row: 3, col: 3 },
  RDM:  { row: 3, col: 4 },

  // Row 4 — Defense
  LB:  { row: 4, col: 0 },
  CLB: { row: 4, col: 1 },
  CB:  { row: 4, col: 2 },
  CRB: { row: 4, col: 3 },
  RB:  { row: 4, col: 4 },

  // Row 5 — Goalkeeper
  GK: { row: 5, col: 2 },
} as const;

export const FORMATIONS: Record<string, string[]> = {
  '4-3-3':   ['LW', 'ST', 'RW',           'CLM', 'CM', 'CRM',          'LB', 'CLB', 'CRB', 'RB', 'GK'],
  '4-4-2':   ['LST', 'RST',               'LM', 'CLM', 'CRM', 'RM',     'LB', 'CLB', 'CRB', 'RB', 'GK'],
  '3-5-2':   ['LST', 'RST',               'LM', 'CLM', 'CM', 'CRM', 'RM', 'CLB', 'CB', 'CRB',      'GK'],
  '4-2-3-1': ['ST',  'LAM', 'CAM', 'RAM', 'CLM', 'CRM',                 'LB', 'CLB', 'CRB', 'RB', 'GK'],
  '5-3-2':   ['LST', 'RST',               'CLM', 'CM', 'CRM',            'LB', 'CLB', 'CB', 'CRB', 'RB', 'GK'],
} as const;
