import Router from 'preact-router'
import { Landing, ProjectCreate, ProjectList, Board, Webhooks, Auth } from './pages'
import { ThemeProvider } from './components'

export function App() {
  return (
    <ThemeProvider>
      <Router>
        <Landing path="/" />
        <ProjectList path="/projects" />
        <ProjectCreate path="/new" />
        <Board path="/board/:projectId" />
        <Webhooks path="/webhooks" />
        <Auth path="/auth" />
      </Router>
    </ThemeProvider>
  )
}
