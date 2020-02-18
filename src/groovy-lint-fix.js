// Imports
//const util = require("util");
//const fse = require("fs-extra");
//const os = require("os");
//const xml2js = require("xml2js");

class NpmGroovyLintFix {
    "use strict";

    options = {};

    codeNarcResult;
    fixableRules;
    fixableErrors = [];

    // Construction: initialize options & args
    constructor(codeNarcResultIn, optionsIn) {
        this.codeNarcResult = codeNarcResultIn;
        this.options = optionsIn;
        this.fixableRules = this.getFixableRules();
    }

    async run() {
        await this.extractFixableErrors();
        return this;
    }

    async extractFixableErrors() {
        for (const fileNm of Object.keys(this.codeNarcResult.files)) {
            const fileErrors = this.codeNarcResult.files[fileNm].errors;
            for (const err of fileErrors) {
                if (this.fixableRules[err.rule] != null) {
                    const fixableError = {
                        file: fileNm,
                        rule: err.rule,
                        line: err.line,
                        params: err.msg.match(this.fixableRules[err.rule].extract)
                    };
                    this.fixableErrors.push(fixableError);
                }
            }
        }
    }

    getFixableRules() {
        const fixableRules = {
            UnnecessaryGString: {
                extract: /The String (.*) can be wrapped in single quotes instead of double quotes/,
                replace: /fff/
            }
        };
        return fixableRules;
    }
}

module.exports = NpmGroovyLintFix;
