import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatients, getAllPatients, exportCSV } from '../services/patientService';
import type { Patient } from '../types';

const PAGE_SIZE = 15;

function DashboardPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const userRole = localStorage.getItem('userRole') || '';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    let cancelled = false;

    const fetchPatients = async () => {
      try {
        const data = isAdmin ? await getAllPatients() : await getPatients();
        if (!cancelled) {
          setPatients(data);
        }
      } catch {
        if (!cancelled) {
          setError('获取患者列表失败，请稍后重试');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPatients();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase().trim();
    return patients.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q)) ||
        String(p.id).includes(q)
    );
  }, [patients, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleRowClick = (id: number) => {
    navigate(`/patients/${id}`);
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
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
      <div className="page-title-row">
        <h2 className="page-title" style={{ margin: 0 }}>
          {isAdmin ? '所有患者' : '我的患者'}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>
            共 {filtered.length} 名患者
          </span>
          <button
            className="btn btn-back"
            onClick={() => exportCSV('patients')}
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            导出 CSV
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="搜索患者（姓名、邮箱、手机号、ID）..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>
            &times;
          </button>
        )}
      </div>

      {loading && <div className="loading">加载中...</div>}

      {error && <div className="error-message">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty">
          {search ? `未找到匹配"${search}"的患者` : '暂无患者数据'}
        </div>
      )}

      {!loading && !error && paged.length > 0 && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>姓名</th>
                <th>邮箱</th>
                <th>手机</th>
                <th>注册时间</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((patient) => (
                <tr key={patient.id} onClick={() => handleRowClick(patient.id)}>
                  <td data-label="ID">{patient.id}</td>
                  <td data-label="姓名">{patient.username}</td>
                  <td data-label="邮箱">{patient.email || '-'}</td>
                  <td data-label="手机">{patient.phone || '-'}</td>
                  <td data-label="注册时间">{formatTime(patient.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                上一页
              </button>
              <span className="pagination-info">
                {currentPage} / {totalPages}
              </span>
              <button
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DashboardPage;
