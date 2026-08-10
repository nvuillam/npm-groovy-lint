// Minimal terminal progress bar (replaces the cli-progress package)
// Supports the subset of the cli-progress SingleBar API used by npm-groovy-lint:
// constructor options: format (with {bar}, {duration_formatted} and custom payload tokens), hideCursor, clearOnComplete
// methods: start(total, startValue, payload), increment(), update(value, payload), stop(), value getter
// Like cli-progress, nothing is rendered when stdout is not a TTY.

const BAR_SIZE = 40;

export class ProgressBar {
    #format;
    #hideCursor;
    #clearOnComplete;
    #stream;
    #total = 0;
    #value = 0;
    #payload = {};
    #startTime = 0;
    #active = false;

    constructor(options = {}) {
        this.#format = options.format || "[{bar}]";
        this.#hideCursor = options.hideCursor === true;
        this.#clearOnComplete = options.clearOnComplete === true;
        // stderr, like cli-progress: keeps the bar out of stdout so lint results and piped output stay clean
        this.#stream = process.stderr;
    }

    get value() {
        return this.#value;
    }

    start(total, startValue = 0, payload = {}) {
        this.#total = total;
        this.#value = startValue;
        this.#payload = payload;
        this.#startTime = Date.now();
        this.#active = true;
        if (this.#hideCursor && this.#stream.isTTY) {
            this.#stream.write("\x1B[?25l");
        }
        this.#render();
    }

    increment(delta = 1) {
        this.update(this.#value + delta);
    }

    update(value, payload) {
        if (typeof value === "number") {
            this.#value = value;
        }
        if (payload) {
            this.#payload = { ...this.#payload, ...payload };
        }
        this.#render();
    }

    stop() {
        if (!this.#active) {
            return;
        }
        this.#active = false;
        if (this.#stream.isTTY) {
            if (this.#clearOnComplete) {
                this.#stream.cursorTo(0);
                this.#stream.clearLine(1);
            } else {
                this.#stream.write("\n");
            }
            if (this.#hideCursor) {
                this.#stream.write("\x1B[?25h");
            }
        }
    }

    #render() {
        if (!this.#active || !this.#stream.isTTY) {
            return;
        }
        const progress = this.#total > 0 ? Math.min(this.#value / this.#total, 1) : 0;
        const filledSize = Math.round(progress * BAR_SIZE);
        const bar = "█".repeat(filledSize) + "░".repeat(BAR_SIZE - filledSize);
        const totalSeconds = Math.round((Date.now() - this.#startTime) / 1000);
        const durationFormatted =
            totalSeconds < 60 ? `${totalSeconds}s` : `${Math.floor(totalSeconds / 60)}m${String(totalSeconds % 60).padStart(2, "0")}s`;
        // Replacer functions so that values containing $&, $' or $$ (e.g. file paths) are inserted literally
        let line = this.#format.replace("{bar}", () => bar).replace("{duration_formatted}", () => durationFormatted);
        for (const [key, val] of Object.entries(this.#payload)) {
            line = line.replace(`{${key}}`, () => String(val));
        }
        // Truncate to the terminal width: a wrapped line would leave rows that clearLine cannot erase
        const width = this.#stream.columns || 80;
        if (line.length >= width) {
            line = line.slice(0, width - 1);
        }
        this.#stream.cursorTo(0);
        this.#stream.write(line);
        this.#stream.clearLine(1);
    }
}
