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
    textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: ink },
    grid: { left: 48, right: 16, top: 24, bottom: 40, containLabel: true },
    tooltip: { backgroundColor: token('surface'), borderColor: border, textStyle: { color: ink, fontSize: 12 } },
    xAxis: { axisLine: { lineStyle: { color: border } }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: border } } },
    yAxis: { axisLine: { lineStyle: { color: border } }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: border } } },
  } as EChartsOption
}
