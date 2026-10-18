import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/auth/LoginPage'
import RequestDetailsPage from './pages/details/RequestDetailsPage'
import RequestFormPage from './pages/form/RequestFormPage'
import ProfilePage from './pages/profile/ProfilePage'
import RequestsListPage from './pages/requests/RequestsListPage'

// 4 המסכים: התחברות, רשימה, פרטים, טופס (יצירה/עריכה - להורה בלבד). ובנוסף - הפרופיל שלי.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/requests" element={<RequestsListPage />} />
          <Route path="/requests/:id" element={<RequestDetailsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<ProtectedRoute roles={['Parent']} />}>
            <Route path="/requests/new" element={<RequestFormPage key="new" />} />
            <Route path="/requests/:id/edit" element={<RequestFormPage key="edit" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/requests" replace />} />
    </Routes>
  )
}
