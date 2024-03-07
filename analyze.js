function analyze(items, recipes, actions, _) {
  const prices = {
    'Emerald': 200,
    'Ruby': 150,
    'Sapphire': 100,
    'Diamond': 300,
    'Tanzanite': 1000,
    'Gold': 250,
    'MASH Season 1': 500,
    'MASH Season 2': 500,
    'MASH Season 3': 500,
    'MASH Season 4': 500,
    'MASH Season 5': 500,
    'MASH Season 6': 500,
    'MASH Season 7': 500,
    'MASH Season 8': 500,
    'MASH Season 9': 500,
    'MASH Season 10': 500,
    'MASH Season 11': 500,
    'Fruit Salad': 50,
    'Bread': 20
  }
  const saleFactor = 0.3

  // console.log('raw actions', JSON.stringify(actions, null, 2))

  // Convert the action tree to a more easily-traversed format
  function traversify(node) {
    // console.log('traversifying', JSON.stringify(node, null, 2))
    if (node.branch) {
      node.branch = _.map(node.branch, v => {
        if (_.isArray(v)) {
          const first = _.first(v)
          first.sequence = _.tail(v)
          return first
        }
        return v
      })
    }

    if (node.sequence) {
      _.each(node.sequence, traversify)
    }
    if (node.branch) {
      _.each(node.branch, traversify)
    }

    if (node.frequency === undefined) node.frequency = 1
  }
  _.each(actions, traversify)

  // Calculate probabilized outcomes for each node
  function probabilize(spec) {
    let {
      node,
      root = null,
      parent = null,
      probability = 1,
      loops = 0,
      outputs = [],
      losses = []
    } = spec

    if (root === null) {
      node.outcomes = []
      node.taggedNodes = {}
      root = node
    }

    if (node.tag) {
      root.taggedNodes[node.tag] = node
    }
    if (node.losses) {
      losses = [...losses, ...node.losses]
    }
    if (node.outputs) {
      outputs = [...outputs, ...node.outputs]
    }

    if (node.sequence) {
      _.each(node.sequence, v => {
        v.probability = probability
        probabilize({
          node: v,
          root,
          parent: node,
          probability: v.probability,
          loops,
          outputs: [...outputs],
          losses: [...losses]
        })
      })
    } else if (node.branch) {
      const total = _.reduce(
        node.branch,
        (sum, node) => sum + (node.frequency ?? 1),
        0
      )
      _.each(node.branch, v => {
        v.localProbability = v.frequency / total
        v.probability = probability * v.localProbability
        probabilize({
          node: v,
          root,
          parent: node,
          probability: v.probability,
          loops,
          outputs: [...outputs],
          losses: [...losses]
        })
      })
    } else {
      // console.log(JSON.stringify(root, null, 2))
      root.outcomes.push({
        probability,
        losses,
        outputs
      })
    }
  }
  _.each(actions, v => probabilize({ node: v }))

  _.each(actions, v => {
    const expectedLosses = {}
    const expectedOutputs = {}
    _.each(v.outcomes, o => {
      o.lossTotals = _.countBy(o.losses)
      _.each(o.lossTotals, (v, k) => {
        expectedLosses[k] = (expectedLosses[k] ?? 0) + v * o.probability
      })

      o.outputTotals = _.countBy(o.outputs)
      _.each(o.outputTotals, (v, k) => {
        expectedOutputs[k] = (expectedOutputs[k] ?? 0) + v * o.probability
      })
    })
    v.expectedLosses = expectedLosses
    v.expectedOutputs = expectedOutputs
  })

  // Run through all objects and give a more easily readable percentage value for each probability
  function percentagize(obj) {
    if (_.isArray(obj)) {
      _.each(obj, percentagize)
    } else if (_.isObject(obj)) {
      if (_.has(obj, 'percentage')) return

      if (_.has(obj, 'probability')) {
        obj.percentage = (obj.probability * 100).toFixed(3) + '%'
      }
      _.each(obj, percentagize)
    }
  }
  percentagize(actions)

  // Convert items to a dictionary, then run through all items and assign initial analytic values
  items = _.zipObject(
    _.map(items, v => v.name),
    items
  )
  _.each(items, (v, k) => {
    v.expense = v.price ?? 1
    v.expenses = [v.expense]
    v.expensizations = {}
    v.utility = v.price ? v.price * saleFactor : 1
    v.utilities = [v.utility]
    v.utilitizations = {}
    v.value = (v.expense + v.utility) / 2
    v.values = [v.value]
    v.valuations = {}
    v.durability = v.durability ?? 100
  })

  // If a recipe has no tools, give it an empty array
  _.each(recipes, v => {
    v.tools = v.tools ?? []
  })
  recipes = _.zipObject(
    _.map(recipes, v => v.outputs.join(', ')),
    recipes
  )

  // If an action has no inputs, give it an empty array
  _.each(actions, v => {
    v.inputs = v.inputs ?? []
  })
  actions = _.zipObject(
    _.map(
      actions,
      v =>
        v.locations.join(', ') +
        ': ' +
        v.tools.join(', ') +
        '~' +
        v.inputs.join(', ')
    ),
    actions
  )

  // Recursively calculate the value of each item based on recipes and actions
  function valuize(items, iterations = 10) {
    const newItems = _.cloneDeep(items)

    // Reset the evaluations of each item
    _.each(newItems, v => {
      v.valuations = {}
      v.utilitizations = {}
      v.expensizations = {}
    })

    // Evaluate the profitability of each action and use that to calculate the value of each output
    _.each(actions, (a, name) => {
      a.expectedLossValues = _.mapValues(
        a.expectedLosses,
        (v, k) => v * items[k].value
      )
      a.expectedOutputValues = _.mapValues(
        a.expectedOutputs,
        (v, k) => v * items[k].value
      )

      // Calculate the total expected gain and loss
      a.expectedLossValue = _.reduce(
        a.expectedLossValues,
        (sum, v, k) => sum + v,
        0
      )
      a.expectedOutputValue = _.reduce(
        a.expectedOutputValues,
        (sum, v, k) => sum + v,
        0
      )

      a.profit = a.expectedOutputValue / a.expectedLossValue

      a.expectedLossWeights = _.mapValues(
        a.expectedLossValues,
        (v, k) => v / a.expectedLossValue
      )
      a.expectedOutputWeights = _.mapValues(
        a.expectedOutputValues,
        (v, k) => v / a.expectedOutputValue
      )

      // Calculate a valuation for each loss and output based on the expected gain and loss
      _.each(
        a.expectedLossWeights,
        (v, k) => (newItems[k].utilitizations[name] = v * a.profit)
      )
      _.each(
        a.expectedOutputWeights,
        (v, k) => (newItems[k].expensizations[name] = v * a.profit)
      )
    })

    // Evaluate the profitability of each recipe and use that to calculate expenses and utilities
    _.each(recipes, (r, name) => {
      // Cost is the sum of the value of all input values, and tool values divided by their durability
      r.cost =
        _.reduce(r.inputs, (sum, item) => sum + items[item].value, 0) +
        _.reduce(
          r.tools,
          (sum, item) => sum + items[item].value / items[item].durability,
          0
        )
      // Revenue is the sum of the value of all outputs
      r.revenue = _.reduce(r.outputs, (sum, item) => sum + items[item].value, 0)
      // Profit is revenue minus cost
      r.profit = r.revenue - r.cost

      // Count inputs, tools, and outputs for weight calculations
      const inputCounts = _.countBy(r.inputs)
      const toolCounts = _.countBy(r.tools)
      const outputCounts = _.countBy(r.outputs)

      const inputWeights = _.mapValues(
        inputCounts,
        (v, k) => items[k].value / (v * r.cost)
      )
      const toolWeights = _.mapValues(
        toolCounts,
        (v, k) => items[k].value / (v * r.cost)
      )
      const outputWeights = _.mapValues(
        outputCounts,
        (v, k) => items[k].value / (v * r.revenue)
      )

      r.outputWeights = outputWeights
      r.inputWeights = inputWeights
      r.toolWeights = toolWeights

      // _.each(inputWeights, (w, k) => {
      //   newItems[k].utilitizations.push(w * r.revenue)
      // })
      // _.each(toolWeights, (w, k) => {
      //   newItems[k].utilitizations.push(w * r.revenue)
      // })
      // Compute a valuation for each output based on its weighted proportion of the recipe's cost? Or profit?
      _.each(outputWeights, (w, k) => {
        newItems[k].expensizations[name] = w * r.cost
      })
      // Compute a valuation for each input based on its weighted proportion of the recipe's revenue? Or profit?
      _.each(inputWeights, (w, k) => {
        newItems[k].utilitizations[name] = w * r.revenue
      })
      // Compute a valuation for each tool based on its weighted proportion of the recipe's revenue? Or profit? With some adjustment for durability?
      _.each(toolWeights, (w, k) => {
        newItems[k].utilitizations[name] = (w * r.revenue) / items[k].durability
      })
    })

    _.each(newItems, v => {
      v.utility = Math.max(
        1,
        _.values(v.utilitizations).length == 0
          ? v.utility
          : _.max(_.values(v.utilitizations))
      )
      v.expense = Math.max(
        1,
        _.values(v.expensizations).length == 0
          ? v.expense
          : _.min(_.values(v.expensizations))
      )
      if (v.price !== undefined) {
        const price = v.price
        v.utility = Math.max(v.utility, price * saleFactor)
        v.expense = Math.min(v.expense, price)
        // v.utilitizations.price = price * saleFactor
        // v.expensizations.price = price
      }
      v.value = (v.utility + v.expense) / 2
      v.values.push(v.value)
      v.utilities.push(v.utility)
      v.expenses.push(v.expense)
    })

    if (iterations <= 0) return newItems
    return valuize(newItems, iterations - 1)
  }

  items = valuize(items, 10)

  const pricedItems = _.zipObject(
    _.map(_.keys(items), k => items[k].value.toFixed(1) + 'gp ' + k),
    _.values(items)
  )
  const pricedRecipes = _.zipObject(
    _.map(_.keys(recipes), k => recipes[k].profit.toFixed(1) + 'gp ' + k),
    _.values(recipes)
  )

  console.log('analyzed actions', actions)
  console.log('analyzed items', pricedItems)
  console.log('analyzed recipes', pricedRecipes)

  return { items, recipes, actions }
}
