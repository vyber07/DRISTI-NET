import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { post, setSession } from '../api/client'

const DEMO = ['investigator', 'officer', 'reviewer', 'analyst', 'auditor', 'admin', 'unassigned', 'outsider']

export default function Login() {
  const [username, setU] = useState('investigator')
  const [password, setP] = useState('investigator-demo')
  const [err, setErr] = useState<string | null>(null)
  const nav = useNavigate()
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    try { const r = await post('/auth/login', { username, password }); setSession(r.token, r.user); nav('/') }
    catch (ex: any) { setErr(ex.message) }
  }
  return (
    <div className="login card">
      <h2>◎ DRISHTI-NET</h2>
      <p className="muted small">Evidence-linked relationship discovery for authorized human review. This prototype runs on synthetic data only.</p>
      <form onSubmit={submit}>
        <label className="visually-hidden" htmlFor="login-username">username</label>
        <input id="login-username" value={username} onChange={e => { setU(e.target.value); setP(`${e.target.value}-demo`) }} placeholder="username" autoFocus />
        <label className="visually-hidden" htmlFor="login-password">password</label>
        <input id="login-password" value={password} onChange={e => setP(e.target.value)} placeholder="password" type="password" />
        {err && <div className="error">{err}</div>}
        <button className="primary" type="submit">Sign in</button>
      </form>
      <p className="demo-users">Demo users (password = <i>name</i>-demo): {DEMO.map(u => <button key={u} type="button" className="demo-user-btn" onClick={() => { setU(u); setP(`${u}-demo`) }}>{u}</button>).reduce<React.ReactNode[]>((a, b) => a.length ? [...a, ' ', b] : [b], [])}</p>
      <p className="demo-users"><b>unassigned</b> is not on CASE-0001 and <b>outsider</b> is in another jurisdiction — use them to show server-side denial.</p>
    </div>
  )
}
