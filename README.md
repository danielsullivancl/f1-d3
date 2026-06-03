# f1-d3 — Visualização de Dados de Fórmula 1

Projeto de visualização de dados focado em corridas de Fórmula 1, usando dados tabulares disponibilizados em CSV e recursos geográficos locais.

## Descrição

Este repositório contém uma visualização interativa construída com HTML, CSS e JavaScript para explorar dados de corridas de F1 (pilotos, construtores, resultados, voltas, pit stops, etc.). O objetivo é oferecer painéis e gráficos que permitam analisar temporadas, corridas e desempenho ao longo do tempo.

## Tecnologias

- HTML5
- CSS3
- JavaScript (ES6+)
- D3.js (visualização de dados)
- GeoJSON/TopoJSON (arquivo `world.json` para mapas)
- Dados em CSV (pasta `data/`)

Não há build necessário — a aplicação é estática. Recomenda-se servir os arquivos via um servidor HTTP local para evitar restrições de CORS ao carregar os CSV/JSON.

## Estrutura do repositório

- index.html — ponto de entrada da aplicação
- script.js — código JavaScript principal
- style.css — estilos
- data/ — conjunto de arquivos CSV utilizados pela visualização
- img/ — imagens e recursos gráficos

Arquivos de dados incluídos (exemplos):

- circuits.csv
- constructor_results.csv
- constructor_standings.csv
- constructors.csv
- driver_standings.csv
- drivers.csv
- lap_times.csv
- pit_stops.csv
- qualifying.csv
- races.csv
- results.csv
- seasons.csv
- sprint_results.csv
- status.csv

## Como executar

Opções rápidas para servir os arquivos localmente:

```bash
# Python 3 (porta 8000)
python -m http.server 8000

# Node.js (http-server)
npx http-server -p 8000
```

Abra `http://localhost:8000` no navegador e carregue `index.html`.

## Fonte dos dados

Os dados estão no formato CSV na pasta `data/`. Eles parecem seguir o esquema comum de bases históricas de F1 (corridas, pilotos, construtores, tempos de volta, etc.). Se estes dados vierem de uma fonte pública (ex.: Ergast API), documente a origem e a licença dos dados aqui.

## API de Funções (resumo)

Abaixo há um resumo das funções principais implementadas em `script.js`. Use esta seção como referência rápida para entender responsabilidades e interações entre controles e visualizações.

- `showTooltip(event, html)`: exibe o tooltip com conteúdo HTML na posição do ponteiro.
- `moveTooltip(event)`: atualiza a posição do tooltip durante o movimento do mouse.
- `hideTooltip()`: oculta o tooltip.
- `haversine(a, b)`: calcula a distância (km) entre duas coordenadas `{lat, lng}` usando a fórmula de Haversine.
- `formatKm(value)`: formata um valor numérico em quilômetros no formato pt-BR com sufixo "km".
- `filteredByContinent(data)`: filtra um array de corridas pelo continente atualmente selecionado (`selectedContinent`).
- `updateFilterStatus()`: atualiza o texto do elemento de status de filtro (`filterStatus`).
- `stopAnimation()`: para a reprodução automática (intervalo) e atualiza o estado do botão de play.

- `update(i)`: função central que atualiza o estado para o índice `i` da sequência de corridas e chama todas as rotinas de desenho (mapa, gráficos, calendário).
- `updateMap(year, round)`: desenha pontos e rotas no mapa para a temporada até `round` do `year`, aplicando filtros e tooltips.
- `updateDistanceChart()`: calcula e desenha a distância total entre corridas por temporada (linha), com pontos clicáveis que selecionam o ano.
- `updateCountriesChart()`: conta e desenha o número de países visitados por temporada (linha), com interação para selecionar o ano.
- `updateContinentChart()`: desenha barras horizontais com contagem de corridas por continente para o `currentYear`; barras são clicáveis para filtrar.
- `updateDonutChart()`: cria um gráfico donut da distribuição continental para o `currentYear` com legenda e interações de filtro.
- `updateStackedAreaChart()`: monta um gráfico de área empilhada (proporções por continente ao longo dos anos) e permite filtragem por camada.
- `updateCalendar(year, round)`: desenha o calendário anual destacando os dias de corrida até `round` do `year` e exibe detalhes no tooltip.

- Handlers/UI: eventos do `slider`, `yearSelect`, `playBtn` e `clearFilterBtn` sincronizam o estado (índice/ano/filtro), controlam a reprodução e chamam `update()` ou funções de redraw apropriadas.

Se preferir, posso inserir esses resumos como comentários inline em `script.js` (cada função com uma breve descrição) ou expandir este bloco com exemplos de uso e trechos de código.
