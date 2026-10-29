import { defineStore } from 'pinia'
import { deleteStoredFile, listStoredFiles, readStoredFile, storeFiles } from './browser-file-storage'
import { computed, ref } from 'vue'
import { decodeReport, estimateContract, parseMt5Report, type Mt5Position, type Mt5Report } from '../api/mt5-report-parser'
import type { Deal } from '../api/types'
import { notionalFrom, type AccountDeal } from '../utils/stats'

export interface ReportFile {
  name: string
  size: number
  mtime: string
  /** Kết quả đọc file; null khi lỗi */
  report: Mt5Report | null
  error?: string
}

/** Tài khoản MT5 gộp từ một hoặc nhiều file báo cáo cùng số tài khoản. */
export interface Mt5Account {
  id: string
  login: string
  label: string
  currency: string
  server?: string
  files: string[]
  /** Báo cáo mới nhất — dùng cho balance/equity */
  latest: Mt5Report
  deals: AccountDeal[]
  /** Vị thế đã đóng (bảng Positions), gộp theo id — dùng cho tab Biểu đồ */
  positions: Mt5Position[]
  /** Số dư trước deal sớm nhất (lấy từ file có deal sớm nhất) */
  openingBalance: number
  firstDealTime?: string
  lastDealTime?: string
}

/** Số dư đầu của tài khoản = openingBalance của file có deal sớm nhất */
function openingOf(reports: Mt5Report[]): number {
  const first = [...reports]
    .filter((r) => r.deals.length)
    .sort((a, b) => a.deals[0].create_time.localeCompare(b.deals[0].create_time))[0]
  return first?.openingBalance ?? 0
}

export const REPORT_ACCOUNT_PREFIX = 'mt5:'

function notional(d: Deal, currency: string): number | null {
  return d.instrument ? notionalFrom(d, estimateContract(d.instrument), currency) : null
}

/**
 * Báo cáo MT5: chạy `npm run dev` → đọc app/reports/ qua dev server;
 * bản deploy tĩnh (Vercel) → file người dùng nạp trên trình duyệt (IndexedDB, chỉ ở máy này).
 */
export const useReportsStore = defineStore('reports', () => {
  const files = ref<ReportFile[]>([])
  const dir = ref('reports')
  const state = ref<'idle' | 'loading' | 'ok' | 'unavailable'>('idle')
  /** Nguồn dữ liệu: dev server (thư mục app/reports) hay trình duyệt (file đã nạp) */
  const source = ref<'server' | 'browser'>('server')
  const parseFile = async (meta: { name: string; size: number; mtime: string }, read: () => Promise<ArrayBuffer>): Promise<ReportFile> => {
    try {
      return { ...meta, report: parseMt5Report(decodeReport(await read())) }
    } catch (e) {
      return { ...meta, report: null, error: e instanceof Error ? e.message : String(e) }
    }
  }
  async function loadFromBrowser() {
    source.value = 'browser'
    dir.value = 'trình duyệt'
    try {
      const metas = await listStoredFiles('report')
      files.value = await Promise.all(metas.map((m) => parseFile(m, () => readStoredFile('report', m.name))))
      state.value = 'ok'
    } catch {
      files.value = []
      state.value = 'unavailable'
    }
  }
  /** Nạp file báo cáo (.html) vào trình duyệt — chỉ dùng khi không có dev server */
  async function importFiles(list: File[]) {
    await storeFiles('report', list.filter((f) => /\.html?$/i.test(f.name)))
    await loadFromBrowser()
  }
  async function removeFile(name: string) {
    await deleteStoredFile('report', name)
    await loadFromBrowser()
  }

  async function load() {
    state.value = 'loading'
    try {
      const res = await fetch('/__mt5-reports/list', { cache: 'no-store' })
      if (!(res.headers.get('content-type') ?? '').includes('json')) return loadFromBrowser() // không chạy npm run dev
      source.value = 'server'
      const list = (await res.json()) as { dir: string; files: { name: string; size: number; mtime: string }[] }
      dir.value = list.dir
      files.value = await Promise.all(
        list.files.map(async (f): Promise<ReportFile> => {
          try {
            const r = await fetch(`/__mt5-reports/file/${encodeURIComponent(f.name)}`, { cache: 'no-store' })
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return { ...f, report: parseMt5Report(decodeReport(await r.arrayBuffer())) }
          } catch (e) {
            return { ...f, report: null, error: e instanceof Error ? e.message : String(e) }
          }
        }),
      )
      state.value = 'ok'
    } catch {
      await loadFromBrowser()
    }
  }

  /** Gộp các file cùng số tài khoản; deal trùng ticket chỉ tính một lần. */
  const accounts = computed<Mt5Account[]>(() => {
    const byLogin = new Map<string, ReportFile[]>()
    for (const f of files.value) {
      if (!f.report) continue
      const list = byLogin.get(f.report.login) ?? []
      list.push(f)
      byLogin.set(f.report.login, list)
    }
    return [...byLogin.entries()].map(([login, list]) => {
      const sorted = [...list].sort((a, b) =>
        (a.report!.reportTime ?? a.mtime).localeCompare(b.report!.reportTime ?? b.mtime),
      )
      const latest = sorted[sorted.length - 1].report!
      const id = `${REPORT_ACCOUNT_PREFIX}${login}`
      const map = new Map<string, AccountDeal>()
      for (const f of sorted) {
        for (const deal of f.report!.deals) {
          map.set(deal.deal_id, { accountKey: id, accountId: login, currency: latest.currency, deal, notional: notional(deal, latest.currency) })
        }
      }
      const deals = [...map.values()]
      const posMap = new Map<string, Mt5Position>()
      for (const f of sorted) for (const p of f.report!.positions) posMap.set(p.id, p)
      const times = deals.map((d) => d.deal.create_time).sort()
      return {
        id,
        login,
        // "Name:" trong báo cáo, ví dụ "MF_01 240826"
        label: latest.name || `#${login}`,
        currency: latest.currency,
        server: latest.server,
        files: sorted.map((f) => f.name),
        latest,
        deals,
        positions: [...posMap.values()],
        openingBalance: openingOf(sorted.map((f) => f.report!)),
        firstDealTime: times[0],
        lastDealTime: times[times.length - 1],
      }
    })
  })

  const byId = (id: string) => accounts.value.find((a) => a.id === id)

  return { files, dir, state, source, accounts, load, byId, importFiles, removeFile }
})
