import { App } from '@hackclub/bag'
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { parse } from 'yaml'

// @prettier-ignore
;(async () => {
  const app = await App.connect({
    appId: Number(process.env.APP_ID),
    key: process.env.APP_KEY
  })

  // Update items
  const items = parse(
    fs.readFileSync(path.join(process.cwd(), '../items.yaml'), 'utf-8')
  )

  const metadata = item => {
    delete item.name
    delete item.artist
    delete item.tag
    delete item.description
    delete item.frequency
    delete item.tradable
    return item
  }

  for (let item of items) {
    const search = (
      await app.readItems({
        query: JSON.stringify({ name: item.name })
      })
    ).items[0]
    try {
      if (!search) {
        // Create new item
        await app.createItem({
          item: {
            name: item.name,
            reaction: `:${item.tag}:`,
            description: `${item.description}${
              item.artist ? '  - Drawn by ' + item.artist === '---' ? 'Unknown' : item.artist : ''
            }`,
            tradable: item.tradable ? item.tradable : undefined,
            metadata: JSON.stringify({
              rarity: item.frequency,
              ...metadata(item)
            })
          }
        })
      } else {
        await app.updateItem({
          itemId: item.name,
          new: {
            reaction: `:${item.tag}:`,
            description: `${item.description}${
              item.artist ? '- Drawn by ' + item.artist : ''
            }`,
            tradable: item.tradable ? item.tradable : undefined,
            metadata: JSON.stringify({
              rarity: item.frequency,
              ...metadata(item)
            })
          }
        })
      }
    } catch {}
  }

  // Update actions
  const actions = parse(
    fs.readFileSync(path.join(process.cwd(), '../actions.yaml'), 'utf-8')
  )

  for (let action of actions) {
    const exists = await app.readAction({
      query: {
        locations: action.locations,
        tools: action.tools.map(tool => tool.toLowerCase())
      }
    })
    if (exists.actions.length) {
      // Update action if it already exists
      const id = exists.actions[0].id
      await app.updateAction({
        actionId: id,
        new: {
          locations: action.locations,
          tools: action.tools,
          branch: JSON.stringify(action.branch)
        }
      })
    } else {
      await app.createAction({
        action: {
          locations: action.locations,
          tools: action.tools,
          branch: JSON.stringify(action.branch)
        }
      })
    }
  }

  // Update recipes
  const recipes = parse(
    fs.readFileSync(path.join(process.cwd(), '../recipes.yaml'), 'utf-8')
  )

  for (let recipe of recipes) {
    let inputs = recipe.inputs.map(input => ({ recipeItemId: input }))
    let outputs = recipe.outputs.map(output => ({ recipeItemId: output }))
    let tools = recipe.tools?.map(tool => ({ recipeItemId: tool })) || []
    const search = await app.readRecipe({
      query: {
        inputs,
        outputs,
        tools
      }
    })
    if (search.recipes.length) {
      // Update recipe if it already exists
      await app.updateRecipe({
        recipeId: search.recipes[0].id,
        new: {
          inputs,
          outputs,
          tools,
          description: recipe.description
        }
      })
    } else {
      await app.createRecipe({
        recipe: {
          inputs,
          outputs,
          tools,
          description: recipe.description
        }
      })
    }
  }
})()
