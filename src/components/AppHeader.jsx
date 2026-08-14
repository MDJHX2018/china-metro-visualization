import { NavLink } from "react-router-dom";

const metroMark = (
  <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="var(--primary)" />
    <path
      d="M9 20 L12.5 9 L16 15 L19.5 9 L23 20"
      stroke="#fff"
      strokeWidth="2.4"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function AppHeader() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <NavLink to="/" className="brand">
          {metroMark}
          <span className="brand-text">
            <span className="brand-title">全国城市地铁可视化系统</span>
            <span className="brand-sub">Metro Explorer · 中国城市轨道交通</span>
          </span>
        </NavLink>
        <nav className="header-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            全国概览
          </NavLink>
          <span className="nav-hint">点击地图城市可下钻城市详情</span>
        </nav>
      </div>
    </header>
  );
}
