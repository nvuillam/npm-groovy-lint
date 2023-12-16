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

// Groovy compilation
import org.codehaus.groovy.control.CompilationFailedException
import org.codehaus.groovy.control.CompilerConfiguration
import org.codehaus.groovy.control.MultipleCompilationErrorsException

// CodeNarc
import org.codenarc.CodeNarc
import org.codenarc.util.CodeNarcVersion

// Logging
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@CompileDynamic
class CodeNarcServer {

    private static final Logger LOGGER = LoggerFactory.getLogger(CodeNarcServer.name)
    private static final int SERVER_PORT = System.getenv('SERVER_PORT') ? System.getenv('SERVER_PORT') as int : 7484
    private static final int MAX_IDLE_TIME = 3600000 // 1h
    private static final List<String> HELP_ARGS = ['-help']
    private static final List<String> VERSION_ARGS = ['-version']
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

        CliBuilder cli = new CliBuilder(usage: 'groovy CodeNarcServer.groovy [--help] [--server] [--version] [--port <port>]').tap {
            h(longOpt: 'help', 'Show usage information')
            s(longOpt: 'server', type: boolean, 'Runs CodeNarc as a server (default: run CodeNarc directly)')
            v(longOpt: 'version', type: boolean, 'Outputs the version of CodeNarc')
            b(longOpt: 'verbose', type: boolean, 'Enables verbose output')
            p(longOpt: 'port', type: int, defaultValue: "$SERVER_PORT", "Sets the server port (default: $SERVER_PORT)")
        }

        def options = cli.parse(args)

        if (options.help || options.arguments() == HELP_ARGS) {
            cli.usage()
            println ''
            println codeNarcHelp()
            return
        }

        if (options.version || options.arguments() == VERSION_ARGS) {
            println codeNarcVersion()
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
        new CodeNarc().execute(options.arguments() as String[])
    }

    /**
     * Returns the CodeNarc version.
     */
    private static String codeNarcVersion() {
        return "CodeNarc version ${CodeNarcVersion.getVersion()}"
    }

    /**
     * Returns CodeNarc help information.
     */
    private static String codeNarcHelp() {
        return CodeNarc.HELP
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
                Map bodyObj = READER.readValue(http.getRequestBody(), Map)
                if (bodyObj.requestKey != null && bodyObj.requestKey != 'undefined') {
                    requestKey = bodyObj.requestKey
                    LOGGER.debug("requestKey: $requestKey")
                    Thread thread = threads.put(requestKey, Thread.currentThread())
                    if (thread != null) {
                        // Cancel already running request.
                        thread.interrupt()
                    }
                }

                // Parse files to detect parse errors
                response.fileList = listFiles(bodyObj)
                response.parseErrors = parseFiles(bodyObj, response.fileList)

                if (bodyObj.codeNarcArgs == VERSION_ARGS) {
                    response.setStdout(codeNarcVersion())
                } else if (bodyObj.codeNarcArgs == HELP_ARGS) {
                    response.setStdout(codeNarcHelp())
                } else {
                    // Run CodeNarc capturing the output if needed.
                    bodyObj.codeNarcArgs.add('-plugins=com.nvuillam.CapturePlugin')
                    LOGGER.debug('Calling CodeNarc with args: {}', bodyObj.codeNarcArgs)
                    def codeNarc = new CodeNarc()
                    codeNarc.execute(bodyObj.codeNarcArgs as String[])
                    codeNarc.reports.each { reportWriter ->
                        if (!(reportWriter instanceof CapturedReportWriter)) { // groovylint-disable-line Instanceof
                            return
                        }

                        CapturedReportWriter captured = (CapturedReportWriter)reportWriter
                        if (captured.capturedClassName().toLowerCase().contains('json')) {
                            response.setJsonResult(captured.report())
                        } else {
                            LOGGER.debug('reportWriter: other')
                            response.setStdout(captured.report())
                        }
                    }
                }
            } catch (InterruptedException ie) {
                LOGGER.debug('Interrupted by duplicate')
                response.setInterrupted()
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
                LOGGER.error('Write response {}', e)
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

    // List files to be parsed / linted
    private List<String> listFiles(def bodyObj) throws FileNotFoundException {
        List<String> fileList = []
        // Unique file (usually from GroovyLint Language Server)
        if (bodyObj.file) {
            LOGGER.debug('listFiles file: {}', bodyObj.file)
            File f = new File(bodyObj.file)
            fileList << f.getAbsolutePath()
        }
        else if (bodyObj.fileList) {
            LOGGER.debug('listFiles fileList: {}', bodyObj.fileList)
            for (String file in bodyObj.fileList) {
                File f = new File(file)
                fileList << f.getAbsolutePath()
            }
        }
        else if (bodyObj.codeNarcBaseDir) {
            // Ant style pattern is used: list all files
            bodyObj.codeNarcExcludes ?= []
            LOGGER.debug('listFiles ant file scanner in {}, includes {}, excludes {}',
                bodyObj.codeNarcBaseDir,
                bodyObj.codeNarcIncludes,
                bodyObj.codeNarcExcludes
            )

            File dir = new File(bodyObj.codeNarcBaseDir)
            if (!dir.exists()) {
                // Base directory doesn't exist, throw to avoid overhead of running CodeNarc.
                throw new FileNotFoundException(bodyObj.codeNarcBaseDir)
            }

            def ant = new groovy.ant.AntBuilder()
            def scanner = ant.fileScanner {
                fileset(dir: bodyObj.codeNarcBaseDir) {
                    bodyObj.codeNarcIncludes.each { includeExpr ->
                        include(name: includeExpr)
                    }
                    bodyObj.codeNarcExcludes.each { excludeExpr ->
                        exclude(name: excludeExpr)
                    }
                }
            }

            // Parse collected files
            for (f in scanner) {
                fileList << f.getAbsolutePath()
            }
        }

        return fileList
    }

    // Parse groovy files to detect errors
    private Map<String, List<Error>> parseFiles(def bodyObj, List<String> fileList) {
        Map<String, List<Error>> parseErrors = [:]
        if (bodyObj.parse) {
            // Parse collected files.
            fileList.each { file ->
                parseErrors.put(file, parseFile(new File(file)))
            }
        }

        return parseErrors
    }

    // Try to parse file to get compilation errors
    private List<Error> parseFile(File file) {
        try {
            // We don't use GroovyShell.parse as it calls InvokerHelper.createScript
            // which fails for files which contain a class which only have non-zero
            // argument constructors.
            GroovyShell shell = new GroovyShell()
            GroovyClassLoader loader = shell.getClassLoader()
            GroovyCodeSource codeSource = new GroovyCodeSource(file, CompilerConfiguration.DEFAULT.sourceEncoding)
            loader.parseClass(codeSource, false)
            LOGGER.debug('Parse "{}" success', file.getAbsolutePath())
        }
        catch (MultipleCompilationErrorsException ep) {
            LOGGER.debug('Parse "{}" multiple compilation errors', file.getAbsolutePath())
            return ep.getErrorCollector().getErrors()
        }
        catch (CompilationFailedException ep) {
            LOGGER.debug('Parse "{}" compilation failed', file.getAbsolutePath())
            return ep.getErrorCollector().getErrors()
        }
        catch (Exception ep) {
            LOGGER.error('Parse "{}" unexpected exception:', file.getAbsolutePath(), ep)
        }

        return []
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
