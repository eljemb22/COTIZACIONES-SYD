type Pillar = {
  code: string;
  title: string;
  description: string;
  icon: JSX.Element;
};

const PILLARS: Pillar[] = [
  {
    code: 'COT',
    title: 'Cotizaciones biomédicas',
    description:
      'Estructuración y seguimiento de cotizaciones para equipos e insumos biomédicos, de la solicitud inicial a la propuesta final.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M9 6h17l6 6v22a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M26 6v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 19h11M12 24h11M12 29h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    code: 'LIC',
    title: 'Licitaciones públicas',
    description:
      'Monitoreo de procesos SECOP II, cronogramas y requisitos habilitantes para cada oportunidad en curso.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M20 5 6 12v3h28v-3L20 5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M10 18v11M17 18v11M23 18v11M30 18v11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M6 33h28" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    code: 'CON',
    title: 'Gestión de contratos',
    description:
      'Trazabilidad de contratos adjudicados: entregas, garantías y obligaciones vigentes en un solo lugar.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.6" />
        <path d="m14 20 4.2 4.2L27 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function App() {
  return (
    <div className="page">
      <div className="page__glow" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">SYD</span>
          <span className="brand__word">Colombia</span>
        </div>
        <span className="topbar__tag">panel en preparación</span>
      </header>

      <main className="hero">
        <p className="hero__eyebrow">Cotizaciones &amp; licitaciones</p>
        <h1 className="hero__title">
          El control de tus procesos
          <br />
          biomédicos, en un solo lugar.
        </h1>
        <p className="hero__lead">
          Este panel está siendo construido. Aquí vivirán las cotizaciones, los procesos de
          licitación pública y la gestión de contratos de SYD Colombia.
        </p>
      </main>

      <section className="pillars" aria-label="Módulos del sistema">
        {PILLARS.map((pillar, index) => (
          <article
            className="pillar-card"
            key={pillar.code}
            style={{ animationDelay: `${120 + index * 90}ms` }}
          >
            <div className="pillar-card__top">
              <span className="pillar-card__icon">{pillar.icon}</span>
              <span className="pillar-card__code">{pillar.code}</span>
            </div>
            <h2 className="pillar-card__title">{pillar.title}</h2>
            <p className="pillar-card__description">{pillar.description}</p>
          </article>
        ))}
      </section>

      <footer className="footer">
        <span>SYD Colombia</span>
        <span className="footer__dot" aria-hidden="true" />
        <span>Sistema de cotizaciones, licitaciones y contratos</span>
      </footer>
    </div>
  );
}

export default App;
