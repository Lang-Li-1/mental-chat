import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientDetailPage from './pages/PatientDetailPage';
import CrisisAlertPage from './pages/CrisisAlertPage';
import AlertHistoryPage from './pages/AlertHistoryPage';
import StatsPage from './pages/StatsPage';
import UserManagementPage from './pages/UserManagementPage';
import AssignmentPage from './pages/AssignmentPage';
import InterventionLibraryPage from './pages/InterventionLibraryPage';
import ArticleManagementPage from './pages/ArticleManagementPage';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter basename="/admin-web">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/patients/:id" element={<PatientDetailPage />} />
          <Route path="/alerts" element={<CrisisAlertPage />} />
          <Route path="/alert-history" element={<AlertHistoryPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/users" element={<UserManagementPage />} />
          <Route path="/assignments" element={<AssignmentPage />} />
          <Route path="/interventions" element={<InterventionLibraryPage />} />
          <Route path="/articles" element={<ArticleManagementPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
