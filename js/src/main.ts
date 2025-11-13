import * as d3 from 'd3'
import * as topojson from "topojson-client";
import './style.css'

import type {ExtendedTopology, IconsData, Planet} from './types'
import type {BaseType} from "d3";

const PLAYER_ICON_URL: string = "icon_transparent.webp"
const AUTOLATHE_ICON_URL: string = "https://stationeers-wiki.com/images/8/85/StructureAutolathe_BuildState4.png"

const svg = d3.select("#svg")
const tooltip = d3.select("#tooltip")
const colorFilter = d3.select("#colorFilter")

const container = document.getElementById("canvasContainer")
const buttonsHeader = document.getElementById("buttonsHeader")
const iconLayer = document.getElementById("iconLayer")
const toggleTerrain = document.getElementById('toggleTerrain') as HTMLInputElement
const toggleSpawn = document.getElementById('toggleSpawn') as HTMLInputElement
const toggleNorth = document.getElementById('toggleNorth') as HTMLInputElement
const sidePane = document.getElementById('sidePane')
const fileButtons = document.getElementById('fileButtons')
const root = document.getElementById('root')

function setCanvasSize(width: number, height: number) {
    console.log("Setting canvas size:", width, height)
    canvasWidth = width
    canvasHeight = height

    const svg = document.getElementById("svg")

    if (container && svg) {
        container.style.width = `${width}px`
        container.style.height = `${height}px`
        svg.setAttribute("width", String(width))
        svg.setAttribute("height", String(height))
    }

    // Update other related elements if needed
    if (iconLayer) {
        iconLayer.style.width = `${width}px`
        iconLayer.style.height = `${height}px`
    }

    if (buttonsHeader) {
        buttonsHeader.style.width = `${width}px`
    }
}

function getSettingsFromUI() {
    const transform = d3.zoomTransform(svg.node() as Element)
    const checkBoxes = colorFilter.selectAll("input[type=checkbox]").nodes() as HTMLInputElement[]
    selectedRegions = []
    for (const i in checkBoxes) {
        if (checkBoxes[i] && checkBoxes[i].checked)
            selectedRegions.push(+i)
    }


    const settings = {
        planet: currentPlanet,
        region: currentRegionType,
        terrain: toggleTerrain.checked ? '1' : '0',
        spawn: toggleSpawn.checked ? '1' : '0',
        zoom: transform.k.toFixed(2),
        x: Math.round(transform.x),
        y: Math.round(transform.y),
        selected: selectedRegions === null ? "" : selectedRegions.join('-'),
        rotate: northUp ? '1' : '0',
        icons: '',
    }

    if (iconsData.length > 0) {
        settings.icons = encodeURIComponent(JSON.stringify(iconsData))
    }

    // @ts-ignore
    const query = new URLSearchParams(settings).toString()
    navigator.clipboard.writeText(window.location.origin + window.location.pathname + '?' + query).then(() => {
    })
    alert("Link copied to clipboard!")
}

function applySettingsFromQuery(params: URLSearchParams) {
    const terrain = params.get('terrain')
    if (terrain !== null) {
        toggleTerrain.checked = terrain === '1'
    }

    const spawn = params.get('spawn')
    if (spawn !== null) {
        toggleSpawn.checked = spawn === '1'
    }
    const scale = parseFloat(params.get('zoom') ?? '1')
    const x = parseFloat(params.get('x') ?? '0')
    const y = parseFloat(params.get('y') ?? '0')

    if (!isNaN(scale) && !isNaN(x) && !isNaN(y)) {
        // @ts-ignore
        svg.call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale))
    }
    const selectedRegionsString = params.get('selected')
    if (selectedRegionsString === null)
        selectedRegions = [0]
    else
        selectedRegions = selectedRegionsString.split('-').map(s => parseInt(s))
    northUp = params.get("rotate") === '1'
    toggleNorth.checked = northUp

    isEmbed = params.get('embed') === '1'
    if (isEmbed) {
        if (fileButtons) {
            fileButtons.style.display = 'none'
        }
        if (sidePane) {
            sidePane.style.display = 'none'
        }

        if (root) {
            root.style.margin = '0px'
            root.style.width = `${canvasWidth}px`
            root.style.height = `${canvasHeight}px`
            root.style.padding = '0px'
            root.style.boxShadow = 'none'
        }

        document.body.style.background = 'none'
        document.body.style.overflow = 'hidden'
        document.body.style.margin = '0px'
    }

    const icons = params.get('icons')
    if (icons !== null) {
        try {
            iconsData = JSON.parse(decodeURIComponent(icons))
        } catch (e) {
            console.error("Failed to parse icons from URL:", e)
            iconsData = []
        }
    }
}

function updateIconPositions() {
    const transform = d3.zoomTransform(svg.node() as Element)
    const iconLayer = d3.select("#iconLayer")
    iconLayer.selectAll("img").each(function () {
        const img = d3.select(this)
        let dataX = +img.attr("data-x")
        let dataY = +img.attr("data-y")

        if (northUp) {
            dataX = -dataX
            dataY = -dataY
        }

        dataX = (dataX + 0.5) * canvasWidth
        dataY = (dataY + 0.5) * canvasHeight

        const screenX = transform.applyX(dataX)
        const screenY = transform.applyY(dataY)

        img.style("left", `${screenX}px`)
            .style("top", `${screenY}px`)

        const isVisible = screenX >= 0 && screenX <= canvasWidth && screenY >= 0 && screenY <= canvasHeight
        img.style("display", isVisible ? "block" : "none")
    })
}

function addIcons() {
    const iconLayer = d3.select("#iconLayer")
    iconLayer.selectAll("img").remove() // clean up

    for (const icon of iconsData) {
        let url = ""
        if (icon.type === "player") {
            url = PLAYER_ICON_URL
        } else if (icon.type === "autolathe") {
            url = AUTOLATHE_ICON_URL
        }

        const size = icon.size || 32
        iconLayer.append("img")
            .attr("src", url)
            .style("position", "absolute")
            .style("width", `${size}px`)
            .style("height", `${size}px`)
            .style("transform", "translate(-16px, -16px)") // center on position
            .attr("data-x", icon.position[0] / mapWidth)
            .attr("data-y", -icon.position[2] / mapHeight)
    }
    updateIconPositions()
}

async function loadData(planet: string): Promise<Planet> {

    const raw = await d3.json<Planet>(`data/${planet}.json`)
    if (!raw) {
        throw new Error(`Failed to load data for planet: ${planet}`)
    }

    const data: Planet = {}

    for (const key in raw) {
        if (['mining', 'names', 'poi'].includes(key)) {
            data[key] = topojson.feature(raw[key], raw[key].objects.data)
        } else {
            data[key] = raw[key]
        }
    }

    if (northUp) {
        for (const key of ['mining', 'names', 'poi']) {
            if (!data[key].features) continue
            data[key].features.forEach((f: ExtendedTopology) => {
                f.geometry.coordinates = f.geometry.coordinates.map((polygon: [number, number][]) => {
                    return polygon.map(([x, y]) => ([-x, -y]))
                })
            })
        }
    }

    return data
}

async function loadMap(planet: string, regionType: string) {
    currentPlanet = planet
    currentRegionType = regionType

    for (const group of ["mining", "names", "poi", "spawn"]) {
        svg.select("." + group).remove()
    }

    allData = await loadData(planet)

    const geoJson = allData.mining

    // Helper to get selected colors (excluding 'all')
    function getSelectedColors() {
        const checked = colorFilter.selectAll("input[type=checkbox]:checked").nodes() as HTMLInputElement[]
        const values = checked.map((input) => input.value)
        if (values.includes("all")) return true
        return new Set(values)
    }


    const projection = d3.geoIdentity().reflectY(true).fitSize([width, height], geoJson)
    const path = d3.geoPath().projection(projection)
    svg.selectAll("g").remove()
    const g = svg.append("g").attr("class", "imageGroup")
    const currentTransform = d3.zoomTransform(svg.node() as Element)
    // @ts-ignore
    g.attr("transform", currentTransform)
    const imgTransform = northUp ? `rotate(180, ${width / 2}, ${height / 2})` : ""
    const invertFilter = northUp ? "invert(1)" : "none"
    g.append("image")
        .attr("class", "terrainImage")
        .attr("href", `data/${planet}_terrain.webp`)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("opacity", 1.0)
        .attr("transform", imgTransform)
        .style("filter", invertFilter)


    const hideTooltip = () => {
        tooltip.style("opacity", 0.0)
    }
    svg.on("mouseleave", hideTooltip)

    svg.on("mousemove", function (event) {
        // Get mouse position in screen coords
        const [mouseX, mouseY] = d3.pointer(event)

        // Use the inverse of the current zoom transform to map back to SVG coords
        const transform = d3.zoomTransform(svg.node() as Element)
        const svgX = (mouseX - transform.x) / transform.k
        const svgY = (mouseY - transform.y) / transform.k

        let x = Math.round((svgX / canvasHeight - 0.5) * mapWidth)
        let y = Math.round((0.5 - svgY / canvasHeight) * mapHeight)
        if (northUp) {
            x = -x
            y = -y
        }

        if (x < -mapWidth / 2 || x > mapWidth / 2 || y < -mapHeight / 2 || y > mapHeight / 2) {
            hideTooltip()
            return
        }

        tooltip
            .style("opacity", 1)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 20) + "px")
            .html(`
              <strong>X:</strong> ${x} <br/>
              <strong>Z:</strong> ${y} <br/>`)
    })

    function addCompass() {
        svg.selectAll(".compass").remove()
        const size = 60
        const w2 = 10

        const compass = svg.append("g")
            .attr("class", "compass")

        const arrow = compass.append("g")
            .attr("class", "compass-arrow")

        const x0 = -w2
        const x1 = w2
        let y0 = 0
        let y1 = -size
        let textPos = 20

        if (northUp) {
            y0 = -size
            y1 = 0
            textPos = -size - 10
        }

        arrow.append("path")
            .attr("d", d3.line()([[0, y0], [x0, y1], [x1, y1], [0, y0]]))
            .attr("fill", "red")

        compass.append("text")
            .attr("y", textPos)
            .attr("text-anchor", "middle")
            .text("N")
            .style("font-size", "20px")
            .style("fill", "red")
            .style("stroke", "black")
            .style("stroke-width", "2px")
            .style("paint-order", "stroke")
    }

    function renderRegions(regionType: string, opacity: number, selectedColors: Set<string> | true | undefined) {
        addCompass()
        svg.select("." + regionType).remove()
        const g = svg.append("g").attr("class", regionType)
        const currentTransform = d3.zoomTransform(svg.node() as Element)
        // @ts-ignore
        g.attr("transform", currentTransform)
        const data = allData[regionType]

        const allFeatures = data.features

        const isVisible = (d: ExtendedTopology) => {
            if (selectedColors === undefined) return true
            if (selectedColors === true) return true
            const col = d.properties.color_hex
            if (col === undefined) return true
            return selectedColors.has(col)
        }

        g.selectAll("path")
            .data(allFeatures)
            .enter()
            .append("path")
            // @ts-ignore
            .attr("d", path)
            .style("opacity", opacity)
            .attr("fill", (d: ExtendedTopology) => {
                const c = d.properties.color_hex || "transparent"
                return isVisible(d) ? c : "transparent"
            })
            .style("mix-blend-mode", "multiply")

        g.selectAll("text")
            .data(allFeatures)
            .enter()
            .append("text")
            .style("font-size", "14px")
            .style("fill", "white")
            .style("stroke", "black")
            .style("stroke-width", "2px")
            .style("paint-order", "stroke")
            .attr("transform", (d: ExtendedTopology) => {
                const centroid = path.centroid(d)
                return `translate(${centroid[0]}, ${centroid[1]})`
            })
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .each(function (d: ExtendedTopology) {
                if (!isVisible(d)) return
                const textEl = d3.select(this)
                const lines = d.properties.name?.split(" ") || []
                const lineHeightEm = 1.2
                const offset = -((lines.length - 1) / 2) * lineHeightEm

                lines.forEach((line: string, i: number) => {
                    textEl.append("tspan")
                        .attr("x", 0)
                        .attr("dy", (i === 0 ? offset : lineHeightEm) + "em")
                        .text(line)
                })
            })

    }

    render = () => {
        const showTerrain = document.getElementById("toggleTerrain") as HTMLInputElement
        const showSpawn = document.getElementById("toggleSpawn") as HTMLInputElement

        svg.select(".terrainImage").attr("visibility", showTerrain.checked ? "visible" : "hidden")

        zoom.on("start", hideTooltip)

        const regionType = currentRegionType
        svg.select(".mining").remove()
        svg.select(".names").remove()
        svg.select(".poi").remove()
        svg.select(".spawn").remove()
        const opacity = showTerrain.checked || showSpawn.checked ? 0.7 : 1.0

        const selectedColors = getSelectedColors()
        renderRegions(regionType, opacity, selectedColors)

        const spawn = svg.append("g").attr("class", "spawn")
        spawn.attr("visibility", showSpawn.checked ? "visible" : "hidden")
        const currentTransform = d3.zoomTransform(svg.node() as Element)
        // @ts-ignore
        spawn.attr("transform", currentTransform)

        // @ts-ignore
        Object.entries(allData.start_locations).forEach(([name, coords]) => {
            let px = coords[0] / mapWidth + 0.5
            let py = 1.0 - (coords[1] / mapHeight + 0.5)
            if (northUp) {
                px = 1 - px
                py = 1 - py
            }
            const [x, y] = [width * px, height * py]

            spawn.append("circle")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 5)
                .attr("fill", "red")
                .attr("stroke", "black")
                .attr("stroke-width", 1)

            spawn.append("text")
                .attr("x", x + 7)
                .attr("y", y - 7)
                .text(name)
                .style("font-size", "14px")
                .style("fill", "white")
                .style("stroke", "black")
                .style("stroke-width", "2px")
                .style("paint-order", "stroke")
        })

        svg.select(".icons").raise()
        const compass = svg.select(".compass")
        compass.raise()
        compass.attr("transform", `translate(${width - 30}, ${height - 40})`)
    }

    // @ts-ignore
    svg.call(zoom)

    updateRender = () => {
        colorFilter.selectAll("*").remove() // clear filters
        const data = allData[currentRegionType].features

        const uniqueColors = Array.from(new Set(data.map((f: Planet) => f.properties.color_hex)))
            .filter(c => c) as number[]// remove undefined

        const color2Name: { [key: string]: string } = {}

        data.forEach((f: Planet) => {
            if (f.properties.color_hex)
                color2Name[f.properties.color_hex] = f.properties.name
        })

        // Add "All" checkbox for convenience
        colorFilter.append("label")
            .html(`<input type="checkbox" value="all"> All`)
            .style("margin-right", "10px")
            .style("display", "block")


        uniqueColors.forEach(color => {
            colorFilter.append("label")
                .html(`<input type="checkbox" value="${color}"> <span style="color:${color}">${color2Name[color]}</span>`)
                .style("display", "block")
                .style("margin-right", "10px")
        })
        for (const i in colorFilter.selectAll("input[type=checkbox]").nodes())
            if (selectedRegions.includes(parseInt(i))) {
                const nodes = colorFilter.selectAll("input[type=checkbox]").nodes()
                if (nodes[i]) {
                    const input = nodes[i] as HTMLInputElement
                    input.checked = true
                }
            }

        colorFilter.selectAll("input[type=checkbox]").on("change", function (this: BaseType) {
            const input = this as HTMLInputElement

            if (!input) {
                return
            }

            if (input.value === "all") {
                if (input.checked) {
                    colorFilter.selectAll("input[type=checkbox]").property("checked", false)
                    input.checked = true
                }
            } else {
                if (input.checked) {
                    colorFilter.select("input[value=all]").property("checked", false)
                }
                // If none checked, check "All"
                if (colorFilter.selectAll("input[type=checkbox]:checked").nodes().length === 0) {
                    colorFilter.select("input[value=all]").property("checked", true)
                }
            }

            render()
        })

        render()
    }

    updateRender()
    addIcons()
}

let isEmbed = false
let allData: Planet = {}
let iconsData: IconsData[] = []
const params: URLSearchParams = new URLSearchParams(window.location.search)
let canvasWidth = -1
let canvasHeight = -1
setCanvasSize(parseInt(params.get('width') || '800'), parseInt(params.get('height') || '800'))
const width = +svg.attr("width")
const height = +svg.attr("height")
let currentPlanet = params.get('planet') || 'lunar'
let currentRegionType = params.get('region') || 'mining'
let selectedRegions = [0]
let northUp = false
let mapWidth = 4000
let mapHeight = 4000

let updateRender = () => {
}
let render = () => {
}

const zoom = d3.zoom()
    .scaleExtent([1, 100])
    .on("zoom", (event) => {
        const t = event.transform
        for (const group of ["mining", "names", "poi", "spawn", "imageGroup"]) {
            svg.select("." + group).attr("transform", t)
        }
        updateIconPositions()
    })
applySettingsFromQuery(params)

loadMap(currentPlanet, currentRegionType).then(() => {
})

d3.selectAll("#planetButtons button").on("click", function () {
    const planet = d3.select(this).attr("data-file")
    // @ts-ignore
    svg.call(zoom.transform, d3.zoomIdentity)
    selectedRegions = [0]
    loadMap(planet, currentRegionType).then(() => {
    })
})
d3.selectAll("#regionTypeButtons button").on("click", function () {
    selectedRegions = [0]
    currentRegionType = d3.select(this).attr("data-region")
    updateRender()
})
d3.select("#toggleTerrain").on("change", () => {
    render()
})
d3.select("#toggleSpawn").on("change", () => {
    render()
})
d3.select("#toggleNorth").on("change", () => {
    northUp = d3.select("#toggleNorth").property("checked")
    loadMap(currentPlanet, currentRegionType).then(() => {
    })
})
d3.select("#share").on("click", () => {
    getSettingsFromUI()
})
