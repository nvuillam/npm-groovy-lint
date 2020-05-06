// Explicit ArrayList instantiation
const rule = {
    fix: {
        label: "Replace ArrayList declaration by []",
        type: "function",
        func: line => {
            return line.replace(/new ArrayList(.*)\)/gi, "[]");
        }
    },
    tests: [
        {
            sourceBefore: `
    List<String> commandArray = new ArrayList<String>()
`,
            sourceAfter: `
    List<String> commandArray = []
`
        },
        {
            sourceBefore: `
List<String> commandArray=new ArrayList<String> ()
`,
            sourceAfter: `
List<String> commandArray=[]
`
        }
    ]
};

module.exports = { rule };
