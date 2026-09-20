import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { clearSession, currentUser } from './api/client'
import Login from './pages/Login'
import Cases from './pages/Cases'
import CaseWorkspace from './pages/CaseWorkspace'

function Shell({ children }: { children: React.ReactNode }) {
  const user = currentUser()
  const nav = useNavigate()
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to main content</a>
      <header className="topbar">
        <div className="brand"><span className="logo">◎</span> DRISHTI-NET <span className="tag">prototype · synthetic data</span></div>
        <div className="who">
          <span className="role">{user.role}</span> {user.display_name} · {user.jurisdiction}
          <button className="link" onClick={() => { clearSession(); nav('/login') }}>sign out</button>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="fade-in">{children}</main>
      <footer className="foot">The system proposes; the investigator decides. Findings are candidate relationships for authorized human review — not determinations of guilt.</footer>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Shell><Cases /></Shell>} />
      <Route path="/cases/:caseId/*" element={<Shell><CaseWorkspace /></Shell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
