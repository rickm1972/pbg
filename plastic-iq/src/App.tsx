import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ScrollToTop } from './components/ScrollToTop'
import { HomePage } from './pages/HomePage'
import { CategoriesPage } from './pages/CategoriesPage'
import { CategoryPage } from './pages/CategoryPage'
import { ProductPage } from './pages/ProductPage'
import { AboutPage } from './pages/AboutPage'
import { WhyPlasticBegonePage } from './pages/WhyPlasticBegonePage'
import { AdminPage } from './pages/AdminPage'
import { ChannelMapExportPage } from './pages/ChannelMapExportPage'
import { PersonaExportPage } from './pages/PersonaExportPage'

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
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
