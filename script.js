const svg = d3.select("#map")
const calendarSvg = d3.select("#calendarChart")

const projection = d3.geoNaturalEarth1()
  .scale(150)
  .translate([450, 250])

const path = d3.geoPath().projection(projection)

const slider = document.getElementById("slider")
const label = document.getElementById("label")
const playBtn = document.getElementById("playBtn")
const yearSelect = document.getElementById("yearSelect")
const clearFilterBtn = document.getElementById("clearFilterBtn")
const filterStatus = document.getElementById("filterStatus")

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")

let dataGlobal
let racesData
let currentYear = null
let currentRound = null
let selectedContinent = null
let playing = false
let interval = null

const countryToContinent = {
  // Europa
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

  // América do Norte
  "USA": "North America",
  "United States": "North America",
  "Canada": "North America",
  "Mexico": "North America",

  // América do Sul
  "Brazil": "South America",
  "Argentina": "South America",

  // Ásia
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

  // Oceania
  "Australia": "Oceania",

  // África
  "South Africa": "Africa",
  "Morocco": "Africa"
}

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
  const x = Math.sin(dLat / 2) ** 2 +
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

Promise.all([
  d3.json("data/world.json"),
  d3.csv("data/circuits.csv"),
  d3.csv("data/races.csv")
]).then(([world, circuits, races]) => {

  racesData = races

  const countries = topojson.feature(world, world.objects.countries)

  svg.append("g")
    .selectAll("path")
    .data(countries.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", "#1e293b")
    .attr("stroke", "#334155")

  circuits.forEach(d => {
    d.lat = +d.lat
    d.lng = +d.lng
  })

  races.forEach(d => {
    d.year = +d.year
    d.round = +d.round
  })

  const data = races.map(r => {
    const c = circuits.find(c => c.circuitId === r.circuitId)
    const continent = c ? countryToContinent[c.country] : null

    if (c && !continent) {
      console.log("País sem continente:", c.country)
    }

    return {
      year: r.year,
      round: r.round,
      raceName: r.name,
      date: r.date,
      lat: c ? c.lat : null,
      lng: c ? c.lng : null,
      country: c ? c.country : null,
      circuitName: c ? c.name : null,
      continent: continent || "Unknown"
    }
  })
  .filter(d => d.lat && d.lng)
  .sort((a, b) => a.year - b.year || a.round - b.round)

  dataGlobal = data

  const anos = [...new Set(data.map(d => d.year))]

  anos.forEach(y => {
    const opt = document.createElement("option")
    opt.value = y
    opt.text = y
    yearSelect.appendChild(opt)
  })

  slider.min = 0
  slider.max = data.length - 1
  slider.value = 0

  function update(i) {
    const d = data[i]

    currentYear = d.year
    currentRound = d.round

    yearSelect.value = currentYear
    label.innerText = `${d.year} - Round ${d.round}`

    updateFilterStatus()
    updateMap(d.year, d.round)
    updateDistanceChart()
    updateCountriesChart()
    updateContinentChart()
    updateDonutChart()
    updateCalendar(d.year, d.round)
  }

  function updateMap(year, round) {
    const temporadaCompleta = dataGlobal.filter(x =>
      x.year === year && x.round <= round
    )

    const temporada = filteredByContinent(temporadaCompleta)

    svg.selectAll("circle.race-point").remove()
    svg.selectAll(".rota").remove()

    for (let i = 1; i < temporada.length; i++) {

  const prev = temporada[i - 1]
  const curr = temporada[i]

  const p1 = projection([prev.lng, prev.lat])
  const p2 = projection([curr.lng, curr.lat])

  // ponto de controle da curva
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

    svg.selectAll("circle.race-point")
      .data(temporada)
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

  function updateDistanceChart() {
    const svgLine = d3.select("#lineChart")
    svgLine.selectAll("*").remove()

    const chartData = filteredByContinent(dataGlobal)

    const grouped = d3.group(chartData, d => d.year)
    const dados = []

    grouped.forEach((values, year) => {
      let total = 0
      const ordered = values.slice().sort((a, b) => a.round - b.round)

      for (let i = 1; i < ordered.length; i++) {
        total += haversine(ordered[i - 1], ordered[i])
      }

      dados.push({ year, total })
    })

    dados.sort((a, b) => a.year - b.year)

    const x = d3.scaleLinear()
      .domain(d3.extent(dataGlobal, d => d.year))
      .range([60, 420])

    const y = d3.scaleLinear()
      .domain([0, d3.max(dados, d => d.total) || 1])
      .nice()
      .range([200, 25])

    svgLine.append("path")
      .datum(dados)
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 2)
      .attr("d", d3.line()
        .defined(d => d.total !== undefined)
        .x(d => x(d.year))
        .y(d => y(d.total))
      )

    svgLine.selectAll(".hit-year")
      .data(dados)
      .enter()
      .append("circle")
      .attr("class", "hit-year clickable")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.total))
      .attr("r", 9)
      .attr("fill", "transparent")
      .on("click", (event, d) => {
        const index = dataGlobal
          .map((item, idx) => ({ item, idx }))
          .filter(x => x.item.year === d.year)
          .pop().idx

        slider.value = index
        stopAnimation()
        update(index)
      })
      .on("mouseover", (event, d) => {
        showTooltip(event, `
          <b>${d.year}</b><br>
          Distância aproximada: ${formatKm(d.total)}<br>
          Clique para selecionar este ano.
        `)
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", hideTooltip)

    const atual = dados.find(d => d.year === currentYear)

    if (atual) {
      svgLine.append("circle")
        .attr("cx", x(atual.year))
        .attr("cy", y(atual.total))
        .attr("r", 6)
        .attr("fill", "#ef4444")
        .attr("stroke", "white")
        .on("mouseover", event => {
          showTooltip(event, `
            Ano: ${atual.year}<br>
            Distância: ${formatKm(atual.total)}
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

  function updateCountriesChart() {
    const svgCountries = d3.select("#countriesChart")
    svgCountries.selectAll("*").remove()

    const chartData = filteredByContinent(dataGlobal)

    const grouped = d3.rollup(
      chartData,
      v => new Set(v.map(d => d.country)).size,
      d => d.year
    )

    const dados = Array.from(grouped, ([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year)

    const x = d3.scaleLinear()
      .domain(d3.extent(dataGlobal, d => d.year))
      .range([60, 420])

    const y = d3.scaleLinear()
      .domain([0, d3.max(dados, d => d.count) || 1])
      .nice()
      .range([200, 25])

    svgCountries.append("path")
      .datum(dados)
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 2)
      .attr("d", d3.line()
        .x(d => x(d.year))
        .y(d => y(d.count))
      )

    svgCountries.selectAll(".hit-year")
      .data(dados)
      .enter()
      .append("circle")
      .attr("class", "hit-year clickable")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.count))
      .attr("r", 9)
      .attr("fill", "transparent")
      .on("click", (event, d) => {
        const index = dataGlobal
          .map((item, idx) => ({ item, idx }))
          .filter(x => x.item.year === d.year)
          .pop().idx

        slider.value = index
        stopAnimation()
        update(index)
      })
      .on("mouseover", (event, d) => {
        showTooltip(event, `
          <b>${d.year}</b><br>
          Países: ${d.count}<br>
          Clique para selecionar este ano.
        `)
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", hideTooltip)

    const atual = dados.find(d => d.year === currentYear)

    if (atual) {
      svgCountries.append("circle")
        .attr("cx", x(atual.year))
        .attr("cy", y(atual.count))
        .attr("r", 6)
        .attr("fill", "#ef4444")
        .attr("stroke", "white")
        .on("mouseover", event => {
          showTooltip(event, `
            Ano: ${atual.year}<br>
            Países: ${atual.count}
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

  function updateContinentChart() {
    const svgContinent = d3.select("#continentChart")
    svgContinent.selectAll("*").remove()

    const dadosAno = dataGlobal.filter(d => d.year === currentYear)

    const counts = d3.rollup(
      dadosAno,
      v => v.length,
      d => d.continent
    )

    const dados = Array.from(counts, ([continent, count]) => ({ continent, count }))
      .filter(d => d.continent !== "Unknown")
      .sort((a, b) => b.count - a.count)

    const x = d3.scaleLinear()
      .domain([0, d3.max(dados, d => d.count) || 1])
      .range([120, 420])

    const y = d3.scaleBand()
      .domain(dados.map(d => d.continent))
      .range([30, 200])
      .padding(0.25)

    const color = d3.scaleSequential()
      .domain([0, d3.max(dados, d => d.count) || 1])
      .interpolator(t => d3.interpolateReds(0.35 + 0.65 * t))

    svgContinent.selectAll("rect")
      .data(dados)
      .enter()
      .append("rect")
      .attr("class", d => `clickable ${selectedContinent === d.continent ? "selected-bar" : ""}`)
      .attr("x", 120)
      .attr("y", d => y(d.continent))
      .attr("width", d => x(d.count) - 120)
      .attr("height", y.bandwidth())
      .attr("fill", d => selectedContinent && selectedContinent !== d.continent ? "#475569" : color(d.count))
      .attr("opacity", d => selectedContinent && selectedContinent !== d.continent ? 0.55 : 1)
      .on("click", (event, d) => {
        selectedContinent = selectedContinent === d.continent ? null : d.continent
        stopAnimation()
        updateMap(currentYear, currentRound)
        updateDistanceChart()
        updateCountriesChart()
        updateContinentChart()
        updateCalendar(currentYear, currentRound)
        updateFilterStatus()
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
      .data(dados)
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

 function updateDonutChart() {

  const svgDonut = d3.select("#donutChart")
  svgDonut.selectAll("*").remove()

  const dadosAno = dataGlobal.filter(d =>
    d.year === currentYear
  )

  const counts = d3.rollup(
    dadosAno,
    v => v.length,
    d => d.continent
  )

  const dados = Array.from(counts, ([continent, count]) => ({
    continent,
    count
  }))
  .filter(d => d.continent !== "Unknown")

  const width = 420
  const height = 320
  const radius = 95

  const color = d3.scaleOrdinal()
    .domain(dados.map(d => d.continent))
    .range([
      "#ef4444",
      "#f97316",
      "#eab308",
      "#22c55e",
      "#3b82f6",
      "#a855f7"
    ])

  // donut mais à esquerda
  const g = svgDonut.append("g")
    .attr("transform", `translate(155,170)`)

  const pie = d3.pie()
    .value(d => d.count)

  const arc = d3.arc()
    .innerRadius(50)
    .outerRadius(radius)

  // slices
  g.selectAll("path")
    .data(pie(dados))
    .enter()
    .append("path")

    .attr("class", d =>
      `clickable ${
        selectedContinent === d.data.continent
          ? "selected-bar"
          : ""
      }`
    )

    .attr("d", arc)

    .attr("fill", d => {

      if (
        selectedContinent &&
        selectedContinent !== d.data.continent
      ) {
        return "#475569"
      }

      return color(d.data.continent)
    })

    .attr("opacity", d => {

      if (
        selectedContinent &&
        selectedContinent !== d.data.continent
      ) {
        return 0.4
      }

      return 1
    })

    .attr("stroke", "#020617")
    .attr("stroke-width", 2)

    .on("click", (event,d) => {

      selectedContinent =
        selectedContinent === d.data.continent
          ? null
          : d.data.continent

      stopAnimation()

      updateMap(currentYear, currentRound)
      updateDistanceChart()
      updateCountriesChart()
      updateContinentChart()
      updateDonutChart()
      updateCalendar(currentYear, currentRound)
      updateFilterStatus()
    })

    .on("mouseover", (event,d) => {

      const total = d3.sum(dados, x => x.count)

      const perc =
        ((d.data.count / total) * 100).toFixed(1)

      showTooltip(event, `
        <b>${d.data.continent}</b><br>
        ${d.data.count} corridas<br>
        ${perc}% da temporada
      `)
    })

    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  // legenda vertical à direita
  const legend = svgDonut.append("g")
    .attr("transform", "translate(285,95)")

  dados.forEach((d,i) => {

    const item = legend.append("g")
      .attr("transform", `translate(0, ${i * 28})`)
      .attr("class","clickable")

      .on("click", () => {

        selectedContinent =
          selectedContinent === d.continent
            ? null
            : d.continent

        stopAnimation()

        updateMap(currentYear, currentRound)
        updateDistanceChart()
        updateCountriesChart()
        updateContinentChart()
        updateDonutChart()
        updateCalendar(currentYear, currentRound)
        updateFilterStatus()
      })

    item.append("rect")
      .attr("width",16)
      .attr("height",16)
      .attr("fill", color(d.continent))

    item.append("text")
      .attr("x",24)
      .attr("y",13)
      .attr("fill","white")
      .attr("font-size","12px")
      .text(`${d.continent} (${d.count})`)
  })

  // título
  svgDonut.append("text")
    .attr("x", width / 2)
    .attr("y", 24)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("font-size", "15px")
    .text(`Distribuição continental da F1 em ${currentYear}`)
}

  function updateCalendar(year, round) {
    calendarSvg.selectAll("*").remove()

    const dadosAno = filteredByContinent(dataGlobal).filter(d =>
      d.year === year && d.round <= round
    )

    const cellSize = 12
    const parseDate = d3.timeParse("%Y-%m-%d")

    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31)
    const dias = d3.timeDays(start, d3.timeDay.offset(end, 1))

    const corridaPorDia = new Map()

    dadosAno.forEach(d => {
      if (d.date) {
        const date = parseDate(d.date)
        if (date) {
          corridaPorDia.set(date.toDateString(), d)
        }
      }
    })

    const g = calendarSvg.append("g")
      .attr("transform", "translate(40,20)")

    g.selectAll("rect")
      .data(dias)
      .enter()
      .append("rect")
      .attr("x", d => d3.timeWeek.count(start, d) * cellSize)
      .attr("y", d => d.getDay() * cellSize)
      .attr("width", cellSize - 2)
      .attr("height", cellSize - 2)
      .attr("rx", 2)
      .attr("fill", d => corridaPorDia.get(d.toDateString()) ? "#f87171" : "#0f172a")
      .attr("stroke", "#1e293b")
      .on("mouseover", (event, d) => {
        const corrida = corridaPorDia.get(d.toDateString())

        showTooltip(event, `
          ${d3.timeFormat("%d/%m/%Y")(d)}<br>
          ${corrida
            ? `<b>${corrida.raceName}</b><br>${corrida.country} · Round ${corrida.round}`
            : "Sem corrida"}
        `)
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", hideTooltip)

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

    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

    g.selectAll(".day-label")
      .data(diasSemana)
      .enter()
      .append("text")
      .attr("x", -10)
      .attr("y", (d, i) => i * cellSize + 10)
      .attr("text-anchor", "end")
      .attr("fill", "#94a3b8")
      .attr("font-size", "10px")
      .text(d => d)
  }

  update(0)

  slider.addEventListener("input", () => {
    stopAnimation()
    update(+slider.value)
  })

  yearSelect.addEventListener("change", e => {
    const year = +e.target.value

    const index = data
      .map((d, i) => ({ d, i }))
      .filter(x => x.d.year === year)
      .pop().i

    slider.value = index
    stopAnimation()
    update(index)
  })

  clearFilterBtn.addEventListener("click", () => {
    selectedContinent = null
    stopAnimation()
    updateMap(currentYear, currentRound)
    updateDistanceChart()
    updateCountriesChart()
    updateContinentChart()
    updateCalendar(currentYear, currentRound)
    updateFilterStatus()
  })

  playBtn.onclick = () => {
    if (!playing) {
      playing = true
      playBtn.innerText = "⏸"

      interval = setInterval(() => {
        let v = +slider.value

        if (v >= data.length - 1) {
          stopAnimation()
          return
        }

        slider.value = v + 1
        update(v + 1)
      }, 400)

    } else {
      stopAnimation()
    }
  }

})
