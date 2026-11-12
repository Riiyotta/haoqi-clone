// Next.js built-in not-found UI rendered inside the subpage layout (no title block, Metadata or TOC).
// Markup (incl. the injected <style> that forces body #fff / #000) from _reference/pages/404.html.
import { useEffect } from 'react'
import { ArticleShell, getPageContent, renderNode } from './ArticlePage.jsx'

export default function NotFoundPage() {
  const page = getPageContent('404')
  useEffect(() => { document.title = page.title }, [page.title])
  return <ArticleShell>{page.nodes.map((n, i) => renderNode(n, i, {}))}</ArticleShell>
}
