import path from 'path'
import fs from 'fs-extra'
import { watch } from 'rollup'
import postcss from '../src'

const testdir = path.join(__dirname, '__watch_test_temp__')

function pathUnderTestdir(...pathComponents) {
  if (pathComponents.length > 1) {
    const dirs = pathComponents.slice(0, pathComponents.length - 1)
    fs.ensureDirSync(path.join(testdir, ...dirs))
  }

  return path.join(testdir, ...pathComponents)
}

function write(filename, contents) {
  fs.writeFileSync(filename, contents, 'utf8')
}

function read(filename) {
  return fs.readFileSync(filename, 'utf8')
}

beforeAll(() => {
  fs.ensureDirSync(testdir)
})

const watchers = []

// Use this to start watchers and have them closed after the tests have completed,
// so jest doesn't get left hanging
function startWatcher(watchOptions) {
  const watcher = watch(watchOptions)
  watchers.push(watcher)
  return watcher
}

afterAll(() => {
  for (const watcher of watchers) {
    watcher.close()
  }
  fs.removeSync(testdir)
})

function arraysEqual(a1, a2) {
  return JSON.stringify(a1) === JSON.stringify(a2)
}

// Utility to check that watcher produces the expected events and only them
function expectEvents(watcher, events, timeout) {
  return new Promise((resolve, reject) => {
    // Without this, the call stack will not include the caller's location, making things hard to debug
    const callStack = new Error().stack

    const actualEvents = []
    setTimeout(() => {
      if (events.length === 0 && actualEvents.length === 0) {
        resolve()
      } else {
        const message = `expectEvents: expected [${events.join(', ')}], ` +
          `got [${actualEvents.join(', ')}]. Timeout exceeded. Stack: ${callStack}`
        reject(new Error(message))
      }
    }, timeout)
    watcher.on('event', ({ code }) => {
      actualEvents.push(code)
      if (actualEvents.length === events.length) {
        if (arraysEqual(actualEvents, events)) {
          resolve()
        } else {
          const message = `expectEvents: expected [${events.join(', ')}], ` +
            `got [${actualEvents.join(', ')}]. Stack: ${callStack}`
          reject(new Error(message))
        }
      }
    })
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test('rollup.watch() watches directly imported .styl files', async () => {
  function localfile(filename) {
    return pathUnderTestdir('test1', filename)
  }

  write(localfile('input.js'), `import './a.styl'; console.log('hi')`)
  write(localfile('a.styl'), 'body { color: #f0f }')

  const watchOptions = {
    input: localfile('input.js'),
    output: {
      file: localfile('output.js'),
      format: 'cjs',
      sourcemap: 'inline'
    },
    plugins: [postcss({
      extract: localfile('output.css'),
      sourceMap: true
    })]
  }

  const watcher = startWatcher(watchOptions)

  await expectEvents(watcher, ['START', 'BUNDLE_START', 'BUNDLE_END', 'END'], 2000)

  // It seems that it takes a while for rollup to actually start listening to file changes.
  // Wait 2 seconds just in case.
  await sleep(2000)

  expect(read(localfile('output.css'))).toMatch(/#f0f/)

  // Writing to a directly imported file should trigger a build...
  write(localfile('a.styl'), 'body { color: #0f0 }')
  await expectEvents(watcher, ['START', 'BUNDLE_START', 'BUNDLE_END', 'END'], 2000)

  // ...and the contents should be included in the output.
  expect(read(localfile('output.css'))).toMatch(/#0f0/)
})

// Upgrade rollup to at least 0.61 to make this work
test.skip('rollup.watch() watches indirectly imported .styl files', async () => {
  function localfile(filename) {
    return pathUnderTestdir('test2', filename)
  }

  write(localfile('input.js'), `import './a.styl'; console.log('hi')`)
  write(localfile('a.styl'), `@import './b.styl'; body { color: #f0f }`)
  write(localfile('b.styl'), 'h1 { color: #00f }')

  const watchOptions = {
    input: localfile('input.js'),
    output: {
      file: localfile('output.js'),
      format: 'cjs',
      sourcemap: 'inline'
    },
    plugins: [postcss({
      extract: localfile('output.css'),
      sourceMap: true
    })]
  }

  const watcher = startWatcher(watchOptions)

  await expectEvents(watcher, ['START', 'BUNDLE_START', 'BUNDLE_END', 'END'], 2000)

  // It seems that it takes a while for rollup to actually start listening to file changes.
  // Wait 2 seconds just in case.
  await sleep(2000)

  const resultingCss = read(localfile('output.css'))
  expect(resultingCss).toMatch(/#f0f/)
  expect(resultingCss).toMatch(/#00f/)

  // Writing to an indirectly imported file should trigger a build...
  write(localfile('b.styl'), 'h1 { color: #f00 }')
  await expectEvents(watcher, ['START', 'BUNDLE_START', 'BUNDLE_END', 'END'], 2000)

  // ...and the contents should be included in the output.
  const resultingCss2 = read(localfile('output.css'))
  expect(resultingCss2).toMatch(/#f0f/)
  expect(resultingCss2).toMatch(/#f00/)
})
