# Contributing

Contributions are very welcome !

Instructions :

- Fork the repository and clone it on your computer
- Install dependencies: `npm install`
- Link npm package bundle: `npm link`
- Update source code and add mocha tests for any code you create
- Run `npm run lint:fix` then `npm run test` to check your updates didn't break anything
- Once your code is ready, documented and tested, please make a [pull request](https://github.com/nvuillam/npm-groovy-lint/pulls) :)

If you need to test your updates in VsCode Groovy Lint before making your PR

- Fork [VsCode Groovy Lint repo](https://github.com/nvuillam/vscode-groovy-lint) and clone it on your computer (with same root as your clone of npm-groovy-lint fork)
- Run `npm run dev:lint-install-local-copy-vscode` to deploy your local updates to VsCode Groovy Lint extension development files
- Launch VsCode Groovy Lint debug configuration `Groovy Lint Debug`
