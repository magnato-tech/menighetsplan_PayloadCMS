import { describe, it, expect } from 'vitest'
import { isoTilOslo, osloTilIso } from '@/lib/tid'

describe('osloTilIso', () => {
  it('sommertid (CEST, UTC+2)', () => {
    expect(osloTilIso('2026-10-14', '14:30')).toBe('2026-10-14T12:30:00.000Z')
  })

  it('vintertid (CET, UTC+1)', () => {
    expect(osloTilIso('2026-12-24', '12:00')).toBe('2026-12-24T11:00:00.000Z')
  })

  it('overgang til sommertid (29. mars 2026)', () => {
    expect(osloTilIso('2026-03-29', '04:00')).toBe('2026-03-29T02:00:00.000Z')
    expect(osloTilIso('2026-03-28', '23:30')).toBe('2026-03-28T22:30:00.000Z')
  })

  it('overgang til vintertid (25. oktober 2026)', () => {
    expect(osloTilIso('2026-10-25', '04:00')).toBe('2026-10-25T03:00:00.000Z')
  })

  it('midnatt', () => {
    expect(osloTilIso('2026-07-01', '00:00')).toBe('2026-06-30T22:00:00.000Z')
  })
})

describe('isoTilOslo', () => {
  it('gir dato og klokkeslett i Oslo-tid', () => {
    expect(isoTilOslo('2026-10-14T12:30:00.000Z')).toEqual({ dato: '2026-10-14', tid: '14:30' })
    expect(isoTilOslo('2026-12-24T11:00:00.000Z')).toEqual({ dato: '2026-12-24', tid: '12:00' })
  })

  it('går rundt: Oslo → ISO → Oslo', () => {
    for (const [d, t] of [
      ['2026-01-15', '09:05'],
      ['2026-06-20', '23:59'],
      ['2026-10-31', '07:00'],
    ]) {
      expect(isoTilOslo(osloTilIso(d, t))).toEqual({ dato: d, tid: t })
    }
  })
})
