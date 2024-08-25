// Explicit LinkedList instantiation
const rule = {
    fix: {
        label: "Replace LinkedList declaration by [] as Queue",
        type: "function",
        func: (line) => {
            return line.replace(/new LinkedList(.*)\)/gi, "[] as Queue");
        },
    },
    tests: [
        {
            sourceBefore: `
    List<String> printList = new LinkedList<String>()
`,
            sourceAfter: `
    List<String> printList = [] as Queue
`,
        },
        {
            sourceBefore: `
List<String> printList=new LinkedList<String>()
`,
            sourceAfter: `
List<String> printList=[] as Queue
`,
        },
    ],
};

export { rule };
