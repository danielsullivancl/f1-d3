// Elementos SVG principais: mapa e calendário
const svg = d3.select("#map")
const calendarSvg = d3.select("#calendarChart")

// Controles da UI: slider de progresso, rótulo, botão de play, seleção de ano e botões de filtro
const slider = document.getElementById("slider")
const label = document.getElementById("label")
const playBtn = document.getElementById("playBtn")
const yearSelect = document.getElementById("yearSelect")
const clearFilterBtn = document.getElementById("clearFilterBtn")
const filterStatus = document.getElementById("filterStatus")

// Novos controles
const decadeSelect = document.getElementById("decadeSelect")
const toggleHegemonyTypeBtn = document.getElementById("toggleHegemonyTypeBtn")
const toggleHegemonyMetricBtn = document.getElementById("toggleHegemonyMetricBtn")
const pitYearSelect = document.getElementById("pitYearSelect")

// Projeção geográfica e gerador de caminho para desenhar o mapa
const projection = d3.geoNaturalEarth1()
  .scale(150)
  .translate([450, 250])

const path = d3.geoPath().projection(projection)

// Tooltip global reutilizável para mostrar informações ao passar o mouse
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")

// Estado global da aplicação
let dataGlobal = [] // dataset unificado (corridas + circuitos)
let currentYear = null
let currentRound = null
let selectedContinent = null // filtro por continente selecionado
let playing = false
let interval = null // referência ao timer de reprodução

// Referências globais para novos dados
let racesGlobal = []
let resultsRaw = []
let driversRaw = []
let constructorsRaw = []
let driverStandingsRaw = []
let constructorStandingsRaw = []
let pitStopsRaw = []

// Mapas de busca rápida pré-computados
const driversMap = new Map()       // driverId -> { name, nationality }
const constructorsMap = new Map()   // constructorId -> { name, nationality }
const racesMap = new Map()          // raceId -> { name, year, round }
const raceToYearMap = new Map()     // raceId -> year

// Estruturas pré-computadas de Hegemonia
const driverWins = new Map()                 // driverId -> count
const constructorWins = new Map()            // constructorId -> count
const driverChampionships = new Map()        // driverId -> count
const constructorChampionships = new Map()   // constructorId -> count

// Estruturas pré-computadas de Pole Position
const poleWinsByYear = new Map()             // year -> { totalPoles, wonFromPole }

// Estruturas de Pit Stop
let pitStopEvolution = []                    // array of { year, avg }
let selectedPitYear = 2023                   // ano selecionado na aba de pit stops

// Paleta de cores global para continentes — usada em TODOS os gráficos
const CONTINENT_COLORS = {
  "Europe": "#e63946",
  "North America": "#4361ee",
  "South America": "#2dc653",
  "Asia": "#f4a261",
  "Oceania": "#a8dadc",
  "Africa": "#a855f7",
  "Unknown": "#475569"
}

// Retorna a cor do continente (com fallback cinza)
function continentColor(continent) {
  return CONTINENT_COLORS[continent] || "#475569"
}

// Configuração inicial de controle de abas
let hegemonyType = "drivers"
let hegemonyMetric = "championships"

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
  "San Marino": "Europe",

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

// Exibe tooltip na posição do mouse com conteúdo HTML fornecido
function showTooltip(event, html) {
  tooltip
    .style("opacity", 1)
    .html(html)
    .style("left", (event.pageX + 12) + "px")
    .style("top", (event.pageY - 22) + "px")
}

// Atualiza posição do tooltip (chamado em mousemove)
function moveTooltip(event) {
  tooltip
    .style("left", (event.pageX + 12) + "px")
    .style("top", (event.pageY - 22) + "px")
}

// Esconde o tooltip
function hideTooltip() {
  tooltip.style("opacity", 0)
}

// Calcula distância aproximada entre dois pontos (km) usando a fórmula de Haversine
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

// Formata valor numérico de quilômetros para string legível (pt-BR)
function formatKm(value) {
  return `${Math.round(value).toLocaleString("pt-BR")} km`
}

// Aplica filtro por continente quando existe `selectedContinent`
function filteredByContinent(data) {
  if (!selectedContinent) return data
  return data.filter(d => d.continent === selectedContinent)
}

// Atualiza texto do status de filtro exibido na UI
function updateFilterStatus() {
  filterStatus.innerText = selectedContinent
    ? `Filtro: ${selectedContinent}. Clique em outro continente ou limpe o filtro.`
    : "Filtro: todos os continentes"
}

// Para a animação de reprodução automática
function stopAnimation() {
  if (interval) clearInterval(interval)

  playing = false
  playBtn.innerText = "▶"
}

// Atualiza todos os gráficos com o estado atual (ano, round, filtro)
function refreshAllVisualizations() {
  updateFilterStatus()
  updateMap(currentYear, currentRound)
  updateCalendar(currentYear, currentRound)
  updateDistanceChart()
  updateCountriesChart()
  updateContinentChart()
  updateDonutChart()
  updateStackedAreaChart()
  updateTopCountriesChart()
}

// Seleciona o último evento (round) do `year` informado e atualiza o slider
function selectLastRaceOfYear(year) {
  if (dataGlobal.length === 0) return

  const filtered = dataGlobal
    .map((item, idx) => ({ item, idx }))
    .filter(x => x.item.year === year)

  if (filtered.length === 0) return
  const index = filtered.pop().idx

  slider.value = index
  stopAnimation()
  update(index)
}

// Alterna seleção de continente (clicando novamente limpa o filtro)
function toggleContinent(continent) {
  selectedContinent = selectedContinent === continent ? null : continent

  stopAnimation()
  refreshAllVisualizations()
}

// =====================================================
// 2. CARREGAMENTO E PREPARAÇÃO DOS DADOS
// =====================================================

// Registrar os eventos imediatamente para garantir a usabilidade das abas
configureEvents()

// Carrega os 9 datasets necessários para responder a todas as perguntas
Promise.all([
  d3.json("data/world.json"),
  d3.csv("data/circuits.csv"),
  d3.csv("data/races.csv"),
  d3.csv("data/drivers.csv"),
  d3.csv("data/constructors.csv"),
  d3.csv("data/results.csv"),
  d3.csv("data/driver_standings.csv"),
  d3.csv("data/constructor_standings.csv"),
  d3.csv("data/pit_stops.csv")
]).then(([world, circuits, races, drivers, constructors, results, driverStandings, constructorStandings, pitStops]) => {

  // Salvar referências nos estados globais
  racesGlobal = races
  resultsRaw = results
  driversRaw = drivers
  constructorsRaw = constructors
  driverStandingsRaw = driverStandings
  constructorStandingsRaw = constructorStandings
  pitStopsRaw = pitStops

  // 1. Criar mapas rápidos de busca por ID
  drivers.forEach(d => {
    driversMap.set(+d.driverId, {
      name: `${d.forename} ${d.surname}`,
      nationality: d.nationality
    })
  })

  constructors.forEach(c => {
    constructorsMap.set(+c.constructorId, {
      name: c.name,
      nationality: c.nationality
    })
  })

  races.forEach(r => {
    racesMap.set(+r.raceId, {
      name: r.name,
      year: +r.year,
      round: +r.round
    })
    raceToYearMap.set(+r.raceId, +r.year)
  })

  prepareNumericFields(circuits, races)
  drawBaseMap(world)

  // Cria dataset unificado geográfico
  dataGlobal = createUnifiedDataset(circuits, races)

  // 2. Pré-calcular dados complexos para outras abas
  precomputeHegemonyData()
  precomputePoleData()
  precomputePitStopData()

  // 3. Inicializar elementos e selects da interface
  populateYearSelect(dataGlobal)
  populatePitYearSelect()
  configureSlider(dataGlobal)

  // Inicializa a visualização no primeiro índice
  update(0)
}).catch(err => {
  console.warn("Falha ao carregar dados do F1 via fetch. Provável bloqueio de CORS no protocolo file://", err)
})

// Converte campos numéricos lidos como strings para números
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

// Une informações de `races` e `circuits` em um único array ordenado
function createUnifiedDataset(circuits, races) {
  return races
    .map(race => {
      const circuit = circuits.find(c => c.circuitId === race.circuitId)
      const continent = circuit ? countryToContinent[circuit.country] : null

      return {
        raceId: +race.raceId,
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
    .filter(d => d.lat && d.lng) // remove entradas sem coordenadas
    .sort((a, b) => a.year - b.year || a.round - b.round)
}

// Preenche o select de anos com os anos presentes no dataset
function populateYearSelect(data) {
  const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b)
  yearSelect.innerHTML = ""

  years.forEach(year => {
    const option = document.createElement("option")
    option.value = year
    option.text = year
    yearSelect.appendChild(option)
  })
}

// Atualiza o select de anos com base na década filtrada
function updateYearSelectForDecade(decade) {
  if (dataGlobal.length === 0) return

  const allYears = [...new Set(dataGlobal.map(d => d.year))].sort((a, b) => a - b)
  let filteredYears = allYears

  if (decade !== "all") {
    const startYear = +decade
    filteredYears = allYears.filter(y => y >= startYear && y < startYear + 10)
  }

  yearSelect.innerHTML = ""
  filteredYears.forEach(year => {
    const option = document.createElement("option")
    option.value = year
    option.text = year
    yearSelect.appendChild(option)
  })

  // Se o ano atual estiver fora da lista de anos filtrados, selecionar o último
  if (!filteredYears.includes(currentYear) && filteredYears.length > 0) {
    const newYear = filteredYears[filteredYears.length - 1]
    selectLastRaceOfYear(newYear)
  } else {
    yearSelect.value = currentYear
  }
}

// Preenche o select de anos da aba de Pit Stops (disponível de 2011+)
function populatePitYearSelect() {
  if (pitStopsRaw.length === 0) return

  const pitYears = [...new Set(pitStopsRaw.map(s => raceToYearMap.get(+s.raceId)))]
    .filter(y => y !== undefined)
    .sort((a, b) => b - a) // Mais recente primeiro

  pitYearSelect.innerHTML = ""
  pitYears.forEach(year => {
    const option = document.createElement("option")
    option.value = year
    option.text = year
    pitYearSelect.appendChild(option)
  })

  if (pitYears.length > 0) {
    selectedPitYear = pitYears[0] // Define como ano padrão o mais recente
    pitYearSelect.value = selectedPitYear
  }
}

// Configura limites do slider com base no tamanho do dataset
function configureSlider(data) {
  slider.min = 0
  slider.max = data.length - 1
  slider.value = 0
}

// =====================================================
// 2.2 FUNÇÕES DE PRÉ-COMPUTAÇÃO DE DADOS
// =====================================================

// Processa e agrega vitórias e campeonatos mundiais
function precomputeHegemonyData() {
  // 1. Contabilizar vitórias individuais de pilotos e construtores
  resultsRaw.forEach(res => {
    if (+res.positionOrder === 1) {
      const dId = +res.driverId
      const cId = +res.constructorId
      driverWins.set(dId, (driverWins.get(dId) || 0) + 1)
      constructorWins.set(cId, (constructorWins.get(cId) || 0) + 1)
    }
  })

  // 2. Contabilizar campeonatos mundiais
  // Apenas a classificação na última corrida da temporada conta como o campeonato
  const finalRaceByYear = new Map()
  racesGlobal.forEach(r => {
    const year = +r.year
    const round = +r.round
    const raceId = +r.raceId
    if (!finalRaceByYear.has(year) || finalRaceByYear.get(year).round < round) {
      finalRaceByYear.set(year, { raceId, round })
    }
  })

  const finalRaceIds = new Set(Array.from(finalRaceByYear.values()).map(d => d.raceId))

  // Campeonatos de pilotos
  driverStandingsRaw.forEach(d => {
    const raceId = +d.raceId
    if (finalRaceIds.has(raceId) && +d.position === 1) {
      const driverId = +d.driverId
      driverChampionships.set(driverId, (driverChampionships.get(driverId) || 0) + 1)
    }
  })

  // Campeonatos de equipes
  constructorStandingsRaw.forEach(c => {
    const raceId = +c.raceId
    if (finalRaceIds.has(raceId) && +c.position === 1) {
      const constructorId = +c.constructorId
      constructorChampionships.set(constructorId, (constructorChampionships.get(constructorId) || 0) + 1)
    }
  })
}

// Processa taxa de vitórias a partir da Pole Position
function precomputePoleData() {
  resultsRaw.forEach(res => {
    const raceId = +res.raceId
    const year = raceToYearMap.get(raceId)
    if (!year) return

    // Verifica se largou em 1º (grid === 1)
    if (+res.grid === 1) {
      if (!poleWinsByYear.has(year)) {
        poleWinsByYear.set(year, { totalPoles: 0, wonFromPole: 0 })
      }
      const stats = poleWinsByYear.get(year)
      stats.totalPoles += 1
      if (+res.positionOrder === 1) {
        stats.wonFromPole += 1
      }
    }
  })
}

// Processa tempos médios de pit stops
function precomputePitStopData() {
  const pitStopsByYear = new Map()
  pitStopsRaw.forEach(stop => {
    const raceId = +stop.raceId
    const year = raceToYearMap.get(raceId)
    if (!year) return

    const ms = +stop.milliseconds
    const sec = ms / 1000
    // Filtro contra anomalias/danos extremos (>45s) e ruídos incorretos (<12s)
    if (sec >= 12 && sec <= 45) {
      if (!pitStopsByYear.has(year)) {
        pitStopsByYear.set(year, [])
      }
      pitStopsByYear.get(year).push(sec)
    }
  })

  pitStopEvolution = Array.from(pitStopsByYear.entries()).map(([year, times]) => {
    const avg = d3.mean(times)
    return { year, avg }
  }).sort((a, b) => a.year - b.year)
}

// =====================================================
// 3. FUNÇÃO CENTRAL DE ATUALIZAÇÃO
// =====================================================

// Atualiza o estado atual e dispara refresh dos gráficos para o índice selecionado
function update(index) {
  if (dataGlobal.length === 0) return

  const selectedRace = dataGlobal[index]

  currentYear = selectedRace.year
  currentRound = selectedRace.round

  yearSelect.value = currentYear
  label.innerText = `${currentYear} - Round ${currentRound}`

  refreshAllVisualizations()
}

// =====================================================
// 4. MAPA (ABA 1)
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
  if (dataGlobal.length === 0) return

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

    if (!p1 || !p2) continue

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
    .attr("fill", d => d.round === round ? "#facc15" : continentColor(d.continent))
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
// 5. CALENDÁRIO (ABA 1)
// =====================================================

function updateCalendar(year, round) {
  calendarSvg.selectAll("*").remove()
  if (dataGlobal.length === 0) return

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
        ${race
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
// 6. DISTÂNCIA TOTAL POR TEMPORADA (ABA 1)
// =====================================================

function updateDistanceChart() {
  const svgLine = d3.select("#lineChart")
  svgLine.selectAll("*").remove()
  if (dataGlobal.length === 0) return

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
// 7. GRÁFICO DE PAÍSES POR TEMPORADA (ABA 1)
// =====================================================

function updateCountriesChart() {
  const svgCountries = d3.select("#countriesChart")
  svgCountries.selectAll("*").remove()
  if (dataGlobal.length === 0) return

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
// 8. BARRAS POR CONTINENTE (ABA 1)
// =====================================================

function updateContinentChart() {
  const svgContinent = d3.select("#continentChart")
  svgContinent.selectAll("*").remove()
  if (dataGlobal.length === 0) return

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

  // Usa a paleta global de continentes (mesma cor em todos os gráficos)
  const color = d => continentColor(d.continent)

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
        : color(d)
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
    .text(`Corridas da F1 por continente em ${currentYear}`)
}

// =====================================================
// 9. DONUT CHART (ABA 1)
// =====================================================

function updateDonutChart() {
  const svgDonut = d3.select("#donutChart")
  svgDonut.selectAll("*").remove()
  if (dataGlobal.length === 0) return

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

  // Usa a paleta global de continentes (mesma cor em todos os gráficos)
  const color = d => continentColor(d)

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
      .attr("fill", continentColor(d.continent))

    item.append("text")
      .attr("x", 24)
      .attr("y", 13)
      .attr("fill", "white")
      .attr("font-size", "12px")
      .text(`${d.continent} (${d.count})`)
  })
}

// =====================================================
// 10. ÁREA EMPILHADA (ABA 1)
// =====================================================

function updateStackedAreaChart() {
  const svgArea = d3.select("#stackedAreaChart")
  svgArea.selectAll("*").remove()
  if (dataGlobal.length === 0) return

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

  // Usa cores globais por continente
  const color = continentColor;


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
// 10.2 PAÍSES RECORDISTAS EM SEDIAR GPS (NOVO - ABA 1)
// =====================================================

function updateTopCountriesChart() {
  const svg = d3.select("#topCountriesChart")
  svg.selectAll("*").remove()
  if (dataGlobal.length === 0) return

  const width = +svg.attr("width")
  const height = +svg.attr("height")
  const margin = { top: 20, right: 40, bottom: 40, left: 140 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  // Agrupar corridas totais na história por país
  const counts = d3.rollup(
    dataGlobal,
    v => v.length,
    d => d.country
  )

  const data = Array.from(counts, ([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15) // Exibir os top 15 países

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count) || 1])
    .nice()
    .range([0, chartWidth])

  const y = d3.scaleBand()
    .domain(data.map(d => d.country))
    .range([0, chartHeight])
    .padding(0.25)

  const color = d3.scaleSequential()
    .domain([0, d3.max(data, d => d.count) || 1])
    .interpolator(t => d3.interpolateReds(0.35 + 0.65 * t))

  g.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "clickable")
    .attr("x", 0)
    .attr("y", d => y(d.country))
    .attr("width", d => x(d.count))
    .attr("height", y.bandwidth())
    .attr("fill", d => color(d.count))
    .attr("rx", 3)
    .on("mouseover", (event, d) => {
      showTooltip(event, `
        <b>${d.country}</b><br>
        Sediou ${d.count} GPs no total da história.
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  g.selectAll(".value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", d => x(d.count) + 6)
    .attr("y", d => y(d.country) + y.bandwidth() / 2 + 4)
    .attr("fill", "white")
    .attr("font-size", "11px")
    .text(d => d.count)

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y))

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(6))
}

// =====================================================
// 11. HEGEMONIA HISTÓRICA - GRAFICOS (ABA 2)
// =====================================================

function updateHegemonyChart() {
  const svg = d3.select("#hegemonyChart")
  svg.selectAll("*").remove()
  if (resultsRaw.length === 0) return

  const width = +svg.attr("width")
  const height = +svg.attr("height")
  const margin = { top: 30, right: 60, bottom: 40, left: 220 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  let dataMap
  let labelText = ""

  if (hegemonyType === "drivers") {
    dataMap = hegemonyMetric === "championships" ? driverChampionships : driverWins
    labelText = hegemonyMetric === "championships" ? "Títulos Mundiais" : "Vitórias em GPs"
  } else {
    dataMap = hegemonyMetric === "championships" ? constructorChampionships : constructorWins
    labelText = hegemonyMetric === "championships" ? "Títulos de Construtores" : "Vitórias em GPs"
  }

  // Prepara e ordena o ranking
  const data = Array.from(dataMap.entries()).map(([id, count]) => {
    let name = ""
    if (hegemonyType === "drivers") {
      name = driversMap.get(id)?.name || `Piloto ${id}`
    } else {
      name = constructorsMap.get(id)?.name || `Equipe ${id}`
    }
    return { name, count }
  })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Top 10

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count) || 1])
    .nice()
    .range([0, chartWidth])

  const y = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([0, chartHeight])
    .padding(0.25)

  const color = d3.scaleSequential()
    .domain([0, d3.max(data, d => d.count) || 1])
    .interpolator(t => d3.interpolateReds(0.35 + 0.65 * t))

  g.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "clickable")
    .attr("x", 0)
    .attr("y", d => y(d.name))
    .attr("width", d => x(d.count))
    .attr("height", y.bandwidth())
    .attr("fill", d => color(d.count))
    .attr("rx", 4)
    .on("mouseover", (event, d) => {
      showTooltip(event, `
        <b>${d.name}</b><br>
        ${d.count} ${labelText}
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  g.selectAll(".value")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value")
    .attr("x", d => x(d.count) + 8)
    .attr("y", d => y(d.name) + y.bandwidth() / 2 + 4)
    .attr("fill", "white")
    .attr("font-size", "11px")
    .text(d => d.count)

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y))

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")))

  const displayType = hegemonyType === "drivers" ? "Pilotos" : "Construtores"
  document.getElementById("hegemonyChartTitle").innerText = `Maiores Recordistas (${displayType}) por ${labelText}`
}

function updateLeaderboardTable() {
  const tbody = d3.select("#leaderboardTable tbody")
  tbody.selectAll("*").remove()
  if (resultsRaw.length === 0) return

  let dataMap
  if (hegemonyType === "drivers") {
    dataMap = hegemonyMetric === "championships" ? driverChampionships : driverWins
  } else {
    dataMap = hegemonyMetric === "championships" ? constructorChampionships : constructorWins
  }

  const data = Array.from(dataMap.entries()).map(([id, count]) => {
    let name = ""
    let nationality = ""
    let titles = 0
    let wins = 0

    if (hegemonyType === "drivers") {
      const driver = driversMap.get(id)
      name = driver?.name || `Piloto ${id}`
      nationality = driver?.nationality || "-"
      titles = driverChampionships.get(id) || 0
      wins = driverWins.get(id) || 0
    } else {
      const constructor = constructorsMap.get(id)
      name = constructor?.name || `Equipe ${id}`
      nationality = constructor?.nationality || "-"
      titles = constructorChampionships.get(id) || 0
      wins = constructorWins.get(id) || 0
    }
    return { name, titles, wins, nationality, sortValue: count }
  })
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, 10) // Exibir o top 10 detalhado

  data.forEach((d, i) => {
    const tr = tbody.append("tr")
    tr.append("td").text(`${i + 1}º`)
    tr.append("td").text(d.name)
    tr.append("td").text(d.titles > 0 ? `${d.titles} título(s)` : "Nenhum título")
    tr.append("td").text(`${d.wins} vitória(s)`)
    tr.append("td").text(d.nationality)
  })
}

// =====================================================
// 12. POLE POSITION VS VITÓRIA - GRAFICOS (ABA 3)
// =====================================================

function updatePoleCharts() {
  if (resultsRaw.length === 0) return
  drawPoleConversionChart()
  drawGridCorrelationChart()
}

function drawPoleConversionChart() {
  const svg = d3.select("#poleConversionChart")
  svg.selectAll("*").remove()

  const width = +svg.attr("width")
  const height = +svg.attr("height")
  const margin = { top: 35, right: 40, bottom: 40, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  // Converte o mapa de taxas de pole em array de objetos ordenados
  const data = Array.from(poleWinsByYear.entries()).map(([year, stats]) => {
    const rate = stats.totalPoles > 0 ? (stats.wonFromPole / stats.totalPoles) * 100 : 0
    return { year, rate, ...stats }
  }).sort((a, b) => a.year - b.year)

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.year))
    .range([0, chartWidth])

  const y = d3.scaleLinear()
    .domain([0, 100])
    .nice()
    .range([chartHeight, 0])

  // Linha tracejada de referência em 50%
  g.append("line")
    .attr("x1", 0)
    .attr("y1", y(50))
    .attr("x2", chartWidth)
    .attr("y2", y(50))
    .attr("stroke", "#475569")
    .attr("stroke-dasharray", "4,4")
    .attr("stroke-width", 1)

  g.append("text")
    .attr("x", chartWidth - 10)
    .attr("y", y(50) - 6)
    .attr("text-anchor", "end")
    .attr("fill", "#94a3b8")
    .attr("font-size", "10px")
    .text("Linha de 50% de conversão")

  // Desenhar linha principal da taxa
  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#ef4444")
    .attr("stroke-width", 2.5)
    .attr("d", d3.line()
      .x(d => x(d.year))
      .y(d => y(d.rate))
    )

  // Círculos interativos
  g.selectAll(".pole-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "pole-point clickable")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.rate))
    .attr("r", 4)
    .attr("fill", "#ef4444")
    .attr("stroke", "#020617")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      showTooltip(event, `
        <b>Temporada: ${d.year}</b><br>
        Corridas com grid registrado: ${d.totalPoles}<br>
        Vitórias saindo da Pole: ${d.wonFromPole}<br>
        <b>Taxa de Conversão: ${d.rate.toFixed(1)}%</b>
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")))

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickFormat(d => `${d}%`))
}

function drawGridCorrelationChart() {
  const svg = d3.select("#gridCorrelationChart")
  svg.selectAll("*").remove()

  const width = +svg.attr("width")
  const height = +svg.attr("height")
  const margin = { top: 30, right: 40, bottom: 50, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  // Processar correlações das posições de largada vs chegada
  const counts = new Map()
  let maxCount = 0

  resultsRaw.forEach(res => {
    const grid = +res.grid
    const pos = +res.positionOrder
    if (grid >= 1 && grid <= 20 && pos >= 1 && pos <= 20) {
      const key = `${grid}-${pos}`
      const c = (counts.get(key) || 0) + 1
      counts.set(key, c)
      if (c > maxCount) maxCount = c
    }
  })

  const data = Array.from(counts.entries()).map(([key, count]) => {
    const [grid, pos] = key.split("-").map(Number)
    return { grid, pos, count }
  })

  const x = d3.scaleLinear()
    .domain([1, 20])
    .range([0, chartWidth])

  const y = d3.scaleLinear()
    .domain([1, 20])
    .range([0, chartHeight]) // 1 na parte superior, 20 na parte inferior

  const radius = d3.scaleSqrt()
    .domain([1, maxCount])
    .range([2.5, 18])

  const color = d3.scaleSequential()
    .domain([1, maxCount])
    .interpolator(d3.interpolateYlOrRd)

  // Linha diagonal de referência (Largada = Chegada)
  g.append("line")
    .attr("x1", x(1))
    .attr("y1", y(1))
    .attr("x2", x(20))
    .attr("y2", y(20))
    .attr("stroke", "#475569")
    .attr("stroke-dasharray", "3,3")
    .attr("stroke-width", 1.5)

  g.append("text")
    .attr("x", x(15))
    .attr("y", y(15) - 8)
    .attr("transform", `rotate(${Math.atan2(chartHeight, chartWidth) * 180 / Math.PI}, ${x(15)}, ${y(15)})`)
    .attr("fill", "#94a3b8")
    .attr("font-size", "10px")
    .text("Largada = Chegada")

  // Indicadores de posições ganhas/perdidas
  g.append("text")
    .attr("x", x(4))
    .attr("y", y(16))
    .attr("fill", "#ef4444")
    .attr("font-size", "12px")
    .attr("opacity", 0.7)
    .text("Perdeu posições ⬇")

  g.append("text")
    .attr("x", x(14))
    .attr("y", y(4))
    .attr("fill", "#10b981")
    .attr("font-size", "12px")
    .attr("opacity", 0.7)
    .text("Recuperou posições ⬆")

  // Renderizar as bolhas (círculos)
  g.selectAll(".correlation-bubble")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "correlation-bubble")
    .attr("cx", d => x(d.grid))
    .attr("cy", d => y(d.pos))
    .attr("r", d => radius(d.count))
    .attr("fill", d => color(d.count))
    .attr("stroke", "white")
    .attr("stroke-width", 0.5)
    .attr("fill-opacity", 0.8)
    .on("mouseover", (event, d) => {
      showTooltip(event, `
        <b>Largada: ${d.grid}º colocado</b><br>
        <b>Chegada: ${d.pos}º colocado</b><br>
        Frequência Histórica: ${d.count} ocorrências
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(20).tickFormat(d => `${d}º`))

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(20).tickFormat(d => `${d}º`))
}

// =====================================================
// 13. PIT STOPS - GRAFICOS (ABA 4)
// =====================================================

function updatePitStopCharts() {
  if (pitStopsRaw.length === 0) return
  drawPitStopEvolutionChart()
  drawPitStopCorrelationChart()
}

function drawPitStopEvolutionChart() {
  const svg = d3.select("#pitStopEvolutionChart")
  svg.selectAll("*").remove()

  const width = +svg.attr("width")
  const height = +svg.attr("height")
  const margin = { top: 35, right: 40, bottom: 40, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  const x = d3.scaleLinear()
    .domain(d3.extent(pitStopEvolution, d => d.year))
    .range([0, chartWidth])

  const y = d3.scaleLinear()
    .domain([d3.min(pitStopEvolution, d => d.avg) - 1, d3.max(pitStopEvolution, d => d.avg) + 1])
    .nice()
    .range([chartHeight, 0])

  // Desenhar linha de evolução
  g.append("path")
    .datum(pitStopEvolution)
    .attr("fill", "none")
    .attr("stroke", "#ef4444")
    .attr("stroke-width", 2.5)
    .attr("d", d3.line()
      .x(d => x(d.year))
      .y(d => y(d.avg))
    )

  // Círculos interativos de média
  g.selectAll(".pit-point")
    .data(pitStopEvolution)
    .enter()
    .append("circle")
    .attr("class", "pit-point clickable")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.avg))
    .attr("r", 4)
    .attr("fill", "#ef4444")
    .attr("stroke", "#020617")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      showTooltip(event, `
        <b>Temporada: ${d.year}</b><br>
        Tempo Médio Geral: ${d.avg.toFixed(3)}s
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")))

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => `${d}s`))
}

function drawPitStopCorrelationChart() {
  const svg = d3.select("#pitStopCorrelationChart")
  svg.selectAll("*").remove()

  const width = +svg.attr("width")
  const height = +svg.attr("height")
  const margin = { top: 35, right: 40, bottom: 50, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  // 1. Filtrar as corridas da temporada selecionada
  const selectedYearRaces = dataGlobal.filter(d => d.year === selectedPitYear)
  const selectedRaceIds = new Set(selectedYearRaces.map(r => r.raceId))

  // 2. Filtrar os pit stops dessas corridas
  const yearStops = pitStopsRaw.filter(s => selectedRaceIds.has(+s.raceId))

  // 3. Somar os tempos de pit stop por piloto e corrida (tempo total de box por GP)
  const stopMap = new Map() // chave: `${raceId}-${driverId}` -> total ms nos boxes
  yearStops.forEach(s => {
    const key = `${s.raceId}-${s.driverId}`
    stopMap.set(key, (stopMap.get(key) || 0) + (+s.milliseconds))
  })

  // 4. Filtrar resultados correspondentes
  const yearResults = resultsRaw.filter(r => selectedRaceIds.has(+r.raceId))

  // 5. Agrupar dados finais de dispersão
  const data = []
  yearResults.forEach(res => {
    const key = `${res.raceId}-${res.driverId}`
    const totalMs = stopMap.get(key)
    const pos = +res.positionOrder

    if (totalMs && pos >= 1 && pos <= 20) {
      const totalSec = totalMs / 1000
      // Descartar paradas excessivamente longas (>90s) causadas por batidas/quebras
      if (totalSec < 90) {
        const driverName = driversMap.get(+res.driverId)?.name || `Piloto ${res.driverId}`
        const raceName = racesMap.get(+res.raceId)?.name || `GP ${res.raceId}`
        data.push({
          driverName,
          raceName,
          totalSec,
          pos
        })
      }
    }
  })

  if (data.length === 0) {
    g.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#94a3b8")
      .text("Sem dados de pit stops para esta temporada.")
    return
  }

  const x = d3.scaleLinear()
    .domain([d3.min(data, d => d.totalSec) - 2, d3.max(data, d => d.totalSec) + 2])
    .nice()
    .range([0, chartWidth])

  const y = d3.scaleLinear()
    .domain([1, 20])
    .range([0, chartHeight]) // 1 na parte superior, 20 na parte inferior

  // Renderizar pontos de dispersão
  g.selectAll(".dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", d => x(d.totalSec))
    .attr("cy", d => y(d.pos))
    .attr("r", 4.5)
    .attr("fill", "#3b82f6")
    .attr("stroke", "#020617")
    .attr("stroke-width", 0.5)
    .attr("fill-opacity", 0.75)
    .on("mouseover", (event, d) => {
      showTooltip(event, `
        <b>${d.driverName}</b><br>
        Corrida: ${d.raceName}<br>
        Tempo nos boxes: ${d.totalSec.toFixed(3)}s<br>
        Posição final: ${d.pos}º colocado
      `)
    })
    .on("mousemove", moveTooltip)
    .on("mouseout", hideTooltip)

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d => `${d}s`))

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(20).tickFormat(d => `${d}º`))

  // Calcular linha de regressão linear para mostrar tendência
  const xMean = d3.mean(data, d => d.totalSec)
  const yMean = d3.mean(data, d => d.pos)
  let num = 0
  let den = 0
  data.forEach(d => {
    num += (d.totalSec - xMean) * (d.pos - yMean)
    den += (d.totalSec - xMean) ** 2
  })
  const slope = den !== 0 ? num / den : 0
  const intercept = yMean - slope * xMean

  const xMin = d3.min(data, d => d.totalSec)
  const xMax = d3.max(data, d => d.totalSec)
  const y1 = slope * xMin + intercept
  const y2 = slope * xMax + intercept

  g.append("line")
    .attr("class", "trend-line")
    .attr("x1", x(xMin))
    .attr("y1", y(Math.max(1, Math.min(20, y1))))
    .attr("x2", x(xMax))
    .attr("y2", y(Math.max(1, Math.min(20, y2))))
    .attr("stroke", "#e10600")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4,4")
    .attr("opacity", 0.8)

  document.getElementById("pitCorrelationTitle").innerText = `Tempo nos Boxes vs Posição Final em ${selectedPitYear}`
}

// =====================================================
// 14. EVENTOS DOS CONTROLES
// =====================================================

function configureEvents() {
  // Configurar listeners de imediato (com checagens de arrays vazios para evitar falhas)

  slider.addEventListener("input", () => {
    if (dataGlobal.length === 0) return
    stopAnimation()
    update(+slider.value)
  })

  yearSelect.addEventListener("change", event => {
    if (dataGlobal.length === 0) return
    const year = +event.target.value
    selectLastRaceOfYear(year)
  })

  decadeSelect.addEventListener("change", event => {
    if (dataGlobal.length === 0) return
    const decade = event.target.value
    updateYearSelectForDecade(decade)
  })

  clearFilterBtn.addEventListener("click", () => {
    if (dataGlobal.length === 0) return
    selectedContinent = null
    decadeSelect.value = "all"
    updateYearSelectForDecade("all")
    stopAnimation()
    refreshAllVisualizations()
  })

  playBtn.onclick = () => {
    if (dataGlobal.length === 0) return
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

  // Eventos da aba de Hegemonia (Aba 2)
  toggleHegemonyTypeBtn.addEventListener("click", () => {
    if (resultsRaw.length === 0) return
    if (hegemonyType === "drivers") {
      hegemonyType = "constructors"
      toggleHegemonyTypeBtn.innerText = "Equipes"
      toggleHegemonyTypeBtn.classList.remove("primary-button")
      toggleHegemonyTypeBtn.classList.add("secondary-button")
    } else {
      hegemonyType = "drivers"
      toggleHegemonyTypeBtn.innerText = "Pilotos"
      toggleHegemonyTypeBtn.classList.remove("secondary-button")
      toggleHegemonyTypeBtn.classList.add("primary-button")
    }
    updateHegemonyChart()
    updateLeaderboardTable()
  })

  toggleHegemonyMetricBtn.addEventListener("click", () => {
    if (resultsRaw.length === 0) return
    if (hegemonyMetric === "championships") {
      hegemonyMetric = "wins"
      toggleHegemonyMetricBtn.innerText = "Vitórias em GPs"
    } else {
      hegemonyMetric = "championships"
      toggleHegemonyMetricBtn.innerText = "Campeonatos Mundiais"
    }
    updateHegemonyChart()
    updateLeaderboardTable()
  })

  // Eventos da aba de Pit Stops (Aba 4)
  pitYearSelect.addEventListener("change", event => {
    if (pitStopsRaw.length === 0) return
    selectedPitYear = +event.target.value
    drawPitStopCorrelationChart()
  })

  // Eventos de troca de Abas (Trabalha de imediato sem depender de carregamento de dados)
  document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"))
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"))

      button.classList.add("active")
      const tabId = button.getAttribute("data-tab")
      document.getElementById(`content-${tabId}`).classList.add("active")

      // Atualiza os gráficos específicos da aba selecionada (com verificações internas de carregamento)
      if (tabId === "global") {
        refreshAllVisualizations()
      } else if (tabId === "hegemonia") {
        updateHegemonyChart()
        updateLeaderboardTable()
      } else if (tabId === "pole") {
        updatePoleCharts()
      } else if (tabId === "pitstops") {
        updatePitStopCharts()
      }
    })
  })
}