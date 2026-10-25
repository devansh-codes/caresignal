import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import { StateView } from './components/ui'

// Hash routes: GitHub Pages has no SPA fallback.
const Home = lazy(() => import('./pages/Home'))
const Explore = lazy(() => import('./pages/Explore'))
const Hospital = lazy(() => import('./pages/Hospital'))
const Insights = lazy(() => import('./pages/Insights'))
const Methods = lazy(() => import('./pages/Methods'))
const DataQuality = lazy(() => import('./pages/DataQuality'))
const Downloads = lazy(() => import('./pages/Downloads'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell>
        <Suspense fallback={<StateView kind="loading" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/hospitals" element={<Explore />} />
            <Route path="/hospital/:ccn" element={<Hospital />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/methods" element={<Methods />} />
            <Route path="/data-quality" element={<DataQuality />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell>
    </HashRouter>
  )
}
