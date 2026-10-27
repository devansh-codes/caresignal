/** Theme helpers shared by every chart: re-render on light/dark switch, token-based base option. */
import type { EChartsOption } from 'echarts'
import { useEffect, useState } from 'react'
import { token } from '../../lib/format'

export function useThemeVersion() {
  const [v, setV] = useState(0)
  useEffect(() => {
    const bump = () => setV((x) => x + 1)
    const mo = new MutationObserver(bump)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', bump)
    return () => { mo.disconnect(); mq.removeEventListener('change', bump) }
  }, [])
  return v
}

export function baseOption(): EChartsOption {
  const ink = token('ink'), muted = token('muted'), border = token('border')
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: '"Hanken Grotesk", system-ui, sans-serif', color: muted, fontSize: 12 },
    grid: { left: 48, right: 16, top: 24, bottom: 40, containLabel: true },
    tooltip: { backgroundColor: token('surface'), borderColor: token('rule'), borderRadius: 2, textStyle: { color: ink, fontSize: 12 } },
    xAxis: { axisLine: { lineStyle: { color: border } }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: border } } },
    yAxis: { axisLine: { lineStyle: { color: border } }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: border } } },
  } as EChartsOption
}

/** Sequential scale from the reference site: lighter = better, darker = worse. */
export const TEAL_SCALE = ['#E1EEF2', '#CFE3EA', '#B7D3DE', '#9FC2D1', '#87B1C3', '#6FA0B5', '#5890A8', '#3F7F9B', '#2A6F8F', '#006A8E']
/** Brand colors for chart marks (read live so dark mode follows). */
export const brand = () => ({ navy: token('navy'), royal: token('royal'), yellow: token('yellow'), rule: token('rule') })
