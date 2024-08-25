// GString Expression within string

const rule = {
    rangeTests: [
        {
            source: `
def someString = '\${SCRIPT,template=\\"mail_template_robot_results.groovy\\"}'
`,
            expectedRange: {
                start: {
                    line: 2,
                    character: 0,
                },
                end: {
                    line: 2,
                    character: 76,
                },
            },
        },
    ],
};

export { rule };
