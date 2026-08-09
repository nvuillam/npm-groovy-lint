// Space after catch

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "catch", errItem);
        },
    },
    fix: {
        label: "Add space after catch",
        type: "replaceString",
        before: "catch(",
        after: "catch (",
    },
    tests: [
        {
            sourceBefore: `
try { } catch(Exception e) { }
try { } catch(
    Exception e) { }
`,
            sourceAfter: `
try { } catch (Exception e) { }
try { } catch (
    Exception e) { }
`,
        },
    ],
};

export { rule };
