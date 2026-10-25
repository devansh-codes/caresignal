/**
 * Single ECharts wrapper: applies the token-based theme and re-renders on light/dark switch.
 * All charts go through this so they share axis, font and tooltip styling.
 */
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  DatasetComponent, GridComponent, LegendComponent, MarkAreaComponent,
  MarkLineComponent, TitleComponent, TooltipComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { useEffect, useRef, useState } from 'react'
import { useThemeVersion } from './theme'

// Register only what the site uses (tree-shaken bundle). Add here when a new series type is needed.
echarts.use([
  BarChart, LineChart, ScatterChart, CustomChart, DatasetComponent, GridComponent,
  LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent, SVGRenderer,
])

/** True once the element has come within 200px of the viewport (charts are expensive; render them on demand). */
function useInView<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (seen || !ref.current) return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: '200px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen] as const
}

export function Chart({ option, height = 280, ariaLabel }: { option: EChartsOption; height?: number; ariaLabel: string }) {
  const v = useThemeVersion()
  const [ref, seen] = useInView<HTMLDivElement>()
  // The wrapper carries the accessible name; ECharts' own aria labels would be prohibited on a plain div.
  return (
    <div ref={ref} role="img" aria-label={ariaLabel} style={{ minHeight: height }}>
      {seen && (
        <ReactEChartsCore echarts={echarts} key={v} option={option} style={{ height, width: '100%' }} notMerge lazyUpdate opts={{ renderer: 'svg' }} />
      )}
    </div>
  )
}
