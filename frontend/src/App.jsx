import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Draws from './pages/Draws.jsx'
import Analysis from './pages/Analysis.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/draws" replace />} />
        <Route path="/draws" element={<Draws />} />
        <Route path="/analysis" element={<Analysis />} />
      </Route>
    </Routes>
  )
}
