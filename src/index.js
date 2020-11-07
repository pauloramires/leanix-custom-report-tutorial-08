import 'alpinejs'
import '@leanix/reporting'
import './assets/tailwind.css'

const state = {
  pageSizes: [100, 1000, 5000, 15000],
  pageSize: 100,
  endCursor: null,
  totalFactSheetCount: null,
  downloadedFactSheetCount: null,
  completionRatio: null,
  timeToFirstResults: null,
  totalDownloadingTime: null,
  factSheetsPerSecond: null,
  t0: null,
  timer: null
}

const methods = {
  async initializeReport () {
    await lx.init()
    await lx.ready({})
    this.fetchPage()
  },
  reset () {
    this.endCursor = null
    this.totalFactSheetCount = null
    this.downloadedFactSheetCount = null
    this.completionRatio = null
    this.timeToFirstResults = null
    this.totalDownloadingTime = null
    this.factSheetsPerSecond = null
    this.t0 = null
    // stop the timer
    clearInterval(this.timer)
    this.timer = null
  },
  async fetchPage () {
    const { pageSize: first, endCursor: after } = this
    const query = `
      query ($first: Int = 15000, $after: String) {
        allFactSheets(first: $first, after: $after) {
          totalCount
          pageInfo { hasNextPage endCursor }
          edges { node { id } }
        }
      }
    `
    const variables = { first, after }

    const t0 = performance.now()
    const result = await lx.executeGraphQL(query, variables)
    const t1 = performance.now()
    const deltaT = t1 - t0

    if (this.endCursor !== after) return
    if (after === null) {
      this.t0 = t0
      this.timeToFirstResults = Math.round(deltaT) + ' ms'
      // start the timer
      if (this.timer) clearInterval(this.timer)
      this.totalDownloadingTime = this.timeToFirstResults

      this.factSheetsPerSecond = Math.round(this.downloadedFactSheetCount / (deltaT / 1000))
      this.timer = setInterval(() => {
        const deltaT = performance.now() - t0
        this.totalDownloadingTime = Math.round(deltaT) + ' ms'
        this.factSheetsPerSecond = Math.round(this.downloadedFactSheetCount / (deltaT / 1000))
      }, 1000)
    }
    const { allFactSheets: { totalCount, pageInfo: { hasNextPage = false, endCursor }, edges } } = result
    if (hasNextPage === false) {
      // stop the timer
      clearInterval(this.timer)
      this.totalDownloadingTime = Math.round(deltaT) + ' ms'
      this.factSheetsPerSecond = Math.round(this.downloadedFactSheetCount / (deltaT / 1000))
    } else this.endCursor = endCursor
    this.totalFactSheetCount = totalCount
    this.downloadedFactSheetCount += edges.length
    this.completionRatio = Math.round((this.downloadedFactSheetCount / this.totalFactSheetCount) * 100) + '%'
  }
}

window.initializeContext = () => {
  return {
    ...state,
    ...methods
  }
}
