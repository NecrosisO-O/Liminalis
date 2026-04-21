type SurfaceCardProps = {
  eyebrow: string
  title: string
  description: string
}

export function SurfaceCard({ eyebrow, title, description }: SurfaceCardProps) {
  return (
    <section className="surface-card">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
    </section>
  )
}
