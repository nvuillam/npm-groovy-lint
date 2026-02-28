/**
 * Custom Mocha reporter that suppresses console output for passing tests.
 *
 * - During each test, stdout and stderr writes are captured in a buffer.
 * - If the test passes the buffer is discarded.
 * - If the test fails the buffer is flushed so the output appears right
 *   after the failure details, making it easy to diagnose.
 *
 * Suite/test structure is still printed using the built-in Spec reporter.
 */

import Mocha from "mocha";
const { Spec } = Mocha.reporters;

class SilentReporter extends Spec {
    constructor(runner, options) {
        super(runner, options);

        let buffer = [];
        let originalStdoutWrite;
        let originalStderrWrite;

        const startCapture = () => {
            buffer = [];
            originalStdoutWrite = process.stdout.write;
            originalStderrWrite = process.stderr.write;

            process.stdout.write = (chunk, encoding, cb) => {
                buffer.push({ stream: "stdout", chunk });
                // Still allow Mocha's own reporter lines through if they
                // originate from the Spec reporter (they use specific ANSI
                // sequences).  We suppress everything to keep CI clean;
                // failing-test output is replayed below.
                if (typeof cb === "function") cb();
                return true;
            };

            process.stderr.write = (chunk, encoding, cb) => {
                buffer.push({ stream: "stderr", chunk });
                if (typeof cb === "function") cb();
                return true;
            };
        };

        const stopCapture = () => {
            if (originalStdoutWrite) {
                process.stdout.write = originalStdoutWrite;
            }
            if (originalStderrWrite) {
                process.stderr.write = originalStderrWrite;
            }
        };

        const flushBuffer = () => {
            for (const entry of buffer) {
                if (entry.stream === "stdout") {
                    originalStdoutWrite.call(process.stdout, entry.chunk);
                } else {
                    originalStderrWrite.call(process.stderr, entry.chunk);
                }
            }
            buffer = [];
        };

        runner.on("test", () => {
            startCapture();
        });

        runner.on("pass", () => {
            stopCapture();
            buffer = []; // discard
        });

        runner.on("fail", () => {
            stopCapture();
            flushBuffer(); // replay so the output is visible in CI
        });

        // Safety net: if a test ends without pass/fail event (e.g. pending)
        runner.on("test end", () => {
            stopCapture();
            buffer = [];
        });
    }
}

export default SilentReporter;
