/* groovylint-disable LineLength */
/*
 * CodeNarc main class Wrapper to run a light HttpServer so next calls can have better performances
 * Auto-kills itself when maximum idle time is reached
 * @author Nicolas Vuillamy
 */
package com.nvuillam

// Java Http Server
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.io.PrintStream

// Concurrency & Timer management
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.ThreadFactory
import java.util.Timer
import java.util.TimerTask

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
        final List<String> argsList =  new ArrayList<String>()
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
        // Create a server who accepts only calls from localhost
        InetSocketAddress socketAddr = new InetSocketAddress(PORT)
        def server = HttpServer.create(socketAddr, 0)

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
            System.setOut(new StorePrintStream(System.out))
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
                def respObj = [:]
                def jsonSlurper = new JsonSlurper()
                def bodyObj = jsonSlurper.parseText(body)

                requestKey = bodyObj.requestKey
                manageRequestKey = (requestKey != null)

                if (manageRequestKey) {
                    // Cancel already running request if necessary
                    cancelConcurrentThread(requestKey)
                    // Set current thread info in  currentThreads property so it can be cancelled later
                    def thread = Thread.currentThread()
                    storeThread(requestKey, thread, ex)
                }

                // Try to parse if requested to get compilation errors
                if (bodyObj.parse == true && bodyObj.file) {
                    try {
                        new GroovyShell().parse(new File(bodyObj.file))
                        println 'PARSE SUCCESS'
                        respObj.parseErrors = []
                    }
                    catch (MultipleCompilationErrorsException ep) {
                        def excptnJsonTxt = JsonOutput.toJson(ep)
                        def compileErrors = ep.getErrorCollector().getErrors()
                        respObj.parseErrors = compileErrors
                        println 'PARSE ERROR (MultipleCompilationErrorsException)\n' + excptnJsonTxt
                    }
                    catch (CompilationFailedException ep) {
                        def excptnJsonTxt = JsonOutput.toJson(ep)
                        def compileErrors = ep.getErrorCollector().getErrors()
                        respObj.parseErrors = compileErrors
                        println 'Parse error (CompilationFailedException)\n' + excptnJsonTxt
                    }
                    catch (Exception ep) {
                        def excptnJsonTxt = JsonOutput.toJson(ep)
                        respObj.parseErrors = compileErrors
                        println 'Parse error (Other)\n' + excptnJsonTxt
                    }
                }

                // Call CodeNarc
                def codeNarcArgs = bodyObj.codeNarcArgs
                def codenarcArgsArray = codeNarcArgs.split(' ')
                this.runCodeNarc(codenarcArgsArray)
                http.responseHeaders.add('Content-type', 'application/json')
                http.sendResponseHeaders(200, 0)
                respObj.status = 'success'
                respObj.stdout =  StorePrintStream.printList.join('\n')

                // Build response
                def respJson = JsonOutput.toJson(respObj)
                http.responseBody.withWriter { out ->
                    out << respJson
                }
            } catch (InterruptedException ie) {
                def respObj = [ status:'cancelledByDuplicateRequest' ,
                                stdout:StorePrintStream.printList.join('\n'),
                                ]
                def respJson = JsonOutput.toJson(respObj)
                http.responseHeaders.add('Content-type', 'application/json')
                http.sendResponseHeaders(444 , 0)
                http.responseBody.withWriter { out ->
                    out << respJson
                }
                println 'INTERRUPTED by duplicate'
            } catch (Throwable t) {
                def respObj = [ status:'error' ,
                                errorDtl:t.getStackTrace().join('\n'),
                                stdout:StorePrintStream.printList.join('\n'),
                                exceptionType: t.getClass().getName(),
                                ]
                def respJson = JsonOutput.toJson(respObj)
                http.responseHeaders.add('Content-type', 'application/json')
                http.sendResponseHeaders(500, 0)
                http.responseBody.withWriter { out ->
                    out << respJson
                }
                println 'UNEXPECTED ERROR ' + respObj
            }
            // Remove thread info
            if (manageRequestKey && requestKey) {
                removeThread(requestKey)
                requestKey = null
                manageRequestKey = false
            }
        }

        // Create executor & start server with a timeOut if inactive
        server.setExecutor(ex);      // set up a custom executor for the server
        server.start();              // start the server
        println "LISTENING on ${this.getHostString(socketAddr)}:${PORT}, hit Ctrl+C to exit."
        currentTimerTask = timer.runAfter(this.maxIdleTime,  { timerData -> stopServer(ex, server) })
    }

    private void runCodeNarc(String[] args) {
        if (args == ['-help'] as String[]) {
            CodeNarc.main(args)
            return
        }
        CodeNarc codeNarc = new CodeNarc()
        try {
            codeNarc.execute(args)
        }
        catch (Throwable t) {
            println "ERROR in CodeNarc.execute: ${t.toString()}"
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

    private void storeThread(String requestKey, def thread, ExecutorService ex) {
        def threadName = thread.getName()
        //currentThreads.put(requestKey, [threadInstance:thread, name: threadName])
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

}

@CompileDynamic
class StorePrintStream extends PrintStream {

    static final List<String> printList = new LinkedList<String>()

    StorePrintStream(PrintStream org) {
        super(org)
    }

    @Override
    void println(String line) {
        printList.add(line)
        super.println(line)
    }

}
