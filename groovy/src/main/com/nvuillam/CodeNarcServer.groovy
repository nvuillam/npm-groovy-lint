/*
 * CodeNarc main class Wrapper to run a light HttpServer so next calls can have better performances
 * Autokills itself when maximum idle time is reached
 * @author Nicolas Vuillamy
 */
package com.nvuillam

// Java Http Server
import com.sun.net.httpserver.HttpServer
import com.sun.net.httpserver.HttpExchange
import java.net.InetAddress
import java.net.InetSocketAddress
import java.io.PrintStream

// Java Executor & Timer management
import java.util.concurrent.Executors
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.ThreadFactory
import java.util.Timer
import java.util.TimerTask

// Groovy Json Management
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

// CodeNarc main class
import org.codenarc.CodeNarc

class CodeNarcServer {

    int PORT = 7484 
    int maxIdleTime = 3600000 // 1h

    final ExecutorService ex = Executors.newSingleThreadExecutor()

    /**
     * Main command-line entry-point. Run the CodeNarcServer application.
     * @param args - the String[] of command-line arguments
     */
    static void main(String[] args) {
        println 'CodeNarcServer: '+args
        final List<String> argsList =  new ArrayList<String>()
        Collections.addAll(argsList, args); 
        CodeNarcServer codeNarcServer = new CodeNarcServer()
        // Initialize CodeNarc Server for later calls
        if (argsList.contains('--server')) {
            codeNarcServer.initialize()
        }
        // Do not use server, just call CodeNarc (worse perfs as Java classes mus be reloaded everytime)
        else  {
            codeNarcServer.runCodeNarc((String[])argsList)
        }
        return ;
    }

    // Launch HttpServer to receive CodeNarc linting request via Http
    private void initialize() {
        // Create a server who accepts only calls from localhost
        def localHost = InetAddress.localHost ;
        InetSocketAddress sockAddr = new InetSocketAddress(InetAddress.localHost, PORT);
        def server = HttpServer.create(sockAddr, 0)

        Timer timer = new Timer();
        TimerTask currentTimerTask ;
        // Ping
        server.createContext("/ping") { http ->
            http.sendResponseHeaders(200, 0)  
            http.responseHeaders.add("Content-type", "application/json")
            http.responseBody.withWriter { out ->
                out << '{"status":"running"}'
            }            
        }
        // Kill server
        server.createContext("/kill") { http ->
            println "INIT: Hit from Host: ${http.remoteAddress.hostName} on port: ${http.remoteAddress.holder.port}"
            println "Received kill CodeNarcServer request"
            stopServer(ex,server)    
            http.sendResponseHeaders(200, 0)  
            http.responseHeaders.add("Content-type", "application/json")
            http.responseBody.withWriter { out ->
                out << '{"status":"killed"}'
            }
            println "CodeNarcServer shutting down..."
        }
        // Request CodeNarc linting
        server.createContext("/") { http ->
            System.setOut(new StorePrintStream(System.out))
            println "INIT: Hit from Host: ${http.remoteAddress.hostName} on port: ${http.remoteAddress.holder.port}"
            // Restart idle timer
            currentTimerTask.cancel();
            timer = new Timer();
            currentTimerTask = timer.runAfter(this.maxIdleTime, { timerData ->
                stopServer(ex,server)
            })                
            // Parse input and call CodeNarc
            try {
                def body = streamToString(http.getRequestBody())
                println "CodeNarcServer: received ${body}"
                def jsonSlurper = new JsonSlurper()
                def bodyObj = jsonSlurper.parseText(body)
                def codeNarcArgs = bodyObj.codeNarcArgs
                def codenarcArgsArray = codeNarcArgs.split(' ') 
                def printOut = runCodeNarc(codenarcArgsArray)
                http.responseHeaders.add("Content-type", "application/json")
                http.sendResponseHeaders(200, 0)
                def respObj = [ status: 'success',
                                stdout: StorePrintStream.printList.join("\n") ]
                def respJson = JsonOutput.toJson(respObj)
                http.responseBody.withWriter { out ->
                    out << respJson
                }
            } catch (Throwable t) {
                def respObj = [ status: 'error' ,
                                errorDtl: t.getStackTrace().join("\n"),
                                stdout: StorePrintStream.printList.join("\n") ]
                def respJson = JsonOutput.toJson(respObj)
                http.responseHeaders.add("Content-type", "application/json")
                http.sendResponseHeaders(500, 0)
                http.responseBody.withWriter { out ->
                    out << respJson
                }                    
                t.printStackTrace()
            }
        }
        server.setExecutor(ex);      // set up a custom executor for the server
        server.start();              // start the server
        println "CodeNarcServer is listening on ${localHost}:${PORT}, hit Ctrl+C to exit." 
        currentTimerTask = timer.runAfter(this.maxIdleTime, { timerData ->
            stopServer(ex,server)
        })
    }

    private runCodeNarc(String[] args) {
        if (args == ['-help'] as String[]) {
            CodeNarc.main(args);
            return ;
        }
        CodeNarc codeNarc = new CodeNarc()
        try {
            codeNarc.execute(args)
        }
        catch(Throwable t) {
            println "CodeNarcServer ERROR: ${t.toString()}"
            throw t ;
        }
    }

    private streamToString(def stream) {
        ByteArrayOutputStream result = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int length;
        while ((length = stream.read(buffer)) != -1) {
            result.write(buffer, 0, length);
        }
        // StandardCharsets.UTF_8.name() > JDK 7
        return result.toString("UTF-8");        
    }

    private stopServer(ex,server) {
            ex.shutdown();
            // ex.awaitTermination(10, TimeUnit.MINUTES); //Seems some ghost request prevents to kill server
            server.stop(0);
            println("CodeNarcServer stopped");
            System.exit(0)
    }

}

class StorePrintStream extends PrintStream {

    public static List<String> printList = new LinkedList<String>();

    public StorePrintStream(PrintStream org) {
        super(org);
    }

    @Override
    public void println(String line) {
        printList.add(line);
        super.println(line);
    }
}