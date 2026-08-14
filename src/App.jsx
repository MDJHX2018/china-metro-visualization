import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppHeader from "./components/AppHeader";
import DashboardPanel from "./components/DashboardPanel";

// Page-level code splitting: ECharts + city data load only when needed.
const NationalOverview = lazy(() => import("./pages/NationalOverview"));
const CityDetail = lazy(() => import("./pages/CityDetail"));

export default function App() {
  return (
    <div className="app">
      <AppHeader />
      <div className="app-body">
        <main className="app-main">
          <Suspense fallback={<div className="page-loading">正在加载页面…</div>}>
            <Routes>
              <Route path="/" element={<NationalOverview />} />
              <Route path="/city/:pinyin" element={<CityDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <aside className="app-side">
          <DashboardPanel />
        </aside>
      </div>
    </div>
  );
}
