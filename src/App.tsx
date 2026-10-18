import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/auth/LoginPage'

// עמודים זמניים - יוחלפו במסכים האמיתיים בשלבים הבאים.
function Placeholder({ title }: { title: string }) {
  return <h1 className="page-title">{title}</h1>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/requests" element={<Placeholder title="בקשות שמרטפות" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/requests" replace />} />
    </Routes>
  )
}
