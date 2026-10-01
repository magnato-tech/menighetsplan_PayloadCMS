import { describe, it, expect } from 'vitest'
import { beregnDekning } from '@/lib/dekning'
import type { Oppgaver, Tildelinger } from '@/payload-types'

const NÅ = '2026-10-01T00:00:00.000Z'

function oppgave(id: number, antall = 1, status: Oppgaver['status'] = 'open'): Oppgaver {
  return { id, aktivitet: 1, gruppe: 1, tittel: `Oppgave ${id}`, antallTrengs: antall, status, updatedAt: NÅ, createdAt: NÅ }
}

function tildeling(id: number, oppgaveId: number, person: number, svar: Tildelinger['svar']): Tildelinger {
  return { id, oppgave: oppgaveId, person, svar, updatedAt: NÅ, createdAt: NÅ }
}

describe('beregnDekning', () => {
  it('gir null uten oppgaver', () => {
    expect(beregnDekning([], [])).toBeNull()
  })

  it('«venter på svar» teller ikke som dekket', () => {
    const d = beregnDekning([oppgave(1)], [tildeling(1, 1, 10, 'pending')])
    expect(d?.label).toBe('Mangler 1')
    expect(d?.dekkede).toBe(0)
  })

  it('er dekket når en person har bekreftet', () => {
    const d = beregnDekning([oppgave(1)], [tildeling(1, 1, 10, 'confirmed')])
    expect(d?.label).toBe('Dekket')
    expect(d).toMatchObject({ dekkede: 1, totalt: 1 })
  })

  it('krever like mange bekreftede som bemanningsbehovet', () => {
    const o = oppgave(1, 3)
    expect(beregnDekning([o], [tildeling(1, 1, 10, 'confirmed'), tildeling(2, 1, 11, 'confirmed')])?.label).toBe('Mangler 1')
    expect(
      beregnDekning([o], [tildeling(1, 1, 10, 'confirmed'), tildeling(2, 1, 11, 'confirmed'), tildeling(3, 1, 12, 'confirmed')])?.label,
    ).toBe('Dekket')
  })

  it('teller samme person bare én gang', () => {
    const d = beregnDekning([oppgave(1, 2)], [tildeling(1, 1, 10, 'confirmed'), tildeling(2, 1, 10, 'confirmed')])
    expect(d?.label).toBe('Mangler 1')
  })

  it('viser Forfall når noen har meldt forfall og oppgaven ikke er dekket igjen', () => {
    const d = beregnDekning([oppgave(1)], [tildeling(1, 1, 10, 'withdrawn')])
    expect(d?.label).toBe('Forfall')
  })

  it('Forfall forsvinner når en annen bekrefter', () => {
    const d = beregnDekning([oppgave(1)], [tildeling(1, 1, 10, 'withdrawn'), tildeling(2, 1, 11, 'confirmed')])
    expect(d?.label).toBe('Dekket')
  })

  it('ignorerer avlyste oppgaver', () => {
    expect(beregnDekning([oppgave(1, 1, 'cancelled')], [])).toBeNull()
    expect(beregnDekning([oppgave(1), oppgave(2, 1, 'cancelled')], [tildeling(1, 1, 10, 'confirmed')])?.label).toBe('Dekket')
  })

  it('Forfall har forrang over Mangler', () => {
    const d = beregnDekning([oppgave(1), oppgave(2)], [tildeling(1, 1, 10, 'withdrawn')])
    expect(d?.label).toBe('Forfall')
  })

  it('«Mangler N» teller manglende personer, og oppfolging teller oppgaver', () => {
    const d = beregnDekning(
      [oppgave(1, 3), oppgave(2, 2), oppgave(3, 1)],
      [tildeling(1, 1, 10, 'confirmed'), tildeling(2, 3, 11, 'confirmed')],
    )
    // oppgave 1 mangler 2, oppgave 2 mangler 2, oppgave 3 er dekket → 4 manglende personer, 2 oppgaver
    expect(d?.label).toBe('Mangler 4')
    expect(d).toMatchObject({ dekkede: 1, totalt: 3, oppfolging: 2 })
  })
})