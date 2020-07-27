import { Browserslist } from "browserslist"
import { TransformOptions, PluginItem } from "@babel/core"

const path = require(`path`)
const {
  CORE_JS_POLYFILL_EXCLUDE_LIST: polyfillsToExclude,
} = require(`gatsby-legacy-polyfills/dist/exclude`)

const resolve = (m: string): string => require.resolve(m)

const IS_TEST = (process.env.BABEL_ENV || process.env.NODE_ENV) === `test`

export function loadCachedConfig(): { browserslist?: Browserslist } {
  let pluginBabelConfig = {}
  if (!IS_TEST) {
    try {
      pluginBabelConfig = require(path.join(
        process.cwd(),
        `./.cache/babelState.json`
      ))
    } catch (err) {
      if (err.message.includes(`Cannot find module`)) {
        // This probably is being used outside of the Gatsby CLI.
        throw Error(
          `\`babel-preset-gatsby\` has been loaded, which consumes config generated by the Gatsby CLI. Set \`NODE_ENV=test\` to bypass, or run \`gatsby build\` first.`
        )
      } else {
        throw err
      }
    }
  }
  return pluginBabelConfig
}

interface IOptions {
  targets?: Browserslist | { node: `current` } | string
  stage?: string
}

export default function preset(_, options: IOptions = {}): TransformOptions {
  let { targets = null } = options

  // TODO(v3): Remove process.env.GATSBY_BUILD_STAGE, needs to be passed as an option
  const stage = options.stage || process.env.GATSBY_BUILD_STAGE || `test`
  const pluginBabelConfig = loadCachedConfig()
  // unused because of cloud builds
  // const absoluteRuntimePath = path.dirname(
  //   require.resolve(`@babel/runtime/package.json`)
  // )

  if (!targets) {
    if (stage === `build-html` || stage === `test`) {
      targets = {
        node: `current`,
      }
    } else {
      targets = pluginBabelConfig.browserslist as Browserslist
    }
  }

  return {
    presets: [
      [
        resolve(`@babel/preset-env`),
        {
          corejs: 3,
          loose: true,
          modules: stage === `test` ? `commonjs` : false,
          useBuiltIns: `usage`,
          targets,
          // debug: true,
          exclude: [
            // Exclude transforms that make all code slower (https://github.com/facebook/create-react-app/pull/5278)
            `transform-typeof-symbol`,
            // we already have transforms for these
            `transform-spread`,
            `proposal-nullish-coalescing-operator`,
            `proposal-optional-chaining`,

            ...polyfillsToExclude,
          ],
        },
      ],
      [
        resolve(`@babel/preset-react`),
        {
          useBuiltIns: true,
          pragma: `React.createElement`,
          development: stage === `develop`,
        },
      ],
    ],
    plugins: [
      [
        resolve(`./optimize-hook-destructuring`),
        {
          lib: true,
        },
      ],
      [
        resolve(`@babel/plugin-proposal-class-properties`),
        {
          loose: true,
        },
      ],
      [resolve(`@babel/plugin-proposal-nullish-coalescing-operator`)],
      [resolve(`@babel/plugin-proposal-optional-chaining`)],
      resolve(`babel-plugin-macros`),
      resolve(`@babel/plugin-syntax-dynamic-import`),
      [
        resolve(`@babel/plugin-transform-runtime`),
        {
          corejs: false,
          helpers: true,
          regenerator: true,
          useESModules: stage !== `test`,
          // this breaks cloud builds so we disable it for now
          // absoluteRuntime: absoluteRuntimePath,
        },
      ],
      [
        resolve(`@babel/plugin-transform-spread`),
        {
          loose: false, // Fixes #14848
        },
      ],
      IS_TEST && resolve(`babel-plugin-dynamic-import-node`),
      stage === `build-javascript` && [
        // Remove PropTypes from production build
        resolve(`babel-plugin-transform-react-remove-prop-types`),
        {
          removeImport: true,
        },
      ],
    ].filter(Boolean) as PluginItem[],
  }
}
