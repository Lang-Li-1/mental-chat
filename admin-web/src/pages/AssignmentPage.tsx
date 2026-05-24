import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAllPatients,
  getAllProfessionals,
  getAssignments,
  createAssignment,
  deleteAssignment,
} from '../services/patientService';
import type { Patient, Assignment } from '../types';
import { toChineseErrorMessage } from '../utils/errorMessage';

function AssignmentPage() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') || '';

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedProfessional, setSelectedProfessional] = useState('');

  useEffect(() => {
    if (userRole !== 'admin') {
      navigate('/', { replace: true });
      return;
    }

    const fetchData = async () => {
      try {
        const [assignData, patientData, proData] = await Promise.all([
          getAssignments(),
          getAllPatients(),
          getAllProfessionals(),
        ]);
        setAssignments(assignData);
        setPatients(patientData);
        setProfessionals(proData);
      } catch {
        setError('获取数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userRole, navigate]);

  const handleCreate = async () => {
    if (!selectedPatient || !selectedProfessional) {
      setSubmitError('请选择患者和医生');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const newAssignment = await createAssignment(
        Number(selectedPatient),
        Number(selectedProfessional),
      );
      setAssignments((prev) => [...prev, newAssignment]);
      setSelectedPatient('');
      setSelectedProfessional('');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setSubmitError(toChineseErrorMessage(axiosErr.response?.data?.detail, '创建分配失败'));
      } else {
        setSubmitError('创建分配失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError('删除失败，请稍后重试');
    }
  };

  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="page-content">
        {/* Create Assignment Form */}
        <div className="assignment-form-card">
          <h2 className="section-title" style={{ marginBottom: 16 }}>
            新建分配
          </h2>
          <div className="assignment-form-row">
            <div className="assignment-form-field">
              <label>选择医生</label>
              <select
                value={selectedProfessional}
                onChange={(e) => setSelectedProfessional(e.target.value)}
              >
                <option value="">-- 请选择医生 --</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.username} ({p.email || p.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="assignment-form-field">
              <label>选择患者</label>
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
              >
                <option value="">-- 请选择患者 --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.username} ({p.email || p.id})
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: 'auto', padding: '10px 24px', alignSelf: 'flex-end' }}
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? '创建中...' : '创建分配'}
            </button>
          </div>
          {submitError && <div className="error-message" style={{ marginTop: 12 }}>{submitError}</div>}
        </div>

        {/* Assignments Table */}
        <h2 className="section-title" style={{ marginTop: 32, marginBottom: 16 }}>
          当前分配关系
        </h2>

        {loading && <div className="loading">加载中...</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && !error && assignments.length === 0 && (
          <div className="empty">暂无分配数据</div>
        )}

        {!loading && !error && assignments.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>医生</th>
                <th>患者</th>
                <th>分配时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} style={{ cursor: 'default' }}>
                  <td>{a.id}</td>
                  <td>{a.professional.username}</td>
                  <td>{a.patient.username}</td>
                  <td>{formatTime(a.created_at)}</td>
                  <td>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={() => handleDelete(a.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

export default AssignmentPage;
