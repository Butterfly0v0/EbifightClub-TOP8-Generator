import type { ReactNode } from 'react'

type Props = {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export default function LayoutEditorSection({ title, defaultOpen = true, children }: Props) {
  return (
    <details className="le-section" open={defaultOpen}>
      <summary className="le-section-title">{title}</summary>
      <div className="le-section-body">{children}</div>
    </details>
  )
}
