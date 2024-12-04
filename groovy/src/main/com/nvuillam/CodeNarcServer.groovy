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
import java.util.function.Supplier

// Concurrency & Timer management
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

// Groovy Json Management
import com.fasterxml.jackson.core.PrettyPrinter
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
    private static final ObjectMapper MAPPER = new ObjectMapper()
    private static final ObjectReader READER = MAPPER.reader()
    private static final ObjectWriter WRITER = MAPPER.writer((PrettyPrinter)null)

    private final CountDownLatch latch
    private final Map<String, Thread> threads
    private final HttpServer server
    private final ExecutorService ex

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
                new CodeNarcServer(options.port).run()
            } catch (java.net.BindException e) {
                LOGGER.error('Error starting server on port {}. Is another instance already running?', options.port)
            }
            return
        }

        // Do not use server, just call CodeNarc (worse performances as Java classes must be reloaded each time)
        Request request = new Request(options.parse, options.files ?: [], options.arguments())
        Response response = new Response()

        // Prevent CodeNarc from writing directly to System.out
        // as that will corrupt our JSON response.
        PrintStream originalSystemOut = System.out
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream()
        System.out = new PrintStream(outputStream)
        request.process(response)
        response.stdout = outputStream.toString()

        WRITER.writeValue(originalSystemOut, response)
    }

    CodeNarcServer(int port) {
        // Create a server who accepts only calls from localhost ( https://stackoverflow.com/questions/50770747/how-to-configure-com-sun-net-httpserver-to-accept-only-requests-from-localhost )
        InetAddress localHost = InetAddress.getLoopbackAddress()
        InetSocketAddress sockAddr = new InetSocketAddress(localHost, port)

        this.server = HttpServer.create(sockAddr, 0)
        this.latch = new CountDownLatch(1)
        this.timerLock = new Object()
        this.threads = new ConcurrentHashMap<String, Thread>()
        this.timer = new Timer()
        this.currentTimerTask = timer.runAfter(MAX_IDLE_TIME, { timerData ->
            this.stopServer()
        })
        this.ex = Executors.newCachedThreadPool()
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

    // Kill server
    private HttpHandler kill() {
        return { HttpExchange http ->
            http.sendResponseHeaders(200, 0)
            http.responseHeaders.add('Content-type', 'application/json')
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
            Response response = new Response()
            // Parse input and call CodeNarc
            try {
                http.responseHeaders.add('Content-type', 'application/json')
                Request request = READER.readValue(http.getRequestBody(), Request)
                if (request.requestKey != null && request.requestKey != 'undefined') {
                    requestKey = request.requestKey
                    LOGGER.debug("requestKey: $requestKey")
                    Thread thread = threads.put(requestKey, Thread.currentThread())
                    if (thread != null) {
                        // Cancel already running request.
                        thread.interrupt()
                    }
                }

                request.process(response)
            } catch (InterruptedException ie) {
                LOGGER.debug('Interrupted by duplicate')
                response.setInterrupted()
            } catch (FileNotFoundException e) {
                LOGGER.debug('File not found', e.message)
                response.setNotFound(e)
            } catch (Throwable t) {
                LOGGER.error('Request failed', t)
                response.setError(t)
            }

            try {
                http.sendResponseHeaders(response.statusCode, 0)
                http.responseBody.withWriter { out ->
                    WRITER.writeValue(out, response)
                }
            } catch (Exception e) {
                LOGGER.error('Write response', e)
            } finally {
                if (requestKey) {
                    threads.remove(requestKey)
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
        timer.cancel()
        ex.shutdown()
        ex.awaitTermination(1, TimeUnit.SECONDS)
        LOGGER.debug('Threads stopped')
        server.stop(1)
        LOGGER.info('Stopped')
        latch.countDown()
    }

}
