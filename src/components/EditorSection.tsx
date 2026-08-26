import type { ReactNode } from 'react'

type Props = {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export default function EditorSection({ title, defaultOpen = true, children }: Props) {
  return (
    <details className="ed-section" open={defaultOpen}>
      <summary className="ed-section-title">{title}</summary>
      <div className="ed-section-body">{children}</div>
    </details>
  )
}
