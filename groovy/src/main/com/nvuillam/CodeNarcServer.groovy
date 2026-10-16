/* groovylint-disable LineLength, TrailingComma */
/*
 * CodeNarc main class Wrapper to run a light HttpServer so next calls can have better performances
 * Auto-kills itself when maximum idle time is reached
 * @author Nicolas Vuillamy
 */
package com.nvuillam

// Java Http Server
import com.sun.net.httpserver.Filter
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpHandler
import com.sun.net.httpserver.HttpServer
import java.nio.file.FileSystems
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermissions
import java.util.function.Supplier

// Concurrency & Timer management
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

// Groovy Json Management
import com.fasterxml.jackson.core.PrettyPrinter
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.ObjectReader
import com.fasterxml.jackson.databind.ObjectWriter

// Groovy Transform
import groovy.transform.CompileDynamic

// Groovy CliBuilder change for Groovy 4
import groovy.cli.commons.CliBuilder

// Logging
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@CompileDynamic
class CodeNarcServer {

    private static final Logger LOGGER = LoggerFactory.getLogger(CodeNarcServer.name)
    private static final int SERVER_PORT = System.getenv('SERVER_PORT') ? System.getenv('SERVER_PORT') as int : 7484
    private static final int MAX_IDLE_TIME = 3600000 // 1h
    private static final long MAX_REQUEST_BODY_BYTES = 50 * 1024 * 1024 // 50 MB
    // Ignore JSON fields this server does not know: a client newer than this server may
    // send extra request fields, and rejecting them would turn every lint into an HTTP 500
    // (the client would then silently fall back to a slow cold-start JVM per call). The
    // client side symmetrically restarts a server that still rejects unknown fields - see
    // isStaleServerResponse in lib/codenarc-caller.js.
    private static final ObjectMapper MAPPER = new ObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
    private static final ObjectReader READER = MAPPER.reader()
    private static final ObjectWriter WRITER = MAPPER.writer((PrettyPrinter)null)

    private final CountDownLatch latch
    private final Map<String, AnalysisPartitioner.RequestHandle> handles
    private final HttpServer server
    private final ExecutorService ex
    private final ExecutorService analysisPool
    private final ResultCache resultCache
    // Random secret required on /kill requests. The server listens on the loopback only, but
    // that still exposes it to every local process/user: without a token, any of them could
    // shut the server down (see nvuillam/npm-groovy-lint#607). The token is persisted to a
    // file restricted to the current OS user so that sibling npm-groovy-lint processes (which
    // did not start the server) can still authorize their own --killserver.
    private final String killToken
    private final File killTokenFile

    // timerLock protects access to the items below.
    private final Object timerLock
    private final Timer timer
    private TimerTask currentTimerTask

    /**
     * Main command-line entry-point. Run the CodeNarcServer application.
     * @param args - the String[] of command-line arguments
     */
    static void main(String[] args) {
        LOGGER.debug('Starting args: {}', (Object)args)

        CliBuilder cli = new CliBuilder(usage: 'groovy CodeNarcServer.groovy [OPTION...] [CODENARCARGS...]').tap {
            h(longOpt: 'help', 'Show usage information')
            s(longOpt: 'server', type: boolean, 'Runs CodeNarc as a server (default: run CodeNarc directly)')
            v(longOpt: 'version', type: boolean, 'Outputs the version of CodeNarc')
            b(longOpt: 'verbose', type: boolean, 'Enables verbose output')
            p(longOpt: 'port', type: int, defaultValue: "$SERVER_PORT", "Sets the server port (default: $SERVER_PORT)")
            a(longOpt: 'parse', type: boolean, 'Enables parsing of the source files for errors (CodeNarc direct only)')
            f(longOpt: 'file', type: String, 'File overrides to parse instead of using CodeNarc args (CodeNarc direct only)')
            t(longOpt: 'tokenfile', type: String, 'File where the /kill authorization token is persisted (server mode only, default: <tmpdir>/npm-groovy-lint-server-kill-<port>.token)')
            P(longOpt: 'parallelism', type: int, 'Number of parallel analysis threads, 1 to disable parallelism (CodeNarc direct only; HTTP requests carry it in their payload)')
        }

        def options = cli.parse(args)

        if (options.help || options.arguments() == Request.HELP_ARGS) {
            cli.usage()
            println ''
            println Request.codeNarcHelp()
            return
        }

        if (options.version || options.arguments() == Request.VERSION_ARGS) {
            println Request.codeNarcVersion()
            return
        }

        if (options.server) {
            // Initialize CodeNarc Server for later calls
            try {
                new CodeNarcServer(options.port, options.tokenfile ?: null).run()
            } catch (java.net.BindException e) {
                LOGGER.error('Error starting server on port {}. Is another instance already running?', options.port)
            }
            return
        }

        // Do not use server, just call CodeNarc (worse performances as Java classes must be reloaded each time)
        Request request = new Request(options.parse, options.files ?: [], options.arguments())
        // --noserver has no HTTP payload to carry the requested parallelism: without this,
        // an explicit --parallelism 1 would be ignored and partitioning forced on.
        if (options.parallelism) {
            request.parallelism = options.parallelism as Integer
        }
        Response response = new Response()

        // Prevent CodeNarc from writing directly to System.out
        // as that will corrupt our JSON response.
        PrintStream originalSystemOut = System.out
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream()
        System.out = new PrintStream(outputStream)
        ExecutorService oneShotPool = Executors.newFixedThreadPool(
            Math.max(1, Math.min(Runtime.runtime.availableProcessors(), AnalysisPartitioner.MAX_PARTITIONS)))
        try {
            request.process(response, new LintContext(oneShotPool, null))
        } finally {
            oneShotPool.shutdownNow()
        }
        response.stdout = outputStream.toString()

        WRITER.writeValue(originalSystemOut, response)
    }

    CodeNarcServer(int port, String killTokenPath = null) {
        // Create a server who accepts only calls from localhost ( https://stackoverflow.com/questions/50770747/how-to-configure-com-sun-net-httpserver-to-accept-only-requests-from-localhost )
        InetAddress localHost = InetAddress.getLoopbackAddress()
        InetSocketAddress sockAddr = new InetSocketAddress(localHost, port)

        this.server = HttpServer.create(sockAddr, 0)
        // The Node client passes an explicit --tokenfile computed from os.tmpdir() so that both
        // sides agree on the location even where java.io.tmpdir and os.tmpdir() diverge (e.g.
        // Linux with TMPDIR set, which Java ignores). The default below covers manual starts.
        this.killTokenFile = killTokenPath
            ? new File(killTokenPath)
            : new File(System.getProperty('java.io.tmpdir'), "npm-groovy-lint-server-kill-${port}.token")
        this.killToken = createKillToken(this.killTokenFile)
        this.latch = new CountDownLatch(1)
        this.timerLock = new Object()
        this.handles = new ConcurrentHashMap<String, AnalysisPartitioner.RequestHandle>()
        this.timer = new Timer()
        this.currentTimerTask = timer.runAfter(MAX_IDLE_TIME, { timerData ->
            this.stopServer()
        })
        this.ex = Executors.newFixedThreadPool(Runtime.runtime.availableProcessors())
        // Separate from the HTTP executor: analysis tasks submitted to the pool that is
        // serving the request would deadlock once all HTTP threads are busy.
        this.analysisPool = Executors.newFixedThreadPool(
            Math.max(1, Math.min(Runtime.runtime.availableProcessors(), AnalysisPartitioner.MAX_PARTITIONS)))
        this.resultCache = new ResultCache()
    }

    // Generate the random /kill authorization token and persist it to a file that only the
    // current OS user can read, so other local users cannot discover it.
    // Written defensively for a shared tmpdir (multi-user /tmp): any pre-existing file at the
    // path is deleted first, the file is then created ATOMICALLY with owner-only permissions
    // (Files.createFile uses O_CREAT|O_EXCL, which fails on an existing file and does not
    // follow a symlink) before the token is written into it. If a foreign file or symlink
    // cannot be removed (sticky-bit /tmp), creation fails and the secret is NOT written into
    // a file another user controls: /kill from other processes is then unavailable (warned),
    // but never leaked. On Windows the ACL of the per-user %TEMP% directory protects the file.
    private static String createKillToken(File tokenFile) {
        String token = UUID.randomUUID()
        try {
            Path path = tokenFile.toPath()
            Files.deleteIfExists(path)
            if (FileSystems.default.supportedFileAttributeViews().contains('posix')) {
                Files.createFile(path, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString('rw-------')))
            } else {
                Files.createFile(path)
            }
            Files.write(path, token.getBytes('UTF-8'))
            tokenFile.deleteOnExit()
        } catch (Exception e) {
            LOGGER.warn("Unable to persist the kill token to ${tokenFile}: --killserver from other processes will not work", e)
        }
        return token
    }

    // Ping
    private HttpHandler ping() {
        return { HttpExchange http ->
            http.sendResponseHeaders(200, 0)
            http.responseHeaders.add('Content-type', 'application/json')
            http.responseBody.withWriter { out ->
                out << '{"status":"running"}'
            }
        }
    }

    // Kill server. Requires the token generated at startup: without it, any local process or
    // user could disrupt the server through the loopback interface.
    private HttpHandler kill() {
        return { HttpExchange http ->
            String providedToken = http.requestHeaders.getFirst('X-CodeNarc-Kill-Token')
            if (providedToken != this.killToken) {
                http.responseHeaders.add('Content-type', 'application/json')
                http.sendResponseHeaders(401, 0)
                http.responseBody.withWriter { out ->
                    out << '{"status":"unauthorized","errorMessage":"Missing or invalid kill token"}'
                }
                return
            }
            http.responseHeaders.add('Content-type', 'application/json')
            http.sendResponseHeaders(200, 0)
            http.responseBody.withWriter { out ->
                out << '{"status":"killed"}'
            }
            stopServer()
        }
    }

    // Request CodeNarc linting
    private HttpHandler request() {
        return { HttpExchange http ->
            // Restart idle timer
            synchronized (timerLock) {
                currentTimerTask.cancel()
                timer.purge()
                currentTimerTask = timer.runAfter(this.MAX_IDLE_TIME, { timerData ->
                    stopServer()
                })
            }

            String requestKey
            AnalysisPartitioner.RequestHandle handle = new AnalysisPartitioner.RequestHandle()
            handle.thread = Thread.currentThread()
            Response response = new Response()
            // Parse input and call CodeNarc
            try {
                http.responseHeaders.add('Content-type', 'application/json')

                // Enforce request body size limit to prevent OOM from oversized payloads
                InputStream requestBody = http.getRequestBody()
                ByteArrayOutputStream buf = new ByteArrayOutputStream()
                byte[] chunk = new byte[8192]
                long totalRead = 0
                int bytesRead
                while ((bytesRead = requestBody.read(chunk)) != -1) {
                    totalRead += bytesRead
                    if (totalRead > MAX_REQUEST_BODY_BYTES) {
                        http.sendResponseHeaders(413, 0)
                        http.responseBody.withWriter { out ->
                            out << '{"status":"error","errorMessage":"Request body too large"}'
                        }
                        return
                    }
                    buf.write(chunk, 0, bytesRead)
                }

                Request request = READER.readValue(buf.toByteArray(), Request)
                if (request.requestKey != null && request.requestKey != 'undefined') {
                    requestKey = request.requestKey
                    LOGGER.debug("requestKey: $requestKey")
                    AnalysisPartitioner.RequestHandle previous = handles.put(requestKey, handle)
                    if (previous != null) {
                        // Cancel the superseded request, including its analysis workers.
                        previous.cancelAll()
                    }
                }

                request.process(response, new LintContext(analysisPool, resultCache), handle)
            } catch (InterruptedException ie) {
                LOGGER.debug('Interrupted by duplicate')
                response.setInterrupted()
                response.cancelledWorkers = handle.cancelledCount
                // cancelAll() called Thread.interrupt() on this thread, and nothing on the
                // path back up here (listFiles/parseFiles/CodeNarc) necessarily consumed it -
                // a plain isInterrupted() check, unlike a blocking call throwing
                // InterruptedException, does not clear the flag. Clear it now: otherwise the
                // HTTP response write below runs on a thread that still looks interrupted,
                // which can make that write itself fail (observed as a connection reset),
                // costing this cancelled request its clean HTTP 444 response and making the
                // client silently retry the whole request instead of seeing status 9.
                Thread.interrupted()
            } catch (FileNotFoundException e) {
                LOGGER.debug('File not found', e.message)
                response.setNotFound(e)
            } catch (Throwable t) {
                LOGGER.error('Request failed', t)
                response.setError(t)
            }

            // cancelAll() can land at any point during processing, including after
            // Request's last isInterrupted() check - e.g. while ResultMerger.merge,
            // storeResults or JSON serialization are running. In that case the request
            // completes normally (no InterruptedException, no catch above runs) but the
            // thread's interrupt flag is still set, and writing the response below on an
            // interrupted thread reproduces the same connection-reset / silent client
            // retry that commit 93a091e set out to prevent. Clear it unconditionally here
            // so every path - success, cancellation or error - writes its response on a
            // non-interrupted thread.
            Thread.interrupted()

            try {
                http.sendResponseHeaders(response.statusCode, 0)
                http.responseBody.withWriter { out ->
                    WRITER.writeValue(out, response)
                }
            } catch (Exception e) {
                LOGGER.error('Write response', e)
            } finally {
                // Conditional removal: only drop the map entry if it is still this request's
                // own handle. An unconditional remove(requestKey) here could otherwise evict a
                // newer request's handle that has since replaced this one (this request was
                // itself cancelled and is only now unwinding), letting that newer request
                // dodge cancellation from any duplicate that arrives after this point.
                if (requestKey) {
                    handles.remove(requestKey, handle)
                }
            }
        }
    }

    // Launch HttpServer to receive CodeNarc linting request via HTTP.
    /* groovylint-disable-next-line UnusedPrivateMethod */
    private void run() {
        Supplier<String> nextRequestId = () -> Long.toString(System.nanoTime())
        List<Filter> filters = [
            new TracingFilter(nextRequestId),
            new GzipFilter(),
            new LoggingFilter(LOGGER)
        ]

        // Assign handlers.
        server.createContext('/ping', ping()).filters.addAll(filters)
        server.createContext('/kill', kill()).filters.addAll(filters)
        server.createContext('/request', request()).filters.addAll(filters)

        Runtime.runtime.addShutdownHook(new Thread(() -> {
            stopServer()
        }))

        // Set the executor and start the server.
        server.setExecutor(ex)
        server.start()
        LOGGER.info('Listening on {}:{} hit Ctrl+C to exit', server.address.address.hostAddress, server.address.port)

        // Wait for server to be stopped.
        latch.await()
    }

    private void stopServer() {
        LOGGER.info('Shutting down...')
        killTokenFile?.delete()
        timer.cancel()
        analysisPool.shutdownNow()
        ex.shutdown()
        ex.awaitTermination(1, TimeUnit.SECONDS)
        LOGGER.debug('Threads stopped')
        server.stop(1)
        LOGGER.info('Stopped')
        latch.countDown()
    }

}
