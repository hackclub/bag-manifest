import { parse } from 'yaml'
import fs from 'fs'
import path from 'path'

console.log(
  parse(fs.readFileSync(path.join(process.cwd(), '../items.yaml'), 'utf-8'))
)
console.log(
  parse(fs.readFileSync(path.join(process.cwd(), '../actions.yaml'), 'utf-8'))
)
console.log(
  parse(fs.readFileSync(path.join(process.cwd(), '../recipes.yaml'), 'utf-8'))
)
