import { Link } from 'react-router-dom'
import { SearchBar } from '../components/search/SearchBar'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">404</div>
      <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">This page doesn’t exist</h1>
      <p className="mt-3 text-sm text-muted">
        The link may be out of date. Search for a hospital below, or return to the overview.
      </p>
      <div className="mt-6 text-left">
        <SearchBar size="md" label="Search for a hospital" />
      </div>
      <div className="mt-6 flex justify-center gap-4 text-sm font-medium">
        <Link to="/" className="text-primary hover:underline">Overview</Link>
        <Link to="/hospitals" className="text-primary hover:underline">Hospital directory</Link>
      </div>
    </div>
  )
}
