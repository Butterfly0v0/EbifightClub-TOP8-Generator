const url = 'https://parry.gg/batteries-not-included-v-019d45f2/melee-singles/_standings'
const html = await fetch(url).then((r) => r.text())
const ctx = JSON.parse(html.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)[1])
const key = 'routes/_open-layout.$tournament-slug.$event-slug.[_]standings'
const d = ctx.state.loaderData[key]
console.log('results count', d.results.length)
console.log('result0', JSON.stringify(d.results[0], null, 2).slice(0, 3500))
console.log('breadcrumb', JSON.stringify(d.breadcrumbHierarchy, null, 2).slice(0, 1500))
