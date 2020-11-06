import 'alpinejs'
import '@leanix/reporting'
import './assets/tailwind.css'

const state = {
  reportSetup: {},
  pageSizes: [100, 500, 1000, 5000, null],
  selectedPageSize: 100,
  totalCount: 0,
  factSheets: [],
  endCursor: null,
  completion: 0,
  loading: false,
  t0: null,
  timeToFirstResults: null,
  timeToLoad: null
}

const methods = {
  async initializeReport () {
    this.reportSetup = await lx.init()
    await lx.ready({})
  },
  async fetchFactSheetPage () {
    const { selectedPageSize: first, endCursor: after } = this
    if (this.endCursor === null) {
      this.t0 = performance.now()
      this.loading = true
    }

    const query = `
      query ($first: Int = 15000, $after: String) {
        allFactSheets(first: $first, after: $after) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              type
            }
          }
        }
      }
    `
    const variables = { first, after }
    const { allFactSheets: { totalCount, pageInfo: { hasNextPage, endCursor }, edges = [] } } = await lx.executeGraphQL(query, variables)

    if (this.selectedPageSize !== first) {
      this.timeToFirstResults = null
      this.timeToLoad = null
      this.endCursor = null
      this.completion = 0
      this.factSheets = []
      return
    }
    if (this.endCursor === null) this.timeToFirstResults = performance.now() - this.t0

    const factSheets = edges.map(({ node }) => node)

    this.totalCount = totalCount

    if (this.endCursor === null) this.factSheets = factSheets
    else this.factSheets.push(...factSheets)
    if (hasNextPage) this.endCursor = endCursor
    else {
      this.timeToLoad = performance.now() - this.t0
      this.loading = false
    }
    this.completion = (this.factSheets.length * 100 / totalCount)
  },
  reset () {
    this.endCursor = null
    this.factSheets = []
    this.completion = 0
    this.timeToFirstResults = null
    this.timeToLoad = null
  }
}

window.initializeContext = () => {
  return {
    ...state,
    ...methods
  }
}
