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
