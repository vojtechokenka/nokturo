import { NavLink } from 'react-router-dom';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { PageShell } from '../../components/PageShell';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 min-w-0">
      <h2 className="text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-6 pb-2 border-b border-nokturo-200 dark:border-nokturo-700">
        {title}
      </h2>
      <div className="min-w-0 break-words">
        {children}
      </div>
    </section>
  );
}

function CodeBlock({ classes }: { classes: string }) {
  return (
    <pre className="mt-2 text-xs font-mono text-nokturo-600 dark:text-nokturo-400 bg-nokturo-100 dark:bg-nokturo-800 rounded-lg px-3 py-2 overflow-x-auto">
      {classes}
    </pre>
  );
}

export default function StyleGuideV2Page() {
  return (
    <PageShell>
      <div className="flex gap-8 max-w-6xl mx-auto min-w-0 w-full">
        <aside className="hidden lg:block w-52 shrink-0">
          <nav className="sticky top-24 space-y-0.5">
            <a href="#richtext-nokturo" className="flex items-center gap-2 px-3 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-100 dark:hover:bg-nokturo-800 rounded-lg transition-colors">
              <MaterialIcon name="title" size={16} className="shrink-0" />
              Rich Text Nokturo
            </a>
            <a href="#richtext-standard" className="flex items-center gap-2 px-3 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-100 dark:hover:bg-nokturo-800 rounded-lg transition-colors">
              <MaterialIcon name="edit_note" size={16} className="shrink-0" />
              Rich Text Standard
            </a>
            <a href="#mimo-richtext" className="flex items-center gap-2 px-3 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-100 dark:hover:bg-nokturo-800 rounded-lg transition-colors">
              <MaterialIcon name="text_fields" size={16} className="shrink-0" />
              Mimo Rich Text
            </a>
            <a href="#labels" className="flex items-center gap-2 px-3 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-100 dark:hover:bg-nokturo-800 rounded-lg transition-colors">
              <MaterialIcon name="label" size={16} className="shrink-0" />
              Labels
            </a>
          </nav>
        </aside>

        <div className="flex-1 min-w-0 space-y-16 pb-16">
          <div className="mb-8">
            <NavLink
              to="/settings/account"
              className="inline-flex items-center gap-1 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
            >
              <MaterialIcon name="chevron_right" size={16} className="rotate-180 shrink-0" />
              Back to Settings
            </NavLink>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-heading-2 font-extralight text-nokturo-900 dark:text-nokturo-100">
                Style Guide v2
              </h1>
              <NavLink
                to="/settings/style-guide"
                className="text-sm text-nokturo-500 hover:text-nokturo-700 dark:hover:text-nokturo-300"
              >
                (v1)
              </NavLink>
            </div>
            <p className="text-nokturo-600 dark:text-nokturo-400 mt-1">
              Typografická škála – Rich Text Nokturo, Rich Text Standard, Label, Mono, Button.
            </p>
          </div>

          {/* Rich Text Nokturo */}
          <Section id="richtext-nokturo" title="Rich Text Nokturo (IvyPresto Headline)">
            <div className="space-y-6">
              <div>
                <p className="font-headline text-rta-h1 text-nokturo-900 dark:text-nokturo-100">H1 — IvyPresto Headline</p>
                <p className="text-xs text-nokturo-500 mt-1">64px</p>
                <CodeBlock classes="font-headline text-rta-h1" />
              </div>
              <div>
                <p className="font-headline text-rta-h2 text-nokturo-900 dark:text-nokturo-100">H2 — IvyPresto Headline</p>
                <p className="text-xs text-nokturo-500 mt-1">48px</p>
                <CodeBlock classes="font-headline text-rta-h2" />
              </div>
              <div>
                <p className="font-headline text-rta-h3 text-nokturo-900 dark:text-nokturo-100">H3 — IvyPresto Headline</p>
                <p className="text-xs text-nokturo-500 mt-1">36px</p>
                <CodeBlock classes="font-headline text-rta-h3" />
              </div>
              <div>
                <p className="font-body text-rta-p-s text-nokturo-900/70 dark:text-white/70">Paragraf S — Instrument Sans</p>
                <p className="text-xs text-nokturo-500 mt-1">14px, 70% opacity</p>
                <CodeBlock classes="font-body text-rta-p-s text-nokturo-900/70 dark:text-white/70" />
              </div>
              <div>
                <p className="font-body text-rta-p-m text-nokturo-900/80 dark:text-white/80">Paragraf M — Instrument Sans</p>
                <p className="text-xs text-nokturo-500 mt-1">16px, 80% opacity</p>
                <CodeBlock classes="font-body text-rta-p-m text-nokturo-900/80 dark:text-white/80" />
              </div>
              <div>
                <p className="font-body text-rta-p-l text-nokturo-900/90 dark:text-white/90">Paragraf L — Instrument Sans</p>
                <p className="text-xs text-nokturo-500 mt-1">20px, 90% opacity</p>
                <CodeBlock classes="font-body text-rta-p-l text-nokturo-900/90 dark:text-white/90" />
              </div>
              <div>
                <blockquote className="font-headline italic text-rta-quote text-nokturo-700 dark:text-nokturo-300 my-4 pl-4 border-l-4 border-nokturo-300 dark:border-nokturo-600">
                  Quote — IvyPresto Italic
                </blockquote>
                <p className="text-xs text-nokturo-500 mt-1">36px</p>
                <CodeBlock classes="font-headline italic text-rta-quote" />
              </div>
              <div>
                <span className="font-body text-rta-tag uppercase tracking-wider text-nokturo-900/80 dark:text-white/80">Section Tag</span>
                <p className="text-xs text-nokturo-500 mt-1">12px, 80% opacity</p>
                <CodeBlock classes="font-body text-rta-tag uppercase tracking-wider text-nokturo-900/80 dark:text-white/80" />
              </div>
            </div>
          </Section>

          {/* Rich Text Standard */}
          <Section id="richtext-standard" title="Rich Text Standard (Instrument Sans)">
            <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mb-4">
              H4–H5 se v Rich Textu pod H3 nezobrazují, ale jsou v guidu pro referenci.
            </p>
            <div className="space-y-6">
              <div>
                <p className="font-body text-rta-std-h1 text-nokturo-900 dark:text-nokturo-100">Nová kolekce jaro 2025</p>
                <p className="text-xs text-nokturo-500 mt-1">44px, CS -4%</p>
                <CodeBlock classes="font-body text-rta-std-h1" />
              </div>
              <div>
                <p className="font-body text-rta-std-h2 text-nokturo-900 dark:text-nokturo-100">Paleta barev a materiálů</p>
                <p className="text-xs text-nokturo-500 mt-1">36px, CS -3%</p>
                <CodeBlock classes="font-body text-rta-std-h2" />
              </div>
              <div>
                <p className="font-body text-rta-std-h3 text-nokturo-900 dark:text-nokturo-100">Technické specifikace</p>
                <p className="text-xs text-nokturo-500 mt-1">24px, CS -2%</p>
                <CodeBlock classes="font-body text-rta-std-h3" />
              </div>
              <div>
                <p className="font-body text-rta-std-h4 text-nokturo-900 dark:text-nokturo-100">Dodavatelé a výroba</p>
                <p className="text-xs text-nokturo-500 mt-1">24px, CS -1%</p>
                <CodeBlock classes="font-body text-rta-std-h4" />
              </div>
              <div>
                <p className="font-body text-rta-std-h5 text-nokturo-900 dark:text-nokturo-100">Kvalita a testování</p>
                <p className="text-xs text-nokturo-500 mt-1">20px, CS -1%</p>
                <CodeBlock classes="font-body text-rta-std-h5" />
              </div>
              <div>
                <p className="text-sm text-nokturo-500 mb-2">Paragrafy jsou sharované (rta-p-s, rta-p-m, rta-p-l)</p>
                <p className="font-body text-rta-p-m text-nokturo-900/80 dark:text-white/80">Paragraf M — sharovaný</p>
              </div>
              <div>
                <p className="text-sm text-nokturo-500 mb-2">Tag je sharovaný</p>
                <span className="font-body text-rta-tag uppercase tracking-wider text-nokturo-900/80 dark:text-white/80">Section Tag</span>
              </div>
            </div>
          </Section>

          {/* Mimo Rich Text */}
          <Section id="mimo-richtext" title="Mimo Rich Text">
            <div className="space-y-6">
              <div>
                <p className="text-label font-body text-nokturo-900/80 dark:text-white/80">Label</p>
                <p className="text-xs text-nokturo-500 mt-1">16px, 80% opacity</p>
                <CodeBlock classes="text-label font-body text-nokturo-900/80 dark:text-white/80" />
              </div>
              <div>
                <p className="font-mono text-sm text-nokturo-900 dark:text-nokturo-100">Monospace font mono — system monospace</p>
                <CodeBlock classes="font-mono text-sm" />
              </div>
              <div>
                <p className="text-sm text-nokturo-500 mb-2">Button text — všechny buttony používají jednu velikost (16px) a jeden style</p>
                <button
                  type="button"
                  className="text-button-text font-body font-medium px-4 py-2 bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 hover:opacity-90 transition-opacity"
                >
                  Vzorový button
                </button>
                <CodeBlock classes="text-button-text font-body font-medium px-4 py-2 bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900" />
              </div>
            </div>
          </Section>

          {/* Labels — category/tag badges (Suppliers, Components, etc.) */}
          <Section id="labels" title="Labels">
            <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mb-4">
              Barevné labely pro kategorie, tagy — používají NotionSelect barvy.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-[6px] bg-nokturo-500 text-[rgb(230,230,230)]">Gray</span>
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-[6px] bg-orange text-orange-fg">Orange</span>
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-[6px] bg-blue-600 text-white">Blue</span>
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-[6px] bg-green text-green-fg">Green</span>
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-[6px] bg-violet-600 text-white">Purple</span>
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-[6px] bg-pink-600 text-white">Pink</span>
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-[6px] bg-red text-red-fg">Red</span>
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-[6px] bg-orange text-nokturo-900">Yellow</span>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs text-nokturo-500">gray: bg-nokturo-500 text-white</p>
              <p className="text-xs text-nokturo-500">orange: bg-orange text-orange-fg</p>
              <p className="text-xs text-nokturo-500">blue: bg-blue-600 text-white</p>
              <p className="text-xs text-nokturo-500">green: bg-green text-green-fg</p>
              <p className="text-xs text-nokturo-500">purple: bg-violet-600 text-white</p>
              <p className="text-xs text-nokturo-500">pink: bg-pink-600 text-white</p>
              <p className="text-xs text-nokturo-500">red: bg-red text-red-fg</p>
              <p className="text-xs text-nokturo-500">yellow: bg-orange text-nokturo-900</p>
            </div>
          </Section>
        </div>
      </div>
    </PageShell>
  );
}
