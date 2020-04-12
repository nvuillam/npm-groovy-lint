# Contributing

Contributions are very welcome !

Instructions :

- Fork the repository and clone it on your computer
- Install jdeploy: `npm install jdeploy -g`
- Install dependencies: `npm install`
- Build executable bundle: `npm run build`
- Update source code and add mocha tests for any code you create
- Run `npm run lint` then `npm run test` to check your updates didn't break anything
- Once your code is ready, documented and tested, please make a [pull request](https://github.com/nvuillam/npm-groovy-lint/pulls) :)

If you need to test your updates in VsCode Groovy Lint before making your PR
- Fork [VsCode Groovy Lint repo](https://github.com/nvuillam/vscode-groovy-lint) and clone it on your computer (with same root as your clone of npm-groovy-lint fork)
- Run `npm run dev:lint-build-copy-vscode` to deploy your local updates to VsCode Groovy Lint extension development files
- Launch VsCode Groovy Lint debug configuration `Groovy Lint Debug`