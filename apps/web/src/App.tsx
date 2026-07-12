import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homeForRole } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import AvailableExamsPage from './pages/student/AvailableExamsPage';
import HardwareCheckPage from './pages/student/HardwareCheckPage';
import ExamRunnerPage from './pages/student/ExamRunnerPage';
import GradingPage from './pages/student/GradingPage';
import ReportPage from './pages/student/ReportPage';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeForRole(user.role)} replace /> : <LoginPage />} />
      <Route
        path="/student/exams"
        element={
          <RequireAuth roles={['student']}>
            <AvailableExamsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/exam/:attemptId/hardware"
        element={
          <RequireAuth roles={['student']}>
            <HardwareCheckPage />
          </RequireAuth>
        }
      />
      <Route
        path="/exam/:attemptId"
        element={
          <RequireAuth roles={['student']}>
            <ExamRunnerPage />
          </RequireAuth>
        }
      />
      <Route
        path="/exam/:attemptId/grading"
        element={
          <RequireAuth roles={['student']}>
            <GradingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports/:attemptId"
        element={
          <RequireAuth>
            <ReportPage />
          </RequireAuth>
        }
      />
      <Route
        path="/teacher"
        element={
          <RequireAuth roles={['teacher', 'org_admin']}>
            <TeacherDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth roles={['platform_admin', 'org_admin']}>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route path="/" element={<Navigate to={user ? homeForRole(user.role) : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
