import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ScrollToTop } from './components/ScrollToTop'
import { HomePage } from './pages/HomePage'
import { CategoriesPage } from './pages/CategoriesPage'
import { CategoryPage } from './pages/CategoryPage'
import { ProductPage } from './pages/ProductPage'
import { AboutPage } from './pages/AboutPage'
import { WhyPlasticBegonePage } from './pages/WhyPlasticBegonePage'
import { ChannelMapExportPage } from './pages/ChannelMapExportPage'
import { PersonaExportPage } from './pages/PersonaExportPage'

const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route
          path="/admin/persona/:personaId/export"
          element={<PersonaExportPage />}
        />
        <Route
          path="/admin/channel-map/:channelMapId/export"
          element={<ChannelMapExportPage />}
        />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/category/:categoryName" element={<CategoryPage />} />
          <Route path="/product/:productId" element={<ProductPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/whyplasticbegone" element={<WhyPlasticBegonePage />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading admin…</div>}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
