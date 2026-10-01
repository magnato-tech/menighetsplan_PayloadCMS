'use client'
import { useState } from 'react'

type Person = { id: number; navn: string; epost: string }

type Props = {
  aktivitetId: number
  oppgaveId: number
  personer: Person[]
  tildelAction: (formData: FormData) => void | Promise<void>
  foresporAction: (formData: FormData) => void | Promise<void>
  /** Ekstra skjulte felt som sendes med (f.eks. aktorId for gruppeleder). */
  ekstraFelt?: Record<string, string | number>
}

/**
 * Søk og velg person til en oppgave. To valg per person:
 * «Tildel» (avtalt muntlig, står som bekreftet) og «Forespør» (personen svarer i appen).
 */
export default function PersonVelger({ aktivitetId, oppgaveId, personer, tildelAction, foresporAction, ekstraFelt }: Props) {
  const [sok, setSok] = useState('')
  const q = sok.trim().toLowerCase()
  const treff = q ? personer.filter((p) => p.navn.toLowerCase().includes(q) || p.epost.toLowerCase().includes(q)) : personer

  return (
    <div className="adm-velger">
      <p className="adm-etikett">DIREKTE BEMANNINGSHÅNDTERING</p>
      <input
        type="search"
        className="adm-sok"
        placeholder="Søk etter navn eller e-post…"
        value={sok}
        onChange={(e) => setSok(e.target.value)}
        aria-label="Søk etter person"
      />
      <ul className="adm-personliste">
        {treff.length === 0 && <li className="adm-tom">Ingen treff.</li>}
        {treff.map((p) => (
          <li key={p.id}>
            <form className="adm-personrad">
              <input type="hidden" name="aktivitetId" value={aktivitetId} />
              <input type="hidden" name="oppgaveId" value={oppgaveId} />
              <input type="hidden" name="personId" value={p.id} />
              {ekstraFelt && Object.entries(ekstraFelt).map(([navn, verdi]) => <input key={navn} type="hidden" name={navn} value={verdi} />)}
              <span className="adm-personinfo">
                <strong>{p.navn}</strong>
                <small>{p.epost}</small>
              </span>
              <span className="adm-personknapper">
                <button type="submit" formAction={tildelAction} className="adm-tildel" title="Avtalt muntlig: står som bekreftet">
                  Tildel
                </button>
                <button type="submit" formAction={foresporAction} className="adm-forespor" title="Personen svarer ja eller nei i appen">
                  Forespør
                </button>
              </span>
            </form>
          </li>
        ))}
      </ul>
      <p className="adm-hjelp">
        <strong>Tildel:</strong> avtalt muntlig, står som bekreftet. <strong>Forespør:</strong> personen svarer i appen.
      </p>
    </div>
  )
}
