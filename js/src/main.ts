import * as d3 from 'd3'
import * as topojson from "topojson-client";
import './style.css'

import type {ExtendedTopology, IconsData, Planet} from './types'
import type {BaseType} from "d3";
import {themeToggle, container, toggleTerrain, toggleSpawn, toggleNorth, fileButtons, sidePane, root} from "./elements";
import {AUTOLATHE_ICON_URL, PLAYER_ICON_URL} from "./constants";
import {onClickThemeToggle} from "./theme";
import {getFromLocalStorage, saveToLocalStorage} from "./localstorage.ts";

// Modal
import {closeModal, openModal} from './modal';
;(window as any).closeModal = closeModal;

// State variables
const params = new URLSearchParams(window.location.search)
let canvasWidth = parseInt(params.get('width') || '800')
let canvasHeight = parseInt(params.get('height') || '800')
let currentPlanet = params.get('planet') || getFromLocalStorage('planet', 'lunar')
let currentRegionType = params.get('region') || getFromLocalStorage('region', 'mining')
let selectedRegions = [0]
let northUp = getFromLocalStorage('rotate', '0') === '1'
let isEmbed = false
let allData: Planet = {}
let iconsData: IconsData[] = []
const mapWidth = 4000
const mapHeight = 4000

// D3 selections
const svg = d3.select("#svg")
const tooltip = d3.select("#tooltip")
const colorFilter = d3.select("#colorFilter")

// Render functions (initialized later)
let updateRender = () => {}
let render = () => {}

// Zoom behavior
const zoom = d3.zoom()
    .scaleExtent([1, 100])
    .on("zoom", (event) => {
        console.log("Zoom event:", event.transform)
        saveToLocalStorage("zoom", event.transform.k)
        saveToLocalStorage("x", event.transform.x)
        saveToLocalStorage("y", event.transform.y)
        const groups = ["mining", "names", "poi", "spawn", "imageGroup"]
        groups.forEach(group => svg.select(`.${group}`).attr("transform", event.transform))
        updateIconPositions()
    })

function setCanvasSize(width: number, height: number) {
    console.log("Setting canvas size:", width, height)
    canvasWidth = width
    canvasHeight = height

    const svgEl = document.getElementById("svg")
    if (container && svgEl) {
        container.style.width = `${width}px`
        container.style.height = `${height}px`
        svgEl.setAttribute("width", String(width))
        svgEl.setAttribute("height", String(height))
    }
}

function boolToString(value: boolean): string {
    return value ? '1' : '0'
}

function getSettingsFromUI() {
    const transform = d3.zoomTransform(svg.node() as Element)
    const checkBoxes = colorFilter.selectAll("input[type=checkbox]").nodes() as HTMLInputElement[]
    selectedRegions = checkBoxes.map((cb, i) => cb.checked ? i : -1).filter(i => i >= 0)

    const settings = {
        planet: currentPlanet,
        region: currentRegionType,
        terrain: boolToString(toggleTerrain.checked),
        spawn: boolToString(toggleSpawn.checked),
        zoom: transform.k.toFixed(2),
        x: Math.round(transform.x).toString(),
        y: Math.round(transform.y).toString(),
        selected: selectedRegions.join('-'),
        rotate: boolToString(northUp),
        icons: iconsData.length > 0 ? encodeURIComponent(JSON.stringify(iconsData)) : '',
    }

    const query = new URLSearchParams(settings).toString()
    const url = `${window.location.origin}${window.location.pathname}?${query}`
    navigator.clipboard.writeText(url).then(() => {
        openModal('Link copied to clipboard!', `<p class="mt-10"><a target="_blank" href="${url}">${url}</a></p>`)
    })
}

function applySettingsFromQuery(params: URLSearchParams) {
    toggleTerrain.checked = (params.get('terrain') || getFromLocalStorage('terrain', '1')) === '1'
    toggleSpawn.checked = (params.get('spawn') || getFromLocalStorage('spawn', '1')) === '1'
    toggleNorth.checked = (params.get("rotate") || getFromLocalStorage('rotate', '0')) === '1'

    const scale = parseFloat(params.get('zoom') ?? getFromLocalStorage('zoom', '1'))
    const x = parseFloat(params.get('x') ?? getFromLocalStorage('x', '0'))
    const y = parseFloat(params.get('y') ?? getFromLocalStorage('y', '0'))
    if (!isNaN(scale) && !isNaN(x) && !isNaN(y)) {
        // @ts-ignore
        svg.call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale))
    }

    const selectedRegionsString = params.get('selected') || getFromLocalStorage('selectedRegions', '0')
    selectedRegions = selectedRegionsString.split('-').map(s => parseInt(s))

    isEmbed = params.get('embed') === '1'
    if (isEmbed) {
        fileButtons?.style.setProperty('display', 'none')
        sidePane?.style.setProperty('display', 'none')
        if (root) {
            Object.assign(root.style, {
                margin: '0px',
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                padding: '0px',
                boxShadow: 'none'
            })
        }
        Object.assign(document.body.style, {
            background: 'none',
            overflow: 'hidden',
            margin: '0px'
        })
    }

    const icons = params.get('icons')
    if (icons) {
        try {
            iconsData = JSON.parse(decodeURIComponent(icons))
        } catch (e) {
            console.error("Failed to parse icons from URL:", e)
        }
    }
}

function normalizeCoordinate(x: number, y: number): [number, number] {
    return northUp ? [-x, -y] : [x, y]
}

function updateIconPositions() {
    const transform = d3.zoomTransform(svg.node() as Element)
    d3.select("#iconLayer").selectAll("img").each(function () {
        const img = d3.select(this)
        let [dataX, dataY] = normalizeCoordinate(+img.attr("data-x"), +img.attr("data-y"))

        dataX = (dataX + 0.5) * canvasWidth
        dataY = (dataY + 0.5) * canvasHeight

        const screenX = transform.applyX(dataX)
        const screenY = transform.applyY(dataY)
        const isVisible = screenX >= 0 && screenX <= canvasWidth && screenY >= 0 && screenY <= canvasHeight

        img.style("left", `${screenX}px`)
           .style("top", `${screenY}px`)
           .style("display", isVisible ? "block" : "none")
    })
}

function addIcons() {
    const iconLayer = d3.select("#iconLayer")
    iconLayer.selectAll("img").remove()

    iconsData.forEach(icon => {
        const url = icon.type === "player" ? PLAYER_ICON_URL :
                    icon.type === "autolathe" ? AUTOLATHE_ICON_URL : ""
        const size = icon.size || 32

        iconLayer.append("img")
            .attr("src", url)
            .style("position", "absolute")
            .style("width", `${size}px`)
            .style("height", `${size}px`)
            .style("transform", "translate(-16px, -16px)")
            .attr("data-x", icon.position[0] / mapWidth)
            .attr("data-y", -icon.position[2] / mapHeight)
    })
    updateIconPositions()
}

async function loadData(planet: string): Promise<Planet> {
    const raw = await d3.json<Planet>(`data/${planet}.json`)
    if (!raw) throw new Error(`Failed to load data for planet: ${planet}`)

    const data: Planet = {}
    for (const key in raw) {
        data[key] = ['mining', 'names', 'poi'].includes(key)
            ? topojson.feature(raw[key], raw[key].objects.data)
            : raw[key]
    }

    if (northUp) {
        ['mining', 'names', 'poi'].forEach(key => {
            data[key]?.features?.forEach((f: ExtendedTopology) => {
                f.geometry.coordinates = f.geometry.coordinates.map((polygon: [number, number][]) =>
                    polygon.map(([x, y]) => [-x, -y])
                )
            })
        })
    }

    return data
}

async function loadMap(planet: string, regionType: string) {
    currentPlanet = planet
    currentRegionType = regionType

    const groups = ["mining", "names", "poi", "spawn"]
    for (const group of groups) {
        svg.select(`.${group}`).remove()
    }

    allData = await loadData(planet)

    const width = +svg.attr("width")
    const height = +svg.attr("height")
    const projection = d3.geoIdentity().reflectY(true).fitSize([width, height], allData.mining)
    const path = d3.geoPath().projection(projection)

    svg.selectAll("g").remove()
    const imageGroup = svg.append("g").attr("class", "imageGroup")
    const currentTransform = d3.zoomTransform(svg.node() as Element)
    // @ts-ignore
    imageGroup.attr("transform", currentTransform)

    const imgTransform = northUp ? `rotate(180, ${width / 2}, ${height / 2})` : ""
    imageGroup.append("image")
        .attr("class", "terrainImage")
        .attr("href", `data/${planet}_terrain.webp`)
        .attr("x", 0).attr("y", 0)
        .attr("width", width).attr("height", height)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("opacity", 1.0)
        .attr("transform", imgTransform)
        .style("filter", northUp ? "invert(1)" : "none")

    setupMouseHandlers()
    setupRenderFunctions(path, width, height)

    // @ts-ignore
    svg.call(zoom)
    updateRender()
    addIcons()
}

function setupMouseHandlers() {
    const hideTooltip = () => tooltip.style("opacity", 0)

    svg.on("mouseleave", hideTooltip)
    svg.on("mousemove", (event) => {
        const [mouseX, mouseY] = d3.pointer(event)
        const transform = d3.zoomTransform(svg.node() as Element)
        const svgX = (mouseX - transform.x) / transform.k
        const svgY = (mouseY - transform.y) / transform.k

        let [x, y] = normalizeCoordinate(
            Math.round((svgX / canvasHeight - 0.5) * mapWidth),
            Math.round((0.5 - svgY / canvasHeight) * mapHeight)
        )

        if (Math.abs(x) > mapWidth / 2 || Math.abs(y) > mapHeight / 2) {
            hideTooltip()
            return
        }

        tooltip.style("opacity", 1)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY + 20}px`)
            .html(`<strong>X:</strong> ${x} <br/><strong>Z:</strong> ${y} <br/>`)
    })
}

function addCompass(width: number, height: number) {
    svg.selectAll(".compass").remove()
    const compass = svg.append("g").attr("class", "compass")
    const arrow = compass.append("g").attr("class", "compass-arrow")

    const size = 60
    const [y0, y1, textPos] = northUp ? [-size, 0, -size - 10] : [0, -size, 20]

    arrow.append("path")
        .attr("d", d3.line()([[0, y0], [-10, y1], [10, y1], [0, y0]]))
        .attr("fill", "red")

    compass.append("text")
        .attr("y", textPos).attr("text-anchor", "middle")
        .text("N")
        .style("font-size", "20px").style("fill", "red")
        .style("stroke", "black").style("stroke-width", "2px")
        .style("paint-order", "stroke")

    compass.attr("transform", `translate(${width - 30}, ${height - 40})`)
}

function setupRenderFunctions(path: d3.GeoPath, width: number, height: number) {
    function getSelectedColors() {
        const checkBoxes = colorFilter.selectAll("input[type=checkbox]").nodes() as HTMLInputElement[]
        const checkedColors = checkBoxes.filter(input => input.checked)
        const checkedIndexes = checkedColors.map(input => checkBoxes.indexOf(input))
        saveToLocalStorage('selectedRegions', checkedIndexes.join('-'))
        const values = checkedColors.map(input => input.value)
        return values.includes("all") ? true : new Set(values)
    }

    function renderRegions(regionType: string, opacity: number, selectedColors: Set<string> | true | undefined) {
        svg.select(`.${regionType}`).remove()
        const g = svg.append("g").attr("class", regionType)
        const currentTransform = d3.zoomTransform(svg.node() as Element)
        // @ts-ignore
        g.attr("transform", currentTransform)

        const isVisible = (d: ExtendedTopology) =>
            !selectedColors || selectedColors === true ||
            !d.properties.color_hex || selectedColors.has(d.properties.color_hex)

        const features = allData[regionType].features

        g.selectAll("path").data(features).enter().append("path")
            // @ts-ignore
            .attr("d", path)
            .style("opacity", opacity)
            .attr("fill", (d: ExtendedTopology) =>
                isVisible(d) ? (d.properties.color_hex || "transparent") : "transparent"
            )
            .style("mix-blend-mode", "multiply")

        g.selectAll("text").data(features).enter().append("text")
            .style("font-size", "14px").style("fill", "white")
            .style("stroke", "black").style("stroke-width", "2px")
            .style("paint-order", "stroke")
            .attr("transform", (d: ExtendedTopology) => {
                const [x, y] = path.centroid(d)
                return `translate(${x}, ${y})`
            })
            .attr("text-anchor", "middle").attr("alignment-baseline", "middle")
            .each(function (d: ExtendedTopology) {
                if (!isVisible(d)) return
                const lines = d.properties.name?.split(" ") || []
                const lineHeightEm = 1.2
                const offset = -((lines.length - 1) / 2) * lineHeightEm

                lines.forEach((line: string, i: number) => {
                    d3.select(this).append("tspan")
                        .attr("x", 0)
                        .attr("dy", `${i === 0 ? offset : lineHeightEm}em`)
                        .text(line)
                })
            })
    }

    render = () => {
        svg.select(".terrainImage").attr("visibility", toggleTerrain.checked ? "visible" : "hidden")
        zoom.on("start", () => tooltip.style("opacity", 0))

        const groups = ["mining", "names", "poi", "spawn"]
        for (const g of groups) {
            svg.select(`.${g}`).remove()
        }

        const opacity = (toggleTerrain.checked || toggleSpawn.checked) ? 0.7 : 1.0
        const selectedColors = getSelectedColors()

        addCompass(width, height)
        renderRegions(currentRegionType, opacity, selectedColors)

        const spawn = svg.append("g").attr("class", "spawn")
        spawn.attr("visibility", toggleSpawn.checked ? "visible" : "hidden")
        const spawnTransform = d3.zoomTransform(svg.node() as Element)
        // @ts-ignore
        spawn.attr("transform", spawnTransform)

        Object.entries(allData.start_locations || {}).forEach(([name, coords]) => {
            let [px, py] = [coords[0] / mapWidth + 0.5, 1.0 - (coords[1] / mapHeight + 0.5)]
            if (northUp) [px, py] = [1 - px, 1 - py]
            const [x, y] = [width * px, height * py]

            spawn.append("circle")
                .attr("cx", x).attr("cy", y).attr("r", 5)
                .attr("fill", "red").attr("stroke", "black").attr("stroke-width", 1)

            spawn.append("text")
                .attr("x", x + 7).attr("y", y - 7).text(name)
                .style("font-size", "14px").style("fill", "white")
                .style("stroke", "black").style("stroke-width", "2px")
                .style("paint-order", "stroke")
        })

        svg.select(".icons").raise()
        svg.select(".compass").raise()
    }

    updateRender = () => {
        colorFilter.selectAll("*").remove()
        const features = allData[currentRegionType].features
        const uniqueColors = Array.from(new Set(
            features.map((f: Planet) => f.properties.color_hex).filter(Boolean)
        ))

        const color2Name: { [key: string]: string } = {}
        features.forEach((f: Planet) => {
            if (f.properties.color_hex) color2Name[f.properties.color_hex] = f.properties.name
        })

        colorFilter.append("label")
            .html(`<input type="checkbox" value="all"> All`)
            .style("display", "block").style("margin-right", "10px")

        uniqueColors.forEach(color => {
            colorFilter.append("label")
                .html(`<input type="checkbox" value="${color}"> <span style="color:${color}">${color2Name[color as string]}</span>`)
                .style("display", "block").style("margin-right", "10px")
        })

        const checkboxNodes = colorFilter.selectAll("input[type=checkbox]").nodes()
        selectedRegions.forEach(i => {
            const input = checkboxNodes[i] as HTMLInputElement
            if (input) input.checked = true
        })

        colorFilter.selectAll("input[type=checkbox]").on("change", function (this: BaseType) {
            const input = this as HTMLInputElement
            if (!input) return

            if (input.value === "all" && input.checked) {
                colorFilter.selectAll("input[type=checkbox]").property("checked", false)
                input.checked = true
            } else {
                if (input.checked) {
                    colorFilter.select("input[value=all]").property("checked", false)
                }
                if (colorFilter.selectAll("input[type=checkbox]:checked").nodes().length === 0) {
                    colorFilter.select("input[value=all]").property("checked", true)
                }
            }
            render()
        })

        render()
    }
}

// Initialize
setCanvasSize(canvasWidth, canvasHeight)
themeToggle?.addEventListener('click', onClickThemeToggle)
applySettingsFromQuery(params)
loadMap(currentPlanet, currentRegionType).then(() => {})

// Event handlers
d3.selectAll("#planetButtons button").on("click", function () {
    const planet = d3.select(this).attr("data-file")
    // @ts-ignore
    svg.call(zoom.transform, d3.zoomIdentity)
    selectedRegions = [0]
    saveToLocalStorage('selectedRegions', '0')
    saveToLocalStorage('planet', planet)
    loadMap(planet, currentRegionType).then(() => {})
})

d3.selectAll("#regionTypeButtons button").on("click", function () {
    selectedRegions = [0]
    currentRegionType = d3.select(this).attr("data-region")
    saveToLocalStorage('region', currentRegionType)
    updateRender()
})

d3.select("#toggleTerrain").on("change", () => {
    saveToLocalStorage('terrain', boolToString(toggleTerrain.checked))
    render()
})

d3.select("#toggleSpawn").on("change", () => {
    saveToLocalStorage('spawn', boolToString(toggleSpawn.checked))
    render()
})

d3.select("#toggleNorth").on("change", () => {
    northUp = d3.select("#toggleNorth").property("checked")
    saveToLocalStorage('rotate', boolToString(northUp))
    loadMap(currentPlanet, currentRegionType).then(() => {})
})

d3.select("#share").on("click", getSettingsFromUI)
