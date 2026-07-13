import { Navigate, useParams } from 'react-router-dom';

/** Legacy route: redirect to exam runner which shows hardware check as the first step. */
export default function HardwareCheckPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  if (!attemptId) return <Navigate to="/student/exams" replace />;
  return <Navigate to={`/exam/${attemptId}`} replace />;
}
