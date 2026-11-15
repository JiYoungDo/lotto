import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Draws from './pages/Draws.jsx'
import Analysis from './pages/Analysis.jsx'
import Admin from './pages/Admin.jsx'
import Login from './pages/Login.jsx'
import SignUp from './pages/SignUp.jsx'
import Community from './pages/Community.jsx'
import Account from './pages/Account.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/draws" replace />} />
        <Route path="/draws" element={<Draws />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/community" element={<Community />} />
        <Route path="/account" element={<Account />} />
      </Route>
    </Routes>
  )
}
