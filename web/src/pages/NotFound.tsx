import { SearchBar } from '../components/search/SearchBar'
import { ArrowLink, EyebrowLabel } from '../components/ui'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl bg-surface p-8 text-center shadow-card sm:p-12">
      <EyebrowLabel>Page not found</EyebrowLabel>
      <h1 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">We could not find that page</h1>
      <p className="mt-4 text-body">The link may be out of date. Search for a hospital below, or go back to the home page.</p>
      <div className="mt-8 text-left">
        <SearchBar size="lg" label="Search for a hospital" />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-8">
        <ArrowLink href="#/">Home page</ArrowLink>
        <ArrowLink href="#/hospitals">All hospitals</ArrowLink>
      </div>
    </div>
  )
}
