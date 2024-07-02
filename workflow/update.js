import { App } from '@hackclub/bag'
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { parse } from 'yaml'

  // @prettier-ignore
  ; (async () => {
    const app = await App.connect({
      appId: Number(process.env.APP_ID),
      key: process.env.APP_KEY,
      baseUrl: process.env.BASE_URL
    })
    console.log(`Connected to Bag!! Base url: ${app.request.appId}`)

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
      console.log(`Trying to update ${item.name}`)
      try {
        let needCreate = false
        try {
          const search = await app.getItem({
            query: JSON.stringify({ name: item.name })
          })
        } catch (err) {
          if (err.message.includes("Item not found")) {
            console.log(`Item does not exist: ${item.name}`)
            needCreate = true
          }
          else {
            throw err
          }
        }
        if (needCreate) {
          // Create new item
          await app.createItem({
            item: {
              name: item.name,
              reaction: `:${item.tag}:`,
              description: `${item.description} - Drawn by ${item.artist.trim() === '---' ? 'Unknown' : item.artist
                }`,
              tradable: item.tradable === undefined ? true : item.tradable,
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
              description: `${item.description} - Drawn by ${item.artist.trim() === '---' ? 'Unknown' : item.artist
                }`,
              tradable: item.tradable === undefined ? true : item.tradable,
              metadata: JSON.stringify({
                rarity: item.frequency,
                ...metadata(item)
              })
            }
          })
        }
      } catch (err) {
        console.log(`Error updating ${item.name}: ${err}`)
      }
    }

    const actions = parse(
      fs.readFileSync(path.join(process.cwd(), '../actions.yaml'), 'utf-8')
    )

    for (let action of actions) {
      try {
        const exists = await app.getAction({
          query: {
            locations: action.locations,
            tools: action.tools.map(tool => tool.toLowerCase())
          }
        })
        console.log(`found ${exists.actions ? '0 (undefined)' : exists.actions.length} existing actions in ${action.locations} using ${ action.tools.map(tool => tool.toLowerCase())}`);
        if (exists.actions) {
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
      } catch (err) {
        console.log(
          `Error updating action [${action.locations}, ${action.tools}]: ${err}`
        )
      }
    }
    console.log("updating recipes...")
    // Update recipes
    const recipes = parse(
      fs.readFileSync(path.join(process.cwd(), '../recipes.yaml'), 'utf-8')
    )

    for (let recipe of recipes) {
      let inputs = recipe.inputs.map(input => ({ recipeItemId: input }))
      let outputs = recipe.outputs.map(output => ({ recipeItemId: output }))
      let tools = recipe.tools?.map(tool => ({ recipeItemId: tool })) || []

      // Combine inputs, outputs, and tools appropriately
      inputs = inputs.reduce((acc, curr) => {
        const index = acc.findIndex(
          input => input.recipeItemId === curr.recipeItemId
        )
        if (index >= 0) acc[index].quantity++
        else acc.push({ quantity: 1, ...curr })
        return acc
      }, [])

      outputs = outputs.reduce((acc, curr) => {
        const index = acc.findIndex(
          output => output.recipeItemId === curr.recipeItemId
        )
        if (index >= 0) acc[index].quantity++
        else acc.push({ quantity: 1, ...curr })
        return acc
      }, [])

      tools = tools.reduce((acc, curr) => {
        const index = acc.findIndex(
          tool => tool.recipeItemId === curr.recipeItemId
        )
        if (index >= 0) acc[index].quantity++
        else acc.push({ quantity: 1, ...curr })
        return acc
      }, [])

      const search = await app.getRecipes({
        query: {
          inputs,
          outputs,
          tools
        }
      })
      if (search.length) {
        console.log(`Updating recipe ${search[0].id} (making ${recipe.outputs[0]}). time: ${recipe.crafting_time_seconds} seconds`)
        // Update recipe if it already exists
        await app.updateRecipe({
          recipeId: search[0].id,
          new: {
            inputs,
            outputs,
            tools,
            description: recipe.description,
            time: recipe.crafting_time_seconds * 1000
          }
        })
      } else {
        console.log(inputs)
        console.log(`Creating recipe for ${recipe.outputs[0]}. time: ${recipe.crafting_time_seconds} seconds`)
        await app.createRecipe({
          recipe: {
            inputs,
            outputs,
            tools,
            description: recipe.description,
            time: recipe.crafting_time_seconds * 1000
          }
        })
      }
    }
  })()
