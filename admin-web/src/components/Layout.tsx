import { useState, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

function Layout() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') || '';
  const userName = localStorage.getItem('userName') || '';
  const isAdmin = userRole === 'admin';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    navigate('/login', { replace: true });
  };

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleNavClick = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="app-layout">
      {/* Mobile hamburger */}
      <button
        className="sidebar-hamburger"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Overlay for mobile */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={closeSidebar}
      />

      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo">+</span>
          <span className="sidebar-title">心理健康管理</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={handleNavClick}
          >
            <span className="sidebar-icon">&#9776;</span>
            患者列表
          </NavLink>
          <NavLink
            to="/alerts"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={handleNavClick}
          >
            <span className="sidebar-icon">&#9888;</span>
            危机监控
          </NavLink>
          <NavLink
            to="/alert-history"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={handleNavClick}
          >
            <span className="sidebar-icon">&#128203;</span>
            告警历史
          </NavLink>
          <NavLink
            to="/stats"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={handleNavClick}
          >
            <span className="sidebar-icon">&#128202;</span>
            数据概览
          </NavLink>
          <NavLink
            to="/interventions"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={handleNavClick}
          >
            <span className="sidebar-icon">&#128214;</span>
            干预建议
          </NavLink>
          <NavLink
            to="/articles"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={handleNavClick}
          >
            <span className="sidebar-icon">&#128240;</span>
            内容管理
          </NavLink>
          {isAdmin && (
            <>
              <NavLink
                to="/users"
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                onClick={handleNavClick}
              >
                <span className="sidebar-icon">&#128101;</span>
                用户管理
              </NavLink>
              <NavLink
                to="/assignments"
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                onClick={handleNavClick}
              >
                <span className="sidebar-icon">&#8644;</span>
                分配管理
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{userName.charAt(0).toUpperCase()}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-username">{userName}</span>
              <span className="sidebar-role">{isAdmin ? '管理员' : '医生'}</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            退出
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
