// Subpage template (RSC page + MDX components of the original). Content comes from src/pages/content/<slug>.json,
// generated from the settled live HTML (_reference/pages/<slug>.html) so the article text — and therefore the
// Metadata "Characters" count — is byte-identical.
import { createElement, useEffect } from 'react'
import { MdxHeading, MdxA, MdxPre } from '../components/mdx/MdxBasics.jsx'
import MdxImg from '../components/mdx/MdxImg.jsx'
import { MdxTableOfContents, ArticleFooter } from '../components/mdx/ArticleChrome.jsx'

const pages = import.meta.glob('./content/*.json', { eager: true, import: 'default' })
export const getPageContent = (slug) => pages[`./content/${slug}.json`]

export const PROSE_CLS = "space-y-4 [&_p]:text-sm [&_p]:text-l1 [&_p]:leading-relaxed lg:[&_p]:text-base [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-0 [&_ul]:space-y-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-0 [&_ol]:space-y-0 [&_li]:text-l1 [&_li]:leading-relaxed [&_li::marker]:text-[var(--selection-bg)] [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--selection-bg)] [&_blockquote]:pl-4 [&_blockquote]:text-l2 [&_blockquote_p]:text-l2 [&_blockquote_li]:text-l2 [&_blockquote_strong]:text-l2 [&_blockquote_em]:text-l2 [&_blockquote_a]:!text-l2 [&_blockquote_a]:underline [&_blockquote_a]:underline-offset-4 [&_blockquote_a]:decoration-[color:var(--label-3)] [&_blockquote_a]:transition-colors [&_blockquote_a]:lg:hover:!text-l1 [&_blockquote_a]:lg:hover:decoration-[color:var(--label-2)] [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-[rgba(var(--label-d),0.08)] [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:text-l1 [&_hr]:my-8 [&_hr]:h-px [&_hr]:w-full [&_hr]:border-0 [&_hr]:bg-line [&_u]:no-underline [&_u]:pb-[6px] [&_u]:[box-decoration-break:clone] [&_u]:[-webkit-box-decoration-break:clone] [&_u]:[background-image:radial-gradient(circle_at_center,var(--color-l2)_0.65px,transparent_0.7px)] [&_u]:[background-size:5px_3px] [&_u]:[background-repeat:repeat-x] [&_u]:[background-position:left_bottom]"

const textOf = (n) => (typeof n === 'string' ? n : Array.isArray(n) ? (n[0] === '$h' ? n.slice(3) : n[0] === '$a' ? n.slice(2) : n.slice(2)).map(textOf).join('') : '')

// Node forms: see scratchpad pages2json.mjs
export function renderNode(n, key, ctx) {
  if (typeof n === 'string') return n
  const [tag] = n
  switch (tag) {
    case '$h': {
      const [, level, id, ...kids] = n
      return <MdxHeading key={key} level={level} id={id} text={kids.map(textOf).join('')}>{renderKids(kids, ctx)}</MdxHeading>
    }
    case '$a': {
      const [, href, ...kids] = n
      return <MdxA key={key} href={href}>{renderKids(kids, ctx)}</MdxA>
    }
    case '$img': return <MdxImg key={key} {...n[1]} />
    case '$pre': return <MdxPre key={key} {...n[1]} />
    case '$footer': return <ArticleFooter key={key} updated={ctx.updated} />
    default: {
      const [, attrs, ...kids] = n
      return createElement(tag, { ...attrs, key }, ...(kids.length ? [renderKids(kids, ctx)] : []))
    }
  }
}
const renderKids = (kids, ctx) => (kids.length === 1 && typeof kids[0] === 'string' ? kids[0] : kids.map((c, i) => renderNode(c, i, ctx)))

export function ArticleShell({ children }) {
  return (
    <article data-mdx-article="true" className="mx-auto px-6 py-18 lg:py-24 w-full max-w-[880px] text-l1">
      <div className={PROSE_CLS}>{children}</div>
    </article>
  )
}

export default function ArticlePage({ slug }) {
  const page = getPageContent(slug)
  useEffect(() => { document.title = page.title }, [page.title])
  const ctx = { updated: page.updated }
  return (
    <>
      <MdxTableOfContents />
      <ArticleShell>{page.nodes.map((n, i) => renderNode(n, i, ctx))}</ArticleShell>
    </>
  )
}
