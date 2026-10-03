import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { approveCanvasApi } from '@/lib/canvasApi'
import { populateWarehouseDispatchFromCanvas } from '@/lib/warehouse-dispatch'
import { API_BASE_URL } from '@/lib/apiConfig'

/* ============================================================
   Event Planner domain — pipeline portfolios, design canvases,
   décor library, and the placed-element ledger.
   ============================================================ */

export type PipelinePhase =
  | 'Concept Definition'
  | 'Layout & Design'
  | 'Final Execution'

/* Client experience segments (the word "tier" is intentionally avoided). */
export type PortfolioTier = 'VIP' | 'Premium' | 'Corporate'

export type PortfolioStatus =
  | 'Moodboard Phase'
  | 'Vendor Outreach'
  | 'Client Approved'
  | 'Floor Plan Layout'
  | 'Finalizing PO'
  | 'Ready for Logistics'
  | 'Settled'

export interface PipelineEvent {
  id: string
  title: string
  client: string
  tier: PortfolioTier
  phase: PipelinePhase
  status: PortfolioStatus
  date: string
  venue: string
  recordId: string
  galaDate: string
  daysRemaining: number
  footprint: string
  attendance: string
  pipelineStage: string
}

export type DesignStatus = 'Active' | 'In Review' | 'Draft'

export interface CanvasDesign {
  id: string
  title: string
  created: string
  status: DesignStatus
  image: string
  /* Linked pipeline event for system-wide data consistency. */
  eventId?: string
}

export interface QuickConcept {
  id: string
  title: string
  meta: string
  kind: 'palette' | 'layout' | 'concept' | 'moodboard'
}

export type DecorCategory =
  | 'Furniture Stock'
  | 'Textiles & Tableware'
  | 'Lighting & Atmosphere'
  | 'Floor Plan Layout'
  | 'Color & Pantone'
  | 'Moodboard & Inspiration'

export interface DecorElement {
  id: string
  name: string
  sku: string
  category: DecorCategory
  image?: string
  /* Physical inventory items carry a stock record + trigger logistics notifs. */
  warehouseStock?: number
  /* Pure design aids (palettes, floor plans) carry a swatch instead of stock. */
  swatch?: string
  pantone?: string
}

export type PlacedKind = 'decor' | 'floorplan' | 'color' | 'text'

export interface PlacedElement {
  id: string
  kind: PlacedKind
  x: number
  y: number
  /* Decor / floor plan / color */
  elementId?: string
  name?: string
  sku?: string
  image?: string
  quantity?: number
  tracked?: boolean
  swatch?: string
  pantone?: string
  /* Text */
  text?: string
  fontSize?: number
  fontFamily?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

/* Committed design artifacts stored against a pipeline event. */
export interface EventDocument {
  id: string
  name: string
  meta: string
  kind: 'design' | 'plan' | 'contract' | 'spec'
  designId?: string
  /* Object URL to an openable PDF generated when the design is committed. */
  fileUrl?: string
}

export interface MaterialLine {
  sku: string
  name: string
  quantity: number
  category: DecorCategory
  image?: string
}

export interface ChecklistItem {
  id: string
  sku: string
  name: string
  quantity: number
}

/* ----------------------------- Seed data ----------------------------- */

const IMG = '/images/decor'

const seedEvents: PipelineEvent[] = [
  {
    id: 'pe-1',
    title: 'La Nuit Dorée — Spring Gala 2026',
    client: 'Maison Châtelet Group',
    tier: 'VIP',
    phase: 'Concept Definition',
    status: 'Moodboard Phase',
    date: 'Oct 14, 2026',
    venue: 'Château Lumière Grand Ballroom, Paris — Île-de-France',
    recordId: 'EVT-2026-0047',
    galaDate: '15 May 2026',
    daysRemaining: 121,
    footprint: '1,200 m²',
    attendance: '320 Seated | 480 Standing',
    pipelineStage: 'Pre-Production Phase',
  },
  {
    id: 'pe-2',
    title: 'Ethereal Garden Soirée',
    client: 'Maison Valois',
    tier: 'Premium',
    phase: 'Concept Definition',
    status: 'Vendor Outreach',
    date: 'Jun 14, 2026',
    venue: 'Jardin des Tuileries Pavilion, Paris',
    recordId: 'EVT-2026-0051',
    galaDate: '14 Jun 2026',
    daysRemaining: 151,
    footprint: '850 m²',
    attendance: '180 Seated | 220 Standing',
    pipelineStage: 'Ideation Phase',
  },
  {
    id: 'pe-3',
    title: 'Golden Hour Heritage Gala',
    client: 'Heritage Trust',
    tier: 'Premium',
    phase: 'Concept Definition',
    status: 'Ready for Logistics',
    date: 'Jun 14, 2026',
    venue: 'The Orangery, Versailles',
    recordId: 'EVT-2026-0052',
    galaDate: '20 Jun 2026',
    daysRemaining: 157,
    footprint: '1,050 m²',
    attendance: '260 Seated | 300 Standing',
    pipelineStage: 'Hand-off Phase',
  },
  {
    id: 'pe-4',
    title: 'Pastel Blossom Luncheon',
    client: 'Dr. Evelyn Rios',
    tier: 'VIP',
    phase: 'Layout & Design',
    status: 'Client Approved',
    date: 'Jun 26, 2026',
    venue: 'Grand Pavilion Conservatory',
    recordId: 'EVT-2026-0058',
    galaDate: '26 Jun 2026',
    daysRemaining: 163,
    footprint: '620 m²',
    attendance: '120 Seated',
    pipelineStage: 'Layout Design Phase',
  },
  {
    id: 'pe-5',
    title: 'Diamond Jubilee Ball',
    client: 'Crown Logistics',
    tier: 'Corporate',
    phase: 'Layout & Design',
    status: 'Finalizing PO',
    date: 'Jun 26, 2026',
    venue: 'Annex Hall — Grand Pavilion',
    recordId: 'EVT-2026-0061',
    galaDate: '26 Jun 2026',
    daysRemaining: 163,
    footprint: '1,400 m²',
    attendance: '400 Seated | 600 Standing',
    pipelineStage: 'Layout Design Phase',
  },
  {
    id: 'pe-6',
    title: 'Summit Keynote Design',
    client: 'Nexus Corp',
    tier: 'Premium',
    phase: 'Final Execution',
    status: 'Finalizing PO',
    date: 'Jun 26, 2026',
    venue: 'Metropolitan Conference Center',
    recordId: 'EVT-2026-0064',
    galaDate: '26 Jun 2026',
    daysRemaining: 163,
    footprint: '900 m²',
    attendance: '500 Theatre',
    pipelineStage: 'Final Execution Phase',
  },
  {
    id: 'pe-7',
    title: 'Baroque Grandeur Banquet',
    client: 'Opera House',
    tier: 'VIP',
    phase: 'Final Execution',
    status: 'Ready for Logistics',
    date: 'Jun 26, 2026',
    venue: 'Palais Garnier Grand Foyer',
    recordId: 'EVT-2026-0066',
    galaDate: '26 Jun 2026',
    daysRemaining: 163,
    footprint: '1,150 m²',
    attendance: '240 Seated | 360 Standing',
    pipelineStage: 'Final Execution Phase',
  },
]

const seedDesigns: CanvasDesign[] = [
  { id: 'd-1', title: 'Gala La Nuit Dorée', created: 'May 17, 2026', status: 'Active', image: `${IMG}/chateau-ballroom.png`, eventId: 'pe-1' },
  { id: 'd-2', title: 'Summer Garden Wedding', created: 'Jun 17, 2026', status: 'In Review', image: `${IMG}/garden-wedding.png`, eventId: 'pe-2' },
  { id: 'd-3', title: 'Château Floral Arch Design', created: 'Jul 17, 2026', status: 'Draft', image: `${IMG}/floral-arch.png`, eventId: 'pe-3' },
  { id: 'd-4', title: 'Minimalist Table Proposal', created: 'Aug 17, 2026', status: 'Active', image: `${IMG}/minimalist-table.png`, eventId: 'pe-4' },
  { id: 'd-5', title: 'Crystal Candelabra Setup', created: 'Sep 17, 2026', status: 'Active', image: `${IMG}/candelabra.png`, eventId: 'pe-7' },
  { id: 'd-6', title: 'Tent Lighting Concept', created: 'Oct 17, 2026', status: 'Draft', image: `${IMG}/string-lights.png`, eventId: 'pe-6' },
]

const seedConcepts: QuickConcept[] = [
  { id: 'qc-1', title: 'Gold & Silver Color Palette', meta: 'Updated 2 days ago · Quick Concept', kind: 'palette' },
  { id: 'qc-2', title: 'Seating Plan Draft (A–Z)', meta: 'Updated 4 days ago · Layout', kind: 'layout' },
  { id: 'qc-3', title: 'Floral Selection (Quick Sketches)', meta: 'Updated 6 days ago · Concept', kind: 'concept' },
  { id: 'qc-4', title: 'Moodboard for Chateau Arch', meta: 'Updated 1 week ago · Moodboard', kind: 'moodboard' },
  { id: 'qc-5', title: 'Tent Lighting Concept', meta: 'Updated 2 weeks ago · Concept', kind: 'concept' },
]

const seedDecor: DecorElement[] = [
  /* Furniture Stock — tracked inventory */
  { id: 'el-1', name: 'Tiffany Chair', sku: 'LMR-FURN-TC01', category: 'Furniture Stock', image: `${IMG}/tiffany-chair.png`, warehouseStock: 240 },
  { id: 'el-2', name: 'Dinner Table', sku: 'LMR-FURN-DT01', category: 'Furniture Stock', image: `${IMG}/dinner-table.png`, warehouseStock: 60 },
  { id: 'el-3', name: 'Gold Candelabra', sku: 'LMR-FURN-CB01', category: 'Furniture Stock', image: `${IMG}/candelabra.png`, warehouseStock: 28 },
  { id: 'el-12', name: 'Velvet Lounge Sofa', sku: 'LMR-FURN-LS01', category: 'Furniture Stock', image: `${IMG}/velvet-sofa.png`, warehouseStock: 18 },
  { id: 'el-13', name: 'Parquet Dance Floor', sku: 'LMR-FURN-DF01', category: 'Furniture Stock', image: `${IMG}/dance-floor.png`, warehouseStock: 8 },

  /* Textiles & Tableware — tracked inventory */
  { id: 'el-6', name: 'Silk Table Runner', sku: 'LMR-TEX-SR01', category: 'Textiles & Tableware', image: `${IMG}/silk-runner.png`, warehouseStock: 45 },
  { id: 'el-7', name: 'Silk Napkin', sku: 'LMR-TEX-SN01', category: 'Textiles & Tableware', image: `${IMG}/silk-napkin.png`, warehouseStock: 320 },
  { id: 'el-8', name: 'Silver Flatware', sku: 'LMR-TAB-SF01', category: 'Textiles & Tableware', image: `${IMG}/silver-flatware.png`, warehouseStock: 410 },
  { id: 'el-9', name: 'Gold Charger', sku: 'LMR-TAB-GC01', category: 'Textiles & Tableware', image: `${IMG}/gold-charger.png`, warehouseStock: 280 },
  { id: 'el-10', name: 'Glassware Set', sku: 'LMR-TAB-GS01', category: 'Textiles & Tableware', image: `${IMG}/glassware.png`, warehouseStock: 190 },

  /* Lighting & Atmosphere — tracked inventory */
  { id: 'el-11', name: 'String Lights', sku: 'LMR-LIGHT-SL01', category: 'Lighting & Atmosphere', image: `${IMG}/string-lights.png`, warehouseStock: 75 },
  { id: 'el-14', name: 'Crystal Chandelier', sku: 'LMR-LIGHT-CC01', category: 'Lighting & Atmosphere', image: `${IMG}/crystal-chandelier.png`, warehouseStock: 12 },
  { id: 'el-15', name: 'Pillar Candle Cluster', sku: 'LMR-LIGHT-PC01', category: 'Lighting & Atmosphere', image: `${IMG}/pillar-candles.png`, warehouseStock: 140 },
  { id: 'el-16', name: 'Amber Up-Lighting', sku: 'LMR-LIGHT-UL01', category: 'Lighting & Atmosphere', image: `${IMG}/uplighting.png`, warehouseStock: 64 },

  /* Moodboard & Inspiration — staged installations (tracked) */
  { id: 'el-4', name: 'Chateau Ballroom Backdrop', sku: 'LMR-DECOR-SI01', category: 'Moodboard & Inspiration', image: `${IMG}/chateau-ballroom.png`, warehouseStock: 10 },
  { id: 'el-5', name: 'Classic Full-Blossom Floral Archway', sku: 'LMR-DECOR-FA01', category: 'Moodboard & Inspiration', image: `${IMG}/floral-arch.png`, warehouseStock: 1 },

  /* Floor Plan Layout — design aids (no stock, no notif) */
  { id: 'fp-1', name: 'Banquet Round Layout', sku: 'LMR-PLAN-BR01', category: 'Floor Plan Layout', image: `${IMG}/floorplan-banquet.png` },
  { id: 'fp-2', name: 'Theatre Seating Layout', sku: 'LMR-PLAN-TH01', category: 'Floor Plan Layout', image: `${IMG}/floorplan-theatre.png` },
  { id: 'fp-3', name: 'U-Shape Boardroom', sku: 'LMR-PLAN-US01', category: 'Floor Plan Layout', image: `${IMG}/floorplan-ushape.png` },
  { id: 'fp-4', name: 'Cocktail Flow Layout', sku: 'LMR-PLAN-CK01', category: 'Floor Plan Layout', image: `${IMG}/floorplan-cocktail.png` },

  /* Color & Pantone — design aids (no stock, no notif) */
  { id: 'cl-1', name: 'Champagne Gold', sku: 'PANTONE 871 C', category: 'Color & Pantone', swatch: '#C9A24B', pantone: '871 C' },
  { id: 'cl-2', name: 'Blush Rose', sku: 'PANTONE 7521 C', category: 'Color & Pantone', swatch: '#E3C0C2', pantone: '7521 C' },
  { id: 'cl-3', name: 'Ivory Cream', sku: 'PANTONE 7506 C', category: 'Color & Pantone', swatch: '#F1E8D8', pantone: '7506 C' },
  { id: 'cl-4', name: 'Deep Bordeaux', sku: 'PANTONE 7421 C', category: 'Color & Pantone', swatch: '#5C2331', pantone: '7421 C' },
  { id: 'cl-5', name: 'Sage Green', sku: 'PANTONE 5773 C', category: 'Color & Pantone', swatch: '#A3AE92', pantone: '5773 C' },
  { id: 'cl-6', name: 'Midnight Navy', sku: 'PANTONE 5395 C', category: 'Color & Pantone', swatch: '#1F2A44', pantone: '5395 C' },
]

/* ----------------------------- Ready-made presets ----------------------------- */

interface PresetSeed {
  elementId: string
  x: number
  y: number
  quantity?: number
}

interface TextSeed {
  text: string
  x: number
  y: number
  fontSize?: number
  bold?: boolean
  italic?: boolean
}

const designPresets: Record<string, { items: PresetSeed[]; texts?: TextSeed[] }> = {
  'd-1': {
    items: [
      { elementId: 'el-4', x: 50, y: 30, quantity: 1 },
      { elementId: 'el-2', x: 28, y: 58, quantity: 8 },
      { elementId: 'el-3', x: 50, y: 58, quantity: 12 },
      { elementId: 'el-1', x: 72, y: 58, quantity: 120 },
      { elementId: 'cl-1', x: 16, y: 84 },
      { elementId: 'cl-3', x: 30, y: 84 },
    ],
    texts: [{ text: 'La Nuit Dorée — Main Ballroom', x: 50, y: 12, fontSize: 22, bold: true }],
  },
  'd-2': {
    items: [
      { elementId: 'el-5', x: 50, y: 32, quantity: 1 },
      { elementId: 'fp-1', x: 50, y: 64 },
      { elementId: 'cl-2', x: 20, y: 86 },
      { elementId: 'cl-5', x: 34, y: 86 },
    ],
    texts: [{ text: 'Garden Ceremony Layout', x: 50, y: 12, fontSize: 22, bold: true }],
  },
  'd-3': {
    items: [
      { elementId: 'el-5', x: 50, y: 40, quantity: 1 },
      { elementId: 'el-6', x: 30, y: 72, quantity: 12 },
      { elementId: 'cl-3', x: 70, y: 74 },
    ],
    texts: [{ text: 'Château Floral Arch — Concept', x: 50, y: 14, fontSize: 20, italic: true }],
  },
  'd-4': {
    items: [
      { elementId: 'el-2', x: 50, y: 42, quantity: 1 },
      { elementId: 'el-9', x: 34, y: 66, quantity: 12 },
      { elementId: 'el-10', x: 66, y: 66, quantity: 12 },
      { elementId: 'cl-3', x: 50, y: 86 },
    ],
    texts: [{ text: 'Minimalist Table Proposal', x: 50, y: 14, fontSize: 20, bold: true }],
  },
  'd-5': {
    items: [
      { elementId: 'el-3', x: 38, y: 44, quantity: 6 },
      { elementId: 'el-15', x: 64, y: 46, quantity: 24 },
      { elementId: 'cl-1', x: 50, y: 82 },
    ],
    texts: [{ text: 'Crystal Candelabra Setup', x: 50, y: 14, fontSize: 20, bold: true }],
  },
  'd-6': {
    items: [
      { elementId: 'el-11', x: 50, y: 34, quantity: 18 },
      { elementId: 'el-16', x: 28, y: 62, quantity: 12 },
      { elementId: 'fp-4', x: 68, y: 64 },
    ],
    texts: [{ text: 'Tent Lighting Concept', x: 50, y: 12, fontSize: 20, italic: true }],
  },
}

/* ----------------------------- Helpers ----------------------------- */

let placedCounter = 0
const nextPlacedId = () => `pl-${Date.now()}-${placedCounter++}`

const kindForCategory = (cat: DecorCategory): PlacedKind => {
  if (cat === 'Color & Pantone') return 'color'
  if (cat === 'Floor Plan Layout') return 'floorplan'
  return 'decor'
}

const isTracked = (el: DecorElement) => el.warehouseStock !== undefined

function buildPlacedFromElement(
  el: DecorElement,
  x: number,
  y: number,
  quantity?: number,
): PlacedElement {
  return {
    id: nextPlacedId(),
    kind: kindForCategory(el.category),
    x,
    y,
    elementId: el.id,
    name: el.name,
    sku: el.sku,
    image: el.image,
    swatch: el.swatch,
    pantone: el.pantone,
    quantity,
    tracked: isTracked(el),
  }
}

function buildPreset(designId: string): PlacedElement[] {
  const preset = designPresets[designId]
  if (!preset) return []
  const out: PlacedElement[] = []
  for (const seed of preset.items) {
    const el = seedDecor.find((d) => d.id === seed.elementId)
    if (el) out.push(buildPlacedFromElement(el, seed.x, seed.y, seed.quantity))
  }
  for (const t of preset.texts ?? []) {
    out.push({
      id: nextPlacedId(),
      kind: 'text',
      x: t.x,
      y: t.y,
      text: t.text,
      fontSize: t.fontSize ?? 16,
      bold: t.bold,
      italic: t.italic,
    })
  }
  return out
}

const phaseStatusByPhase: Record<PipelinePhase, PortfolioStatus> = {
  'Concept Definition': 'Moodboard Phase',
  'Layout & Design': 'Floor Plan Layout',
  'Final Execution': 'Ready for Logistics',
}

export interface NewPortfolioDraft {
  title: string
  client: string
  tier: PortfolioTier
  venue: string
  date: string
}

/* ----------------------------- Context ----------------------------- */

interface PlannerContextValue {
  events: PipelineEvent[]
  designs: CanvasDesign[]
  concepts: QuickConcept[]
  decor: DecorElement[]
  selectedEventId: string | null
  selectedDesignId: string | null
  placed: PlacedElement[]
  /* Committed design artifacts, keyed by pipeline event id. */
  eventDocuments: Record<string, EventDocument[]>
  eventMaterials: Record<string, MaterialLine[]>
  eventChecklist: Record<string, ChecklistItem[]>
  addPortfolio: (draft: NewPortfolioDraft) => void
  selectEvent: (id: string | null) => void
  selectDesign: (id: string | null) => void
  addDesign: (title: string, eventId?: string) => string
  renameDesign: (id: string, title: string) => void
  /* True when at least one canvas exists for the given event. */
  hasDesignForEvent: (eventId: string) => boolean
  /* Snapshot the live canvas against its design without committing — keeps it
     editable and visible as a draft on the Design Canvas dashboard. */
  saveDraft: (designId: string) => void
  /* Persist the active canvas to the event: docs + materials + warehouse checklist. */
  commitDesign: (designId: string, pdfUrl?: string) => string | null
  /* R9: Approves canvas and auto-populates warehouse/dispatch preparation queue. */
  approveDesign: (designId: string) => Promise<boolean>
  /* Tracked inventory item placed after a successful allocation check. */
  placeElement: (elementId: string, quantity: number, x: number, y: number) => void
  /* Untracked design aid (color / floor plan) placed directly. */
  placeDirect: (elementId: string, x: number, y: number) => void
  addText: (x: number, y: number, opts?: { text?: string; fontSize?: number; bold?: boolean }) => string
  updatePlaced: (id: string, patch: Partial<PlacedElement>) => void
  removePlaced: (id: string) => void
  clearPlaced: () => void
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<PipelineEvent[]>(seedEvents)
  const [designs, setDesigns] = useState<CanvasDesign[]>(seedDesigns)
  const [concepts] = useState<QuickConcept[]>(seedConcepts)
  const [decor, setDecor] = useState<DecorElement[]>(seedDecor)

  // Hydrate pipeline events only when the optional REST API is configured.
  useEffect(() => {
    if (!API_BASE_URL) return

    let active = true
    import('@/lib/eventsApi').then(({ fetchEventsApi }) => {
      fetchEventsApi().then((remoteEvents) => {
        if (!active || !remoteEvents.length) return
        const mappedPipelineEvents: PipelineEvent[] = remoteEvents.map((pe) => ({
          id: pe.id,
          title: pe.title,
          client: pe.client || 'Not available from backend yet',
          tier: 'VIP',
          phase: 'Concept Definition',
          status: 'Moodboard Phase',
          date: pe.targetDate,
          venue: pe.venue,
          recordId: pe.refId,
          galaDate: pe.targetDate,
          daysRemaining: 120,
          footprint: 'Pending survey',
          attendance: 'Pending confirmation',
          pipelineStage: 'Ideation Phase',
        }))
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id))
          const newRemote = mappedPipelineEvents.filter((e) => !existingIds.has(e.id))
          return [...newRemote, ...prev]
        })
      })
    })
    return () => {
      active = false
    }
  }, [])

  // Hydrate the décor library with assets registered by the Warehouse Supervisor
  // so newly stocked items appear in the canvas side panel.
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('planner_assets')
        .select('id, sku, name, decor_category, image, warehouse_stock')
        .order('created_at', { ascending: false })

      if (!active) return
      if (error) {
        console.error('[v0] Failed to load planner assets:', error)
        return
      }
      if (data && data.length > 0) {
        const fromWarehouse: DecorElement[] = data.map((row: any) => ({
          id: `wh-${row.id}`,
          name: row.name,
          sku: row.sku,
          category: (row.decor_category ?? 'Furniture Stock') as DecorCategory,
          image: row.image || undefined,
          warehouseStock: row.warehouse_stock ?? 0,
        }))
        const seededSkus = new Set(seedDecor.map((d) => d.sku))
        const merged = fromWarehouse.filter((d) => !seededSkus.has(d.sku))
        setDecor([...merged, ...seedDecor])
      }
    })()
    return () => {
      active = false
    }
  }, [])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null)
  const [placed, setPlaced] = useState<PlacedElement[]>([])
  /* Per-design saved canvas snapshots so drafts survive navigation. */
  const [designCanvases, setDesignCanvases] = useState<Record<string, PlacedElement[]>>({})
  const [eventDocuments, setEventDocuments] = useState<Record<string, EventDocument[]>>({})
  const [eventMaterials, setEventMaterials] = useState<Record<string, MaterialLine[]>>({})
  const [eventChecklist, setEventChecklist] = useState<Record<string, ChecklistItem[]>>({})

  const addPortfolio = useCallback(async (draft: NewPortfolioDraft) => {
    const { createEventApi } = await import('@/lib/eventsApi')

    const cleanDate = draft.date && draft.date.trim() ? draft.date.trim().split('T')[0] : new Date().toISOString().slice(0, 10)
    const dateOfEventIso = `${cleanDate}T00:00:00Z`
    const result = await createEventApi({
      eventName: draft.title.trim(),
      eventVenue: (draft.venue || 'Venue Pending').trim(),
      geoClass: 'Local',
      dateOfEvent: dateOfEventIso,
      ingressDate: dateOfEventIso,
      ingressTime: '08:00:00',
      fullStop: '23:00:00',
    })

    if (result.kind === 'success') {
      const persisted = result.event
      const newEvent: PipelineEvent = {
        id: persisted.id,
        title: persisted.title,
        client: draft.client,
        tier: draft.tier,
        phase: 'Concept Definition',
        status: phaseStatusByPhase['Concept Definition'],
        date: persisted.targetDate,
        venue: persisted.venue,
        recordId: persisted.refId,
        galaDate: persisted.targetDate,
        daysRemaining: 120,
        footprint: 'Pending survey',
        attendance: 'Pending confirmation',
        pipelineStage: 'Ideation Phase',
      }
      setEvents((prev) => [newEvent, ...prev])
    } else {
      console.warn('[planner] POST /api/events failed:', result.message)
      throw new Error(`Failed to create portfolio event: ${result.message}`)
    }
  }, [])

  const selectEvent = useCallback((id: string | null) => setSelectedEventId(id), [])

  const selectDesign = useCallback(
    (id: string | null) => {
      setSelectedDesignId(id)
      if (!id) {
        setPlaced([])
        return
      }
      /* Prefer a saved draft snapshot, then fall back to a ready-made preset. */
      setPlaced(designCanvases[id] ?? buildPreset(id))
    },
    [designCanvases],
  )

  const addDesign = useCallback((title: string, eventId?: string) => {
    const id = `d-${Date.now()}`
    const now = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
    setDesigns((prev) => [
      { id, title: title || 'Untitled Design', created: now, status: 'Draft', image: `${IMG}/minimalist-table.png`, eventId },
      ...prev,
    ])
    setSelectedDesignId(id)
    setPlaced([])
    return id
  }, [])

  const hasDesignForEvent = useCallback(
    (eventId: string) => designs.some((d) => d.eventId === eventId),
    [designs],
  )

  /* Save the live canvas as a draft snapshot against its design only. Saving does
     NOT create a design document or material requirements — those are produced
     exclusively when the planner commits the design. The design keeps a Draft
     status and stays editable + listed on the Design Canvas dashboard. */
  const saveDraft = useCallback(
    (designId: string) => {
      const snapshot = placed.map((p) => ({ ...p }))
      setDesignCanvases((prev) => ({ ...prev, [designId]: snapshot }))
      const now = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
      setDesigns((prev) =>
        prev.map((d) =>
          d.id === designId
            ? { ...d, status: d.status === 'In Review' ? d.status : 'Draft', created: now }
            : d,
        ),
      )
    },
    [placed],
  )

  /* Commit the live canvas: write a design document, roll placed inventory into
     the event's material requirements, and generate a warehouse verification checklist. */
  const commitDesign = useCallback(
    (designId: string, pdfUrl?: string): string | null => {
      const design = designs.find((d) => d.id === designId)
      if (!design) return null
      const eventId = design.eventId ?? selectedEventId ?? undefined
      if (!eventId) return null

      const tally = new Map<string, MaterialLine>()
      for (const p of placed) {
        if (!p.tracked || !p.sku) continue
        const qty = p.quantity ?? 1
        const existing = tally.get(p.sku)
        if (existing) {
          existing.quantity += qty
        } else {
          const el = decor.find((d) => d.sku === p.sku)
          tally.set(p.sku, {
            sku: p.sku,
            name: p.name ?? el?.name ?? p.sku,
            quantity: qty,
            category: el?.category ?? 'Furniture Stock',
            image: p.image,
          })
        }
      }
      const materials = Array.from(tally.values())
      const checklist: ChecklistItem[] = materials.map((m, i) => ({
        id: `ck-${designId}-${i}`,
        sku: m.sku,
        name: m.name,
        quantity: m.quantity,
      }))

      const now = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
      const doc: EventDocument = {
        id: `doc-${designId}`,
        name: `${design.title} — Canvas Layout`,
        meta: `Design Canvas · ${placed.length} element${placed.length === 1 ? '' : 's'} · Committed ${now}`,
        kind: 'design',
        designId,
        fileUrl: pdfUrl,
      }

      setDesignCanvases((prev) => ({ ...prev, [designId]: placed.map((p) => ({ ...p })) }))
      setEventMaterials((prev) => ({ ...prev, [eventId]: materials }))
      setEventChecklist((prev) => ({ ...prev, [eventId]: checklist }))
      setEventDocuments((prev) => {
        const list = (prev[eventId] ?? []).filter((d) => d.designId !== designId)
        return { ...prev, [eventId]: [doc, ...list] }
      })
      setDesigns((prev) =>
        prev.map((d) => (d.id === designId ? { ...d, eventId, status: 'In Review' } : d)),
      )

      // R9: Auto-populate warehouse dispatch preparation queue from committed design
      const ev = events.find((e) => e.id === eventId)
      populateWarehouseDispatchFromCanvas(
        eventId,
        ev?.title || design.title,
        materials,
        ev?.venue || 'Grand Ballroom',
        ev?.date || '2026-09-02',
      )

      return eventId
    },
    [designs, placed, selectedEventId, decor, events],
  )

  const approveDesign = useCallback(
    async (designId: string): Promise<boolean> => {
      const design = designs.find((d) => d.id === designId)
      if (!design) return false
      const eventId = design.eventId ?? selectedEventId ?? undefined
      if (eventId) {
        // Task 1 / R9: Await canonical backend approval — do not fire-and-forget.
        const approveResult = await approveCanvasApi(eventId)
        if (!approveResult.ok) {
          const detail =
            approveResult.reason === 'conflict-409'
              ? approveResult.message
              : approveResult.reason === 'backend-rejected'
                ? `HTTP ${approveResult.status}`
                : approveResult.reason === 'network-error'
                  ? (approveResult.message ?? 'Network error')
                  : 'No event ID'
          console.warn(
            `[planner] approveDesign: backend canvas approval failed for event ${eventId}:`,
            approveResult.reason,
            detail,
          )
          // Return false so callers know approval did not succeed canonically.
          return false
        }
        // Backend approval confirmed. Populate local module-state dispatch queue.
        // R9 boundary: populateWarehouseDispatchFromCanvas writes to in-memory module
        // state only. It does NOT persist to backend dispatch tables. Persistent
        // warehouse logistics queue population is backend-driven from the approval
        // event above. This local state is session-only scaffolding until the backend
        // exposes a GET /api/dispatch-queue?eventId= endpoint for the frontend to read.
        const ev = events.find((e) => e.id === eventId)
        const materials = eventMaterials[eventId] || []
        populateWarehouseDispatchFromCanvas(
          eventId,
          ev?.title || design.title,
          materials,
          ev?.venue || 'Grand Ballroom',
          ev?.date || '2026-09-02',
        )
      }
      setDesigns((prev) =>
        prev.map((d) => (d.id === designId ? { ...d, status: 'Active' as DesignStatus } : d)),
      )
      return true
    },
    [designs, selectedEventId, events, eventMaterials],
  )

  const renameDesign = useCallback((id: string, title: string) => {
    setDesigns((prev) => prev.map((d) => (d.id === id ? { ...d, title: title || 'Untitled Design' } : d)))
  }, [])

  const placeElement = useCallback(
    (elementId: string, quantity: number, x: number, y: number) => {
      const el = decor.find((d) => d.id === elementId)
      if (!el) return
      setPlaced((prev) => [...prev, buildPlacedFromElement(el, x, y, quantity)])
    },
    [decor],
  )

  const placeDirect = useCallback(
    (elementId: string, x: number, y: number) => {
      const el = decor.find((d) => d.id === elementId)
      if (!el) return
      setPlaced((prev) => [...prev, buildPlacedFromElement(el, x, y)])
    },
    [decor],
  )

  const addText = useCallback(
    (x: number, y: number, opts?: { text?: string; fontSize?: number; bold?: boolean }) => {
      const id = nextPlacedId()
      setPlaced((prev) => [
        ...prev,
        {
          id,
          kind: 'text',
          x,
          y,
          text: opts?.text ?? 'Double-click to edit',
          fontSize: opts?.fontSize ?? 16,
          bold: opts?.bold,
        },
      ])
      return id
    },
    [],
  )

  const updatePlaced = useCallback((id: string, patch: Partial<PlacedElement>) => {
    setPlaced((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const removePlaced = useCallback((id: string) => {
    setPlaced((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const clearPlaced = useCallback(() => setPlaced([]), [])

  const value = useMemo(
    () => ({
      events,
      designs,
      concepts,
      decor,
      selectedEventId,
      selectedDesignId,
      placed,
      eventDocuments,
      eventMaterials,
      eventChecklist,
      addPortfolio,
      selectEvent,
      selectDesign,
      addDesign,
      renameDesign,
      hasDesignForEvent,
      saveDraft,
      commitDesign,
      approveDesign,
      placeElement,
      placeDirect,
      addText,
      updatePlaced,
      removePlaced,
      clearPlaced,
    }),
    [
      events,
      designs,
      concepts,
      decor,
      selectedEventId,
      selectedDesignId,
      placed,
      eventDocuments,
      eventMaterials,
      eventChecklist,
      addPortfolio,
      selectEvent,
      selectDesign,
      addDesign,
      renameDesign,
      hasDesignForEvent,
      saveDraft,
      commitDesign,
      approveDesign,
      placeElement,
      placeDirect,
      addText,
      updatePlaced,
      removePlaced,
      clearPlaced,
    ],
  )

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner() {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner must be used within a PlannerProvider')
  return ctx
}
