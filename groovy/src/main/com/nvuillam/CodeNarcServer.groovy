/* groovylint-disable LineLength, TrailingComma */
/*
 * CodeNarc main class Wrapper to run a light HttpServer so next calls can have better performances
 * Auto-kills itself when maximum idle time is reached
 * @author Nicolas Vuillamy
 */
package com.nvuillam

// Java Http Server
import com.sun.net.httpserver.HttpServer

// Concurrency & Timer management
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

// Ant
import org.apache.tools.ant.types.Commandline

// CodeNarc main class
import org.codenarc.CodeNarc

// Logging
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@CompileDynamic
class CodeNarcServer {

    static Map<String,String> currentThreads = new ConcurrentHashMap<String,String>()
    static final Logger logger = LoggerFactory.getLogger(CodeNarcServer.name)

    static final int SERVER_PORT = System.getenv('SERVER_PORT') ? System.getenv('SERVER_PORT') as int : 7484
    static final int maxIdleTime = 3600000 // 1h

    ExecutorService ex = Executors.newCachedThreadPool()

    /**
     * Main command-line entry-point. Run the CodeNarcServer application.
     * @param args - the String[] of command-line arguments
     */
    static void main(String[] args) {
        logger.debug('Starting args: {}', (Object)args)

        CliBuilder cli = new CliBuilder(usage: 'groovy CodeNarcServer.groovy [--help] [--server] [--port <port>]').tap {
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

        CodeNarcServer codeNarcServer = new CodeNarcServer()
        if (options.server) {
            // Initialize CodeNarc Server for later calls
            codeNarcServer.server(options.port)
            return
        }

        // Do not use server, just call CodeNarc (worse performances as Java classes must be reloaded each time)
        codeNarcServer.runCodeNarc(options.arguments() as String[])
    }

    // Launch HttpServer to receive CodeNarc linting request via Http
    /* groovylint-disable-next-line UnusedPrivateMethod */
    private void server(int port) {
        // Create a server who accepts only calls from localhost ( https://stackoverflow.com/questions/50770747/how-to-configure-com-sun-net-httpserver-to-accept-only-requests-from-localhost )
        InetAddress localHost = InetAddress.getLoopbackAddress()
        InetSocketAddress sockAddr = new InetSocketAddress(localHost, port)
        HttpServer server = HttpServer.create(sockAddr, 0)

        Timer timer = new Timer()
        TimerTask currentTimerTask

        // Ping
        server.createContext('/ping') { http ->
            logger.trace('INIT: Hit from Host: {} on port: {}', http.remoteAddress.hostName, http.remoteAddress.holder.port)
            logger.debug('PING')
            http.sendResponseHeaders(200, 0)
            http.responseHeaders.add('Content-type', 'application/json')
            http.responseBody.withWriter { out ->
                out << '{"status":"running"}'
            }
        }

        // Kill server
        server.createContext('/kill') { http ->
            logger.trace('INIT: Hit from Host: {} on port: {}', http.remoteAddress.hostName, http.remoteAddress.holder.port)
            logger.debug('shutdown started')
            http.sendResponseHeaders(200, 0)
            http.responseHeaders.add('Content-type', 'application/json')
            http.responseBody.withWriter { out ->
                out << '{"status":"killed"}'
            }
            stopServer(ex, server)
            logger.info('shutdown complete')
        }

        // Request CodeNarc linting
        server.createContext('/request') { http ->
            def respObj = [:]
            logger.trace('INIT: Hit from Host: {} on port: {}', http.remoteAddress.hostName, http.remoteAddress.holder.port)
            // Restart idle timer
            currentTimerTask.cancel()
            timer = new Timer()
            currentTimerTask = timer.runAfter(this.maxIdleTime, { timerData -> stopServer(ex, server) })
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
                def codeNarcArgs = bodyObj.codeNarcArgs
                def codenarcArgsArray = Commandline.translateCommandline(codeNarcArgs)
                respObj.stdout = captureSystemOut {
                    this.runCodeNarc(codenarcArgsArray)
                }
                respObj.statusCode = 200
                respObj.status = 'success'
            } catch (InterruptedException ie) {
                respObj.status = 'cancelledByDuplicateRequest'
                respObj.statusCode = 444
                logger.debug('Interrupted by duplicate')
            } catch (Throwable t) {
                respObj.status = 'error'
                respObj.errorMessage = t.getMessage()
                respObj.errorDtl = t.getStackTrace().join('\n')
                respObj.exceptionType =  t.getClass().getName()
                respObj.statusCode = 500
                logger.debug('Request failed {}', respObj.errorMessage)
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

        // Create executor & start server with a timeOut if inactive
        server.setExecutor(ex)      // set up a custom executor for the server
        server.start()              // start the server
        logger.info('Listening on {}:{} hit Ctrl+C to exit', this.getHostString(sockAddr), port)
        currentTimerTask = timer.runAfter(this.maxIdleTime,  { timerData -> stopServer(ex, server) })
    }

    private void runCodeNarc(String[] args) {
        CodeNarc codeNarc = new CodeNarc()
        codeNarc.execute(args)
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
                    logger.debug('CANCELLED duplicate thread {} requestKey: {}', tName, requestKey)
                }
            }
        }
    }

    // List files to be parsed / linted
    private List<String> listFiles(def bodyObj) {
        def fileList = []
        // Unique file (usually from GroovyLint Language Server)
        if (bodyObj.file) {
            File f = new File(bodyObj.file)
            fileList << f.getAbsolutePath()
        }
        else if (bodyObj.fileList) {
            for (String file in bodyObj.fileList) {
                File f = new File(file)
                fileList << f.getAbsolutePath()
            }
        }
        else if (bodyObj.codeNarcBaseDir) {
            // Ant style pattern is used: list all files
            logger.debug('Ant file scanner in {}, includes {}, excludes {}', bodyObj.codeNarcBaseDir, bodyObj.codeNarcIncludes, bodyObj.codeNarcExcludes ?: 'none')
            def ant = new groovy.ant.AntBuilder()
            def scanner = ant.fileScanner {
                fileset(dir: bodyObj.codeNarcBaseDir) {
                    bodyObj.codeNarcIncludes.split(',').each { includeExpr ->
                        include(name: includeExpr)
                    }
                    if (bodyObj.codeNarcExcludes) {
                        bodyObj.codeNarcIncludes.split(',').each { excludeExpr ->
                            exclude(name: excludeExpr)
                        }
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

    // Try to parse file  to get compilation errors
    private List<Error> parseFile(File file) {
        List<Error> parseErrors = []
        try {
            new GroovyShell().parse(file)
            logger.debug('PARSE SUCCESS: {}', file.getAbsolutePath())
        }
        catch (MultipleCompilationErrorsException ep) {
            def excptnJsonTxt = JsonOutput.toJson(ep)
            parseErrors = ep.getErrorCollector().getErrors()
            logger.debug('PARSE ERROR (MultipleCompilationErrorsException): {}\n{}', file.getAbsolutePath(), excptnJsonTxt)
        }
        catch (CompilationFailedException ep) {
            def excptnJsonTxt = JsonOutput.toJson(ep)
            parseErrors = ep.getErrorCollector().getErrors()
            logger.debug('PARSE ERROR (CompilationFailedException): {}\n{}', file.getAbsolutePath(), excptnJsonTxt)
        }
        catch (Exception ep) {
            def excptnJsonTxt = JsonOutput.toJson(ep)
            parseErrors = []
            logger.debug('PARSE ERROR (Other): {}\n{}', file.getAbsolutePath(), excptnJsonTxt)
        }
        return parseErrors
    }

    private void storeThread(String requestKey, def thread, ExecutorService ex) {
        def threadName = thread.getName()
        currentThreads.put(requestKey, threadName)
        logger.debug('THREADS: (var {}, threadPool {})\n{}', currentThreads.size(), ex.getActiveCount(), currentThreads)
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

    private void stopServer(ex, server) {
        ex.shutdown()
        // ex.awaitTermination(10, TimeUnit.MINUTES); //Seems some ghost request prevents to kill server
        server.stop(0)
        logger.info('CodeNarcServer stopped')
        System.exit(0)
    }

    private String getHostString(InetSocketAddress socketAddress) {
        InetAddress address = socketAddress.getAddress()
        if (address == null) {
            // The InetSocketAddress was specified with a string (either a numeric IP or a host name). If
            // it is a name, all IPs for that name should be tried. If it is an IP address, only that IP
            // address should be tried.
            return socketAddress.getHostName()
        }
        // The InetSocketAddress has a specific address: we should only try that address. Therefore we
        // return the address and ignore any host name that may be available.
        return address.getHostAddress()
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
