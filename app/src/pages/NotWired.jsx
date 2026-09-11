import { BackButton, Card, SectionTitle } from '../components/UI'

/**
 * Honest placeholder for pages whose contract wiring is still in progress.
 *
 * The original mock designs are preserved under `src/pages/_legacy/` — they are
 * good UI work and should be ported, but they render fabricated assets, prices
 * and activity. Showing invented data next to a live mainnet deployment would
 * misrepresent the protocol, so those pages stay out of the build until each
 * one reads real chain state.
 */
export default function NotWired({ title, contract, todo = [], onNavigate }) {
  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <BackButton onClick={() => onNavigate('dashboard')} label="Dashboard" />
      <Card>
        <SectionTitle>{title}</SectionTitle>
        <p className="text-xs text-white/[0.54] mb-4">
          This page is not wired to the contracts yet. The mock design lives in{' '}
          <code className="text-[#B084E9]">src/pages/_legacy/</code> and should be ported to read
          live state before launch.
        </p>

        {contract && (
          <p className="text-[11px] text-white/[0.36] mb-4">
            Backing contract: <span className="text-[#B084E9]">{contract}</span>
          </p>
        )}

        {todo.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-wider text-white/[0.3] mb-2">To port</p>
            <ul className="space-y-1.5">
              {todo.map((t) => (
                <li key={t} className="text-[11px] text-white/[0.54] flex gap-2">
                  <span className="text-white/[0.2]">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}
