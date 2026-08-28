import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from '@/screens/Shell'
import { Startup } from '@/screens/Startup'
import { Home } from '@/screens/Home'
import { Sandbox } from '@/screens/Sandbox'
import { CaseLibrary, Insights, Predict, Scan, SearchPrecedent } from '@/screens'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Startup />} />
        <Route path="/sandbox" element={<Sandbox />} />
        <Route path="/app" element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="predict" element={<Predict />} />
          <Route path="scan" element={<Scan />} />
          <Route path="search" element={<SearchPrecedent />} />
          <Route path="library" element={<CaseLibrary />} />
          <Route path="insights" element={<Insights />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
