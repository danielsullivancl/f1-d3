const svg = d3.select("#map")
const calendarSvg = d3.select("#calendarChart")

const slider = document.getElementById("slider")
const label = document.getElementById("label")
const playBtn = document.getElementById("playBtn")
const yearSelect = document.getElementById("yearSelect")
const clearFilterBtn = document.getElementById("clearFilterBtn")
const filterStatus = document.getElementById("filterStatus")

const projection = d3.geoNaturalEarth1()
  .scale(150)
  .translate([450, 250])

const path = d3.geoPath().projection(projection)

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")

let dataGlobal = []
let currentYear = null
let currentRound = null
let selectedContinent = null
let playing = false
let interval = null

const countryToContinent = {
  "UK": "Europe",
  "United Kingdom": "Europe",
  "Italy": "Europe",
  "Spain": "Europe",
  "France": "Europe",
  "Germany": "Europe",
  "Monaco": "Europe",
  "Belgium": "Europe",
  "Hungary": "Europe",
  "Austria": "Europe",
  "Netherlands": "Europe",
  "Portugal": "Europe",
  "Sweden": "Europe",
  "Russia": "Europe",
  "Switzerland": "Europe",

  "USA": "North America",
  "United States": "North America",
  "Canada": "North America",
  "Mexico": "North America",

  "Brazil": "South America",
  "Argentina": "South America",

  "Japan": "Asia",
  "China": "Asia",
  "Singapore": "Asia",
  "UAE": "Asia",
  "United Arab Emirates": "Asia",
  "Bahrain": "Asia",
  "Saudi Arabia": "Asia",
  "Qatar": "Asia",
  "Azerbaijan": "Asia",
  "Turkey": "Asia",
  "India": "Asia",
  "Korea": "Asia",
  "Malaysia": "Asia",

  "Australia": "Oceania",

  "South Africa": "Africa",
  "Morocco": "Africa"
}

// =====================================================
// 1. FUNÇÕES AUXILIARES
// =====================================================

function showTooltip(event, html) {
  tooltip
    .style("opacity", 1)
    .html(html)
    .style("left", (event.pageX + 12) + "px")
    .style("top", (event.pageY - 22) + "px")
}

function moveTooltip(event) {
  tooltip
    .style("left", (event.pageX + 12) + "px")
    .style("top", (event.pageY - 22) + "px")
}

function hideTooltip() {
  tooltip.style("opacity", 0)
}

function haversine(a, b) {
  const R = 6371

  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) *
    Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function formatKm(value) {
  return `${Math.round(value).toLocaleString("pt-BR")} km`
}

function filteredByContinent(data) {
  if (!selectedContinent) return data
  return data.filter(d => d.continent === selectedContinent)
}

function updateFilterStatus() {
  filterStatus.innerText = selectedContinent
    ? `Filtro: ${selectedContinent}. Clique em outro continente ou limpe o filtro.`
    : "Filtro: todos os continentes"
}

function stopAnimation() {
  if (interval) clearInterval(interval)

  playing = false
  playBtn.innerText = "▶"
}

function refreshAllVisualizations() {
  updateFilterStatus()
  updateMap(currentYear, currentRound)
  updateCalendar(currentYear, currentRound)
  updateDistanceChart()
  updateCountriesChart()
  updateContinentChart()
  updateDonutChart()
  updateStackedAreaChart()
}

function selectLastRaceOfYear(year) {
  const index = dataGlobal
    .map((item, idx) => ({ item, idx }))
    .filter(x => x.item.year === year)
    .pop().idx

  slider.value = index
  stopAnimation()
  update(index)
}

function toggleContinent(continent) {
  selectedContinent = selectedContinent === continent ? null : continent

  stopAnimation()
  refreshAllVisualizations()
}

// =====================================================
// 2. CARREGAMENTO E PREPARAÇÃO DOS DADOS
// =====================================================

Promise.all([
  d3.json("data/world.json"),
  d3.csv("data/circuits.csv"),
  d3.csv("data/races.csv")
]).then(([world, circuits, races]) => {

  prepareNumericFields(circuits, races)
  drawBaseMap(world)

  dataGlobal = createUnifiedDataset(circuits, races)

  populateYearSelect(dataGlobal)
  configureSlider(dataGlobal)
  configureEvents()

  update(0)
})

function prepareNumericFields(circuits, races) {
  circuits.forEach(d => {
    d.lat = +d.lat
    d.lng = +d.lng
  })

  races.forEach(d => {
    d.year = +d.year
    d.round = +d.round
  })
}

function createUnifiedDataset(circuits, races) {
  return races
    .map(race => {
      const circuit = circuits.find(c => c.circuitId === race.circuitId)
      const continent = circuit ? countryToContinent[circuit.country] : null

      if (circuit && !continent) {
        console.log("País sem continente:", circuit.country)
      }

      return {
        year: race.year,
        round: race.round,
        raceName: race.name,
        date: race.date,
        lat: circuit ? circuit.lat : null,
        lng: circuit ? circuit.lng : null,
        country: circuit ? circuit.country : null,
        circuitName: circuit ? circuit.name : null,
        continent: continent || "Unknown"
      }
    })
    .filter(d => d.lat && d.lng)
    .sort((a, b) => a.year - b.year || a.round - b.round)
}

function populateYearSelect(data) {
  const years = [...new Set(data.map(d => d.year))]

  years.forEach(year => {
    const option = document.createElement("option")
    option.value = year
    option.text = year
    yearSelect.appendChild(option)
  })
}

function configureSlider(data) {
  slider.min = 0
  slider.max = data.length - 1
  slider.value = 0
}

// =====================================================
// 3. FUNÇÃO CENTRAL DE ATUALIZAÇÃO
// =====================================================

function update(index) {
  const selectedRace = dataGlobal[index]

  currentYear = selectedRace.year
  currentRound = selectedRace.round

  yearSelect.value = currentYear
  label.innerText = `${currentYear} - Round ${currentRound}`

  refreshAllVisualizations()
}

// =====================================================
// 4. MAPA
// =====================================================

function drawBaseMap(world) {
  const countries = topojson.feature(world, world.objects.countries)

  svg.append("g")
    .selectAll("path")
    .data(countries.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", "#1e293b")
    .attr("stroke", "#334155")
}

function updateMap(year, round) {
  const seasonUntilCurrentRound = dataGlobal.filter(d =>
    d.year === year && d.round <= round
  )

  const seasonData = filteredByContinent(seasonUntilCurrentRound)

  svg.selectAll("circle.race-point").remove()
  svg.selectAll(".rota").remove()

  drawSeasonRoutes(seasonData)
  drawRacePoints(seasonData, round)
}

function drawSeasonRoutes(seasonData) {
  for (let i = 1; i < seasonData.length; i++) {
    const previousRace = seasonData[i - 1]
    const currentRace = seasonData[i]

    const p1 = projection([previousRace.lng, previousRace.lat])
    const p2 = projection([currentRace.lng, currentRace.lat])

    const midX = (p1[0] + p2[0]) / 2
    const midY = (p1[1] + p2[1]) / 2 - 60

    const curve = `
      M ${p1[0]} ${p1[1]}
      Q ${midX} ${midY}
        ${p2[0]} ${p2[1]}
    `

    svg.append("path")
      .attr("class", "rota")
      .attr("d", curve)
      .attr("fill", "none")
      .attr("stroke", "#facc15")
      .attr("stroke-width", 2.5)
      .attr("stroke-opacity", 0.85)
  }
}

function drawRacePoints(seasonData, round) {
  svg.selectAll("circle.race-point")
    .data(seasonData)
    .enter()
    .append("circle")
    .attr("class", "race-point")
    .attr("cx", d => projection([d.lng, d.lat])[0])
    .attr("cy", d => projection([d.lng, d.lat])[1])
    .attr("r", d => d.round === round ? 7 : 4.5)
    .attr("fill", d => d.round === round ? "#facc15" : "#ef4444")
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      showTooltip(event, `
        <b>${d.raceName || "Corrida"}</b><br>
        Circuito: ${d.circuitName || "-"}<br>
        País: ${d.country}<br>
        Continente: ${d.continent}<br>
        Ano: ${d.year}<br>
        Round: ${d.round}
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)
}

// =====================================================
// 5. CALENDÁRIO
// =====================================================

function updateCalendar(year, round) {
  calendarSvg.selectAll("*").remove()

  const racesUntilRound = filteredByContinent(dataGlobal).filter(d =>
    d.year === year && d.round <= round
  )

  const cellSize = 12
  const parseDate = d3.timeParse("%Y-%m-%d")

  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)
  const days = d3.timeDays(start, d3.timeDay.offset(end, 1))

  const raceByDay = new Map()

  racesUntilRound.forEach(d => {
    if (d.date) {
      const date = parseDate(d.date)

      if (date) {
        raceByDay.set(date.toDateString(), d)
      }
    }
  })

  const g = calendarSvg.append("g")
    .attr("transform", "translate(40,20)")

  g.selectAll("rect")
    .data(days)
    .enter()
    .append("rect")
    .attr("x", d => d3.timeWeek.count(start, d) * cellSize)
    .attr("y", d => d.getDay() * cellSize)
    .attr("width", cellSize - 2)
    .attr("height", cellSize - 2)
    .attr("rx", 2)
    .attr("fill", d => raceByDay.get(d.toDateString()) ? "#f87171" : "#0f172a")
    .attr("stroke", "#1e293b")
    .on("mouseover", (event, d) => {
      const race = raceByDay.get(d.toDateString())

      showTooltip(event, `
        ${d3.timeFormat("%d/%m/%Y")(d)}<br>
        ${
          race
            ? `<b>${race.raceName}</b><br>${race.country} · Round ${race.round}`
            : "Sem corrida"
        }
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  drawCalendarMonths(g, start, end, cellSize)
  drawCalendarWeekdays(g, cellSize)
}

function drawCalendarMonths(g, start, end, cellSize) {
  const months = d3.timeMonths(start, end)

  g.selectAll(".month")
    .data(months)
    .enter()
    .append("text")
    .attr("x", d => d3.timeWeek.count(start, d) * cellSize)
    .attr("y", -5)
    .attr("fill", "#94a3b8")
    .attr("font-size", "10px")
    .text(d => d3.timeFormat("%b")(d))
}

function drawCalendarWeekdays(g, cellSize) {
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  g.selectAll(".day-label")
    .data(weekdays)
    .enter()
    .append("text")
    .attr("x", -10)
    .attr("y", (d, i) => i * cellSize + 10)
    .attr("text-anchor", "end")
    .attr("fill", "#94a3b8")
    .attr("font-size", "10px")
    .text(d => d)
}

// =====================================================
// 6. GRÁFICO DE DISTÂNCIA TOTAL POR TEMPORADA
// =====================================================

function updateDistanceChart() {
  const svgLine = d3.select("#lineChart")
  svgLine.selectAll("*").remove()

  const chartData = filteredByContinent(dataGlobal)
  const grouped = d3.group(chartData, d => d.year)

  const data = []

  grouped.forEach((races, year) => {
    let total = 0
    const orderedRaces = races.slice().sort((a, b) => a.round - b.round)

    for (let i = 1; i < orderedRaces.length; i++) {
      total += haversine(orderedRaces[i - 1], orderedRaces[i])
    }

    data.push({ year, total })
  })

  data.sort((a, b) => a.year - b.year)

  const x = d3.scaleLinear()
    .domain(d3.extent(dataGlobal, d => d.year))
    .range([60, 420])

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.total) || 1])
    .nice()
    .range([200, 25])

  svgLine.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 2)
    .attr("d", d3.line()
      .defined(d => d.total !== undefined)
      .x(d => x(d.year))
      .y(d => y(d.total))
    )

  addClickableYearPoints(svgLine, data, x, y, "total", d => `
    <b>${d.year}</b><br>
    Distância aproximada: ${formatKm(d.total)}<br>
    Clique para selecionar este ano.
  `)

  const currentData = data.find(d => d.year === currentYear)

  if (currentData) {
    svgLine.append("circle")
      .attr("cx", x(currentData.year))
      .attr("cy", y(currentData.total))
      .attr("r", 6)
      .attr("fill", "#ef4444")
      .attr("stroke", "white")
      .on("mouseover", event => {
        showTooltip(event, `
          Ano: ${currentData.year}<br>
          Distância: ${formatKm(currentData.total)}
        `)
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", hideTooltip)
  }

  svgLine.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0,200)")
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")))

  svgLine.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(60,0)")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${Math.round(d / 1000)}k`))

  svgLine.append("text")
    .attr("x", 240)
    .attr("y", 14)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("font-size", "14px")
    .text(selectedContinent
      ? `Distância entre corridas em ${selectedContinent}`
      : "Distância total por temporada")
}

// =====================================================
// 7. GRÁFICO DE PAÍSES POR TEMPORADA
// =====================================================

function updateCountriesChart() {
  const svgCountries = d3.select("#countriesChart")
  svgCountries.selectAll("*").remove()

  const chartData = filteredByContinent(dataGlobal)

  const grouped = d3.rollup(
    chartData,
    races => new Set(races.map(d => d.country)).size,
    d => d.year
  )

  const data = Array.from(grouped, ([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year)

  const x = d3.scaleLinear()
    .domain(d3.extent(dataGlobal, d => d.year))
    .range([60, 420])

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count) || 1])
    .nice()
    .range([200, 25])

  svgCountries.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 2)
    .attr("d", d3.line()
      .x(d => x(d.year))
      .y(d => y(d.count))
    )

  addClickableYearPoints(svgCountries, data, x, y, "count", d => `
    <b>${d.year}</b><br>
    Países: ${d.count}<br>
    Clique para selecionar este ano.
  `)

  const currentData = data.find(d => d.year === currentYear)

  if (currentData) {
    svgCountries.append("circle")
      .attr("cx", x(currentData.year))
      .attr("cy", y(currentData.count))
      .attr("r", 6)
      .attr("fill", "#ef4444")
      .attr("stroke", "white")
      .on("mouseover", event => {
        showTooltip(event, `
          Ano: ${currentData.year}<br>
          Países: ${currentData.count}
        `)
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", hideTooltip)
  }

  svgCountries.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0,200)")
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")))

  svgCountries.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(60,0)")
    .call(d3.axisLeft(y).ticks(5))

  svgCountries.append("text")
    .attr("x", 240)
    .attr("y", 14)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("font-size", "14px")
    .text(selectedContinent
      ? `Países visitados em ${selectedContinent}`
      : "Número de países por temporada")
}

function addClickableYearPoints(svgElement, data, x, y, valueKey, tooltipContent) {
  svgElement.selectAll(".hit-year")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "hit-year clickable")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d[valueKey]))
    .attr("r", 9)
    .attr("fill", "transparent")
    .on("click", (event, d) => {
      selectLastRaceOfYear(d.year)
    })
    .on("mouseover", (event, d) => {
      showTooltip(event, tooltipContent(d))
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)
}

// =====================================================
// 8. GRÁFICO DE BARRAS POR CONTINENTE
// =====================================================

function updateContinentChart() {
  const svgContinent = d3.select("#continentChart")
  svgContinent.selectAll("*").remove()

  const dataCurrentYear = dataGlobal.filter(d => d.year === currentYear)

  const counts = d3.rollup(
    dataCurrentYear,
    races => races.length,
    d => d.continent
  )

  const data = Array.from(counts, ([continent, count]) => ({ continent, count }))
    .filter(d => d.continent !== "Unknown")
    .sort((a, b) => b.count - a.count)

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count) || 1])
    .range([120, 420])

  const y = d3.scaleBand()
    .domain(data.map(d => d.continent))
    .range([30, 200])
    .padding(0.25)

  const color = d3.scaleSequential()
    .domain([0, d3.max(data, d => d.count) || 1])
    .interpolator(t => d3.interpolateReds(0.35 + 0.65 * t))

  svgContinent.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", d => `clickable ${selectedContinent === d.continent ? "selected-bar" : ""}`)
    .attr("x", 120)
    .attr("y", d => y(d.continent))
    .attr("width", d => x(d.count) - 120)
    .attr("height", y.bandwidth())
    .attr("fill", d =>
      selectedContinent && selectedContinent !== d.continent
        ? "#475569"
        : color(d.count)
    )
    .attr("opacity", d =>
      selectedContinent && selectedContinent !== d.continent
        ? 0.55
        : 1
    )
    .on("click", (event, d) => {
      toggleContinent(d.continent)
    })
    .on("mouseover", (event, d) => {
      showTooltip(event, `
        <b>${d.continent}</b><br>
        ${d.count} corridas em ${currentYear}<br>
        Clique para filtrar os demais gráficos.
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  svgContinent.selectAll(".value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", d => x(d.count) + 5)
    .attr("y", d => y(d.continent) + y.bandwidth() / 2 + 4)
    .attr("fill", "white")
    .attr("font-size", "11px")
    .text(d => d.count)

  svgContinent.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(120,0)")
    .call(d3.axisLeft(y))

  svgContinent.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0,200)")
    .call(d3.axisBottom(x).ticks(5))

  svgContinent.append("text")
    .attr("x", 240)
    .attr("y", 14)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("font-size", "14px")
    .text("Corridas por continente")
}

// =====================================================
// 9. DONUT CHART
// =====================================================

function updateDonutChart() {
  const svgDonut = d3.select("#donutChart")
  svgDonut.selectAll("*").remove()

  const dataCurrentYear = dataGlobal.filter(d => d.year === currentYear)

  const counts = d3.rollup(
    dataCurrentYear,
    races => races.length,
    d => d.continent
  )

  const data = Array.from(counts, ([continent, count]) => ({
    continent,
    count
  })).filter(d => d.continent !== "Unknown")

  const width = 420
  const radius = 95

  const color = d3.scaleOrdinal()
    .domain(data.map(d => d.continent))
    .range([
      "#ef4444",
      "#f97316",
      "#eab308",
      "#22c55e",
      "#3b82f6",
      "#a855f7"
    ])

  const g = svgDonut.append("g")
    .attr("transform", "translate(155,170)")

  const pie = d3.pie()
    .value(d => d.count)

  const arc = d3.arc()
    .innerRadius(50)
    .outerRadius(radius)

  g.selectAll("path")
    .data(pie(data))
    .enter()
    .append("path")
    .attr("class", d => `clickable ${selectedContinent === d.data.continent ? "selected-bar" : ""}`)
    .attr("d", arc)
    .attr("fill", d => {
      if (selectedContinent && selectedContinent !== d.data.continent) {
        return "#475569"
      }

      return color(d.data.continent)
    })
    .attr("opacity", d => {
      if (selectedContinent && selectedContinent !== d.data.continent) {
        return 0.4
      }

      return 1
    })
    .attr("stroke", "#020617")
    .attr("stroke-width", 2)
    .on("click", (event, d) => {
      toggleContinent(d.data.continent)
    })
    .on("mouseover", (event, d) => {
      const total = d3.sum(data, x => x.count)
      const percentage = ((d.data.count / total) * 100).toFixed(1)

      showTooltip(event, `
        <b>${d.data.continent}</b><br>
        ${d.data.count} corridas<br>
        ${percentage}% da temporada
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  drawDonutLegend(svgDonut, data, color)

  svgDonut.append("text")
    .attr("x", width / 2)
    .attr("y", 24)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("font-size", "15px")
    .text(`Distribuição continental da F1 em ${currentYear}`)
}

function drawDonutLegend(svgDonut, data, color) {
  const legend = svgDonut.append("g")
    .attr("transform", "translate(285,95)")

  data.forEach((d, i) => {
    const item = legend.append("g")
      .attr("transform", `translate(0, ${i * 28})`)
      .attr("class", "clickable")
      .on("click", () => {
        toggleContinent(d.continent)
      })

    item.append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("fill", color(d.continent))

    item.append("text")
      .attr("x", 24)
      .attr("y", 13)
      .attr("fill", "white")
      .attr("font-size", "12px")
      .text(`${d.continent} (${d.count})`)
  })
}

// =====================================================
// 10. ÁREA EMPILHADA
// =====================================================

function updateStackedAreaChart() {
  const svgArea = d3.select("#stackedAreaChart")
  svgArea.selectAll("*").remove()

  const margin = {
    top: 40,
    right: 160,
    bottom: 50,
    left: 70
  }

  const width = 920 - margin.left - margin.right
  const height = 420 - margin.top - margin.bottom

  const g = svgArea.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  const continents = [
    "Europe",
    "North America",
    "South America",
    "Asia",
    "Oceania",
    "Africa"
  ]

  const formattedData = prepareStackedAreaData(continents)

  const stack = d3.stack()
    .keys(continents)
    .offset(d3.stackOffsetExpand)

  const stackedData = stack(formattedData)

  const x = d3.scaleLinear()
    .domain(d3.extent(formattedData, d => d.year))
    .range([0, width])

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([height, 0])

  const color = d3.scaleOrdinal()
    .domain(continents)
    .range([
      "#c1121f",
      "#003049",
      "#669bbc",
      "#588157",
      "#dda15e",
      "#6a4c93"
    ])

  const area = d3.area()
    .x(d => x(d.data.year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveMonotoneX)

  g.selectAll(".layer")
    .data(stackedData)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", d => color(d.key))
    .attr("d", area)
    .attr("opacity", d => {
      if (selectedContinent && selectedContinent !== d.key) {
        return 0.25
      }

      return 1
    })
    .on("mouseover", (event, d) => {
      const year = Math.round(x.invert(d3.pointer(event)[0]))
      const yearData = formattedData.find(x => x.year === year)

      if (!yearData) return

      const total = continents.reduce((acc, c) => acc + yearData[c], 0)
      const count = yearData[d.key]
      const percentage = ((count / total) * 100).toFixed(1)

      showTooltip(event, `
        <b>${d.key}</b><br>
        Ano: ${year}<br>
        Corridas: ${count}<br>
        Proporção: ${percentage}%
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)
    .on("click", (event, d) => {
      toggleContinent(d.key)
    })

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3.axisBottom(x)
        .ticks(10)
        .tickFormat(d3.format("d"))
    )

  g.append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickFormat(d => `${d * 100}%`)
    )

  drawStackedAreaLegend(svgArea, continents, color)
}

function prepareStackedAreaData(continents) {
  const validData = dataGlobal.filter(d => d.continent !== "Unknown")

  const grouped = d3.rollups(
    validData,
    races => races.length,
    d => d.year,
    d => d.continent
  )

  const formatted = grouped.map(([year, values]) => {
    const obj = { year }

    values.forEach(([continent, count]) => {
      obj[continent] = count
    })

    return obj
  })

  formatted.forEach(d => {
    continents.forEach(continent => {
      if (!d[continent]) {
        d[continent] = 0
      }
    })
  })

  formatted.sort((a, b) => a.year - b.year)

  return formatted
}

function drawStackedAreaLegend(svgArea, continents, color) {
  const legend = svgArea.append("g")
    .attr("transform", "translate(760,70)")

  continents.forEach((continent, i) => {
    const item = legend.append("g")
      .attr("transform", `translate(0, ${i * 28})`)
      .attr("class", "clickable")
      .on("click", () => {
        toggleContinent(continent)
      })

    item.append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("fill", color(continent))

    item.append("text")
      .attr("x", 24)
      .attr("y", 13)
      .attr("fill", "white")
      .attr("font-size", "12px")
      .text(continent)
  })
}

// =====================================================
// 11. EVENTOS DOS CONTROLES
// =====================================================

function configureEvents() {
  slider.addEventListener("input", () => {
    stopAnimation()
    update(+slider.value)
  })

  yearSelect.addEventListener("change", event => {
    const year = +event.target.value
    selectLastRaceOfYear(year)
  })

  clearFilterBtn.addEventListener("click", () => {
    selectedContinent = null
    stopAnimation()
    refreshAllVisualizations()
  })

  playBtn.onclick = () => {
    if (!playing) {
      playing = true
      playBtn.innerText = "⏸"

      interval = setInterval(() => {
        const value = +slider.value

        if (value >= dataGlobal.length - 1) {
          stopAnimation()
          return
        }

        slider.value = value + 1
        update(value + 1)
      }, 400)

    } else {
      stopAnimation()
    }
  }
}