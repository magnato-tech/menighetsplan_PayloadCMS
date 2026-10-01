import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

/**
 * Tilgangsregler for Payload (API-et og adminpanelet). Appens egne server-handlinger bruker Payloads lokale API med
 * full tilgang og sjekker rettigheter selv (se bemanningKjerne.ts), så disse reglene styrer det som er åpent utenfra:
 * REST/GraphQL-API og /admin.
 *
 * Prinsipp: stengt som standard. Lese krever innlogging, endre krever admin, og vanlige brukere ser bare seg selv.
 */

type MedRolle = { globalRolle?: string | null } | null | undefined

export const erAdmin = (user: MedRolle): boolean => user?.globalRolle === 'admin'

/** Bare admin. */
export const kunAdmin: Access = ({ req }) => erAdmin(req.user as MedRolle)

/** Alle innloggede brukere. */
export const innlogget: Access = ({ req }) => Boolean(req.user)

/** Felt som bare admin kan sette (f.eks. rolle), så ingen kan gjøre seg selv til admin. */
export const adminFelt: FieldAccess = ({ req }) => erAdmin(req.user as MedRolle)

/** Admin ser alt; en innlogget bruker ser og endrer bare sin egen post. */
export const egenEllerAdmin: Access = ({ req }) => {
  if (erAdmin(req.user as MedRolle)) return true
  if (req.user) return { id: { equals: req.user.id } } as Where
  return false
}

/** Uinnloggede ser bare offentlige arrangementer; innloggede ser alle. */
export const offentligEllerInnlogget: Access = ({ req }) => {
  if (req.user) return true
  return { offentlig: { equals: true } } as Where
}

/** Adgang til adminpanelet (/admin): bare admin. Vanlige medlemmer skal bruke Min side. */
export const kanBrukeAdminpanel = ({ req }: { req: PayloadRequest }): boolean => erAdmin(req.user as MedRolle)

/**
 * Gruppemeldinger: bare medlemmer, ledere og nestledere i gruppen kan lese meldingene til gruppen (admin ser alt).
 * Filteret bygges per bruker: vi finner gruppene brukeren er med i og slipper bare gjennom meldinger der.
 */
export const lesGruppemeldinger: Access = async ({ req }) => {
  if (!req.user) return false
  if (erAdmin(req.user as MedRolle)) return true
  const id = req.user.id
  const { docs } = await req.payload.find({
    collection: 'grupper',
    where: { or: [{ medlemmer: { equals: id } }, { ledere: { equals: id } }, { varaledere: { equals: id } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  return { gruppe: { in: docs.map((g) => g.id) } } as Where
}