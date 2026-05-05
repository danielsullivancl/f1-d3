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

const tooltip = d3.select("body")
  .append("div")
  .style("position", "absolute")
  .style("background", "#0f172a")
  .style("color", "white")
  .style("padding", "6px 10px")
  .style("border-radius", "6px")
  .style("font-size", "12px")
  .style("pointer-events", "none")
  .style("opacity", 0)

let dataGlobal
let racesData
let currentYear = null

const countryToContinent = {
  // Europa
  "UK": "Europe",
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

    return {
      year: r.year,
      round: r.round,
      lat: c ? c.lat : null,
      lng: c ? c.lng : null,
      country: c ? c.country : null
    }
  })
  .filter(d => d.lat && d.lng)
  .sort((a,b) => a.year - b.year || a.round - b.round)

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

  function haversine(a,b){
    const R = 6371
    const dLat = (b.lat-a.lat)*Math.PI/180
    const dLon = (b.lng-a.lng)*Math.PI/180
    const x = Math.sin(dLat/2)**2 +
      Math.cos(a.lat*Math.PI/180) *
      Math.cos(b.lat*Math.PI/180) *
      Math.sin(dLon/2)**2

    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
  }

  function update(i){

    const d = data[i]
    currentYear = d.year

    yearSelect.value = currentYear
    label.innerText = `${d.year} - Round ${d.round}`

    const temporada = data.filter(x =>
      x.year === d.year && x.round <= d.round
    )

    svg.selectAll("circle").remove()
    svg.selectAll(".rota").remove()

    svg.selectAll("circle")
  .data(temporada)
  .enter()
  .append("circle")
  .attr("cx", d => projection([d.lng, d.lat])[0])
  .attr("cy", d => projection([d.lng, d.lat])[1])
  .attr("r", 5)
  .attr("fill", "#ef4444")
  .attr("stroke", "white")

  // 👇 HOVER
  .on("mouseover", (event,d) => {
    tooltip.style("opacity",1)
      .html(`
        <b>${d.country}</b><br>
        Ano: ${d.year}<br>
        Round: ${d.round}
      `)
  })
  .on("mousemove", (event) => {
    tooltip.style("left",(event.pageX+10)+"px")
           .style("top",(event.pageY-20)+"px")
  })
  .on("mouseout", () => tooltip.style("opacity",0))

    if (temporada.length > 1){
      const prev = temporada[temporada.length - 2]

      svg.append("path")
        .attr("class", "rota")
        .attr("d", path({
          type: "LineString",
          coordinates: [
            [prev.lng, prev.lat],
            [d.lng, d.lat]
          ]
        }))
        .attr("fill", "none")
        .attr("stroke", "#facc15")
        .attr("stroke-width", 3)
    }

    updateDistanceChart()
    updateCountriesChart()
    updateContinentChart()
    updateCalendar(d.year, d.round)
  }

  function updateDistanceChart(){

    const svgLine = d3.select("#lineChart")
    svgLine.selectAll("*").remove()

    const grouped = d3.group(dataGlobal, d => d.year)
    const dados = []

    grouped.forEach((values, year) => {
      let total = 0

      values.sort((a,b) => a.round - b.round)

      for (let i = 1; i < values.length; i++) {
        total += haversine(values[i-1], values[i])
      }

      dados.push({year, total})
    })

    dados.sort((a,b) => a.year - b.year)

    const x = d3.scaleLinear()
      .domain(d3.extent(dados, d => d.year))
      .range([60,420])

    const y = d3.scaleLinear()
      .domain([0, d3.max(dados, d => d.total)])
      .range([200,20])

    svgLine.append("path")
      .datum(dados)
      .attr("fill","none")
      .attr("stroke","#94a3b8")
      .attr("stroke-width",2)
      .attr("d", d3.line()
        .x(d => x(d.year))
        .y(d => y(d.total))
      )

    const atual = dados.find(d => d.year === currentYear)

    svgLine.append("circle")
  .attr("cx", x(atual.year))
  .attr("cy", y(atual.total))
  .attr("r", 6)
  .attr("fill", "#ef4444")

  // 👇 HOVER
  .on("mouseover", (event) => {
    tooltip.style("opacity",1)
      .html(`
        Ano: ${atual.year}<br>
        Distância: ${Math.round(atual.total)} km
      `)
  })
  .on("mousemove", (event) => {
    tooltip.style("left",(event.pageX+10)+"px")
           .style("top",(event.pageY-20)+"px")
  })
  .on("mouseout", () => tooltip.style("opacity",0))

    svgLine.append("g")
      .attr("transform","translate(0,200)")
      .call(d3.axisBottom(x).ticks(6))

    svgLine.append("g")
      .attr("transform","translate(60,0)")
      .call(d3.axisLeft(y))

    svgLine.append("text")
      .attr("x", 240)
      .attr("y", 10)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "14px")
      .text("Distância total por temporada (km)")
  }

  function updateCountriesChart(){

    const svgCountries = d3.select("#countriesChart")
    svgCountries.selectAll("*").remove()

    const grouped = d3.rollup(
      dataGlobal,
      v => new Set(v.map(d => d.country)).size,
      d => d.year
    )

    const dados = Array.from(grouped, ([year,count]) => ({year,count}))
      .sort((a,b) => a.year - b.year)

    const x = d3.scaleLinear()
      .domain(d3.extent(dados, d => d.year))
      .range([60,420])

    const y = d3.scaleLinear()
      .domain([0, d3.max(dados, d => d.count)])
      .range([200,20])

    svgCountries.append("path")
      .datum(dados)
      .attr("fill","none")
      .attr("stroke","#94a3b8")
      .attr("stroke-width",2)
      .attr("d", d3.line()
        .x(d => x(d.year))
        .y(d => y(d.count))
      )

    const atual = dados.find(d => d.year === currentYear)

svgCountries.append("circle")
  .attr("cx", x(atual.year))
  .attr("cy", y(atual.count))
  .attr("r", 6)
  .attr("fill", "#ef4444")

  // 👇 HOVER
  .on("mouseover", (event) => {
    tooltip.style("opacity",1)
      .html(`
        Ano: ${atual.year}<br>
        Países: ${atual.count}
      `)
  })
  .on("mousemove", (event) => {
    tooltip.style("left",(event.pageX+10)+"px")
           .style("top",(event.pageY-20)+"px")
  })
  .on("mouseout", () => tooltip.style("opacity",0))

    svgCountries.append("g")
      .attr("transform","translate(0,200)")
      .call(d3.axisBottom(x).ticks(6))

    svgCountries.append("g")
      .attr("transform","translate(60,0)")
      .call(d3.axisLeft(y))

    svgCountries.append("text")
      .attr("x", 240)
      .attr("y", 10)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "14px")
      .text("Número de países por temporada")
  }

  function updateContinentChart(){

    const svgContinent = d3.select("#continentChart")
    svgContinent.selectAll("*").remove()

    const dadosAno = dataGlobal.filter(d => d.year === currentYear)

    const counts = {}

    dadosAno.forEach(d => {
      const continent = countryToContinent[d.country]

      if (!continent) {
        console.log("País sem continente:", d.country)
        return
      }

      counts[continent] = (counts[continent] || 0) + 1
    })

    const dados = Object.entries(counts)
      .map(([continent, count]) => ({continent, count}))
      .sort((a,b) => b.count - a.count)

    const x = d3.scaleLinear()
      .domain([0, d3.max(dados, d => d.count)])
      .range([120,420])

    const y = d3.scaleBand()
      .domain(dados.map(d => d.continent))
      .range([30,200])
      .padding(0.25)

    const color = d3.scaleSequential()
      .domain([0, d3.max(dados, d => d.count)])
      .interpolator(t => d3.interpolateReds(0.35 + 0.65 * t))

    svgContinent.selectAll("rect")
        .data(dados)
        .enter()
        .append("rect")
        .attr("x",120)
        .attr("y",d => y(d.continent))
        .attr("width",d => x(d.count) - 120)
        .attr("height",y.bandwidth())
        .attr("fill",d => color(d.count))

        // 👇 HOVER
        .on("mouseover", (event,d) => {
            tooltip.style("opacity",1)
            .html(`
                ${d.continent}<br>
                ${d.count} corridas
            `)
        })
        .on("mousemove", (event) => {
            tooltip.style("left",(event.pageX+10)+"px")
                .style("top",(event.pageY-20)+"px")
        })
        .on("mouseout", () => tooltip.style("opacity",0))

    svgContinent.selectAll(".value")
      .data(dados)
      .enter()
      .append("text")
      .attr("class","value")
      .attr("x",d => x(d.count) + 5)
      .attr("y",d => y(d.continent) + y.bandwidth()/2 + 4)
      .attr("fill","white")
      .attr("font-size","11px")
      .text(d => d.count)

    svgContinent.append("g")
      .attr("transform","translate(120,0)")
      .call(d3.axisLeft(y))

    svgContinent.append("g")
      .attr("transform","translate(0,200)")
      .call(d3.axisBottom(x).ticks(5))

    svgContinent.append("text")
      .attr("x", 240)
      .attr("y", 10)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "14px")
      .text("Corridas por continente")
  }

  function updateCalendar(year, round){

    calendarSvg.selectAll("*").remove()

    const dadosAno = dataGlobal.filter(d =>
      d.year === year && d.round <= round
    )

    const cellSize = 12
    const parseDate = d3.timeParse("%Y-%m-%d")

    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31)
    const dias = d3.timeDays(start, end)

    const corridaPorDia = new Map()

    dadosAno.forEach(d => {
      const race = racesData.find(r =>
        +r.year === d.year && +r.round === d.round
      )

      if (race) {
        const date = parseDate(race.date)
        corridaPorDia.set(date.toDateString(), 1)
      }
    })

    const g = calendarSvg.append("g")
      .attr("transform","translate(40,20)")

  g.selectAll("rect")
  .data(dias)
  .enter()
  .append("rect")
  .attr("x", d => d3.timeWeek.count(start, d) * cellSize)
  .attr("y", d => d.getDay() * cellSize)
  .attr("width", cellSize - 2)
  .attr("height", cellSize - 2)
  .attr("fill", d =>
    corridaPorDia.get(d.toDateString()) ? "#f87171" : "#0f172a"
  )

  // 👇 HOVER
  .on("mouseover", (event,d) => {

    const temCorrida = corridaPorDia.get(d.toDateString())

    tooltip.style("opacity",1)
      .html(`
        ${d3.timeFormat("%d/%m/%Y")(d)}<br>
        ${temCorrida ? "🏁 Corrida" : "Sem corrida"}
      `)
  })
  .on("mousemove", (event) => {
    tooltip.style("left",(event.pageX+10)+"px")
           .style("top",(event.pageY-20)+"px")
  })
  .on("mouseout", () => tooltip.style("opacity",0))

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

    const diasSemana = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]

    g.selectAll(".day-label")
      .data(diasSemana)
      .enter()
      .append("text")
      .attr("x", -10)
      .attr("y", (d,i) => i * cellSize + 10)
      .attr("text-anchor","end")
      .attr("fill","#94a3b8")
      .attr("font-size","10px")
      .text(d => d)
  }

  update(0)

  slider.addEventListener("input", () => {
    update(+slider.value)
  })

  yearSelect.addEventListener("change", e => {
    const year = +e.target.value

    const index = data
      .map((d,i) => ({d,i}))
      .filter(x => x.d.year === year)
      .pop().i

    slider.value = index
    update(index)
  })

  let playing = false
  let interval

  playBtn.onclick = () => {
    if (!playing){
      playing = true
      playBtn.innerText = "⏸"

      interval = setInterval(() => {
        let v = +slider.value

        if (v >= data.length - 1){
          clearInterval(interval)
          playing = false
          playBtn.innerText = "▶"
          return
        }

        slider.value = v + 1
        update(v + 1)
      },400)

    } else {
      clearInterval(interval)
      playing = false
      playBtn.innerText = "▶"
    }
  }

})