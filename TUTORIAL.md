# Querying large datasets in LeanIX workspaces
When developing custom reports that deal with large workspaces, i.e. more than 15k factsheets, it becomes necessary to use special client-side techniques for ensuring a good user experience. This tutorial will cover one of those techniques, the data pagination. Data pagination is particularly useful when the custom report requires to access the full set of workspace factsheets for computing workspace statistics or capture correlations between factsheets.
In this tutorial, we'll build a custom report that implements a data pagination technique and give us some performance statistics. More specifically, and given that the LeanIX GraphQL API **allFactSheets** method imposes a maximum limit of 15k edges on each query, we'll study the impact, in terms of fetching time for our complete dataset, when changing the page size of each query.

<div  style="display:flex; justify-content:center">
  <img  src="https://i.imgur.com/eeMxOpC.png">
</div>

The complete source-code for this project can be found [here](https://github.com/pauloramires/leanix-custom-report-tutorial-08).

## Pre-requisites

*  [NodeJS LTS](https://nodejs.org/en/) installed in your computer.

## Getting started

Install the [leanix-reporting-cli](https://github.com/leanix/leanix-reporting-cli) globally via npm:

```bash
npm install -g @leanix/reporting-cli
```

Initialize a new project:

```bash
mkdir leanix-custom-report-tutorial-08
cd leanix-custom-report-tutorial-08
lxr init
npm install
```
Configure your environment by editing the *lxr.json* file, if required:
```json
{
  "host": "app.leanix.net",
  "apitoken": "your-api-token-here"
}
```

After this procedure, you should end up with the following project structure:

<div style="display:flex; justify-content:center">
  <img src="https://i.imgur.com/ITgzJJ5.png">
</div>

## Adjusting the report boilerplate source code

We need to make some modifications in our project's boilerplate code. We start by adding the following dependencies:
```bash
npm install --dev @babel/plugin-transform-runtime postcss-loader tailwindcss
npm install alpinejs
```

 **Note:** During the course of this tutorial, we'll be using the [Alpine JS](https://github.com/alpinejs/alpine) and [Tailwind CSS](https://tailwindcss.com/) libraries.

After installing the dependencies, we modify the *webpack.config.js* file and include the *@babel/plugin-transform-runtime* and the *postcss-loader*, as indicated by the red arrows in the picture below:

<div  style="display:flex; justify-content:center;">
  <img  src="https://i.imgur.com/Vn0ZeWK.png">
</div>

 We then clean up our project source code by deleting the unnecessary files:
-  *src/report.js*
-  *src/fact-sheet-mapper.js*
-  *src/assets/bar.css*
-  *src/assets/main.css*

Next we create a *postcss.config.js* file in the **root** folder of our project, with the following content:
```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer')
  ]
}
```

Additionally we create an *tailwind.css* file in the assets folder with the following content:

```css
/* src/assets/tailwind.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Next you should set the *src/index.html* file with the contents below:
```html
<!-- src/index.html -->
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="application-name" content="leanix-custom-report-tutorial-08">
  <meta name="description" content="Querying paginated data in large workspaces">
  <meta name="author" content="LeanIX GmbH">
  <title>Querying paginated data in large workspaces</title>
  <style>
    [x-cloak] {
      display: none;
    }
  </style>
</head>
<body x-data="initializeContext()" x-init="initializeReport()">
  <div x-cloak class="container mx-auto h-screen">
  </div>
</body>
</html>
```

And finally set the *src/index.js* file content as follows:
```javascript
// src/index.js
import 'alpinejs'
import '@leanix/reporting'
import './assets/tailwind.css'

const state = {
}

const methods = {
  async initializeReport () {
    await lx.init()
    await lx.ready({})
  }
}

window.initializeContext = () => {
  return {
    ...state,
    ...methods
  }
}
```

Your project folder should look now like this:
<div style="display:flex; justify-content:center">
  <img src="https://i.imgur.com/4l9Qjlw.png">
</div>

You may start the development server now by running the following command:
```bash
npm start
```
**Note!**

When you run *npm start*, a local webserver is hosted on *localhost:8080* that allows connections via HTTPS. But since just a development SSL certificate is created the browser might show a warning that the connection is not secure. You could either allow connections to this host anyways or create your self-signed certificate: https://www.tonyerwin.com/2014/09/generating-self-signed-ssl-certificates.html#MacKeyChainAccess.

If you decide to add a security exception to your localhost, make sure you open a second browser tab and point it to https://localhost:8080. Once the security exception is added to your browser, reload the original URL of your development server and open the developer console. You should see a screen similar to the one below:
<div  style="display:flex; justify-content:center">
  <img  src="https://i.imgur.com/Jrn3RXQ.png">
</div>

Now that we have the base structure for our Custom Report, let's continue!

## Implementing the custom report layout
In this section, we'll build our custom report layout. We'll need a selector for allowing the user to set the page size of each query, and placeholders displaying the following statistics: total number of workspace factsheets, number of factsheets downloaded, completion ratio, time to first results, total downloading time, and factsheets per second, as in the example below:

<div  style="display:flex; justify-content:center">
  <img  src="https://svgshare.com/i/RFx.svg">
</div>

### Setting up the template
As a first step, we'll edit the *src/index.html* file and add the template of our report by replacing the existing ``body`` tag content by the content indicated below:

```html
<!-- src/index.html -->
(...)
<body
  x-data="initializeContext()"
  x-init="() => {
    initializeReport()
    // watcher for pageSize variable, triggers reset method
    $watch('pageSize', () => reset())
    // watcher for endCursor variable, triggers fetchPage method
    $watch('endCursor', () => fetchPage())
  }">
  <div  x-cloak  class="h-screen">
    <div  class="max-w-lg grid grid-cols-2 space-y-4">
      <div  class="col-span-2"></div>
      <label>Page size</label>
      <!-- dropdown selector for pageSize -->
      <select  x-model="pageSize">
        <template  x-for="size in pageSizes">
          <option
            :selected="pageSize === size"
            :value="size"
            x-text="size"
            :key="size">
	  </option>
        </template>
      </select>
      <label>Workspace factsheet count:</label>
      <!-- placeholder for totalFactSheetCount -->
      <div  x-text="totalFactSheetCount"></div>
      <label>Downloaded factsheets:</label>
      <!-- placeholder for downloadedFactSheetCount -->
      <div  x-text="downloadedFactSheetCount"></div>
      <label>Completion ratio:</label>
      <!-- placeholder for completionRatio -->
      <div  x-text="completionRatio"></div>
      <label>Time to first results:</label>
      <!-- placeholder for timeToFirstResults -->
      <div  x-text="timeToFirstResults"></div>
      <label>Total downloading time:</label>
      <!-- placeholder for totalDownloadingTime -->
      <div  x-text="totalDownloadingTime"></div>
      <label>Factsheets per second:</label>
      <!-- placeholder for factSheetsPerSecond -->
      <div  x-text="factSheetsPerSecond"></div>
    </div>
  </div>
</body>
(...)
```
Notice that we've added on the **x-init** directive of our **body** tag two watchers for the **pageSize** and **endCursor** variables that trigger, respectively, the **reset** and **fetchPage** methods to be defined ahead.

### Adding the state variables
We proceed by editing the *src/index.js* file and add the following state variables:

```javascript
// src/index.js
const state = {
  // page size options for the dropdown selector
  pageSizes: [100, 500, 1000, 15000],
  // variable that holds the selected page size option
  pageSize: 100,
  // holds the last cursor value for the downloaded page
  endCursor: null,
  // holds the total workspace factsheet cuont
  totalFactSheetCount: null,
  // holds the downloaded factsheet count
  downloadedFactSheetCount: null,
  // holds the completion ratio, i.e. (downloadedFactSheetCount / totalFactSheetCount) * 100
  completionRatio: null,
  // holds the time to first results, in miliseconds
  timeToFirstResults: null,
  // holds the total download time, in miliseconds
  totalDownloadingTime: null,
  // holds the factSheetPerSecond statistic
  factSheetsPerSecond: null,
  // holds the time reference t0, download start
  t0: null,
  // holds the timer that will trigger the update of totalDownloadingTime every 1 second
  timer: null
}
(...)
```

### Implementing the reset method
As we've noticed before, we've implemented a couple of watchers in our body tag. One of them triggers a **reset** method on every update of the **pageSize** variable. This variable changes every time the user selects the value of the dropdown input. Therefore we will want to reset the whole state of our data fetching process to its default values, including statistics, every time it happens.
So, again, let's edit our *src/index.js* and add the **reset** method to the **methods** object, right below the **initializeReport** method already defined.

```javascript
// src/index.js
(...)
const  methods = {
  async initializeReport () {
    (...)
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
  }
}
```

### Implementing the fetchPage method
Next, we'll deal with the implementation of the **fetchPage** method. This method is triggered after every change of the **endCursor** variable and is responsible for fetching the next batch of factSheets given the **pageSize** value provided by the user. If you need further details of the LeanIX GraphQL API pagination feature, please check out this [article](https://dev.leanix.net/docs/graphql-basics#section-paging) first.
So, and again, let's edit our **src/index.js** file and add the **fetchPage** method right below our **reset** method:

```javascript
// src/index.js
(...)
const  methods = {
  async initializeReport () {
    (...)
  },
  reset () {
    (...)
  },
  async  fetchPage () {
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
    const deltaT = t1 - this.t0
    // if the user changed the pageSize while the query was being fetched from the server, and a reset was performed to the state, then discard the results of the query
    if (this.endCursor !== after) return
    // if this is the first page of our dataset (endCursor still null)
    if (after === null) {
      // save t0 into our state variable
      this.t0 = t0
      // compute the timeToFirst results, in miliseconds
      this.timeToFirstResults = Math.round(deltaT) + ' ms'
      // start the timer
      if (this.timer) clearInterval(this.timer)
      // set the first value of totalDownloadingTime and factSheetsPerSecond
      this.totalDownloadingTime = this.timeToFirstResults
      this.factSheetsPerSecond = Math.round(this.downloadedFactSheetCount / (deltaT / 1000))
      // and update them every second
      this.timer = setInterval(() => {
	const deltaT = performance.now() - t0
        this.totalDownloadingTime = Math.round(deltaT) + ' ms'
        this.factSheetsPerSecond = Math.round(this.downloadedFactSheetCount / (deltaT / 1000))
      }, 1000)
    }
    // we destructure the query response object into totalCount, hasNextPage, endCursor and edges variables
    const { allFactSheets: { totalCount, pageInfo: { hasNextPage = false, endCursor }, edges } } = result
    // if we just fetched the last page of our dataset then...
    if (hasNextPage === false) {
      // stop the timer
      clearInterval(this.timer)
      // update the final totalDownloadingTime and factSheetsPerSecond values accordingly
      this.totalDownloadingTime = Math.round(deltaT) + ' ms'
      this.factSheetsPerSecond = Math.round(this.downloadedFactSheetCount / (deltaT / 1000))
    } else  this.endCursor = endCursor // else, just update our endCursor
    this.totalFactSheetCount = totalCount
    // update the downloadedFactSheetCount value
    this.downloadedFactSheetCount += edges.length
    // update the completion ratio
    this.completionRatio = Math.round((this.downloadedFactSheetCount / this.totalFactSheetCount) * 100) + '%'
  }
}
```

Notice, again, that the **fetchPage** method is triggered automatically every time the **endCursor** variable changes, due to the watcher we set on the **x-init** directive of the **body** tag in our html template. On the other hand, the **endCursor** variable is updated exclusively by the **fetchPage** method if there are more pages to be fetched in our dataset. Therefore we need to call the **fetchPage** manually, somewhere, to fetch the first page of our dataset. We do it by changing our **initializeReport** method as follows:

```javascript
// src/index.js
(...)
const  methods = {
  async initializeReport () {
    await lx.init()
    await lx.ready({})
    // fetches the first page of our dataset upon report initialization
    this.fetchPage()
  },
  reset () {
    (...)
  },
  async fetchPage () {
    (...)
  }
}
```

### Styling our layout
Finally, we add some style to our layout. Edit the **body** tag of our *src/index.html* file as follows:

```html
<!-- src/index.html -->
<body
  x-data="initializeContext()"
  x-init="() => {
    initializeReport()
    // watcher for pageSize variable, triggers reset method
    $watch('pageSize', () => reset())
    // watcher for endCursor variable, triggers fetchPage method
    $watch('endCursor', () => fetchPage())
  }">
  <div  x-cloak  class="h-screen text-base flex flex-col items-center justify-center">
    <div  class="flex flex-col items-center mb-10">
      <div  class="text-4xl font-semibold">LeanIX Tutorial</div>
      <div  class="text-2xl font-light">Querying paginated data in large workspaces</div>
    </div>
    <div  class="w-full max-w-lg grid grid-cols-2 space-y-4 space-x-8 rounded p-4 bg-gray-100 shadow">
      <div  class="col-span-2"></div>
      <label  class="text-2xl font-semibold">Page size</label>
      <div  class="relative">
        <select
          x-model.number="pageSize"
          class="block appearance-none w-full bg-white border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500">
          <template  x-for="size in pageSizes">
            <option
              :selected="pageSize === size"
              :value="size"
              x-text="size"
              :key="size">
            </option>
          </template>
        </select>
        <div  class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg  class="fill-current h-4 w-4"  xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 20 20"><path  d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>
      <div  class="col-span-2 border-t"></div>
      <label  class="font-semibold">Workspace factsheet count:</label>
      <div  x-text="totalFactSheetCount"></div>
      <label  class="font-semibold">Downloaded factsheets:</label>
      <div  x-text="downloadedFactSheetCount"></div>
      <label  class="font-semibold">Completion ratio:</label>
      <div  x-text="completionRatio"></div>
      <label  class="font-semibold">Time to first results:</label>
      <div  x-text="timeToFirstResults"></div>
      <label  class="font-semibold">Total downloading time:</label>
      <div  x-text="totalDownloadingTime"></div>
      <label  class="font-semibold">Factsheets per second:</label>
      <div  x-text="factSheetsPerSecond"></div>
    </div>
  </div>
</body>
```


Now that we have all the pieces of our custom report in place, let's start it by running again the **start** command:
```bash
npm start
```
You should be getting now an output like the picture below, and see the progress of all statistics while the data is being fetched. If that's the case, then congratulations. If not, then check your developer console for eventual errors and double-check your source code.
<div  style="display:flex; justify-content:center">
  <img  src="https://i.imgur.com/eeMxOpC.png">
</div>


## Analysing the impact of page size vs download times
While changing the page size, observe the different metrics show. More specifically, notice the impact that it has on all different metrics shown. Keep in mind that, currently, the LeanIX GraphQL API has a maximum page size of 15k edges for each query. You’ll realize that, on average, the higher the page size the quicker it is to fetch a large dataset, at the expense of a higher time to first result. This is an important factor to take into account when thinking about your Custom Report UX, more specifically the [Time to Interactive metric](https://web.dev/interactive/), i.e., how much does it take to make your report fully interactive. Therefore, and depending on the size of your workspace and custom report use case, an adaptive pagination algorithm that yields a small time to first results while minimizing the total download time would be an interesting feature for enhancing your Custom Report's UX.

That's it for this tutorial! Congratulations for your work and thank you for your time.