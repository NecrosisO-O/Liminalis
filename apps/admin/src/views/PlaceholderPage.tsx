type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="panel page-panel">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
    </section>
  )
}
