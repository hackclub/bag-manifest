;(async () => {
  // Load items.yaml and recipes.yaml
  const itemsYaml = await $.get('./items.yaml')
  const recipesYaml = await $.get('./recipes.yaml')

  const items = jsyaml.load(itemsYaml, 'utf8')
  const recipes = jsyaml.load(recipesYaml, 'utf8')

  console.log('Items:', items)
  console.log('Recipes:', recipes)

  // Combine items and recipes into a single array
  const nodes = [...items, ...recipes]

  const canvasWidth = innerWidth
  const canvasHeight = innerHeight

  const itemImageSize = 40
  const recipeImageSize = 20

  const inputColor = 'red'
  const toolColor = 'blue'
  const outputColor = 'green'

  // Define a deterministic random number generator function
  function seededRandom(seed) {
    var x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  // Update the position initialization loop to use seeded random numbers
  _.each(nodes, (v, i) => {
    // Clone the item into itself to create the tooltip info
    v.tooltip = _.cloneDeep(v)

    // Use the node's index as the seed
    const seed = i
    const randX = seededRandom(seed) * canvasWidth
    const randY = seededRandom(seed + 1) * canvasHeight
    v.x = randX
    v.y = randY

    v.index = i
  })

  console.log('Nodes:', nodes)

  // Create a new SVG container
  const container = d3.select(document.body).append('div')

  // Add an SVG element to the container
  const svg = container
    .append('svg')
    .attr('width', canvasWidth)
    .attr('height', canvasHeight)
    .append('g') // Append a 'g' element for grouping elements

  // Define the zoom behavior
  const zoom = d3.zoom().on('zoom', (event) => {
    svg.attr('transform', event.transform)
  })

  container.call(zoom)

  // Append the arrowhead marker for input links
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'input-arrowhead')
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('refX', 5)
    .attr('refY', 2.5)
    .attr('orient', 'auto')
    .attr('fill', inputColor)
    .append('polygon')
    .attr('points', '0 0, 5 2.5, 0 5') // Adjust the shape of the arrowhead

  // Append the arrowhead marker for input links
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'tool-arrowhead')
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('refX', 5)
    .attr('refY', 2.5)
    .attr('orient', 'auto')
    .attr('fill', toolColor)
    .append('polygon')
    .attr('points', '0 0, 5 2.5, 0 5') // Adjust the shape of the arrowhead

  // Append the arrowhead marker for output links
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'output-arrowhead')
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('refX', 5)
    .attr('refY', 2.5)
    .attr('orient', 'auto')
    .attr('fill', outputColor)
    .append('polygon')
    .attr('points', '0 0, 5 2.5, 0 5') // Adjust the shape of the arrowhead

  // Create links for inputs
  const inputLinks = svg
    .selectAll('.input-link')
    .data(recipes)
    .enter()
    .append('g')
    .attr('class', 'input-link-group')
    .selectAll('.input-link')
    .data((d) =>
      d.inputs.map((input) => {
        const sourceIndex = nodes.findIndex((node) => node.name === input)
        if (sourceIndex === -1) {
          console.error(`Input not found for recipe: ${JSON.stringify(d)}`)
        }
        const inputLink = {
          source: sourceIndex,
          target: nodes.indexOf(d),
          item: nodes[sourceIndex],
          recipe: d,
        }
        return inputLink
      })
    )
    .enter()
    .append('line')
    .attr('class', 'input-link')
    .attr('stroke', inputColor)
    .attr('stroke-width', 2)
    .attr('pointer-events', 'none')
    .attr('marker-end', 'url(#input-arrowhead)') // Add arrowhead to the line

  // Create links for tools
  const toolLinks = svg
    .selectAll('.tool-link')
    .data(recipes)
    .enter()
    .append('g')
    .attr('class', 'tool-link-group')
    .selectAll('.tool-link')
    .data((d) => {
      if (!d.tools) return []
      return d.tools.map((tool) => {
        const sourceIndex = nodes.findIndex((node) => node.name === tool)
        if (sourceIndex === -1) {
          console.error(`Tool not found for recipe: ${JSON.stringify(d)}`)
        }
        const toolLink = {
          source: sourceIndex,
          target: nodes.indexOf(d),
          item: nodes[sourceIndex],
          recipe: d,
        }
        return toolLink
      })
    })
    .enter()
    .append('line')
    .attr('class', 'tool-link')
    .attr('stroke', toolColor)
    .attr('stroke-width', 2)
    .attr('pointer-events', 'none')
    .attr('marker-end', 'url(#tool-arrowhead)') // Add arrowhead to the line

  console.log('Input Links:', inputLinks.data())

  // Create links for outputs
  const outputLinks = svg
    .selectAll('.output-link')
    .data(recipes)
    .enter()
    .append('g')
    .attr('class', 'output-link-group')
    .selectAll('.output-link')
    .data((d) =>
      d.outputs.map((output) => {
        const targetIndex = nodes.findIndex((node) => node.name === output)
        if (targetIndex === -1) {
          console.error(`Output not found for recipe: ${JSON.stringify(d)}`)
        }
        const outputLink = {
          source: nodes.indexOf(d),
          target: targetIndex,
          item: nodes[targetIndex],
          recipe: d,
        }
        return outputLink
      })
    )
    .enter()
    .append('line')
    .attr('class', 'output-link')
    .attr('stroke', outputColor)
    .attr('stroke-width', 2)
    .attr('pointer-events', 'none')
    .attr('marker-end', 'url(#output-arrowhead)') // Add arrowhead to the line

  console.log('Output Links:', outputLinks.data())

  // Create a group for each item
  const itemNodes = svg
    .selectAll('.item-group')
    .data(items)
    .enter()
    .append('g')
    .attr('class', 'item-group')
    .call(
      d3
        .drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
    )

  // Add an image to each group
  itemNodes
    .append('svg:image')
    .attr('xlink:href', (d) => `./images/${d.tag}.png`) // Set the image source
    .attr('width', itemImageSize) // Set the width of the image
    .attr('height', itemImageSize) // Set the height of the image
    .attr('x', -itemImageSize / 2) // Offset the image position
    .attr('y', -itemImageSize / 2) // Offset the image position

  // Add text below each image
  itemNodes
    .append('g')
    .attr('text-anchor', 'middle')
    .attr('dy', itemImageSize) // Adjust the distance below the image
    .text((d) => d.name) // Assuming each item has a 'name' field

  // Add text labels below each image for items
  itemNodes
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', itemImageSize / 2 + 15) // Adjust the distance below the image
    .text((d) => d.name)

  // Tooltip
  const tooltip = d3
    .select('body')
    .append('div')
    .style('position', 'absolute')
    .style('background', 'lightsteelblue')
    .style('top', '5px')
    .style('left', '5px')
    .style('padding', '5px')
    .style('border', '1px solid black')
    .style('border-radius', '5px')
    .style('visibility', 'hidden')
    .style('pointer-events', 'none')

  // Add mouseover and mouseout event listeners to item nodes
  itemNodes
    .on('mouseover', function (event, d) {
      tooltip.style('visibility', 'visible')
      tooltip.html(`<pre>${jsyaml.dump(d.tooltip)}</pre>`)
    })
    .on('mouseout', function () {
      tooltip.style('visibility', 'hidden')
    })

  // Create nodes for recipes
  const recipeNodes = svg
    .selectAll('.recipe')
    .data(recipes)
    .enter()
    .append('g')
    .attr('class', 'recipe')

  // Append images for each item in the formula
  recipeNodes
    .selectAll('.formula')
    .data((d) => {
      let items = [...d.inputs]
      if (d.tools) items = [...items, '+', ...d.tools]
      items = [...items, '=', ...d.outputs]
      return items
    })
    .enter()
    .append('svg:image')
    .attr('xlink:href', (d) => {
      if (d == '+') return './plus.png'
      if (d == '=') return './equals.png'
      return `./images/${items.find((v) => v.name === d).tag}.png`
    })
    .attr('width', recipeImageSize)
    .attr('height', recipeImageSize)
    .attr('x', (d, i, data) => (i - data.length / 2) * recipeImageSize)
    .attr('y', (d) => -recipeImageSize / 2)

  // Add mouseover and mouseout event listeners to recipe nodes
  recipeNodes
    .on('mouseover', function (event, d) {
      tooltip.style('visibility', 'visible')
      tooltip.html(`<pre>${jsyaml.dump(d.tooltip)}</pre>`)
    })
    .on('mouseout', function () {
      tooltip.style('visibility', 'hidden')
    })

  // Update node and link positions on each tick
  function tick() {
    itemNodes.attr('transform', (d) => `translate(${d.x},${d.y})`)
    recipeNodes.attr('transform', (d) => `translate(${d.x},${d.y})`)

    inputLinks
      .attr('x1', (d) => d.item.x)
      .attr('y1', (d) => d.item.y)
      .attr('x2', (d) => d.recipe.x)
      .attr('y2', (d) => d.recipe.y)

    toolLinks
      .attr('x1', (d) => d.item.x)
      .attr('y1', (d) => d.item.y)
      .attr('x2', (d) => d.recipe.x)
      .attr('y2', (d) => d.recipe.y)

    outputLinks
      .attr('x1', (d) => d.recipe.x)
      .attr('y1', (d) => d.recipe.y)
      .attr('x2', (d) => d.item.x)
      .attr('y2', (d) => d.item.y)
  }

  // Create a force simulation
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink()
        .id((d) => d.index)
        .distance(100)
        .strength(0.1)
    )
    .force('charge', d3.forceManyBody().strength(-500))
    .force('x', d3.forceX(canvasWidth / 2).strength(0.05))
    .force('y', d3.forceY(canvasHeight / 2).strength(0.05))
    .on('tick', tick)

  // Start the simulation
  simulation
    .force('link')
    .links([...inputLinks.data(), ...toolLinks.data(), ...outputLinks.data()])

  // Add drag behavior to items
  itemNodes.call(
    d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended)
  )

  // Add drag behavior to recipes
  recipeNodes.call(
    d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended)
  )

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event, d) {
    d.fx = event.x
    d.fy = event.y
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
  }
})()
