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

// CodeNarc main class
import org.codenarc.CodeNarc

@CompileDynamic
class CodeNarcServer {

    static Map<String,String> currentThreads = new ConcurrentHashMap<String,String>()

    int PORT = 7484
    int maxIdleTime = 3600000 // 1h

    ExecutorService ex = Executors.newCachedThreadPool()

    /**
     * Main command-line entry-point. Run the CodeNarcServer application.
     * @param args - the String[] of command-line arguments
     */
    static void main(String[] args) {
        println 'CodeNarcServer: ' + args
        final List<String> argsList =  []
        Collections.addAll(argsList, args)
        CodeNarcServer codeNarcServer = new CodeNarcServer()
        // Initialize CodeNarc Server for later calls
        if (argsList.contains('--server')) {
            codeNarcServer.initialize()
        }
        // Do not use server, just call CodeNarc (worse performances as Java classes must be reloaded each time)
        else  {
            codeNarcServer.runCodeNarc((String[])argsList)
        }
        return
    }

    // Launch HttpServer to receive CodeNarc linting request via Http
    /* groovylint-disable-next-line UnusedPrivateMethod */
    private void initialize() {
        // Create a server who accepts only calls from localhost ( https://stackoverflow.com/questions/50770747/how-to-configure-com-sun-net-httpserver-to-accept-only-requests-from-localhost )

        InetAddress localHost = InetAddress.getLoopbackAddress()
        InetSocketAddress sockAddr = new InetSocketAddress(localHost, PORT)
        HttpServer server = HttpServer.create(sockAddr, 0)

        Timer timer = new Timer()
        TimerTask currentTimerTask

        // Ping
        server.createContext('/ping') { http ->
            println "INIT: Hit from Host: ${http.remoteAddress.hostName} on port: ${http.remoteAddress.holder.port}"
            println 'PING'
            http.sendResponseHeaders(200, 0)
            http.responseHeaders.add('Content-type', 'application/json')
            http.responseBody.withWriter { out ->
                out << '{"status":"running"}'
            }
        }

        // Kill server
        server.createContext('/kill') { http ->
            println "INIT: Hit from Host: ${http.remoteAddress.hostName} on port: ${http.remoteAddress.holder.port}"
            println 'REQUEST KILL CodeNarc Server'
            stopServer(ex, server)
            http.sendResponseHeaders(200, 0)
            http.responseHeaders.add('Content-type', 'application/json')
            http.responseBody.withWriter { out ->
                out << '{"status":"killed"}'
            }
            println 'SHUT DOWN CodeNarcServer'
        }

        // Request CodeNarc linting
        server.createContext('/request') { http ->
            def respObj = [:]
            println "INIT: Hit from Host: ${http.remoteAddress.hostName} on port: ${http.remoteAddress.holder.port}"
            // Restart idle timer
            currentTimerTask.cancel()
            timer = new Timer()
            currentTimerTask = timer.runAfter(this.maxIdleTime, { timerData -> stopServer(ex, server) })
            String requestKey
            Boolean manageRequestKey
            // Parse input and call CodeNarc
            try {
                def body = streamToString(http.getRequestBody())
                println "REQUEST BODY: ${body}"
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
                def codenarcArgsArray = codeNarcArgs.split(' ')
                respObj.stdout = captureSystemOut {
                    this.runCodeNarc(codenarcArgsArray)
                }
                respObj.statusCode = 200
                respObj.status = 'success'
            } catch (InterruptedException ie) {
                respObj.status = 'cancelledByDuplicateRequest'
                respObj.statusCode = 444
                println 'INTERRUPTED by duplicate'
            } catch (Throwable t) {
                respObj.status = 'error'
                respObj.errorMessage = t.getMessage()
                respObj.errorDtl = t.getStackTrace().join('\n')
                respObj.exceptionType =  t.getClass().getName()
                respObj.statusCode = 500
                println 'UNEXPECTED ERROR ' + respObj
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
                requestKey = null
                manageRequestKey = false
            }
        }

        // Create executor & start server with a timeOut if inactive
        server.setExecutor(ex)      // set up a custom executor for the server
        server.start()              // start the server
        println "LISTENING on ${this.getHostString(sockAddr)}:${PORT}, hit Ctrl+C to exit."
        currentTimerTask = timer.runAfter(this.maxIdleTime,  { timerData -> stopServer(ex, server) })
    }

    private void runCodeNarc(String[] args) {
        if (args == ['-help'] as String[]) {
            CodeNarc.main(args)
            return
        }
        else if (args == ['-version'] as String[]) {
            CodeNarc.main(args)
            return
        }
        CodeNarc codeNarc = new CodeNarc()
        try {
            codeNarc.execute(args)
        }
        catch (Throwable t) {
            println "ERROR in CodeNarc.execute: ${t}"
            throw t
        }
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
                    println 'CANCELLED duplicate thread ' + tName + '(requestKey: ' + requestKey + ')'
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
        else if (bodyObj.codeNarcBaseDir) {
            // Ant style pattern is used: list all files
            println 'Ant file scanner in ' + bodyObj.codeNarcBaseDir + ', includes ' + bodyObj.codeNarcIncludes + ', excludes ' + ((bodyObj.codeNarcExcludes) ? bodyObj.codeNarcExcludes : 'no')
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
            println 'PARSE SUCCESS: ' + file.getAbsolutePath()
        }
        catch (MultipleCompilationErrorsException ep) {
            def excptnJsonTxt = JsonOutput.toJson(ep)
            parseErrors = ep.getErrorCollector().getErrors()
            println 'PARSE ERROR (MultipleCompilationErrorsException): ' + file.getAbsolutePath() + '\n' + excptnJsonTxt
        }
        catch (CompilationFailedException ep) {
            def excptnJsonTxt = JsonOutput.toJson(ep)
            parseErrors = ep.getErrorCollector().getErrors()
            println 'PARSE ERROR (CompilationFailedException): ' + file.getAbsolutePath() + '\n' + excptnJsonTxt
        }
        catch (Exception ep) {
            def excptnJsonTxt = JsonOutput.toJson(ep)
            parseErrors = ep.getErrorCollector().getErrors()
            println 'PARSE ERROR (Other): ' + file.getAbsolutePath() + '\n' + excptnJsonTxt
        }
        return parseErrors
    }

    private void storeThread(String requestKey, def thread, ExecutorService ex) {
        def threadName = thread.getName()
        currentThreads.put(requestKey, threadName)
        println 'THREADS: (var ' + currentThreads.size() + ', threadPool ' + ex.getActiveCount() + ')\n' + currentThreads.toString()
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
        println('CodeNarcServer stopped')
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
