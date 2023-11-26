/* groovylint-disable LineLength, TrailingComma */
/*
 * CodeNarc main class Wrapper to run a light HttpServer so next calls can have better performances
 * Auto-kills itself when maximum idle time is reached
 * @author Nicolas Vuillamy
 */
package com.nvuillam

// Java Http Server
import com.sun.net.httpserver.HttpServer
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.Filter
import com.sun.net.httpserver.HttpHandler
import java.util.function.Supplier

// Concurrency & Timer management
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

// Groovy Json Management
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

// Groovy Transform
import groovy.transform.CompileDynamic

// Groovy compilation
import org.codehaus.groovy.control.CompilationFailedException
import org.codehaus.groovy.control.MultipleCompilationErrorsException

// CodeNarc main class
import org.codenarc.CodeNarc

// Logging
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@CompileDynamic
class CodeNarcServer {

    private static final Logger LOGGER = LoggerFactory.getLogger(CodeNarcServer.name)
    private static final String REQUEST_ID_KEY = 'requestId'
    private static final int SERVER_PORT = System.getenv('SERVER_PORT') ? System.getenv('SERVER_PORT') as int : 7484
    private static final int MAX_IDLE_TIME = 3600000 // 1h
    private static final String[] HELP_ARGS = ['-help']
    private static final String[] VERSION_ARGS = ['-version']

    private final CountDownLatch latch
    private final Object lock
    private final Map<String,String> currentThreads
    private final Timer timer
    private final HttpServer server
    private final ExecutorService ex
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

        if (options.help) {
            cli.usage()
            println ''
            CodeNarc.main('-help')
            return
        }

        if (options.version) {
            CodeNarc.main('-version')
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
        runCodeNarc(options.arguments() as String[])
    }

    // Call CodeNarc directly.
    private static void runCodeNarc(String[] args) {
        if (args == VERSION_ARGS || args == HELP_ARGS) {
            // execute doesn't support help/version so redirect to main.
            CodeNarc.main(args)
            return
        }

        new CodeNarc().execute(args)
    }

    CodeNarcServer(int port) {
        // Create a server who accepts only calls from localhost ( https://stackoverflow.com/questions/50770747/how-to-configure-com-sun-net-httpserver-to-accept-only-requests-from-localhost )
        InetAddress localHost = InetAddress.getLoopbackAddress()
        InetSocketAddress sockAddr = new InetSocketAddress(localHost, port)

        this.server = HttpServer.create(sockAddr, 0)
        this.latch = new CountDownLatch(1)
        this.lock = new Object()
        this.currentThreads = new ConcurrentHashMap<String,String>()
        this.timer = new Timer()
        this.currentTimerTask = timer.runAfter(MAX_IDLE_TIME, { timerData ->
            this.stopServer()
        })
        this.ex = Executors.newCachedThreadPool()
    }

    // Request logging
    private Filter logging(Logger logger) {
        return new Filter() {

            class LogOutputStream extends OutputStream implements Closeable {

                private long written = 0
                private final OutputStream inner

                LogOutputStream(OutputStream inner) {
                    this.inner = inner
                }

                void close() {
                    inner.close()
                }

                void flush() {
                    inner.flush()
                }

                void write(byte[] b) {
                    write(b, 0, b.length)
                }

                void write(byte[] b, int off, int len) {
                    inner.write(b, off, len)
                    written += len
                }

                @Override
                void write(int b) {
                    written++
                    inner.write(b)
                }

            }

            private LogOutputStream output = null

            @Override
            void doFilter(HttpExchange http, Chain chain) throws IOException {
                try {
                    output = new LogOutputStream(http.responseBody)
                    http.setStreams(http.requestBody, output)
                    chain.doFilter(http)
                } finally {
                    // Apache Common Log Format
                    // %h %l %u [%t] "%r" %>s %b
                    String date = new Date().format('dd/MMM/yyyy:HH:mm:ss Z')
                    logger.info('{} {} {} [{}] "{} {} {}" {} {}',
                        http.remoteAddress.address.hostAddress,
                        '-',
                        '-',
                        date,
                        http.requestMethod,
                        http.requestURI.path,
                        http.protocol,
                        http.responseCode,
                        output.written,
                    )
                }
            }

            @Override
            String description() {
                return 'logging'
            }

        }
    }

    // Request tracing
    private Filter tracing(Supplier<String> nextRequestId) {
        return new Filter() {

            @Override
            void doFilter(HttpExchange http, Chain chain) throws IOException {
                String requestId = http.requestHeaders.getFirst('X-Request-Id')
                requestId ?= nextRequestId.get()
                http.setAttribute(REQUEST_ID_KEY, requestId)
                http.responseHeaders.add('X-Request-Id', requestId)
                chain.doFilter(http)
            }

            @Override
            String description() {
                return 'tracing'
            }

        }
    }

    // Ping
    private HttpHandler ping() {
        return { http ->
            http.sendResponseHeaders(200, 0)
            http.responseHeaders.add('Content-type', 'application/json')
            http.responseBody.withWriter { out ->
                out << '{"status":"running"}'
            }
        }
    }

    // Kill server
    private HttpHandler kill(Logger logger) {
        return { http ->
            http.sendResponseHeaders(200, 0)
            http.responseHeaders.add('Content-type', 'application/json')
            http.responseBody.withWriter { out ->
                out << '{"status":"killed"}'
            }
            stopServer()
        }
    }

    // Request CodeNarc linting
    private HttpHandler request(Logger logger) {
        return { http ->
            def respObj = [:]

            // Restart idle timer
            synchronized (lock) {
                currentTimerTask.cancel()
                timer.purge()
                currentTimerTask = timer.runAfter(this.MAX_IDLE_TIME, { timerData ->
                    stopServer()
                })
            }

            String requestKey
            Boolean manageRequestKey
            // Parse input and call CodeNarc
            try {
                def body = streamToString(http.getRequestBody())
                logger.trace('REQUEST BODY: {}', body)
                def jsonSlurper = new JsonSlurper()
                def bodyObj = jsonSlurper.parseText(body)

                requestKey = bodyObj.requestKey
                manageRequestKey = (requestKey != null && requestKey != 'undefined')

                if (manageRequestKey) {
                    // Cancel already running request if necessary
                    cancelConcurrentThread(requestKey)
                    // Set current thread info in  currentThreads property so it can be cancelled later
                    def thread = Thread.currentThread()
                    storeThread(requestKey, thread, ex)
                }

                // Parse files to detect parse errors
                respObj.fileList = listFiles(bodyObj)
                respObj.parseErrors = parseFiles(bodyObj, respObj.fileList)

                // Call CodeNarc
                String[] args = bodyObj.codeNarcArgs as String[]
                LOGGER.debug('Calling CodeNarc with args: {}', args)
                respObj.stdout = captureSystemOut {
                    runCodeNarc(args)
                }
                respObj.statusCode = 200
                respObj.status = 'success'
            } catch (InterruptedException ie) {
                respObj.status = 'cancelledByDuplicateRequest'
                respObj.statusCode = 444
                logger.debug('Interrupted by duplicate')
            } catch (Throwable t) {
                respObj.status = 'error'
                respObj.errorMessage = t.message
                respObj.errorDtl = t.stackTrace.join('\n')
                respObj.exceptionType =  t.class.name
                respObj.statusCode = 500
                logger.debug('Request failed', t)
            }

            // Build response
            def respJson = JsonOutput.toJson(respObj)
            http.responseHeaders.add('Content-type', 'application/json')
            http.sendResponseHeaders(respObj.statusCode, 0)
            http.responseBody.withWriter { out ->
                out << respJson
            }

            // Remove thread info
            if (manageRequestKey && requestKey) {
                removeThread(requestKey)
            }
        }
    }

    // Launch HttpServer to receive CodeNarc linting request via Http
    /* groovylint-disable-next-line UnusedPrivateMethod */
    private void run() {
        Supplier<String> nextRequestId = () -> Long.toString(System.nanoTime())
        List<Filter> filters = Arrays.asList(tracing(nextRequestId), logging(LOGGER))

        // Assign handlers.
        server.createContext('/ping', ping()).filters.addAll(filters)
        server.createContext('/kill', kill(LOGGER)).filters.addAll(filters)
        server.createContext('/request', request(LOGGER)).filters.addAll(filters)

        Runtime.runtime.addShutdownHook(new Thread(() -> {
            stopServer()
        }))

        // Create executor & start server with a timeOut if inactive
        server.setExecutor(ex)      // set up a custom executor for the server
        server.start()              // start the server
        LOGGER.info('Listening on {}:{} hit Ctrl+C to exit', server.address.address.hostAddress, server.address.port)

        // Wait for server to be stopped.
        latch.await()
    }

    // Cancel concurrent thread if existing
    private void cancelConcurrentThread(String requestKey) {
        def requestKeyCurrentThread = currentThreads.get(requestKey)
        if (requestKeyCurrentThread != null) {
            // Kill duplicate thread started previously
            Set<Thread> threads = Thread.getAllStackTraces().keySet()
            for (Thread t : threads) {
                String tName = t.getName()
                if (tName == requestKeyCurrentThread) {
                    t.interrupt()
                    t.stop()
                    currentThreads.remove(requestKey)
                    LOGGER.debug('CANCELLED duplicate thread {} requestKey: {}', tName, requestKey)
                }
            }
        }
    }

    // List files to be parsed / linted
    private List<String> listFiles(def bodyObj) {
        def fileList = []
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
            bodyObj.codeNarcExcludes = bodyObj.codeNarcExcludes ?= [] // TODO(steve): is there a simpler way to do this?
            LOGGER.debug('listFiles ant file scanner in {}, includes {}, excludes {}',
                bodyObj.codeNarcBaseDir,
                bodyObj.codeNarcIncludes,
                bodyObj.codeNarcExcludes
            )
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
        def parseErrors = [:]
        if (bodyObj.parse != true) {
            return parseErrors
        }
        // Parse collected files
        fileList.each { file ->
            parseErrors.put(file, parseFile(new File(file)))
        }
        return parseErrors
    }

    // Try to parse file to get compilation errors
    private List<Error> parseFile(File file) {
        List<Error> parseErrors = []
        try {
            LOGGER.debug('Parsing file: {}', file)
            new GroovyShell().parse(file)
            LOGGER.debug('PARSE SUCCESS: {}', file.getAbsolutePath())
        }
        catch (MultipleCompilationErrorsException ep) {
            def excptnJsonTxt = JsonOutput.toJson(ep)
            parseErrors = ep.getErrorCollector().getErrors()
            LOGGER.debug('PARSE ERROR (MultipleCompilationErrorsException): {}\n{}', file.getAbsolutePath(), excptnJsonTxt)
        }
        catch (CompilationFailedException ep) {
            def excptnJsonTxt = JsonOutput.toJson(ep)
            parseErrors = ep.getErrorCollector().getErrors()
            LOGGER.debug('PARSE ERROR (CompilationFailedException): {}\n{}', file.getAbsolutePath(), excptnJsonTxt)
        }
        catch (Exception ep) {
            def excptnJsonTxt = JsonOutput.toJson(ep)
            parseErrors = []
            LOGGER.debug('PARSE ERROR (Other): {}\n{}', ep.message, file.getAbsolutePath(), excptnJsonTxt)
        }
        return parseErrors
    }

    private void storeThread(String requestKey, def thread, ExecutorService ex) {
        def threadName = thread.getName()
        currentThreads.put(requestKey, threadName)
        LOGGER.debug('THREADS: (var {}, threadPool {})\n{}', currentThreads.size(), ex.getActiveCount(), currentThreads)
    }

    private void removeThread(String requestKey) {
        currentThreads.remove(requestKey)
    }

    private String streamToString(def stream) {
        ByteArrayOutputStream result = new ByteArrayOutputStream()
        byte[] buffer = new byte[1024]
        int length
        while ((length = stream.read(buffer)) != -1) {
            result.write(buffer, 0, length)
        }
        // StandardCharsets.UTF_8.name() > JDK 7
        return result.toString('UTF-8')
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

    private String captureSystemOut(Closure closure) {
        def originalSystemOut = System.out
        def outputStream = new ByteArrayOutputStream()
        try {
            System.out = new PrintStream(outputStream)
            closure()
        }
        finally {
            System.out = originalSystemOut
        }
        return outputStream.toString()
    }

}
