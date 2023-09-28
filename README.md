# Plugin Builder

Plugin Builder is an [Amplenote plugin](https://www.amplenote.com/help/developing_amplenote_plugins) that 
makes it easy to build plugins for Amplenote from Github projects.

## Installation

1. Clone this repo. `git clone git@github.com:alloy-org/plugin-builder.git`
2. Install node and npm if you haven't already. 
3. Run `npm install` to install the packages.  

## Running offline

You can also run the code locally to create a file called `out.plugin.js` which you can then copy and paste into Amplenote. Useful if you don't like commiting and pushing small changes that you want to test.

To use:
Copy and paste `plugin.js` and `plugin-import-inliner.js` into the `lib` folder of your plugin, then in that directory:

```
npm install isomorphic-fetch
node plugin.js
```

Open the resulting file (`out.plugin.js`) and copy and paste the contents of that file to your Amplenote plugin.

## Testing

Run `NODE_OPTIONS=--experimental-vm-modules npm test` to run the tests.

If it complains about jsdom being absent, run `npm install -D jest-environment-jsdom` and try again.

### Run tests continuously as modifying the plugin

```bash
NODE_OPTIONS=--experimental-vm-modules npm run test -- --watch
```

## Technologies used to help with this project

* https://esbuild.github.io/getting-started/#your-first-bundle
* https://jestjs.io/
* https://www.gitclear.com
