// Shared chart defaults — import and spread into Recharts components

export const chartColors = {
  primary:   '#16603A',
  secondary: '#5B9E7A',
  accent:    '#93C4A8',
  muted:     '#E4E4E7',
  grid:      '#F4F4F5',
  tick:      '#A1A1AA',
  tooltip: {
    bg:     '#FFFFFF',
    border: '#E4E4E7',
    text:   '#0C0C0D',
  },
}

export const barDefaults = {
  radius:     [3, 3, 0, 0] as [number, number, number, number],
  maxBarSize: 48,
}

export const xAxisDefaults = {
  axisLine: false,
  tickLine: false,
  tick:     { fontSize: 12, fill: chartColors.tick, fontFamily: 'var(--font-sans)' },
  dy:       8,
}

export const yAxisDefaults = {
  axisLine: false,
  tickLine: false,
  tick:     { fontSize: 11, fill: chartColors.tick, fontFamily: 'var(--font-sans)' },
  dx:       -4,
  width:    48,
}

export const gridDefaults = {
  vertical:    false,
  stroke:      chartColors.grid,
  strokeWidth: 1,
}

export const tooltipDefaults = {
  contentStyle: {
    background:   chartColors.tooltip.bg,
    border:       `1px solid ${chartColors.tooltip.border}`,
    borderRadius: '6px',
    boxShadow:    '0 4px 12px rgba(0,0,0,0.08)',
    fontSize:     12,
    fontFamily:   'var(--font-sans)',
    color:        chartColors.tooltip.text,
    padding:      '8px 12px',
  },
  cursor: { fill: 'var(--surface-sunken)' },
}

export const legendDefaults = {
  iconType:     'circle' as const,
  iconSize:      8,
  wrapperStyle: {
    fontSize:   12,
    color:      chartColors.tick,
    fontFamily: 'var(--font-sans)',
    paddingTop: 8,
  },
}
